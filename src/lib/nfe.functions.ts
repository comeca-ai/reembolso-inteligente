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

/**
 * Núcleo da verificação: recebe uma chave já normalizada e consulta a fonte.
 * Não acessa o banco — é reaproveitado por `verifyNfe` e `verifyNfeKey`.
 */
async function checkKey(key: string): Promise<{
  result: NfeVerifyResult;
  /** Corpo bruto retornado pela fonte (para gravar histórico). */
  raw: unknown;
}> {
  // Camada 1 — validação estrutural offline (sempre roda, não depende de rede).
  const structure = validarChave(key);

  const base = {
    code: null as string | null,
    verifiedAt: null as string | null,
    sefazUrl: SEFAZ_PORTAL_URL,
    key,
    structure,
  };

  if (key.length !== 44) {
    return {
      raw: null,
      result: {
        ...base,
        key: null,
        status: "erro",
        message: "Chave DANFE inválida — precisa ter 44 dígitos.",
        source: "Validação local",
      },
    };
  }

  const apiKey = process.env.NFE_IO_API_KEY;

  // Sem API key → fallback manual (portal SEFAZ).
  if (!apiKey) {
    return {
      raw: null,
      result: {
        ...base,
        status: "manual",
        message:
          "Verificação automática indisponível. Confira a chave no portal da SEFAZ.",
        source: "SEFAZ · conferência manual",
      },
    };
  }

  // Principal — Consulta Irrestrita do nfe.io pela chave de acesso.
  try {
    const resp = await fetch(
      `https://nfe.api.nfe.io/v2/productinvoices/serpro/${key}`,
      {
        method: "GET",
        headers: { Authorization: apiKey, Accept: "application/json" },
      },
    );

    const text = await resp.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { raw: text };
    }

    const nfeIoSource = "nfe.io · SERPRO/SEFAZ";

    if (resp.status === 404) {
      return {
        raw: body,
        result: {
          ...base,
          status: "inexistente",
          message: "Nota não encontrada na base nacional da SEFAZ.",
          code: "404",
          verifiedAt: new Date().toISOString(),
          source: nfeIoSource,
        },
      };
    }

    if (resp.status === 401 || resp.status === 403) {
      // Chave válida porém sem o produto de consulta habilitado, ou chave
      // inválida → fallback manual, sem gravar status falso.
      return {
        raw: body,
        result: {
          ...base,
          status: "manual",
          message:
            "Consulta automática indisponível (produto de Consulta de NF-e não habilitado na conta nfe.io). Confira no portal da SEFAZ.",
          source: "SEFAZ · conferência manual",
        },
      };
    }

    if (!resp.ok) {
      return {
        raw: body,
        result: {
          ...base,
          status: "manual",
          message:
            "Não foi possível consultar automaticamente agora. Confira no portal da SEFAZ.",
          source: "SEFAZ · conferência manual",
        },
      };
    }

    // 200 — usa currentStatus (authorized | canceled | unknown).
    const b = (body ?? {}) as Record<string, unknown>;
    const current =
      (b.currentStatus as string | undefined) ??
      (b.status as string | undefined) ??
      null;
    const mapped = mapCurrentStatus(current);
    return {
      raw: body,
      result: {
        ...base,
        ...mapped,
        code: current ? String(current) : null,
        verifiedAt: new Date().toISOString(),
        source: nfeIoSource,
      },
    };
  } catch (e) {
    console.error("[verifyNfe] falha ao consultar nfe.io:", e);
    return {
      raw: null,
      result: {
        ...base,
        status: "manual",
        message:
          "Não foi possível consultar automaticamente agora. Confira no portal da SEFAZ.",
        source: "SEFAZ · conferência manual",
      },
    };
  }
}

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
    const { result } = await checkKey(key);
    return result;
  });
