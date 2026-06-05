import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { api, formatBRL, formatDateTime } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, ChannelBadge } from "@/components/shared/StatusBadge";
import { VerdictBadge } from "@/components/shared/VerdictBadge";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import { Button } from "@/components/ui/button";
import {
  Clock,
  TrendingUp,
  Sparkles,
  Wallet,
  ArrowUpRight,
  ArrowRight,
} from "lucide-react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

const overviewQuery = queryOptions({
  queryKey: ["overview"],
  queryFn: () => api.getOverview(),
});

export const Route = createFileRoute("/_app/overview")({
  head: () => ({
    meta: [{ title: "Visão geral · reembolsa.aí" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(overviewQuery),
  component: OverviewPage,
});

function OverviewPage() {
  const { data } = useSuspenseQuery(overviewQuery);

  const metrics = [
    {
      label: "Aguardando aprovação",
      value: String(data.pending),
      hint: "comprovantes na fila",
      icon: Clock,
      tint: "text-warning-foreground bg-warning/15",
    },
    {
      label: "Reembolsado no mês",
      value: formatBRL(data.totalReimbursedMonth),
      hint: `${data.approvedThisMonth} despesas aprovadas`,
      icon: Wallet,
      tint: "text-primary bg-primary/10",
    },
    {
      label: "Aprovação automática",
      value: `${data.autoApprovalRate}%`,
      hint: "recomendadas pela IA",
      icon: Sparkles,
      tint: "text-success bg-success/12",
    },
    {
      label: "Tempo médio de decisão",
      value: `${data.avgDecisionHours.toLocaleString("pt-BR")}h`,
      hint: "do envio à aprovação",
      icon: TrendingUp,
      tint: "text-brand bg-brand/10",
    },
  ];

  const maxCat = Math.max(...data.byCategory.map((c) => c.total));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visão geral"
        description="Acompanhe a fila de aprovação e o desempenho dos reembolsos da equipe de campo."
        actions={
          <Button asChild>
            <Link to="/expenses">
              Ver despesas
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <Card key={m.label} className="shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${m.tint}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-4 text-2xl font-semibold tracking-tight text-foreground tabular-nums">
                  {m.value}
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">{m.label}</p>
                <p className="text-xs text-muted-foreground">{m.hint}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Decisões por semana</CardTitle>
            <span className="text-xs text-muted-foreground">Últimas 4 semanas</span>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
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
            <CardTitle className="text-base">Gasto por categoria</CardTitle>
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
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Recebidos recentemente</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/expenses">
              Ver todas
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="divide-y divide-border border-t border-border">
            {data.recent.map((e) => (
              <Link
                key={e.id}
                to="/expenses/$id"
                params={{ id: e.id }}
                className="flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-secondary/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{e.employeeName}</p>
                    <ChannelBadge channel={e.channel} />
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {e.merchant} · {formatDateTime(e.submittedAt)}
                  </p>
                </div>
                <span className="hidden text-sm font-semibold tabular-nums text-foreground sm:block">
                  {formatBRL(e.amount)}
                </span>
                <VerdictBadge verdict={e.ai.verdict} size="sm" className="hidden md:inline-flex" />
                <StatusBadge status={e.status} />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
