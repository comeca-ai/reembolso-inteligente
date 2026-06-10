import { generateObject } from "ai";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  createLovableAiGatewayProvider,
  getLovableApiKey,
} from "@/lib/ai-gateway.server";
import { resolveCompanyBySenderWhatsapp } from "@/lib/webhook-auth.server";
import { autoVerifyReimbursementNfe } from "@/lib/nfe-verify.server";

/**
 * Lógica compartilhada do webhook do Whapi.Cloud.
 *
 * IMPORTANTE — por que existe uma rota splat: o Whapi NÃO posta no caminho
 * exato configurado. Ele ANEXA o nome do evento como subcaminho. Se a URL é
 * `.../api/public/whapi`, o Whapi chama:
 *   POST .../api/public/whapi/messages
 *   POST .../api/public/whapi/chats
 *   POST .../api/public/whapi/statuses   etc.
 * Por isso a rota é um splat (`/api/public/whapi/$`) e também o caminho exato.
 * Só processamos quando há `messages: [...]`; os demais eventos são aceitos
 * com 200 e ignorados (para o Whapi não ficar reenviando).
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

export const whapiCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, PATCH, PUT, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, apikey, X-Webhook-Token",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...whapiCorsHeaders },
  });
}

/** Normaliza qualquer string em data URL de imagem. */
function toDataUrl(input: string, mimetype?: string | null): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("data:")) return trimmed;
  if (trimmed.startsWith("http")) return trimmed;
  return `data:${mimetype || "image/jpeg"};base64,${trimmed}`;
}

/** Extensão de arquivo a partir do mimetype. */
function extFromMime(mime: string): string {
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}

/** Extrai o token de segurança da requisição (query, Bearer ou header). */
function extractToken(request: Request): string | null {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("token");
  if (fromQuery) return fromQuery.trim();

  const custom = request.headers.get("x-webhook-token");
  if (custom) return custom.trim();

  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.replace(/^Bearer\s+/i, "").trim();
  return bearer || null;
}

/**
 * Baixa a mídia do link do Whapi (já descriptografado). Tenta o link direto
 * e, se exigir autenticação, repete com o Bearer do WHAPI_TOKEN.
 */
async function downloadWhapiMedia(
  link: string,
  mimeHint: string | null,
): Promise<{ bytes: Uint8Array; mime: string } | null> {
  const tryFetch = async (withAuth: boolean) => {
    const headers: Record<string, string> = {};
    const token = process.env.WHAPI_TOKEN;
    if (withAuth && token) headers.Authorization = `Bearer ${token}`;
    return fetch(link, { headers, signal: AbortSignal.timeout(20_000) });
  };
  try {
    let res = await tryFetch(false);
    if ((res.status === 401 || res.status === 403) && process.env.WHAPI_TOKEN) {
      res = await tryFetch(true);
    }
    if (!res.ok) {
      console.error("[whapi webhook] download de mídia status", res.status);
      return null;
    }
    const mime = res.headers.get("content-type") || mimeHint || "image/jpeg";
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length === 0) return null;
    return { bytes, mime };
  } catch (e) {
    console.error("[whapi webhook] download de mídia exceção:", e);
    return null;
  }
}

/**
 * Persiste o comprovante no Storage (bucket privado "comprovantes") e devolve
 * o CAMINHO do objeto. Retorna null se falhar.
 */
async function uploadComprovante(
  companyId: string,
  bytes: Uint8Array,
  mime: string,
): Promise<string | null> {
  try {
    const year = new Date().getFullYear();
    const path = `${companyId}/${year}/${crypto.randomUUID()}.${extFromMime(mime)}`;
    const { error } = await supabaseAdmin.storage
      .from("comprovantes")
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (error) {
      console.error("[whapi webhook] upload do comprovante falhou:", error);
      return null;
    }
    return path;
  } catch (e) {
    console.error("[whapi webhook] upload do comprovante exceção:", e);
    return null;
  }
}

/** Telefone (apenas dígitos + "+") a partir de um `from`/`chat_id` do Whapi. */
function phoneFrom(value: string | undefined | null): string {
  if (!value) return "desconhecido";
  const num = value.split("@")[0]?.split(":")[0] ?? "";
  const digits = num.replace(/\D/g, "");
  return digits ? `+${digits}` : "desconhecido";
}

/** Extrai mídia + legenda de uma mensagem do Whapi (image/document). */
function extractMedia(msg: Record<string, any>): {
  link: string | null;
  mimetype: string | null;
  caption: string | null;
} {
  const media = msg.image ?? msg.document ?? null;
  const caption: string | null =
    media?.caption ??
    msg.text?.body ??
    (typeof msg.text === "string" ? msg.text : null) ??
    null;
  return {
    link: media?.link ?? null,
    mimetype: media?.mime_type ?? null,
    caption,
  };
}

/** Trata uma requisição do webhook do Whapi e devolve a Response. */
export async function handleWhapiWebhook(request: Request): Promise<Response> {
  // 1. Segurança: valida o token quando o secret está definido.
  const expected = process.env.WHAPI_WEBHOOK_TOKEN;
  if (expected) {
    const provided = extractToken(request);
    if (!provided || provided !== expected) {
      return json({ error: "Token inválido." }, 401);
    }
  }

  // 2. Lê o corpo.
  let raw: any;
  try {
    raw = await request.json();
  } catch {
    // Eventos sem corpo JSON (ex.: verificação) — aceita e ignora.
    return json({ ok: true, ignored: "sem corpo" }, 200);
  }

  // O Whapi envia `messages: [...]` no evento de mensagens. Outros eventos
  // (chats, statuses, etc.) NÃO trazem `messages` — aceitamos e ignoramos.
  const messages: any[] = Array.isArray(raw?.messages) ? raw.messages : [];
  if (messages.length === 0) {
    return json(
      { ok: true, ignored: raw?.event?.type ?? "sem mensagens" },
      200,
    );
  }

  const results: Array<{ status: string; id?: string; reason?: string }> = [];

  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;

    const logDebug = async (reason: string, resolvedCompany: string | null) => {
      try {
        await supabaseAdmin.from("webhook_debug").insert({
          source: "whapi",
          event_name: raw?.event?.event ?? raw?.event?.type ?? null,
          instance: raw?.channel_id ?? null,
          owner_number: msg?.from ?? null,
          resolved_company: resolvedCompany,
          reason,
          payload: {
            type: msg?.type ?? null,
            from: msg?.from ?? null,
            from_me: msg?.from_me ?? null,
            chat_id: msg?.chat_id ?? null,
            from_name: msg?.from_name ?? null,
            hasImage: !!msg?.image,
            hasDocument: !!msg?.document,
          } as never,
        });
      } catch (e) {
        console.error("[whapi webhook] debug log falhou:", e);
      }
    };

    // Ignora mensagens enviadas por nós mesmos.
    if (msg?.from_me === true) {
      await logDebug("fromMe", null);
      results.push({ status: "ignorado", reason: "fromMe" });
      continue;
    }

    // Telefone de quem ENVIOU o comprovante (o colaborador).
    const sender = phoneFrom(msg?.from ?? msg?.chat_id);
    const senderName: string | null = msg?.from_name ?? null;

    // Resolve a empresa pelo telefone do remetente (perfil cadastrado).
    const companyId = await resolveCompanyBySenderWhatsapp(sender);
    if (!companyId) {
      console.warn("[whapi webhook] empresa não resolvida. sender=", sender);
      await logDebug("empresa não resolvida", null);
      results.push({
        status: "ignorado",
        reason: "colaborador (whatsapp) não cadastrado em nenhuma empresa",
      });
      continue;
    }

    await logDebug("empresa resolvida", companyId);

    // Idempotência: o Whapi pode reenviar o mesmo evento.
    const waMessageId: string | null =
      typeof msg?.id === "string" && msg.id.trim() ? msg.id.trim() : null;
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

    const { link, mimetype, caption } = extractMedia(msg);

    // Baixa a mídia (link já descriptografado pelo Whapi).
    let media: { bytes: Uint8Array; mime: string } | null = null;
    if (link) {
      media = await downloadWhapiMedia(link, mimetype);
    }

    // 3. IA analisa o comprovante quando há imagem.
    let amount: number | null = null;
    let category: string | null = null;
    let aiDescription: string | null = null;
    let danfeKey: string | null = null;
    let attachmentUrl: string | null = null;
    let aiRead = false;

    if (media) {
      const b64 = Buffer.from(media.bytes).toString("base64");
      const imageForAi = toDataUrl(b64, media.mime);

      for (let attempt = 1; attempt <= 2 && !aiRead; attempt++) {
        try {
          const provider = createLovableAiGatewayProvider(getLovableApiKey());
          const { object } = await generateObject({
            model: provider("google/gemini-3-flash-preview"),
            schema: ExtractionSchema,
            abortSignal: AbortSignal.timeout(30_000),
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
          amount =
            typeof object.amount === "number" && object.amount > 0
              ? object.amount
              : null;
          category = object.category ?? "outros";
          aiDescription = object.description;
          const onlyDigits = (object.danfe_key ?? "").replace(/\D/g, "");
          danfeKey = onlyDigits.length === 44 ? onlyDigits : null;
          aiRead = amount !== null;
        } catch (e) {
          console.error(
            `[whapi webhook] IA falhou (tentativa ${attempt}):`,
            e,
          );
        }
      }

      // Persiste o comprovante no Storage (durável).
      attachmentUrl = await uploadComprovante(companyId, media.bytes, media.mime);
    }

    const status = aiRead ? "recebido" : "pendente_leitura";

    // 4. Grava a mensagem recebida.
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
          provider: "whapi",
          event: raw?.event ?? null,
          channel_id: raw?.channel_id ?? null,
          message_id: waMessageId,
          pushName: senderName,
          ai: {
            amount,
            category,
            description: aiDescription,
            danfe_key: danfeKey,
            read: aiRead,
          },
        } as never,
      })
      .select("id")
      .single();

    if (insertError) {
      if ((insertError as { code?: string }).code === "23505") {
        results.push({ status: "duplicado" });
        continue;
      }
      console.error("[whapi webhook] insert falhou:", insertError);
      results.push({ status: "erro", reason: "falha ao gravar" });
      continue;
    }

    // 5. Verificação automática da NF-e na SEFAZ.
    if (danfeKey) {
      await autoVerifyReimbursementNfe(inserted.id, danfeKey);
    }

    results.push({ status: aiRead ? "ok" : "sem_leitura", id: inserted.id });
  }

  return json({ ok: true, results }, 200);
}
