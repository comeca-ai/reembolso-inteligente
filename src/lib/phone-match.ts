/**
 * Utilidades puras para casar remetentes (telefone) com colaboradores.
 *
 * Extraído para um módulo sem dependências de servidor para permitir testes
 * unitários e reuso entre o webhook, as funções de servidor e a UI.
 *
 * A regra de casamento compara os ÚLTIMOS 8 dígitos do telefone, tolerando
 * diferenças de DDI/DDD e de formatação (espaços, parênteses, +55, etc.).
 */

/** Mantém apenas os dígitos de um telefone para comparação robusta. */
export function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/** Telefone comparável: últimos 8 dígitos, ou "" quando há menos de 8. */
export function phoneTail(value: string | null | undefined): string {
  const digits = digitsOnly(value);
  return digits.length >= 8 ? digits.slice(-8) : "";
}

/** Indica se dois telefones se referem ao mesmo número (últimos 8 dígitos). */
export function phonesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const ta = phoneTail(a);
  const tb = phoneTail(b);
  return ta !== "" && ta === tb;
}

/**
 * Casa um remetente (telefone) com um colaborador da lista.
 * Retorna o primeiro colaborador cujo WhatsApp casa, ou null.
 */
export function matchCollaborator(
  sender: string,
  profiles: { id: string; nome: string | null; whatsapp: string | null }[],
): { id: string; nome: string } | null {
  const senderTail = phoneTail(sender);
  if (!senderTail) return null;
  const found = profiles.find((p) => phoneTail(p.whatsapp) === senderTail);
  return found ? { id: found.id, nome: found.nome ?? "Colaborador" } : null;
}
