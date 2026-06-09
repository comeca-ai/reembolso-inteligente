import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { generateObject } from "ai";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  createLovableAiGatewayProvider,
  getLovableApiKey,
} from "@/lib/ai-gateway.server";
import {
  extractWebhookToken,
  resolveCompanyByWebhookToken,
} from "@/lib/webhook-auth.server";
import { autoVerifyReimbursementNfe } from "@/lib/nfe-verify.server";

/**
 * Webhook público para receber comprovantes de reembolso.
 *
 * Autenticação: cada empresa tem um `webhook_token` (UUID). O integrador
 * (WhatsApp, e-mail, etc.) envia esse token (querystring `?token=`, header
 * `apikey` ou `Authorization: Bearer`) — é por ele que resolvemos a empresa,
 * nunca por um `company_id` vindo do corpo (evita injeção cross-tenant).
 *
 * A imagem do comprovante chega em base64 e a IA (Lovable AI) extrai valor,
 * categoria e descrição antes de gravar em inbound_reimbursements.
 *
 *   POST /api/public/reimbursements?token=<webhook_token>
 *   Body (JSON):
 *     {
 *       "image_base64": "data:image/jpeg;base64,...", // obrigatório
 *       "sender": "+5511999999999",  // opcional (telefone ou e-mail)
 *       "sender_name": "João Silva", // opcional
 *       "channel": "whatsapp",       // whatsapp | email (default whatsapp)
 *       "message": "Almoço"          // opcional (legenda enviada)
 *     }
 */

const PayloadSchema = z.object({
  image_base64: z.string().min(16).max(15_000_000),
  sender: z.string().min(1).max(320).optional(),
  sender_name: z.string().min(1).max(255).optional(),
  channel: z.enum(["whatsapp", "email"]).default("whatsapp"),
  message: z.string().max(5000).optional(),
});

const CATEGORIES = [
  "combustivel",
  "refeicao",
  "hospedagem",
  "transporte",
  "pedagio",
  "material",
  "outros",
] as const;

const ExtractionSchema = z.object({
  amount: z
    .number()
    .nullable()
    .describe("Valor total do comprovante em reais, ou null se ilegível."),
  category: z
    .enum(CATEGORIES)
    .describe("Categoria da despesa mais provável."),
  description: z
    .string()
    .max(280)
    .describe("Resumo curto do que foi a despesa (ex.: estabelecimento)."),
  danfe_key: z
    .string()
    .nullable()
    .describe(
      "Chave de acesso da NF-e/DANFE: exatamente 44 dígitos numéricos impressos no comprovante (normalmente sob o código de barras). Retorne apenas os 44 dígitos, sem espaços, ou null se não houver.",
    ),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

/** Garante que a string seja um data URL de imagem. */
function toDataUrl(input: string): string {
  if (input.startsWith("data:")) return input;
  return `data:image/jpeg;base64,${input}`;
}

export const Route = createFileRoute("/api/public/reimbursements")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: corsHeaders }),

      POST: async ({ request }) => {
        // 1. Autentica pelo webhook_token e resolve a empresa correspondente.
        const companyId = await resolveCompanyByWebhookToken(
          extractWebhookToken(request),
        );
        if (!companyId) {
          return json({ error: "Token de webhook inválido ou ausente." }, 401);
        }

        // 2. Valida o corpo
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return json({ error: "Corpo JSON inválido." }, 400);
        }

        const parsed = PayloadSchema.safeParse(raw);
        if (!parsed.success) {
          return json(
            { error: "Dados inválidos.", issues: parsed.error.flatten() },
            400,
          );
        }
        const data = parsed.data;

        // 3. IA analisa o comprovante (valor, categoria, descrição)
        const imageUrl = toDataUrl(data.image_base64);
        let amount: number | null = null;
        let category: string | null = null;
        let aiDescription: string | null = null;
        let danfeKey: string | null = null;

        try {
          const provider = createLovableAiGatewayProvider(getLovableApiKey());
          const { object } = await generateObject({
            model: provider("google/gemini-3-flash-preview"),
            schema: ExtractionSchema,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Analise este comprovante de despesa e extraia o valor total, a categoria, uma descrição curta e a chave de acesso da NF-e/DANFE (44 dígitos numéricos, geralmente sob o código de barras; use null se não houver). Responda em português.",
                  },
                  { type: "image", image: imageUrl },
                ],
              },
            ],
          });
          amount = object.amount;
          category = object.category;
          aiDescription = object.description;
          const onlyDigits = (object.danfe_key ?? "").replace(/\D/g, "");
          danfeKey = onlyDigits.length === 44 ? onlyDigits : null;
        } catch (e) {
          // Se a IA falhar, ainda gravamos a mensagem para análise manual.
          console.error("[reimbursements webhook] IA falhou:", e);
        }

        // 4. Grava a mensagem recebida
        const { data: inserted, error: insertError } = await supabaseAdmin
          .from("inbound_reimbursements")
          .insert({
            company_id: companyId,
            channel: data.channel,
            sender: data.sender ?? "desconhecido",
            sender_name: data.sender_name ?? null,
            message: data.message ?? aiDescription,
            attachment_url: imageUrl,
            amount,
            category,
            danfe_key: danfeKey,
            status: "recebido",
            raw_payload: {
              ...(raw as Record<string, unknown>),
              image_base64: "[omitido]", // já salvo em attachment_url
              ai: { amount, category, description: aiDescription, danfe_key: danfeKey },
            } as never,
          })
          .select("id, created_at")
          .single();

        if (insertError) {
          return json({ error: "Falha ao registrar a mensagem." }, 500);
        }

        // 5. Se há chave de DANFE, verifica a nota na SEFAZ automaticamente e
        // grava o resultado (tolerante a falhas — não derruba o webhook).
        let nfeStatus: string | null = null;
        if (danfeKey) {
          nfeStatus = await autoVerifyReimbursementNfe(inserted.id, danfeKey);
        }


        return json(
          {
            ok: true,
            id: inserted.id,
            received_at: inserted.created_at,
            ai: { amount, category, description: aiDescription, danfe_key: danfeKey },
          },
          201,
        );
      },
    },
  },
});
