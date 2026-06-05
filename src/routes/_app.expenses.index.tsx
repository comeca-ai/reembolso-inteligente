import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import {
  api,
  formatBRL,
  formatDate,
  type ExpenseStatus,
  type Expense,
} from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge, ChannelBadge } from "@/components/shared/StatusBadge";
import { VerdictBadge } from "@/components/shared/VerdictBadge";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import { ConfidenceBadge } from "@/components/shared/Confidence";
import { Search, ChevronRight, Download, ReceiptText } from "lucide-react";
import { PageSkeleton, TableSkeleton } from "@/components/shared/Skeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { toast } from "sonner";

const expensesQuery = queryOptions({
  queryKey: ["expenses"],
  queryFn: () => api.listExpenses(),
});

export const Route = createFileRoute("/_app/expenses/")({
  head: () => ({ meta: [{ title: "Despesas · reembolsa.aí" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(expensesQuery),
  pendingComponent: () => (
    <PageSkeleton>
      <TableSkeleton rows={8} cols={8} />
    </PageSkeleton>
  ),
  component: ExpensesPage,
});

type TabKey = "analise" | "aprovadas" | "recusadas" | "todas";

const tabMatch: Record<Exclude<TabKey, "todas">, ExpenseStatus[]> = {
  analise: ["pendente", "extraindo", "em_analise"],
  aprovadas: ["aprovado", "aprovado_ressalva"],
  recusadas: ["recusado"],
};

function inTab(e: Expense, tab: TabKey) {
  if (tab === "todas") return true;
  return tabMatch[tab].includes(e.status);
}

function ExpensesPage() {
  const { data } = useSuspenseQuery(expensesQuery);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabKey>("analise");
  const [exporting, setExporting] = useState(false);

  const counts = useMemo(
    () => ({
      analise: data.filter((e) => inTab(e, "analise")).length,
      aprovadas: data.filter((e) => inTab(e, "aprovadas")).length,
      recusadas: data.filter((e) => inTab(e, "recusadas")).length,
      todas: data.length,
    }),
    [data],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((e) => {
      const matchSearch =
        !q ||
        e.employeeName.toLowerCase().includes(q) ||
        e.merchant.toLowerCase().includes(q) ||
        e.protocol.toLowerCase().includes(q) ||
        (e.cnpj ?? "").toLowerCase().includes(q);
      return inTab(e, tab) && matchSearch;
    });
  }, [data, search, tab]);

  const total = filtered.reduce((s, e) => s + e.amount, 0);

  async function handleExport() {
    setExporting(true);
    try {
      const { fileName, content, rows } = await api.exportReportCsv();
      const blob = new Blob(["\ufeff" + content], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Relatório exportado", {
        description: `${rows} despesas em ${fileName}. Pronto para o seu ERP ou financeiro.`,
      });
    } finally {
      setExporting(false);
    }
  }

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "analise", label: "Em análise" },
    { key: "aprovadas", label: "Aprovadas" },
    { key: "recusadas", label: "Recusadas" },
    { key: "todas", label: "Todas" },
  ];

  return (
    <div className="animate-fade-rise space-y-8">
      <PageHeader
        eyebrow="Fila de aprovação"
        title="Despesas"
        description="Comprovantes enviados pela equipe de campo, lidos e conferidos pela IA contra a política — prontos para a sua decisão."
        actions={
          <Button onClick={handleExport} disabled={exporting} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            {exporting ? "Exportando…" : "Exportar CSV"}
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
            <TabsList>
              {tabs.map((t) => (
                <TabsTrigger key={t.key} value={t.key} className="gap-1.5">
                  {t.label}
                  <span className="rounded-full bg-secondary px-1.5 text-[11px] font-semibold tabular-nums text-secondary-foreground">
                    {counts[t.key]}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="relative w-full lg:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por colaborador, CNPJ, fornecedor ou código…"
              className="h-9 pl-9"
            />
          </div>
        </div>

        {/* Tabela densa */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="whitespace-nowrap px-5 py-3 font-medium">Código</th>
                <th className="px-5 py-3 font-medium">Colaborador</th>
                <th className="px-5 py-3 font-medium">Categoria</th>
                <th className="whitespace-nowrap px-5 py-3 text-right font-medium">Valor</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Recomendação IA</th>
                <th className="whitespace-nowrap px-5 py-3 text-right font-medium">Data</th>
                <th className="w-10 px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((e) => (
                <tr key={e.id} className="group transition-colors hover:bg-secondary/40">
                  <td className="whitespace-nowrap px-5 py-4 align-top">
                    <Link
                      to="/expenses/$id"
                      params={{ id: e.id }}
                      className="font-medium tabular-nums text-primary hover:underline"
                    >
                      {e.protocol}
                    </Link>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <div className="flex items-center gap-2">
                      <span className="whitespace-nowrap font-medium text-foreground">{e.employeeName}</span>
                      <ChannelBadge channel={e.channel} />
                    </div>
                    <span className="mt-0.5 block max-w-[15rem] truncate text-xs text-muted-foreground">
                      {e.costCenter} · {e.merchant}
                    </span>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <CategoryBadge category={e.category} />
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-right align-top font-semibold tabular-nums text-foreground">
                    {formatBRL(e.amount)}
                  </td>
                  <td className="px-5 py-4 align-top">
                    <StatusBadge status={e.status} />
                  </td>
                  <td className="px-5 py-4 align-top">
                    <div className="flex flex-col items-start gap-1.5">
                      <VerdictBadge verdict={e.ai.verdict} size="sm" />
                      <ConfidenceBadge confidence={e.ai.confidence} />
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-right align-top tabular-nums text-muted-foreground">
                    {formatDate(e.date)}
                  </td>
                  <td className="px-2 py-4 text-right align-top">
                    <Link
                      to="/expenses/$id"
                      params={{ id: e.id }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-secondary hover:text-foreground md:opacity-0 md:group-hover:opacity-100"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <EmptyState
            icon={ReceiptText}
            title="Nenhuma despesa por aqui"
            description={
              search
                ? "Não encontramos nada com esses filtros. Tente outro termo ou limpe a busca."
                : "Quando a equipe enviar comprovantes neste status, eles aparecem aqui automaticamente."
            }
            action={
              search ? (
                <Button variant="outline" onClick={() => setSearch("")}>
                  Limpar busca
                </Button>
              ) : undefined
            }
          />
        )}

        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "despesa" : "despesas"}
          </span>
          <span className="text-muted-foreground">
            Total exibido:{" "}
            <span className="font-semibold tabular-nums text-foreground">{formatBRL(total)}</span>
          </span>
        </div>
      </Card>
    </div>
  );
}
