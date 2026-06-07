import { useState } from "react";
import { createFileRoute, Link, useRouter, notFound, Navigate } from "@tanstack/react-router";
import {
  useSuspenseQuery,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { api, formatBRL, formatDate, formatDateTime, type ExpenseStatus } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { canViewExpense } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { StatusBadge, ChannelBadge } from "@/components/shared/StatusBadge";
import { VerdictBadge } from "@/components/shared/VerdictBadge";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import { ConfidenceMeter } from "@/components/shared/Confidence";
import { RuleCheckList, RuleTrafficLight } from "@/components/shared/RuleCheck";
import {
  ArrowLeft,
  Sparkles,
  Quote,
  ThumbsUp,
  ShieldCheck,
  ThumbsDown,
  CheckCircle2,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const expenseQuery = (id: string) =>
  queryOptions({
    queryKey: ["expense", id],
    queryFn: async () => {
      const expense = await api.getExpense(id);
      if (!expense) throw notFound();
      return expense;
    },
  });

const fieldUsersQuery = queryOptions({
  queryKey: ["fieldUsers"],
  queryFn: () => api.listFieldUsers(),
});

export const Route = createFileRoute("/_app/expenses/$id")({
  head: ({ params }) => ({ meta: [{ title: `${params.id} · reembolso.ia.br` }] }),
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(expenseQuery(params.id)),
      context.queryClient.ensureQueryData(fieldUsersQuery),
    ]);
  },
  component: ExpenseDetailPage,
  notFoundComponent: () => (
    <div className="py-20 text-center">
      <p className="text-muted-foreground">Despesa não encontrada.</p>
    </div>
  ),
});

type Decision = Extract<ExpenseStatus, "aprovado" | "aprovado_ressalva" | "recusado">;

const LOW_CONFIDENCE = 0.8;

function ExpenseDetailPage() {
  const { id } = Route.useParams();
  const { data: expense } = useSuspenseQuery(expenseQuery(id));
  const { data: fieldUsers } = useSuspenseQuery(fieldUsersQuery);
  const queryClient = useQueryClient();
  const router = useRouter();
  const [note, setNote] = useState("");

  const canView = canViewExpense(expense, getCurrentUser(), fieldUsers);


  const mutation = useMutation({
    mutationFn: (decision: Decision) => api.decideExpense(id, decision, note || undefined),
    onSuccess: (updated) => {
      queryClient.setQueryData(expenseQuery(id).queryKey, updated);
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      const msg: Record<Decision, { title: string; description: string }> = {
        aprovado: {
          title: "Despesa aprovada",
          description: "Enviada para pagamento. A decisão ficou registrada na trilha de auditoria.",
        },
        aprovado_ressalva: {
          title: "Aprovada com ressalva",
          description: "Sua observação foi registrada junto à decisão para auditoria.",
        },
        recusado: {
          title: "Despesa recusada",
          description: "O colaborador será notificado com o motivo informado.",
        },
      };
      const m = msg[updated.status as Decision];
      toast.success(m.title, { description: m.description });
      router.invalidate();
    },
    onError: () => toast.error("Não foi possível registrar a decisão. Tente novamente."),
  });

  if (!expense) return null;
  if (!canView) return <Navigate to="/expenses" />;

  const decided = ["aprovado", "aprovado_ressalva", "recusado"].includes(expense.status);

  return (
    <div className="animate-fade-rise space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" asChild className="-ml-2 h-7 text-muted-foreground">
            <Link to="/expenses">
              <ArrowLeft className="h-4 w-4" />
              Despesas
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
              {expense.protocol}
            </h1>
            <StatusBadge status={expense.status} />
            <ChannelBadge channel={expense.channel} />
          </div>
          <p className="text-sm text-muted-foreground">
            {expense.employeeName} · {expense.costCenter} · enviado em {formatDateTime(expense.submittedAt)}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor solicitado</p>
          <p className="text-3xl font-semibold tabular-nums text-foreground">{formatBRL(expense.amount)}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {/* Coluna esquerda — comprovante e dados extraídos */}
        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Comprovante</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border border-border bg-secondary/40">
                <img src={expense.receiptUrl} alt={`Comprovante ${expense.protocol}`} className="w-full" />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{expense.merchant}</span>
                <span className="tabular-nums">{formatDate(expense.date)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Dados extraídos do comprovante</CardTitle>
              <p className="text-xs text-muted-foreground">
                Campos com confiança abaixo de {Math.round(LOW_CONFIDENCE * 100)}% são destacados para revisão.
              </p>
            </CardHeader>
            <CardContent className="px-0">
              <div className="divide-y divide-border border-t border-border">
                {expense.extracted.map((f) => {
                  const low = f.confidence < LOW_CONFIDENCE;
                  return (
                    <div
                      key={f.label}
                      className={cn(
                        "flex items-center justify-between gap-3 px-6 py-3",
                        low && "bg-warning/10",
                      )}
                    >
                      <span className="text-sm text-muted-foreground">{f.label}</span>
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "text-sm font-medium tabular-nums",
                            low ? "text-warning-foreground" : "text-foreground",
                          )}
                        >
                          {f.value}
                        </span>
                        <span
                          className={cn(
                            "inline-flex w-16 items-center justify-end gap-1 text-xs tabular-nums",
                            low ? "font-semibold text-warning-foreground" : "text-muted-foreground",
                          )}
                        >
                          {low && <AlertTriangle className="h-3 w-3" />}
                          {Math.round(f.confidence * 100)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Coluna direita — análise da IA, regras e decisão */}
        <div className="space-y-6">
          {/* Recomendação da IA */}
          <Card className="overflow-hidden border-brand/20 shadow-sm">
            <div className="flex items-center gap-2 bg-brand/8 px-6 py-3">
              <Sparkles className="h-4 w-4 text-brand" />
              <span className="text-sm font-semibold text-foreground">Recomendação da IA</span>
              <VerdictBadge verdict={expense.ai.verdict} size="sm" className="ml-auto" />
            </div>
            <CardContent className="space-y-5 p-6">
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Justificativa
                </h3>
                <p className="text-sm leading-relaxed text-foreground">{expense.ai.summary}</p>
              </div>
              <ConfidenceMeter confidence={expense.ai.confidence} />
              <Separator />
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Semáforo de regras</h3>
                  <RuleTrafficLight rules={expense.ai.rules} />
                </div>
                <RuleCheckList rules={expense.ai.rules} />
              </div>
            </CardContent>
          </Card>

          {/* Citações da política */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Quote className="h-4 w-4 text-brand" />
                Regras citadas da política
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {expense.ai.citations.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma cláusula citada — análise ainda em processamento.
                </p>
              )}
              {expense.ai.citations.map((c) => (
                <div key={c.clause} className="rounded-lg border border-border bg-secondary/40 p-4">
                  <span className="mb-1 inline-block rounded bg-brand/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-brand">
                    Cláusula {c.clause}
                  </span>
                  <p className="text-sm leading-relaxed text-foreground">{c.text}</p>
                </div>
              ))}
              <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
                <Link to="/policy">
                  <FileText className="h-4 w-4" />
                  Ver política completa (v3.2)
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Ações de decisão */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Decisão do aprovador</CardTitle>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-brand" />
                A IA recomenda; a aprovação final é sempre humana e fica registrada.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {decided ? (
                <div className="rounded-lg bg-secondary/50 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    Decisão registrada
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {expense.decidedBy} · {expense.decidedAt && formatDateTime(expense.decidedAt)}
                  </p>
                  {expense.decisionNote && (
                    <p className="mt-2 rounded-md bg-card p-2.5 text-sm italic text-muted-foreground">
                      “{expense.decisionNote}”
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Observação ou ressalva (opcional). Fica registrada na trilha de auditoria."
                    rows={3}
                    className="resize-none text-sm"
                  />
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Button
                      onClick={() => mutation.mutate("aprovado")}
                      disabled={mutation.isPending}
                      className="w-full bg-success text-success-foreground hover:bg-success/90"
                    >
                      <ThumbsUp className="h-4 w-4" />
                      Aprovar
                    </Button>
                    <Button
                      onClick={() => mutation.mutate("aprovado_ressalva")}
                      disabled={mutation.isPending}
                      variant="outline"
                      className="w-full border-warning/40 text-warning-foreground hover:bg-warning/10"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Aprovar com ressalva
                    </Button>
                    <Button
                      onClick={() => mutation.mutate("recusado")}
                      disabled={mutation.isPending}
                      variant="outline"
                      className="w-full border-destructive/40 text-destructive hover:bg-destructive/10"
                    >
                      <ThumbsDown className="h-4 w-4" />
                      Recusar
                    </Button>
                  </div>
                  <p className="pt-1 text-center text-xs text-muted-foreground">
                    A decisão notifica o colaborador automaticamente.
                  </p>
                </>
              )}

              <Separator className="my-2" />
              <div className="space-y-2.5 text-sm">
                <Row label="Colaborador" value={expense.employeeName} />
                <Row label="Centro de custo" value={expense.costCenter} />
                <Row label="Categoria" value={<CategoryBadge category={expense.category} />} />
                <Row label="CNPJ" value={expense.cnpj ?? "Não identificado"} />
                <Row label="Descrição" value={expense.description} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
