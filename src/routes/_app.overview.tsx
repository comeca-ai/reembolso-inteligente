import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { getCurrentUser } from "@/lib/auth";
import { canAccess, landingForRole } from "@/lib/permissions";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { formatBRL, formatDateTime, criticalKindLabels, type CriticalKind } from "@/lib/api";
import { getOverviewMetrics } from "@/lib/overview.functions";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton, KpiSkeleton } from "@/components/shared/Skeletons";
import { TrustStrip } from "@/components/shared/TrustStrip";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, ChannelBadge } from "@/components/shared/StatusBadge";
import { VerdictBadge } from "@/components/shared/VerdictBadge";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Clock,
  Wallet,
  Handshake,
  Timer,
  ShieldX,
  ArrowUpRight,
  ArrowRight,
  AlertTriangle,
  Gauge,
  FileX,
  Copy,
  type LucideIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const overviewQuery = queryOptions({
  queryKey: ["overview"],
  queryFn: () => getOverviewMetrics(),
});

export const Route = createFileRoute("/_app/overview")({
  head: () => ({
    meta: [{ title: "Visão geral · reembolso.ia.br" }],
  }),
  beforeLoad: () => {
    const role = getCurrentUser()?.role;
    if (!canAccess("/overview", role)) {
      throw redirect({ to: landingForRole(role) });
    }
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(overviewQuery),
  pendingComponent: () => (
    <PageSkeleton>
      <KpiSkeleton />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="h-72 rounded-xl border bg-card shadow-[var(--shadow-card)] lg:col-span-2" />
        <div className="h-72 rounded-xl border bg-card shadow-[var(--shadow-card)]" />
      </div>
    </PageSkeleton>
  ),
  component: OverviewPage,
});

const statusColors: Record<string, string> = {
  extraindo: "bg-muted-foreground/40",
  em_analise: "bg-warning",
  aprovado: "bg-success",
  aprovado_ressalva: "bg-brand",
  recusado: "bg-destructive",
};

const criticalMeta: Record<CriticalKind, { icon: LucideIcon; tint: string }> = {
  limite: { icon: AlertTriangle, tint: "text-warning bg-warning/15" },
  confianca: { icon: Gauge, tint: "text-warning bg-warning/15" },
  sem_cnpj: { icon: FileX, tint: "text-destructive bg-destructive/15" },
  duplicidade: { icon: Copy, tint: "text-brand bg-brand/15" },
};

function OverviewPage() {
  const { data } = useSuspenseQuery(overviewQuery);

  const metrics = [
    {
      label: "Reembolsado no mês",
      value: formatBRL(data.totalReimbursedMonth),
      hint: `${data.approvedThisMonth} despesas aprovadas`,
      icon: Wallet,
      tint: "text-primary bg-primary/10",
    },
    {
      label: "Despesas em análise",
      value: String(data.inAnalysis),
      hint: "aguardando decisão",
      icon: Clock,
      tint: "text-warning bg-warning/15",
    },
    {
      label: "Tempo médio de aprovação",
      value: `${data.avgDecisionHours.toLocaleString("pt-BR")}h`,
      hint: "do envio à decisão",
      icon: Timer,
      tint: "text-brand bg-brand/10",
    },
    {
      label: "Concordância com a IA",
      value: `${data.agreementRate}%`,
      hint: "decisões alinhadas",
      icon: Handshake,
      tint: "text-success bg-success/12",
    },
    {
      label: "Recusado por política",
      value: formatBRL(data.rejectedByPolicyAmount),
      hint: "economia bloqueada",
      icon: ShieldX,
      tint: "text-destructive bg-destructive/12",
    },
  ];

  const maxCat = Math.max(1, ...data.byCategory.map((c) => c.total));
  const maxStatus = Math.max(1, ...data.byStatus.map((s) => s.count));

  return (
    <div className="animate-fade-rise space-y-8">
      <PageHeader
        eyebrow="Painel executivo"
        title="Visão geral"
        description="Acompanhe o que a IA já resolveu, o que precisa da sua decisão e a economia gerada pela política — tudo em um só lugar."
        actions={
          <Button asChild>
            <Link to="/expenses">
              Ver despesas
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <Card
              key={m.label}
              className="shadow-sm transition-shadow hover:shadow-[var(--shadow-card)]"
            >
              <CardContent className="flex h-full flex-col p-5">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${m.tint}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mt-4 truncate text-2xl font-semibold tracking-tight text-foreground tabular-nums">
                  {m.value}
                </p>
                <p className="mt-1 text-sm font-medium leading-snug text-foreground">{m.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{m.hint}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Evolução semanal + Status das despesas */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Evolução semanal</CardTitle>
            <span className="text-xs text-muted-foreground">Últimas 4 semanas</span>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.weekly} barGap={6}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="week" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
                <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" width={28} />
                <Tooltip
                  cursor={{ fill: "var(--secondary)" }}
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    fontSize: 13,
                    background: "var(--card)",
                  }}
                />
                <Bar dataKey="aprovados" name="Aprovados" fill="var(--success)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="recusados" name="Recusados" fill="var(--destructive)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Status das despesas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.byStatus.map((s) => (
              <div key={s.status} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="font-medium tabular-nums text-foreground">{s.count}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn("h-full rounded-full", statusColors[s.status] ?? "bg-primary")}
                    style={{ width: `${Math.max(6, (s.count / maxStatus) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Gastos por categoria + Pendências críticas */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Gastos por categoria</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.byCategory.slice(0, 6).map((c) => (
              <div key={c.category} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <CategoryBadge category={c.category} />
                  <span className="font-medium tabular-nums text-foreground">{formatBRL(c.total)}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${Math.max(6, (c.total / maxCat) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-sm lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Pendências críticas</CardTitle>
              <span className="rounded-full bg-destructive/12 px-2 py-0.5 text-xs font-medium tabular-nums text-destructive">
                {data.critical.length}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">Requerem atenção do aprovador</span>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="divide-y divide-border border-t border-border">
              {data.critical.map((item) => {
                const meta = criticalMeta[item.kind];
                const Icon = meta.icon;
                return (
                  <Link
                    key={item.id}
                    to="/expenses/$id"
                    params={{ id: item.id }}
                    className="flex items-center gap-3 px-6 py-3 transition-colors hover:bg-secondary/50"
                  >
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", meta.tint)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="truncate text-sm font-medium text-foreground">{item.employeeName}</p>
                        <span className="shrink-0 whitespace-nowrap rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {criticalKindLabels[item.kind]}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                    <span className="hidden whitespace-nowrap text-sm font-semibold tabular-nums text-foreground sm:block">
                      {formatBRL(item.amount)}
                    </span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                );
              })}
              {data.critical.length === 0 && (
                <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                  Nenhuma pendência crítica no momento.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Atividade recente */}
      <Card className="shadow-sm">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Atividade recente</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/expenses">
              Ver todas
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {data.recent.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="Nada por aqui ainda"
              description="Assim que sua equipe enviar comprovantes por WhatsApp ou e-mail, eles aparecem aqui em segundos."
            />
          ) : (
            <div className="divide-y divide-border border-t border-border">
              {data.recent.map((e) => (
                <Link
                  key={e.id}
                  to="/expenses/$id"
                  params={{ id: e.id }}
                  className="flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-secondary/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="truncate text-sm font-medium text-foreground">{e.employeeName}</p>
                      <ChannelBadge channel={e.channel} />
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {e.merchant} · {formatDateTime(e.submittedAt)}
                    </p>
                  </div>
                  <span className="hidden whitespace-nowrap text-sm font-semibold tabular-nums text-foreground sm:block">
                    {formatBRL(e.amount)}
                  </span>
                  <VerdictBadge verdict={e.ai.verdict} size="sm" className="hidden md:inline-flex" />
                  <StatusBadge status={e.status} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sinais de confiança */}
      <TrustStrip />
    </div>
  );
}
