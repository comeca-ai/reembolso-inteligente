/**
 * Verificação automática de NF-e — núcleo server-only.
 *
 * Roda sempre que uma nota/reembolso é recebido (webhook): pega a chave da
 * DANFE (44 dígitos, já SEM espaços nem traços), consulta a situação na SEFAZ
 * (via nfe.io) e grava o resultado em `inbound_reimbursements`.
 *
 * Este arquivo é SERVER-ONLY (sufixo `.server.ts`): nunca é incluído no bundle
 * do cliente. Usa NFE_IO_API_KEY e o cliente admin do banco.
 */
import { validarChave } from "@/lib/nfe-chave";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  SEFAZ_PORTAL_URL,
  type NfeStatus,
  type NfeVerifyResult,
} from "@/lib/nfe.functions";

/** Remove tudo que não é dígito (espaços, traços, "NFe", pontos, etc.). */
export function normalizeDanfeKey(bruto: string | null | undefined): string {
  return String(bruto ?? "")
    .replace(/^nfe/i, "")
    .replace(/\D/g, "");
}

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
 * Núcleo da verificação: recebe uma chave (de qualquer formato) e consulta a
 * fonte. Não acessa o banco — é reaproveitado por `verifyNfe`/`verifyNfeKey`
 * e pela verificação automática do webhook.
 */
export async function checkKey(bruto: string): Promise<{
  result: NfeVerifyResult;
  /** Corpo bruto retornado pela fonte (para gravar histórico). */
  raw: unknown;
}> {
  // Normaliza: garante apenas os 44 dígitos, sem espaços nem traços.
  const key = normalizeDanfeKey(bruto);

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
        // Timeout defensivo: se a SEFAZ/nfe.io pendurar, não travamos o webhook.
        signal: AbortSignal.timeout(12_000),
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
    console.error("[checkKey] falha ao consultar nfe.io:", e);
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

/**
 * Verifica automaticamente a NF-e de um reembolso recém-recebido e grava o
 * resultado em `inbound_reimbursements`. Usa o cliente admin (bypassa RLS),
 * portanto só pode ser chamado de código server-only (webhooks/funções).
 *
 * É tolerante a falhas: nunca lança — qualquer erro é logado e ignorado para
 * não derrubar o fluxo de recebimento do comprovante.
 *
 * @param reimbursementId  id da linha em inbound_reimbursements
 * @param danfeKey         chave da DANFE (qualquer formato; será normalizada)
 */
export async function autoVerifyReimbursementNfe(
  reimbursementId: string,
  danfeKey: string | null | undefined,
): Promise<NfeStatus | null> {
  try {
    const key = normalizeDanfeKey(danfeKey);
    // Sem chave válida não há o que verificar na SEFAZ.
    if (key.length !== 44) return null;

    const { result, raw } = await checkKey(key);

    // Só grava quando houve consulta efetiva (verifiedAt preenchido).
    if (result.verifiedAt) {
      const { error } = await supabaseAdmin
        .from("inbound_reimbursements")
        .update({
          danfe_key: key, // garante a chave normalizada (sem espaços/traços)
          nfe_status: result.status,
          nfe_verified_at: result.verifiedAt,
          nfe_raw: raw as never,
        } as never)
        .eq("id", reimbursementId);
      if (error) {
        console.error(
          "[autoVerifyReimbursementNfe] falha ao gravar resultado:",
          error,
        );
      }
    }

    return result.status;
  } catch (e) {
    console.error("[autoVerifyReimbursementNfe] exceção:", e);
    return null;
  }
}
