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
}

const verifyInput = z.object({ id: z.string().uuid() });

/**
 * Mapeia o `currentStatus` retornado pela Consulta Irrestrita do nfe.io
 * (authorized | canceled | unknown) para um status simples.
 */
function mapCurrentStatus(current: string | null | undefined): {
  status: NfeStatus;
  message: string;
} {
  switch (String(current ?? "").toLowerCase()) {
    case "authorized":
      return { status: "autorizada", message: "Nota autorizada pela SEFAZ." };
    case "canceled":
    case "cancelled":
      return { status: "cancelada", message: "Nota cancelada na SEFAZ." };
    case "denied":
    case "denegada":
      return {
        status: "denegada",
        message: "Uso da nota foi denegado pela SEFAZ.",
      };
    default:
      return {
        status: "inexistente",
        message: "Nota não encontrada na base nacional da SEFAZ.",
      };
  }
}

export const verifyNfe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => verifyInput.parse(input))
  .handler(async ({ data, context }): Promise<NfeVerifyResult> => {
    const { supabase } = context;

    // 1. Carrega a despesa (escopo pela RLS do usuário) e valida a chave.
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
    if (key.length !== 44) {
      return {
        status: "erro",
        message: "Esta despesa não possui uma chave DANFE válida (44 dígitos).",
        code: null,
        verifiedAt: null,
        sefazUrl: SEFAZ_PORTAL_URL,
      };
    }

    const apiKey = process.env.NFE_IO_API_KEY;

    // 2. Sem API key → fallback manual (portal SEFAZ).
    if (!apiKey) {
      return {
        status: "manual",
        message:
          "Verificação automática indisponível. Confira a chave no portal da SEFAZ.",
        code: null,
        verifiedAt: null,
        sefazUrl: SEFAZ_PORTAL_URL,
      };
    }

    // 3. Principal — Consulta Irrestrita do nfe.io pela chave de acesso.
    //    Host e header conforme a doc: Authorization recebe a chave SEM prefixo.
    let result: NfeVerifyResult;
    try {
      const resp = await fetch(
        `https://nfe.api.nfe.io/v2/productinvoices/serpro/${key}`,
        {
          method: "GET",
          headers: {
            Authorization: apiKey,
            Accept: "application/json",
          },
        },
      );

      const text = await resp.text();
      let body: unknown = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = { raw: text };
      }

      if (resp.status === 404) {
        result = {
          status: "inexistente",
          message: "Nota não encontrada na base nacional da SEFAZ.",
          code: "404",
          verifiedAt: new Date().toISOString(),
          sefazUrl: SEFAZ_PORTAL_URL,
        };
      } else if (resp.status === 401 || resp.status === 403) {
        // Chave válida porém sem o produto de consulta habilitado, ou chave
        // inválida → fallback manual, sem gravar status falso.
        return {
          status: "manual",
          message:
            "Consulta automática indisponível (produto de Consulta de NF-e não habilitado na conta nfe.io). Confira no portal da SEFAZ.",
          code: null,
          verifiedAt: null,
          sefazUrl: SEFAZ_PORTAL_URL,
        };
      } else if (!resp.ok) {
        // Outro erro do serviço → fallback manual.
        return {
          status: "manual",
          message:
            "Não foi possível consultar automaticamente agora. Confira no portal da SEFAZ.",
          code: null,
          verifiedAt: null,
          sefazUrl: SEFAZ_PORTAL_URL,
        };
      } else {
        // 200 — usa currentStatus (authorized | canceled | unknown).
        const b = (body ?? {}) as Record<string, unknown>;
        const current =
          (b.currentStatus as string | undefined) ??
          (b.status as string | undefined) ??
          null;
        const mapped = mapCurrentStatus(current);
        result = {
          ...mapped,
          code: current ? String(current) : null,
          verifiedAt: new Date().toISOString(),
          sefazUrl: SEFAZ_PORTAL_URL,
        };
      }

      // 4. Grava o resultado para histórico (best-effort).
      await supabase
        .from("inbound_reimbursements")
        .update({
          nfe_status: result.status,
          nfe_verified_at: result.verifiedAt,
          nfe_raw: body as never,
        } as never)
        .eq("id", data.id);

      return result;
    } catch (e) {
      console.error("[verifyNfe] falha ao consultar nfe.io:", e);
      return {
        status: "manual",
        message:
          "Não foi possível consultar automaticamente agora. Confira no portal da SEFAZ.",
        code: null,
        verifiedAt: null,
        sefazUrl: SEFAZ_PORTAL_URL,
      };
    }
  });
