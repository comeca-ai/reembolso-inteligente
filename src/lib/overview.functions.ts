/**
 * Função de servidor para a Visão Geral (painel executivo).
 *
 * Calcula as métricas do dashboard a partir dos DADOS REAIS recebidos via
 * webhook (`inbound_reimbursements`), respeitando a RLS por empresa/colaborador.
 *
 * Antes, a Visão Geral usava dados de demonstração (mock). Agora consome o
 * mesmo backend que a página de Reembolsos recebidos.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { matchCollaborator } from "@/lib/phone-match";
import type {
  OverviewMetrics,
  ExpenseCategory,
  ExpenseStatus,
  Verdict,
  CriticalKind,
} from "@/lib/api";

// Rótulos locais (evita importar a camada de mock no bundle do servidor).
const categoryLabels: Record<ExpenseCategory, string> = {
  combustivel: "Combustível",
  refeicao: "Refeição",
  hospedagem: "Hospedagem",
  transporte: "Transporte",
  pedagio: "Pedágio",
  material: "Material",
  outros: "Outros",
};

const statusLabels: Record<ExpenseStatus, string> = {
  pendente: "Pendente",
  extraindo: "Extraindo",
  em_analise: "Em análise",
  aprovado: "Aprovada",
  aprovado_ressalva: "Parcial",
  recusado: "Recusada",
};

/** Mapeia o texto livre de categoria para uma categoria conhecida. */
function normalizeCategory(raw: string | null): ExpenseCategory {
  const c = (raw ?? "").toLowerCase();
  if (/combust|gasolina|álcool|alcool|etanol|diesel|posto/.test(c)) return "combustivel";
  if (/refei|aliment|restaurante|almoç|almoc|jantar|lanche|comida/.test(c)) return "refeicao";
  if (/hosped|hotel|pousada|diária|diaria/.test(c)) return "hospedagem";
  if (/transp|uber|99|táxi|taxi|passagem|ônibus|onibus|metrô|metro/.test(c)) return "transporte";
  if (/pedág|pedag|sem parar|veloe/.test(c)) return "pedagio";
  if (/material|papel|escrit|ferrament|peça|peca/.test(c)) return "material";
  return "outros";
}

type Row = {
  id: string;
  channel: string;
  sender: string;
  sender_name: string | null;
  message: string | null;
  amount: number | null;
  category: string | null;
  status: string;
  created_at: string;
  policy_verdict: string | null;
  policy_summary: string | null;
  policy_confidence: number | null;
  policy_analyzed_at: string | null;
};

function toVerdict(raw: string | null): Verdict | null {
  return raw === "aprovar" || raw === "revisar" || raw === "recusar" ? raw : null;
}

/** Status do fluxo interno → status visual da despesa, conforme o veredito. */
function rowStatus(row: Row): ExpenseStatus {
  const verdict = toVerdict(row.policy_verdict);
  if (verdict === "aprovar") return "aprovado";
  if (verdict === "revisar") return "aprovado_ressalva";
  if (verdict === "recusar") return "recusado";
  if (row.status === "arquivado") return "recusado";
  if (row.status === "processado") return "aprovado";
  return "em_analise";
}

export const getOverviewMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OverviewMetrics> => {
    const { supabase } = context;

    const { data: rowsData, error } = await supabase
      .from("inbound_reimbursements")
      .select(
        "id, channel, sender, sender_name, message, amount, category, status, created_at, policy_verdict, policy_summary, policy_confidence, policy_analyzed_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    const rows = (rowsData ?? []) as Row[];

    // Colaboradores para casar o remetente pelo telefone/e-mail.
    const { data: collaborators } = await supabase
      .from("profiles")
      .select("id, nome, whatsapp");
    const collabList = (collaborators ?? []) as {
      id: string;
      nome: string | null;
      whatsapp: string | null;
    }[];

    const senderName = (row: Row): string => {
      const match = matchCollaborator(row.sender, collabList);
      return match?.nome ?? row.sender_name ?? row.sender;
    };

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const approved = rows.filter((r) => toVerdict(r.policy_verdict) === "aprovar");
    const rejected = rows.filter((r) => toVerdict(r.policy_verdict) === "recusar");
    const analyzed = rows.filter((r) => r.policy_analyzed_at !== null);

    const approvedThisMonth = approved.filter(
      (r) => new Date(r.created_at) >= monthStart,
    );
    const totalReimbursedMonth = approvedThisMonth.reduce(
      (s, r) => s + Number(r.amount ?? 0),
      0,
    );
    const rejectedByPolicyAmount = rejected.reduce(
      (s, r) => s + Number(r.amount ?? 0),
      0,
    );

    const inAnalysis = rows.filter(
      (r) => r.policy_analyzed_at === null && r.status !== "arquivado",
    ).length;
    const pending = rows.filter(
      (r) => r.status === "recebido" || r.status === "em_analise",
    ).length;

    // Tempo médio de análise (recebimento → análise da IA), em horas.
    const decisionHours = analyzed
      .map(
        (r) =>
          (new Date(r.policy_analyzed_at as string).getTime() -
            new Date(r.created_at).getTime()) /
          36e5,
      )
      .filter((h) => h >= 0);
    const avgDecisionHours = decisionHours.length
      ? Math.round(
          (decisionHours.reduce((s, h) => s + h, 0) / decisionHours.length) * 10,
        ) / 10
      : 0;

    // Cobertura de análise da IA (proxy de "concordância").
    const agreementRate = rows.length
      ? Math.round((analyzed.length / rows.length) * 100)
      : 0;
    const autoApprovable = approved.length;
    const flaggedForReview = rows.filter(
      (r) => toVerdict(r.policy_verdict) === "revisar",
    ).length;

    // Por categoria.
    const catMap = new Map<ExpenseCategory, { total: number; count: number }>();
    for (const r of rows) {
      const cat = normalizeCategory(r.category);
      const cur = catMap.get(cat) ?? { total: 0, count: 0 };
      cur.total += Number(r.amount ?? 0);
      cur.count += 1;
      catMap.set(cat, cur);
    }
    const byCategory = Array.from(catMap.entries())
      .map(([category, v]) => ({ category, label: categoryLabels[category], ...v }))
      .sort((a, b) => b.total - a.total);

    // Por status.
    const statusOrder: ExpenseStatus[] = [
      "extraindo",
      "em_analise",
      "aprovado",
      "aprovado_ressalva",
      "recusado",
    ];
    const byStatus = statusOrder
      .map((status) => ({
        status,
        label: statusLabels[status],
        count: rows.filter((r) => rowStatus(r) === status).length,
      }))
      .filter((s) => s.count > 0);

    // Evolução das últimas 4 semanas.
    const weekly = [3, 2, 1, 0].map((offset, idx) => {
      const end = new Date(now);
      end.setDate(end.getDate() - offset * 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 7);
      const inWeek = rows.filter((r) => {
        const d = new Date(r.created_at);
        return d > start && d <= end;
      });
      return {
        week: `Sem ${idx + 1}`,
        aprovados: inWeek.filter((r) => toVerdict(r.policy_verdict) === "aprovar").length,
        recusados: inWeek.filter((r) => toVerdict(r.policy_verdict) === "recusar").length,
      };
    });

    // Atividade recente (5 últimos) no formato consumido pela UI.
    const recent = rows.slice(0, 5).map((r) => ({
      id: r.id,
      protocol: r.id.slice(0, 8).toUpperCase(),
      employeeId: "",
      employeeName: senderName(r),
      category: normalizeCategory(r.category),
      merchant: r.message?.slice(0, 40) || "Comprovante recebido",
      description: r.message ?? "",
      amount: Number(r.amount ?? 0),
      date: r.created_at,
      submittedAt: r.created_at,
      channel: (r.channel === "email" ? "email" : "whatsapp") as "email" | "whatsapp",
      status: rowStatus(r),
      receiptUrl: "",
      extracted: [],
      costCenter: "—",
      ai: {
        verdict: toVerdict(r.policy_verdict) ?? "revisar",
        confidence: Number(r.policy_confidence ?? 0),
        summary: r.policy_summary ?? "",
        rules: [],
        citations: [],
      },
    }));

    // Pendências críticas — itens que exigem atenção do aprovador.
    const critical = rows
      .map((r) => {
        const verdict = toVerdict(r.policy_verdict);
        const conf = r.policy_confidence;
        let kind: CriticalKind | null = null;
        let detail = "";
        if (verdict === "recusar") {
          kind = "limite";
          detail = r.policy_summary ?? "Fora da política de reembolso.";
        } else if (verdict === "revisar") {
          kind = "confianca";
          detail = r.policy_summary ?? "Comprovante marcado para revisão.";
        } else if (conf !== null && conf < 0.6) {
          kind = "confianca";
          detail = `Confiança da análise em ${Math.round(conf * 100)}%.`;
        } else if (r.amount === null && r.policy_analyzed_at === null) {
          kind = "sem_cnpj";
          detail = "Comprovante sem valor identificado.";
        }
        if (!kind) return null;
        return {
          id: r.id,
          protocol: r.id.slice(0, 8).toUpperCase(),
          employeeName: senderName(r),
          amount: Number(r.amount ?? 0),
          kind,
          detail,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .slice(0, 8);

    return {
      pending,
      inAnalysis,
      approvedThisMonth: approvedThisMonth.length,
      totalReimbursedMonth,
      avgDecisionHours,
      autoApprovalRate: rows.length
        ? Math.round((autoApprovable / rows.length) * 100)
        : 0,
      agreementRate,
      rejectedByPolicyAmount,
      flaggedForReview,
      byCategory,
      byStatus,
      weekly,
      recent,
      critical,
    };
  });
