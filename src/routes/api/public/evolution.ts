import { createFileRoute } from "@tanstack/react-router";
import { generateObject } from "ai";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  createLovableAiGatewayProvider,
  getLovableApiKey,
} from "@/lib/ai-gateway.server";

/**
 * Webhook do Evolution API (WhatsApp).
 *
 * Cole esta URL direto na configuração de webhook da sua instância no
 * Evolution e habilite o evento `MESSAGES_UPSERT`. Recomendado também ligar
 * "Webhook Base64" para que a imagem do comprovante venha embutida.
 *
 *   URL:   POST https://reembolso-inteligente.lovable.app/api/public/evolution
 *   (opcional) proteção por token:
 *     - querystring:  ...?token=SEU_TOKEN
 *     - ou header:    apikey: SEU_TOKEN
 *     - ou header:    Authorization: Bearer SEU_TOKEN
 *   O token comparado é o secret DESPESAS_WEBHOOK_TOKEN (se definido).
 *
 * O Evolution envia algo como:
 *   {
 *     "event": "messages.upsert",
 *     "instance": "minha-instancia",
 *     "data": {
 *       "key": { "remoteJid": "5511999999999@s.whatsapp.net", "fromMe": false },
 *       "pushName": "João Silva",
 *       "messageType": "imageMessage",
 *       "message": {
 *         "imageMessage": { "caption": "Almoço", "mimetype": "image/jpeg" },
 *         "base64": "<imagem em base64>"
 *       }
 *     }
 *   }
 */

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
  category: z.enum(CATEGORIES).describe("Categoria da despesa mais provável."),
  description: z
    .string()
    .max(280)
    .describe("Resumo curto do que foi a despesa (ex.: estabelecimento)."),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

/** Normaliza qualquer string em data URL de imagem. */
function toDataUrl(input: string, mimetype?: string | null): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("data:")) return trimmed;
  if (trimmed.startsWith("http")) return trimmed;
  return `data:${mimetype || "image/jpeg"};base64,${trimmed}`;
}

/** A mídia do WhatsApp vem criptografada (.enc) — base64 puro não é uma URL .enc. */
function isUsableBase64(value: string | null): boolean {
  if (!value) return false;
  const v = value.trim();
  if (v.startsWith("data:")) return true;
  // URLs .enc (CDN criptografada do WhatsApp) NÃO servem para a IA.
  if (/^https?:\/\//i.test(v)) return !/\.enc(\?|$)/i.test(v);
  // Caso contrário, assumimos base64 cru (já descriptografado).
  return v.length > 100;
}

/**
 * Pede ao Evolution o base64 já DESCRIPTOGRAFADO da mídia (.enc → imagem/pdf).
 * Precisa dos secrets EVOLUTION_API_URL e EVOLUTION_API_KEY e do nome da instância.
 * Endpoint: POST /chat/getBase64FromMediaMessage/{instance}
 */
async function decryptMediaFromEvolution(
  instance: string | null | undefined,
  message: Record<string, any> | undefined,
  key: Record<string, any> | undefined,
): Promise<{ base64: string | null; mimetype: string | null }> {
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  if (!apiUrl || !apiKey || !instance) {
    return { base64: null, mimetype: null };
  }
  try {
    const base = apiUrl.replace(/\/+$/, "");
    const res = await fetch(
      `${base}/chat/getBase64FromMediaMessage/${encodeURIComponent(instance)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({
          message: { key, message },
          convertToMp4: false,
        }),
      },
    );
    if (!res.ok) {
      console.error(
        "[evolution webhook] getBase64FromMediaMessage status",
        res.status,
      );
      return { base64: null, mimetype: null };
    }
    const json = (await res.json()) as { base64?: string; mimetype?: string };
    return {
      base64: json?.base64 ?? null,
      mimetype: json?.mimetype ?? null,
    };
  } catch (e) {
    console.error("[evolution webhook] decrypt falhou:", e);
    return { base64: null, mimetype: null };
  }
}

/** Extrai o telefone (apenas dígitos + "+") de um remoteJid do WhatsApp. */
function phoneFromJid(jid: string | undefined | null): string {
  if (!jid) return "desconhecido";
  const num = jid.split("@")[0]?.split(":")[0] ?? "";
  const digits = num.replace(/\D/g, "");
  return digits ? `+${digits}` : "desconhecido";
}

/** Tenta achar a imagem em base64 em vários lugares do payload do Evolution. */
function findImageBase64(message: Record<string, any> | undefined): {
  base64: string | null;
  mimetype: string | null;
  caption: string | null;
} {
  if (!message) return { base64: null, mimetype: null, caption: null };

  const img = message.imageMessage ?? message.documentMessage ?? null;
  const caption: string | null =
    img?.caption ?? message.conversation ?? message.extendedTextMessage?.text ?? null;
  const mimetype: string | null = img?.mimetype ?? null;

  // Locais possíveis do base64 dependendo da versão/config do Evolution.
  const base64: string | null =
    message.base64 ??
    img?.base64 ??
    message.mediaBase64 ??
    img?.url ?? // às vezes vem uma URL pública
    null;

  return { base64, mimetype, caption };
}

export const Route = createFileRoute("/api/public/evolution")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: corsHeaders }),

      POST: async ({ request }) => {
        // 1. Webhook público sem token (qualquer chamada do Evolution é aceita).

        // 2. Lê o corpo.
        let raw: any;
        try {
          raw = await request.json();
        } catch {
          return json({ error: "Corpo JSON inválido." }, 400);
        }

        // Evolution pode mandar 1 objeto ou um array de eventos.
        const events: any[] = Array.isArray(raw) ? raw : [raw];

        const results: Array<{ status: string; id?: string; reason?: string }> = [];

        for (const evt of events) {
          const eventName: string = (evt?.event ?? "").toString().toLowerCase();
          // Só nos interessam mensagens recebidas.
          if (eventName && !eventName.includes("messages.upsert")) {
            results.push({ status: "ignorado", reason: `evento ${eventName}` });
            continue;
          }

          const data = evt?.data ?? evt;
          const key = data?.key ?? {};
          // Ignora mensagens enviadas por nós mesmos.
          if (key?.fromMe === true) {
            results.push({ status: "ignorado", reason: "fromMe" });
            continue;
          }

          const sender = phoneFromJid(key?.remoteJid);
          const senderName: string | null = data?.pushName ?? null;
          let { base64, mimetype } = findImageBase64(data?.message);
          const { caption } = findImageBase64(data?.message);

          // Se não veio base64 utilizável (ex.: só a URL .enc criptografada),
          // pedimos ao Evolution o conteúdo já descriptografado.
          if (!isUsableBase64(base64) && data?.message) {
            const decrypted = await decryptMediaFromEvolution(
              evt?.instance,
              data.message,
              key,
            );
            if (decrypted.base64) {
              base64 = decrypted.base64;
              mimetype = decrypted.mimetype ?? mimetype;
            }
          }

          // 3. Resolve a empresa (primeira empresa cadastrada).
          const { data: company, error: companyError } = await supabaseAdmin
            .from("companies")
            .select("id")
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          if (companyError || !company?.id) {
            results.push({ status: "erro", reason: "empresa não encontrada" });
            continue;
          }
          const companyId = company.id;

          // 4. IA analisa o comprovante quando há imagem utilizável.
          let amount: number | null = null;
          let category: string | null = null;
          let aiDescription: string | null = null;
          let attachmentUrl: string | null = null;

          if (isUsableBase64(base64) && base64) {
            attachmentUrl = toDataUrl(base64, mimetype);
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
                      { type: "image", image: attachmentUrl },
                    ],
                  },
                ],
              });
              amount = object.amount;
              category = object.category;
              aiDescription = object.description;
            } catch (e) {
              console.error("[evolution webhook] IA falhou:", e);
            }
          }

          // 5. Grava a mensagem recebida.
          const { data: inserted, error: insertError } = await supabaseAdmin
            .from("inbound_reimbursements")
            .insert({
              company_id: companyId,
              channel: "whatsapp",
              sender,
              sender_name: senderName,
              message: caption ?? aiDescription,
              attachment_url: attachmentUrl,
              amount,
              category,
              status: "recebido",
              raw_payload: {
                event: evt?.event ?? null,
                instance: evt?.instance ?? null,
                key,
                pushName: senderName,
                ai: { amount, category, description: aiDescription },
              } as never,
            })
            .select("id")
            .single();

          if (insertError) {
            console.error("[evolution webhook] insert falhou:", insertError);
            results.push({ status: "erro", reason: "falha ao gravar" });
            continue;
          }

          results.push({ status: "ok", id: inserted.id });
        }

        return json({ ok: true, results }, 200);
      },
    },
  },
});
