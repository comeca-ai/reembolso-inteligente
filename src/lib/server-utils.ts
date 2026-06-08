/**
 * Utilitários compartilhados pelas funções de servidor.
 *
 * São funções puras (sem dependências de runtime do servidor), extraídas para
 * evitar duplicação entre os convites (escapeHtml/generateTempPassword) e os
 * parsers de resposta da IA (extractJsonObject).
 */

/** Escapa caracteres especiais para interpolação segura em HTML de e-mail. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Gera uma senha temporária forte (web crypto, disponível no runtime do
 * servidor). Sem caracteres ambíguos para facilitar a digitação.
 */
export function generateTempPassword(length = 14): string {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#%*";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += charset[bytes[i] % charset.length];
  return out;
}

/**
 * Extrai e parseia o primeiro objeto JSON de um texto que pode vir com cercas
 * de código (```json ... ```) ou texto ao redor (saída típica de LLM).
 * Lança SyntaxError se o conteúdo não for JSON válido — o chamador deve tratar.
 */
export function extractJsonObject(raw: string): unknown {
  let txt = (raw ?? "").trim();
  const fence = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) txt = fence[1].trim();
  const first = txt.indexOf("{");
  const last = txt.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) txt = txt.slice(first, last + 1);
  return JSON.parse(txt);
}
