import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { generateObject } from "ai";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  createLovableAiGatewayProvider,
  getLovableApiKey,
} from "@/lib/ai-gateway.server";

/**
 * Webhook público e simples para receber comprovantes de reembolso.
 *
 * Sem autenticação: o integrador (WhatsApp, e-mail, etc.) envia a imagem do
 * comprovante em base64 e a IA (Lovable AI) extrai valor, categoria e uma
 * descrição automaticamente antes de gravar em inbound_reimbursements.
 *
 *   POST /api/public/reimbursements
 *   Body (JSON):
 *     {
 *       "image_base64": "data:image/jpeg;base64,...", // obrigatório
 *       "sender": "+5511999999999",  // opcional (telefone ou e-mail)
 *       "sender_name": "João Silva", // opcional
 *       "channel": "whatsapp",       // whatsapp | email (default whatsapp)
 *       "message": "Almoço",         // opcional (legenda enviada)
 *       "company_id": "uuid"         // opcional (usa a 1ª empresa se ausente)
 *     }
 */

const PayloadSchema = z.object({
  image_base64: z.string().min(16).max(15_000_000),
  sender: z.string().min(1).max(320).optional(),
  sender_name: z.string().min(1).max(255).optional(),
  channel: z.enum(["whatsapp", "email"]).default("whatsapp"),
  message: z.string().max(5000).optional(),
  company_id: z.string().uuid().optional(),
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
        // 1. Valida o corpo
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

        // 2. Resolve a empresa: usa o company_id informado ou a primeira empresa.
        let companyId = data.company_id ?? null;
        if (!companyId) {
          const { data: company, error: companyError } = await supabaseAdmin
            .from("companies")
            .select("id")
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          if (companyError) {
            return json({ error: "Erro ao resolver a empresa." }, 500);
          }
          companyId = company?.id ?? null;
        }
        if (!companyId) {
          return json({ error: "Nenhuma empresa encontrada." }, 400);
        }

        // 3. IA analisa o comprovante (valor, categoria, descrição)
        const imageUrl = toDataUrl(data.image_base64);
        let amount: number | null = null;
        let category: string | null = null;
        let aiDescription: string | null = null;

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
                    text: "Analise este comprovante de despesa e extraia o valor total, a categoria e uma descrição curta. Responda em português.",
                  },
                  { type: "image", image: imageUrl },
                ],
              },
            ],
          });
          amount = object.amount;
          category = object.category;
          aiDescription = object.description;
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
            status: "recebido",
            raw_payload: {
              ...(raw as Record<string, unknown>),
              image_base64: "[omitido]", // já salvo em attachment_url
              ai: { amount, category, description: aiDescription },
            } as never,
          })
          .select("id, created_at")
          .single();

        if (insertError) {
          return json({ error: "Falha ao registrar a mensagem." }, 500);
        }

        return json(
          {
            ok: true,
            id: inserted.id,
            received_at: inserted.created_at,
            ai: { amount, category, description: aiDescription },
          },
          201,
        );
      },
    },
  },
});
