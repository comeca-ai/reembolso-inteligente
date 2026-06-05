import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import {
  api,
  formatBRL,
  formatDate,
  categoryLabels,
  statusLabels,
  type ExpenseStatus,
  type ExpenseCategory,
} from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge, ChannelBadge } from "@/components/shared/StatusBadge";
import { VerdictBadge } from "@/components/shared/VerdictBadge";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import { RuleTrafficLight } from "@/components/shared/RuleCheck";
import { ConfidenceBadge } from "@/components/shared/Confidence";
import { Search, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const expensesQuery = queryOptions({
  queryKey: ["expenses"],
  queryFn: () => api.listExpenses(),
});

export const Route = createFileRoute("/_app/expenses/")({
  head: () => ({ meta: [{ title: "Despesas · reembolsa.aí" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(expensesQuery),
  component: ExpensesPage,
});

function ExpensesPage() {
  const { data } = useSuspenseQuery(expensesQuery);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ExpenseStatus | "todos">("todos");
  const [category, setCategory] = useState<ExpenseCategory | "todas">("todas");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((e) => {
      const matchSearch =
        !q ||
        e.employeeName.toLowerCase().includes(q) ||
        e.merchant.toLowerCase().includes(q) ||
        e.protocol.toLowerCase().includes(q);
      const matchStatus = status === "todos" || e.status === status;
      const matchCat = category === "todas" || e.category === category;
      return matchSearch && matchStatus && matchCat;
    });
  }, [data, search, status, category]);

  const total = filtered.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Despesas"
        description="Comprovantes enviados pela equipe de campo, analisados pela IA e prontos para decisão."
      />

      <Card className="shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por colaborador, estabelecimento ou protocolo…"
              className="h-9 pl-9"
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as ExpenseStatus | "todos")}>
            <SelectTrigger className="h-9 w-full sm:w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {(Object.keys(statusLabels) as ExpenseStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabels[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory | "todas")}>
            <SelectTrigger className="h-9 w-full sm:w-44">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as categorias</SelectItem>
              {(Object.keys(categoryLabels) as ExpenseCategory[]).map((c) => (
                <SelectItem key={c} value={c}>
                  {categoryLabels[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tabela densa */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Protocolo</th>
                <th className="px-4 py-2.5 font-medium">Colaborador</th>
                <th className="px-4 py-2.5 font-medium">Categoria</th>
                <th className="px-4 py-2.5 font-medium">Estabelecimento</th>
                <th className="px-4 py-2.5 text-right font-medium">Valor</th>
                <th className="px-4 py-2.5 font-medium">Data</th>
                <th className="px-4 py-2.5 font-medium">IA</th>
                <th className="px-4 py-2.5 font-medium">Regras</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((e) => (
                <tr key={e.id} className="group transition-colors hover:bg-secondary/40">
                  <td className="px-4 py-3">
                    <Link
                      to="/expenses/$id"
                      params={{ id: e.id }}
                      className="font-medium tabular-nums text-primary hover:underline"
                    >
                      {e.protocol}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{e.employeeName}</span>
                      <ChannelBadge channel={e.channel} />
                    </div>
                    <span className="text-xs text-muted-foreground">{e.costCenter}</span>
                  </td>
                  <td className="px-4 py-3">
                    <CategoryBadge category={e.category} />
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-muted-foreground">{e.merchant}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">
                    {formatBRL(e.amount)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{formatDate(e.date)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <VerdictBadge verdict={e.ai.verdict} size="sm" />
                      <ConfidenceBadge confidence={e.ai.confidence} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <RuleTrafficLight rules={e.ai.rules} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={e.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to="/expenses/$id"
                      params={{ id: e.id }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-secondary group-hover:opacity-100"
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
          <div className="px-4 py-16 text-center text-sm text-muted-foreground">
            Nenhuma despesa encontrada com os filtros atuais.
          </div>
        )}

        <div className={cn("flex items-center justify-between border-t border-border px-4 py-3 text-sm")}>
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
