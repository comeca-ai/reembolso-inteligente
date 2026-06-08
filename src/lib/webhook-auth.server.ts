/**
 * Autenticação dos webhooks públicos (server-only).
 *
 * Cada empresa tem um `webhook_token` (UUID) na tabela `companies`. Os
 * integradores (WhatsApp/Evolution, e-mail, etc.) devem enviar esse token em
 * cada chamada — assim resolvemos a empresa a partir do token, sem confiar em
 * um `company_id` vindo do corpo da requisição (evita injeção cross-tenant).
 *
 * O token pode chegar de três formas (nessa ordem de prioridade):
 *   - querystring:  ...?token=<uuid>
 *   - header:       apikey: <uuid>
 *   - header:       Authorization: Bearer <uuid>
 *
 * O sufixo `.server.ts` garante que este módulo nunca seja incluído no bundle
 * do cliente (ele importa o client admin com a service role key).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Extrai o token do webhook da requisição (query, apikey ou Bearer). */
export function extractWebhookToken(request: Request): string | null {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("token");
  if (fromQuery) return fromQuery.trim();

  const apikey = request.headers.get("apikey");
  if (apikey) return apikey.trim();

  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.replace(/^Bearer\s+/i, "").trim();
  return bearer || null;
}

/**
 * Resolve o id da empresa a partir do token do webhook.
 * Retorna null quando o token está ausente, malformado ou não corresponde a
 * nenhuma empresa — o chamador deve responder 401 nesse caso.
 */
export async function resolveCompanyByWebhookToken(
  token: string | null,
): Promise<string | null> {
  if (!token || !UUID_RE.test(token)) return null;
  const { data } = await supabaseAdmin
    .from("companies")
    .select("id")
    .eq("webhook_token", token)
    .maybeSingle();
  return data?.id ?? null;
}
