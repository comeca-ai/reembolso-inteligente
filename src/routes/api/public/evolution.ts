import { createFileRoute } from "@tanstack/react-router";
import { generateObject } from "ai";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  createLovableAiGatewayProvider,
  getLovableApiKey,
} from "@/lib/ai-gateway.server";
import { resolveCompanyByWhatsappNumber } from "@/lib/webhook-auth.server";

/**
 * Webhook do Evolution API (WhatsApp).
 *
 * Cole esta URL direto na configuração de webhook da sua instância no
 * Evolution e habilite o evento `MESSAGES_UPSERT`. Recomendado também ligar
 * "Webhook Base64" para que a imagem do comprovante venha embutida.
 *
 *   URL:   POST https://reembolso-ia-br.lovable.app/api/public/evolution
 *   Sem token: a empresa é identificada pelo NÚMERO DE WHATSAPP da linha
 *   (a instância) que recebeu a mensagem. Cadastre esse número em
 *   `companies.whatsapp_number`. O número da linha vem no payload do Evolution
 *   (campos `sender` / `owner` no topo, ou `key.remoteJid` quando `fromMe`).
 *   Se nenhuma empresa tiver esse WhatsApp cadastrado, a mensagem é ignorada.
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
  category: z
    .enum(CATEGORIES)
    .nullable()
    .describe("Categoria da despesa mais provável (use 'outros' se incerto)."),
  description: z
    .string()
    .max(280)
    .nullable()
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

/** Extensão de arquivo a partir do mimetype. */
function extFromMime(mime: string): string {
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}

/**
 * Persiste o comprovante no Storage (bucket privado "comprovantes") e devolve
 * o CAMINHO do objeto (ex.: "<companyId>/2026/uuid.jpg"). Aceita data URL,
 * base64 cru ou uma URL http (que será baixada). Retorna null se falhar — nesse
 * caso a despesa ainda é gravada, só sem anexo persistido.
 */
async function uploadComprovante(
  companyId: string,
  source: string,
  mimetype: string | null,
): Promise<string | null> {
  try {
    let mime = mimetype || "image/jpeg";
    let bytes: Uint8Array | null = null;
    const trimmed = source.trim();

    if (/^https?:\/\//i.test(trimmed)) {
      const res = await fetch(trimmed);
      if (!res.ok) return null;
      mime = res.headers.get("content-type") || mime;
      bytes = new Uint8Array(await res.arrayBuffer());
    } else {
      let b64 = trimmed;
      const m = b64.match(/^data:([^;]+);base64,(.*)$/s);
      if (m) {
        mime = m[1] || mime;
        b64 = m[2];
      }
      bytes = Buffer.from(b64, "base64");
    }

    if (!bytes || bytes.length === 0) return null;

    const year = new Date().getFullYear();
    const path = `${companyId}/${year}/${crypto.randomUUID()}.${extFromMime(mime)}`;
    const { error } = await supabaseAdmin.storage
      .from("comprovantes")
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (error) {
      console.error("[evolution webhook] upload do comprovante falhou:", error);
      return null;
    }
    return path;
  } catch (e) {
    console.error("[evolution webhook] upload do comprovante exceção:", e);
    return null;
  }
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

/**
 * Descobre o número da LINHA de WhatsApp que recebeu a mensagem (a instância).
 * É a chave que identifica a empresa. O Evolution coloca esse número em
 * diferentes lugares conforme a versão; tentamos todos em ordem.
 */
function ownerNumberFromEvent(
  evt: Record<string, any> | undefined,
  data: Record<string, any> | undefined,
  key: Record<string, any> | undefined,
): string | null {
  const candidates = [
    evt?.sender,
    evt?.owner,
    evt?.instanceOwner,
    data?.owner,
    data?.instanceOwner,
    // Quando a própria conta envia (fromMe), o remetente é a linha da empresa.
    key?.fromMe === true ? key?.remoteJid : null,
  ];
  for (const c of candidates) {
    if (typeof c === "string") {
      const digits = c.replace(/\D/g, "");
      if (digits.length >= 8) return digits;
    }
  }
  return null;
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
        // 1. Lê o corpo. A empresa é resolvida por evento (pelo número de
        // WhatsApp da linha que recebeu a mensagem), não por token.
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

          // Resolve a empresa pelo número de WhatsApp da linha que recebeu
          // a mensagem (a instância). Sem cadastro, ignoramos o evento.
          const ownerNumber = ownerNumberFromEvent(evt, data, key);
          const companyId = await resolveCompanyByWhatsappNumber(ownerNumber);
          if (!companyId) {
            results.push({
              status: "ignorado",
              reason: "whatsapp da empresa não cadastrado",
            });
            continue;
          }

          const sender = phoneFromJid(key?.remoteJid);
          const senderName: string | null = data?.pushName ?? null;

          // ID único da mensagem do WhatsApp — usado para idempotência
          // (o Evolution às vezes reenvia o mesmo evento, gerando duplicados).
          const waMessageId: string | null =
            typeof key?.id === "string" && key.id.trim() ? key.id.trim() : null;

          // Se já gravamos esta mensagem para esta empresa, ignoramos (dedupe).
          if (waMessageId) {
            const { data: existing } = await supabaseAdmin
              .from("inbound_reimbursements")
              .select("id")
              .eq("company_id", companyId)
              .eq("wa_message_id", waMessageId)
              .maybeSingle();
            if (existing) {
              results.push({ status: "duplicado", id: existing.id });
              continue;
            }
          }

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

          // 3. Empresa já resolvida pelo token (acima).

          // 4. IA analisa o comprovante quando há imagem utilizável.
          let amount: number | null = null;
          let category: string | null = null;
          let aiDescription: string | null = null;
          let danfeKey: string | null = null;
          let attachmentUrl: string | null = null;
          let aiRead = false; // a IA conseguiu extrair pelo menos o valor?

          if (isUsableBase64(base64) && base64) {
            // Imagem (data URL ou http) usada apenas em memória para a IA ler.
            const imageForAi = toDataUrl(base64, mimetype);

            // Tenta ler com a IA; em caso de falha transitória, faz uma 2ª tentativa.
            for (let attempt = 1; attempt <= 2 && !aiRead; attempt++) {
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
                          text:
                            "Você é um leitor especialista de comprovantes, recibos e notas fiscais de despesa. " +
                            "Analise a imagem com atenção e extraia os campos abaixo. " +
                            "(1) amount = o VALOR TOTAL pago, como número em reais (ex.: 45.90). " +
                            "Procure por rótulos como 'TOTAL', 'VALOR TOTAL', 'VALOR A PAGAR', 'TOTAL R$' ou o maior valor em destaque. " +
                            "Use ponto como separador decimal e NÃO inclua o símbolo R$. Se realmente não houver valor legível, use null (nunca 0). " +
                            "(2) category = uma destas opções: " +
                            CATEGORIES.join(", ") +
                            " (escolha a mais provável pelo estabelecimento/itens; use 'outros' só se não houver pista). " +
                            "(3) description = um resumo curto e útil (ex.: nome do estabelecimento). " +
                            "(4) danfe_key = a CHAVE DE ACESSO da NF-e/DANFE: exatamente 44 dígitos numéricos (geralmente sob o código de barras, às vezes em grupos de 4). " +
                            "Junte todos os dígitos sem espaços. Use null se não for nota fiscal ou se a chave não estiver legível. " +
                            "Responda sempre preenchendo todos os campos.",
                        },
                        { type: "image", image: imageForAi },
                      ],
                    },
                  ],
                });
                // Trata 0 (ou negativo) como valor não lido.
                amount =
                  typeof object.amount === "number" && object.amount > 0
                    ? object.amount
                    : null;
                category = object.category ?? "outros";
                aiDescription = object.description;
                // Mantém apenas os dígitos e valida o tamanho de 44 (chave NF-e).
                const onlyDigits = (object.danfe_key ?? "").replace(/\D/g, "");
                danfeKey = onlyDigits.length === 44 ? onlyDigits : null;
                aiRead = amount !== null; // sucesso se conseguiu o valor
              } catch (e) {
                console.error(
                  `[evolution webhook] IA falhou (tentativa ${attempt}):`,
                  e,
                );
              }
            }

            // Persiste o comprovante no Storage (durável) e guarda só o caminho.
            attachmentUrl = await uploadComprovante(companyId, imageForAi, mimetype);
          }

          // Status: "recebido" quando a leitura foi ok; "pendente_leitura" quando
          // a IA não conseguiu extrair o valor (revisão manual no painel).
          const status = aiRead ? "recebido" : "pendente_leitura";

          // 5. Grava a mensagem recebida.
          const { data: inserted, error: insertError } = await supabaseAdmin
            .from("inbound_reimbursements")
            .insert({
              company_id: companyId,
              channel: "whatsapp",
              sender,
              sender_name: senderName,
              wa_message_id: waMessageId,
              message: caption ?? aiDescription,
              attachment_url: attachmentUrl,
              amount,
              category,
              danfe_key: danfeKey,
              status,
              raw_payload: {
                event: evt?.event ?? null,
                instance: evt?.instance ?? null,
                key,
                pushName: senderName,
                ai: { amount, category, description: aiDescription, danfe_key: danfeKey, read: aiRead },
              } as never,
            })
            .select("id")
            .single();

          if (insertError) {
            // Conflito do índice único = corrida com outro reenvio; trata como duplicado.
            if ((insertError as { code?: string }).code === "23505") {
              results.push({ status: "duplicado" });
              continue;
            }
            console.error("[evolution webhook] insert falhou:", insertError);
            results.push({ status: "erro", reason: "falha ao gravar" });
            continue;
          }

          results.push({ status: aiRead ? "ok" : "sem_leitura", id: inserted.id });
        }

        return json({ ok: true, results }, 200);
      },
    },
  },
});
