import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { api, formatBRL, type OverviewMetrics } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const overviewQuery = queryOptions({ queryKey: ["overview"], queryFn: () => api.getOverview() });

export const Route = createFileRoute("/_app/reports")({
  head: () => ({ meta: [{ title: "Relatórios · reembolsa.aí" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(overviewQuery),
  component: ReportsPage,
});

function ReportsPage() {
  const { data } = useSuspenseQuery(overviewQuery);
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { fileName, content, rows } = await api.exportReportCsv();
      const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      setLastExport(fileName);
      toast.success("Relatório exportado", {
        description: `${rows} lançamentos em ${fileName}, com vereditos da IA e decisões humanas.`,
      });
    } finally {
      setExporting(false);
    }
  };

  const cats = data.byCategory as OverviewMetrics["byCategory"];
  const totalGeral = cats.reduce((s, c) => s + c.total, 0);

  return (
    <div className="animate-fade-rise space-y-8">
      <PageHeader
        eyebrow="Fechamento"
        title="Relatórios"
        description="Consolide os reembolsos do período e exporte para a contabilidade em poucos cliques."
        actions={
          <Button onClick={handleExport} disabled={exporting}>
            <Download className="h-4 w-4" />
            {exporting ? "Gerando CSV…" : "Exportar CSV"}
          </Button>
        }
      />

      <Card className="border-brand/20 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand/10">
            <FileSpreadsheet className="h-6 w-6 text-brand" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Exportação para contabilidade</p>
            <p className="text-sm text-muted-foreground">
              Gera um CSV com todos os lançamentos, vereditos da IA e decisões dos aprovadores (separador “;”, compatível com Excel pt-BR).
            </p>
            {lastExport && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-success">
                <CheckCircle2 className="h-3.5 w-3.5" /> Último arquivo: {lastExport}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
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
                <td className="px-6 py-3 text-right font-semibold tabular-nums text-foreground">
                  {cats.reduce((s, c) => s + c.count, 0)}
                </td>
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
  );
}
