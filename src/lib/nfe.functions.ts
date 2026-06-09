/**
 * Verificação de autenticidade de NF-e (DANFE) já emitida.
 *
 * Estratégia:
 *   1. Principal — consulta a chave de acesso (44 dígitos) no nfe.io, que
 *      devolve a situação da nota na SEFAZ (autorizada/cancelada/...).
 *   2. Fallback — se o nfe.io não estiver configurado ou falhar, retornamos
 *      `status: "manual"` com a URL do portal oficial da SEFAZ para o usuário
 *      conferir manualmente (o portal tem captcha e não permite automação).
 *
 * A API Key do nfe.io fica no secret NFE_IO_API_KEY (nunca no código).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { validarChave, type NfeChaveResultado } from "@/lib/nfe-chave";

/** Portal nacional de consulta pública de NF-e (resumo, com captcha). */
export const SEFAZ_PORTAL_URL =
  "https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx";

export type NfeStatus =
  | "autorizada"
  | "cancelada"
  | "denegada"
  | "inexistente"
  | "erro"
  | "manual";

export interface NfeVerifyResult {
  status: NfeStatus;
  /** Mensagem amigável em português para exibir ao usuário. */
  message: string;
  /** Código de situação (cStat) quando disponível. */
  code: string | null;
  /** Data/hora da verificação (ISO) quando gravada. */
  verifiedAt: string | null;
  /** URL do portal SEFAZ para conferência manual (sempre presente). */
  sefazUrl: string;
  /** Fonte onde a situação foi conferida (ex.: "nfe.io · SERPRO/SEFAZ"). */
  source: string;
  /** Chave consultada (44 dígitos), quando válida. */
  key: string | null;
  /** Validação estrutural offline (camada 1) — sempre presente. */
  structure: NfeChaveResultado;
}

const verifyInput = z.object({ id: z.string().uuid() });
const verifyKeyInput = z.object({
  key: z.string().min(40).max(60),
});

// O núcleo da verificação (`checkKey`) vive em `nfe-verify.server.ts` (server-only)
// e é compartilhado com a verificação AUTOMÁTICA disparada nos webhooks de
// recebimento. Importamos dinamicamente dentro dos handlers para que o módulo
// server-only nunca vaze para o bundle do cliente.

export const verifyNfe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => verifyInput.parse(input))
  .handler(async ({ data, context }): Promise<NfeVerifyResult> => {
    const { supabase } = context;

    // Carrega a despesa (escopo pela RLS do usuário) e valida a chave.
    const { data: row, error: rowErr } = await supabase
      .from("inbound_reimbursements")
      .select("id, danfe_key")
      .eq("id", data.id)
      .single();
    if (rowErr) throw rowErr;

    const key = String((row as { danfe_key?: string }).danfe_key ?? "").replace(
      /\D/g,
      "",
    );

    const { checkKey } = await import("@/lib/nfe-verify.server");
    const { result, raw } = await checkKey(key);

    // Grava o resultado para histórico apenas quando houve consulta efetiva.
    if (result.verifiedAt) {
      await supabase
        .from("inbound_reimbursements")
        .update({
          nfe_status: result.status,
          nfe_verified_at: result.verifiedAt,
          nfe_raw: raw as never,
        } as never)
        .eq("id", data.id);
    }

    return result;
  });

/**
 * Verificação avulsa por chave — para testar qualquer DANFE sem precisar de
 * uma despesa cadastrada. Não grava nada no banco.
 */
export const verifyNfeKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => verifyKeyInput.parse(input))
  .handler(async ({ data }): Promise<NfeVerifyResult> => {
    const key = String(data.key ?? "").replace(/\D/g, "");
    const { checkKey } = await import("@/lib/nfe-verify.server");
    const { result } = await checkKey(key);
    return result;
  });
