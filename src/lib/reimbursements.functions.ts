/**
 * Funções de servidor para os reembolsos recebidos via webhook.
 *
 * - getReimbursementsConfig: token do webhook da empresa (admin) + mensagens recebidas.
 * - updateReimbursementStatus: muda o status de uma mensagem recebida.
 *
 * O webhook em si vive em src/routes/api/public/reimbursements.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText } from "ai";
import {
  createLovableAiGatewayProvider,
  getLovableApiKey,
} from "@/lib/ai-gateway.server";
import { matchCollaborator } from "@/lib/phone-match";

export interface InboundReimbursementDTO {
  id: string;
  channel: string;
  sender: string;
  senderName: string | null;
  message: string | null;
  attachmentUrl: string | null;
  amount: number | null;
  category: string | null;
  status: string;
  createdAt: string;
  /** Nome do colaborador casado pelo número de telefone (ou null). */
  collaboratorName: string | null;
  /** Id do perfil do colaborador casado pelo telefone (ou null). */
  collaboratorId: string | null;
  /** Observação da IA sobre conformidade com a política. */
  policyVerdict: "aprovar" | "revisar" | "recusar" | null;
  policySummary: string | null;
  policyCitedRule: string | null;
  policyConfidence: number | null;
  policyAnalyzedAt: string | null;
}



export interface ReimbursementsConfig {
  webhookToken: string | null;
  isAdmin: boolean;
  messages: InboundReimbursementDTO[];
}

function mapRow(
  row: {
    id: string;
    channel: string;
    sender: string;
    sender_name: string | null;
    message: string | null;
    attachment_url: string | null;
    amount: number | null;
    category: string | null;
    status: string;
    created_at: string;
    policy_verdict?: string | null;
    policy_summary?: string | null;
    policy_cited_rule?: string | null;
    policy_confidence?: number | null;
    policy_analyzed_at?: string | null;
  },
  collaborators: { id: string; nome: string | null; whatsapp: string | null }[],
): InboundReimbursementDTO {
  const match = matchCollaborator(row.sender, collaborators);
  const verdict =
    row.policy_verdict === "aprovar" ||
    row.policy_verdict === "revisar" ||
    row.policy_verdict === "recusar"
      ? row.policy_verdict
      : null;
  return {
    id: row.id,
    channel: row.channel,
    sender: row.sender,
    senderName: row.sender_name,
    message: row.message,
    attachmentUrl: row.attachment_url,
    amount: row.amount === null ? null : Number(row.amount),
    category: row.category,
    status: row.status,
    createdAt: row.created_at,
    collaboratorName: match?.nome ?? null,
    collaboratorId: match?.id ?? null,
    policyVerdict: verdict,
    policySummary: row.policy_summary ?? null,
    policyCitedRule: row.policy_cited_rule ?? null,
    policyConfidence:
      row.policy_confidence === null || row.policy_confidence === undefined
        ? null
        : Number(row.policy_confidence),
    policyAnalyzedAt: row.policy_analyzed_at ?? null,
  };
}

export const getReimbursementsConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReimbursementsConfig> => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    const companyId = profile?.company_id;

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");

    let webhookToken: string | null = null;
    if (isAdmin && companyId) {
      const { data: company } = await supabase
        .from("companies")
        .select("webhook_token")
        .eq("id", companyId)
        .maybeSingle();
      webhookToken = (company?.webhook_token as string | undefined) ?? null;
    }

    const { data: rows, error } = await supabase
      .from("inbound_reimbursements")
      .select(
        "id, channel, sender, sender_name, message, attachment_url, amount, category, status, created_at, policy_verdict, policy_summary, policy_cited_rule, policy_confidence, policy_analyzed_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;

    // Colaboradores da empresa para casar o comprovante pelo telefone.
    const { data: collaborators } = await supabase
      .from("profiles")
      .select("id, nome, whatsapp");

    return {
      webhookToken,
      isAdmin,
      messages: (rows ?? []).map((row) => mapRow(row, collaborators ?? [])),
    };
  });

const statusInput = z.object({
  id: z.string().uuid(),
  status: z.enum(["recebido", "em_analise", "processado", "arquivado"]),
});

export const updateReimbursementStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => statusInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Escopo defensivo por empresa (além da RLS).
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.company_id) throw new Error("Empresa não encontrada.");
    const { error } = await supabase
      .from("inbound_reimbursements")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("company_id", profile.company_id);
    if (error) throw error;
    return { ok: true, id: data.id, status: data.status };
  });

// ---------------------------------------------------------------------------
// Análise da IA: o comprovante recebido está em linha com a política?
// ---------------------------------------------------------------------------

const analyzeInput = z.object({ id: z.string().uuid() });

function extractJsonObject(raw: string): any {
  let txt = (raw ?? "").trim();
  const fence = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) txt = fence[1].trim();
  const first = txt.indexOf("{");
  const last = txt.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) txt = txt.slice(first, last + 1);
  return JSON.parse(txt);
}

export interface ReimbursementAnalysis {
  verdict: "aprovar" | "revisar" | "recusar";
  summary: string;
  citedRule: string;
  confidence: number;
}

export const analyzeReimbursement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => analyzeInput.parse(input))
  .handler(async ({ data, context }): Promise<ReimbursementAnalysis> => {
    const { supabase } = context;

    const { data: row, error: rowErr } = await supabase
      .from("inbound_reimbursements")
      .select("id, sender, sender_name, message, amount, category, created_at")
      .eq("id", data.id)
      .single();
    if (rowErr) throw rowErr;

    // Regras da política ativa (escopo pela RLS do usuário).
    const { data: active } = await supabase
      .from("policies")
      .select("id")
      .eq("active", true)
      .maybeSingle();

    let rulesText = "";
    if (active) {
      const { data: rules } = await supabase
        .from("policy_rules")
        .select("code, title, category, rule_limit, rule_basis, rule_text")
        .eq("policy_id", active.id)
        .order("code");
      rulesText = (rules ?? [])
        .map(
          (r) =>
            `- [${r.code}] ${r.title} (categoria: ${r.category}; limite: ${r.rule_limit || "n/d"}; base: ${r.rule_basis || "n/d"}): ${r.rule_text}`,
        )
        .join("\n");
    }

    let analysis: ReimbursementAnalysis;

    if (!rulesText) {
      analysis = {
        verdict: "revisar",
        summary:
          "Nenhuma política ativa com regras extraídas. Publique a política para a IA avaliar automaticamente.",
        citedRule: "",
        confidence: 0.3,
      };
    } else {
      const gateway = createLovableAiGatewayProvider(getLovableApiKey());
      const { text } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        messages: [
          {
            role: "user",
            content:
              "Você avalia comprovantes de reembolso recebidos contra a política da empresa. " +
              "Regras vigentes:\n" +
              rulesText +
              "\n\nComprovante recebido:\n" +
              `- Remetente: ${row.sender_name || row.sender}\n` +
              `- Categoria: ${row.category || "n/d"}\n` +
              `- Valor: ${row.amount === null ? "n/d" : `R$ ${Number(row.amount).toFixed(2)}`}\n` +
              `- Data: ${row.created_at || "n/d"}\n` +
              `- Mensagem/descrição: ${row.message || "n/d"}\n\n` +
              "Decida se o comprovante está EM LINHA com a política. " +
              "verdict = 'aprovar' (em linha), 'revisar' (parcial/dúvida) ou 'recusar' (fora da política). " +
              "Em summary, explique em 1-2 frases, em português do Brasil, por que está ou não em linha. " +
              "citedRule = código da cláusula que justifica. Responda APENAS com JSON válido no formato: " +
              '{ "verdict": "aprovar|revisar|recusar", "summary": string, "citedRule": string, "confidence": 0.8 }.',
          },
        ],
      });
      const parsed = extractJsonObject(text);
      const v = String(parsed?.verdict ?? "revisar");
      analysis = {
        verdict:
          v === "aprovar" || v === "revisar" || v === "recusar"
            ? (v as ReimbursementAnalysis["verdict"])
            : "revisar",
        summary: String(parsed?.summary ?? "Comprovante marcado para revisão."),
        citedRule: String(parsed?.citedRule ?? ""),
        confidence: Math.min(1, Math.max(0, Number(parsed?.confidence ?? 0.5))),
      };
    }

    const { data: updated, error: updErr } = await supabase
      .from("inbound_reimbursements")
      .update({
        policy_verdict: analysis.verdict,
        policy_summary: analysis.summary,
        policy_cited_rule: analysis.citedRule,
        policy_confidence: analysis.confidence,
        policy_analyzed_at: new Date().toISOString(),
      } as never)
      .eq("id", data.id)
      .select("id");
    if (updErr) throw updErr;
    if (!updated || updated.length === 0) {
      throw new Error(
        "Sem permissão para gravar a análise. Apenas administradores e aprovadores podem analisar.",
      );
    }

    return analysis;
  });
