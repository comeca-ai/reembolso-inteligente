/**
 * Pipeline de COMPLIANCE de nota fiscal — tipos + server function.
 *
 * Roda, "uma a uma", três habilidades adaptadas deste projeto sobre um
 * comprovante já recebido:
 *
 *   1. triagem-nota-fiscal  → estrutura/completude (chave + leitura do documento)
 *   2. verifica-nota-sefaz  → situação real na SEFAZ (autorizada/cancelada/...)
 *   3. recibo-foto-de-foto  → forense de imagem (score de "foto de foto" 0–10)
 *
 * O núcleo server-only vive em `compliance.server.ts` e é importado
 * dinamicamente dentro do handler para nunca vazar no bundle do cliente.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Status de cada etapa e do veredito geral. */
export type ComplianceStatus =
  | "ok"
  | "alerta"
  | "violado"
  | "manual"
  | "pendente";

export type ComplianceStepId = "triagem" | "sefaz" | "foto";

export interface ComplianceStep {
  id: ComplianceStepId;
  /** Nome da skill correspondente. */
  skill: string;
  label: string;
  status: ComplianceStatus;
  /** Score próprio da etapa (triagem 0–100; foto 0–10; SEFAZ null). */
  score: number | null;
  /** Resumo curto em português. */
  summary: string;
  /** Evidências/observações listadas. */
  details: string[];
}

export interface ComplianceReport {
  overall: ComplianceStatus;
  steps: ComplianceStep[];
  evaluatedAt: string;
}

const evaluateInput = z.object({ id: z.string().uuid() });

export const evaluateCompliance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => evaluateInput.parse(input))
  .handler(async ({ data, context }): Promise<ComplianceReport> => {
    const { supabase } = context;

    // Carrega o comprovante (escopo pela RLS do usuário).
    const { data: row, error } = await supabase
      .from("inbound_reimbursements")
      .select("id, danfe_key, attachment_url, amount")
      .eq("id", data.id)
      .single();
    if (error) throw error;

    const { runCompliancePipeline } = await import("@/lib/compliance.server");
    return runCompliancePipeline({
      id: (row as { id: string }).id,
      danfeKey: (row as { danfe_key?: string | null }).danfe_key ?? null,
      attachmentUrl:
        (row as { attachment_url?: string | null }).attachment_url ?? null,
      amount: (row as { amount?: number | null }).amount ?? null,
    });
  });
