import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { getCurrentUser } from "@/lib/auth";
import { canAccess, landingForRole } from "@/lib/permissions";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { api, formatBRL, type OverviewMetrics } from "@/lib/api";
import { buildReportHtml } from "@/lib/report-html";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Download,
  FileSpreadsheet,
  FileCode2,
  CheckCircle2,
  Wallet,
  Timer,
  Handshake,
  ShieldX,
  Sparkles,
  Gauge,
  Info,
  LayoutDashboard,
  PieChart as PieIcon,
  TrendingUp,
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const overviewQuery = queryOptions({ queryKey: ["overview"], queryFn: () => api.getOverview() });

const CHART_COLORS = [
  "var(--brand)",
  "var(--primary)",
  "var(--warning)",
  "var(--success)",
  "#6366f1",
  "#ec4899",
  "#3b82f6",
  "#8b5cf6",
];

export const Route = createFileRoute("/_app/reports")({
  head: () => ({ meta: [{ title: "Relatórios · reembolso.ia.br" }] }),
  beforeLoad: () => {
    const role = getCurrentUser()?.role;
    if (!canAccess("/reports", role)) {
      throw redirect({ to: landingForRole(role) });
    }
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(overviewQuery),
  component: ReportsPage,
});

function ReportsPage() {
  const { data } = useSuspenseQuery(overviewQuery);
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState<string | null>(null);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const { fileName, content, rows } = await api.exportReportCsv();
      const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8;" });
      triggerDownload(blob, fileName);
      setLastExport(fileName);
      toast.success("Relatório CSV exportado", {
        description: `${rows} lançamentos em ${fileName}, com vereditos da IA e decisões humanas.`,
      });
    } finally {
      setExporting(false);
    }
  };

  const handleExportHtml = () => {
    const html = buildReportHtml(data);
    const stamp = new Date().toISOString().slice(0, 10);
    const fileName = `dashboard-reembolsos-${stamp}.html`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
    triggerDownload(blob, fileName);
    setLastExport(fileName);
    toast.success("Dashboard HTML gerado", {
      description: `${fileName} — abra no navegador, navegue pelas seções ou salve em PDF.`,
    });
  };

  const cats = data.byCategory as OverviewMetrics["byCategory"];
  const totalGeral = cats.reduce((s, c) => s + c.total, 0) || 1;
  const totalLanc = cats.reduce((s, c) => s + c.count, 0);
  const maxStatus = Math.max(1, ...data.byStatus.map((s) => s.count));
  const topCat = cats[0];

  const kpis: Array<{
    label: string;
    value: string;
    hint: string;
    explain: string;
    icon: LucideIcon;
    tint: string;
  }> = [
    {
      label: "Reembolsado no mês",
      value: formatBRL(data.totalReimbursedMonth),
      hint: `${data.approvedThisMonth} aprovadas`,
      explain: "Soma dos valores de todas as despesas aprovadas no período atual.",
      icon: Wallet,
      tint: "text-primary bg-primary/10",
    },
    {
      label: "Aprovação automática",
      value: `${data.autoApprovalRate}%`,
      hint: "elegíveis sem revisão",
      explain:
        "Percentual de despesas que a IA considerou totalmente dentro da política e que poderiam ser aprovadas sem intervenção humana.",
      icon: Sparkles,
      tint: "text-brand bg-brand/10",
    },
    {
      label: "Concordância com a IA",
      value: `${data.agreementRate}%`,
      hint: "decisões alinhadas",
      explain:
        "Das despesas já decididas, quantas a decisão humana coincidiu com o veredito recomendado pela IA.",
      icon: Handshake,
      tint: "text-success bg-success/12",
    },
    {
      label: "Tempo médio",
      value: `${data.avgDecisionHours.toLocaleString("pt-BR")}h`,
      hint: "do envio à decisão",
      explain: "Tempo médio entre o envio do comprovante e a decisão final (aprovação ou recusa).",
      icon: Timer,
      tint: "text-warning bg-warning/15",
    },
    {
      label: "Recusado por política",
      value: formatBRL(data.rejectedByPolicyAmount),
      hint: "economia bloqueada",
      explain: "Valor total das despesas recusadas por estarem fora das regras da política vigente.",
      icon: ShieldX,
      tint: "text-destructive bg-destructive/12",
    },
  ];

  const insights = [
    topCat
      ? `Categoria líder: ${topCat.label} (${formatBRL(topCat.total)}, ${Math.round((topCat.total / totalGeral) * 100)}% do total).`
      : "Sem despesas no período.",
    `${data.autoApprovalRate}% das despesas seriam aprovadas automaticamente pela IA.`,
    `A política bloqueou ${formatBRL(data.rejectedByPolicyAmount)} fora das regras.`,
    `${data.flaggedForReview} despesas foram sinalizadas para revisão manual.`,
  ];

  const tabs = [
    { value: "overview", label: "Visão geral", icon: LayoutDashboard },
    { value: "categories", label: "Categorias", icon: PieIcon },
    { value: "evolution", label: "Evolução", icon: TrendingUp },
    { value: "insights", label: "Insights & Auditoria", icon: ListChecks },
  ];

  return (
    <TooltipProvider delayDuration={150}>
      <div className="animate-fade-rise space-y-8">
        <PageHeader
          eyebrow="Fechamento"
          title="Relatórios"
          description="Um dashboard navegável e explicável: percorra as seções, entenda cada indicador e exporte para a contabilidade em poucos cliques."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleExportCsv} disabled={exporting}>
                <FileSpreadsheet className="h-4 w-4" />
                {exporting ? "Gerando CSV…" : "Exportar CSV"}
              </Button>
              <Button onClick={handleExportHtml}>
                <Download className="h-4 w-4" />
                Baixar dashboard HTML
              </Button>
            </div>
          }
        />

        {/* Destaque exportação HTML */}
        <Card className="border-brand/20 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand/10">
              <FileCode2 className="h-6 w-6 text-brand" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Dashboard HTML para download</p>
              <p className="text-sm text-muted-foreground">
                Gera um relatório visual autossuficiente (gráficos, indicadores e insights) que abre em
                qualquer navegador, navega por seções e pode ser salvo em PDF — sem depender da plataforma.
              </p>
              {lastExport && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Último arquivo: {lastExport}
                </p>
              )}
            </div>
            <Button onClick={handleExportHtml} className="shrink-0">
              <Download className="h-4 w-4" />
              Gerar agora
            </Button>
          </CardContent>
        </Card>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-secondary/60 p-1">
            {tabs.map((t) => {
              const Icon = t.icon;
              return (
                <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
                  <Icon className="h-4 w-4" />
                  {t.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* ---------- Visão geral ---------- */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {kpis.map((m) => {
                const Icon = m.icon;
                return (
                  <Card key={m.label} className="shadow-sm transition-shadow hover:shadow-[var(--shadow-card)]">
                    <CardContent className="flex h-full flex-col p-5">
                      <div className="flex items-start justify-between">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${m.tint}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              aria-label={`Como calculamos ${m.label}`}
                              className="text-muted-foreground/60 transition-colors hover:text-foreground"
                            >
                              <Info className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[240px] text-xs leading-relaxed">
                            {m.explain}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="mt-4 truncate text-2xl font-semibold tracking-tight tabular-nums text-foreground">
                        {m.value}
                      </p>
                      <p className="mt-1 text-sm font-medium leading-snug text-foreground">{m.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{m.hint}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Resumo do período */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Gauge className="h-4 w-4 text-brand" /> Leitura do período
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {insights.map((t, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border border-l-4 border-l-brand bg-secondary/30 px-4 py-3 text-sm text-foreground"
                  >
                    {t}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---------- Categorias ---------- */}
          <TabsContent value="categories" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Distribuição por categoria</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={cats}
                        dataKey="total"
                        nameKey="label"
                        innerRadius={52}
                        outerRadius={88}
                        paddingAngle={2}
                      >
                        {cats.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <RTooltip
                        formatter={(v: number) => formatBRL(v)}
                        contentStyle={{
                          borderRadius: 10,
                          border: "1px solid var(--border)",
                          fontSize: 13,
                          background: "var(--card)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <ul className="mt-2 space-y-1.5">
                    {cats.map((c, i) => (
                      <li key={c.category} className="flex items-center gap-2 text-xs">
                        <span
                          className="h-2.5 w-2.5 rounded-sm"
                          style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                        />
                        <span className="flex-1 truncate text-foreground">{c.label}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {Math.round((c.total / totalGeral) * 100)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Consolidado por categoria */}
              <Card className="shadow-sm lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Consolidado por categoria</CardTitle>
                </CardHeader>
                <CardContent className="px-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-y border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <th className="px-6 py-2.5 font-medium">Categoria</th>
                        <th className="px-6 py-2.5 text-right font-medium">Lançamentos</th>
                        <th className="px-6 py-2.5 text-right font-medium">Total</th>
                        <th className="px-6 py-2.5 text-right font-medium">% do total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {cats.map((c) => (
                        <tr key={c.category} className="hover:bg-secondary/40">
                          <td className="px-6 py-3 font-medium text-foreground">{c.label}</td>
                          <td className="px-6 py-3 text-right tabular-nums text-muted-foreground">{c.count}</td>
                          <td className="px-6 py-3 text-right font-semibold tabular-nums text-foreground">
                            {formatBRL(c.total)}
                          </td>
                          <td className="px-6 py-3 text-right tabular-nums text-muted-foreground">
                            {Math.round((c.total / totalGeral) * 100)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border bg-secondary/30">
                        <td className="px-6 py-3 font-semibold text-foreground">Total geral</td>
                        <td className="px-6 py-3 text-right font-semibold tabular-nums text-foreground">{totalLanc}</td>
                        <td className="px-6 py-3 text-right font-semibold tabular-nums text-foreground">
                          {formatBRL(totalGeral)}
                        </td>
                        <td className="px-6 py-3 text-right font-semibold tabular-nums text-foreground">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ---------- Evolução ---------- */}
          <TabsContent value="evolution" className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">Evolução semanal</CardTitle>
                <span className="text-xs text-muted-foreground">Aprovados x recusados</span>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.weekly} barGap={6}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="week" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
                    <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" width={28} />
                    <RTooltip
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
              <CardContent className="space-y-3">
                {data.byStatus.map((s) => (
                  <div key={s.status} className="flex items-center gap-3 text-sm">
                    <span className="w-28 shrink-0 truncate text-muted-foreground">{s.label}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${(s.count / maxStatus) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 text-right tabular-nums text-muted-foreground">{s.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---------- Insights & Auditoria ---------- */}
          <TabsContent value="insights" className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Gauge className="h-4 w-4 text-brand" /> Insights automáticos
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {insights.map((t, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border border-l-4 border-l-brand bg-secondary/30 px-4 py-3 text-sm text-foreground"
                  >
                    {t}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Como ler estes indicadores</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {kpis.map((m) => (
                  <div key={m.label} className="rounded-lg border border-border bg-card px-4 py-3">
                    <p className="text-sm font-medium text-foreground">{m.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{m.explain}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
