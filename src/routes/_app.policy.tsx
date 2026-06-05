import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, formatDate, formatDateTime, categoryLabels, type PolicyVersion, type PolicyRule } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import {
  UploadCloud,
  FileText,
  CheckCircle2,
  Clock,
  Sparkles,
  Building2,
  Calendar,
  Fuel,
  UtensilsCrossed,
  BedDouble,
  Route as RouteIcon,
  ReceiptText,
  ListChecks,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const policyQuery = queryOptions({
  queryKey: ["policies"],
  queryFn: () => api.listPolicyVersions(),
});

const rulesQuery = queryOptions({
  queryKey: ["policy-rules"],
  queryFn: () => api.listPolicyRules(),
});

export const Route = createFileRoute("/_app/policy")({
  head: () => ({ meta: [{ title: "Política · reembolsa.aí" }] }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(policyQuery),
      context.queryClient.ensureQueryData(rulesQuery),
    ]),
  component: PolicyPage,
});

const ruleIcons: Record<PolicyRule["category"], typeof Fuel> = {
  combustivel: Fuel,
  refeicao: UtensilsCrossed,
  hospedagem: BedDouble,
  transporte: RouteIcon,
  pedagio: ReceiptText,
  material: ReceiptText,
  outros: ReceiptText,
  documentos: ReceiptText,
};

function categoryLabel(category: PolicyRule["category"]) {
  return category === "documentos" ? "Documentos" : categoryLabels[category];
}

function PolicyPage() {
  const { data } = useSuspenseQuery(policyQuery);
  const { data: rules } = useSuspenseQuery(rulesQuery);
  const queryClient = useQueryClient();
  const [dragging, setDragging] = useState(false);
  const active = data.find((p) => p.active);

  const mutation = useMutation({
    mutationFn: (fileName: string) => api.uploadPolicy(fileName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      toast.success("Nova versão publicada", {
        description: "A política passou a valer para todas as próximas análises da IA.",
      });
    },
  });

  const handleUpload = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    mutation.mutate(`politica-reembolso-${stamp}.pdf`);
  };

  return (
    <div className="animate-fade-rise space-y-8">
      <PageHeader
        eyebrow="Governança"
        title="Política de reembolso"
        description="A política é o combustível da IA: cada recomendação cita a cláusula e a versão vigente que a justifica."
        actions={
          <Button onClick={handleUpload} disabled={mutation.isPending} className="gap-2">
            <UploadCloud className="h-4 w-4" />
            {mutation.isPending ? "Publicando…" : "Publicar nova versão"}
          </Button>
        }
      />

      {/* Banner explicativo */}
      <div className="flex items-start gap-3 rounded-xl border border-brand/20 bg-brand/8 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/15">
          <Sparkles className="h-5 w-5 text-brand" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">
            A IA usa esta política para justificar cada recomendação.
          </p>
          <p className="text-sm text-muted-foreground">
            As cláusulas abaixo entram no contexto da análise de cada comprovante. Sem RAG nem embeddings — a
            política ativa é enviada junto à chamada de visão que lê o comprovante.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        {/* Política ativa */}
        <Card className="border-brand/20 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Política ativa</CardTitle>
          </CardHeader>
          <CardContent>
            {active && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand/10">
                    <FileText className="h-6 w-6 text-brand" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold tabular-nums text-foreground">{active.version}</p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Em vigor
                    </span>
                  </div>
                </div>
                <div className="space-y-2.5 border-t border-border pt-3 text-sm">
                  <Info icon={Building2} label="Empresa" value={active.company} />
                  <Info icon={Calendar} label="Publicada em" value={formatDate(active.uploadedAt)} />
                  <Info icon={FileText} label="Arquivo" value={active.fileName} />
                  <Info icon={Clock} label="Publicada por" value={active.uploadedBy} />
                </div>
                <div className="rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
                  {active.pages} páginas · {rules.length} regras estruturadas extraídas
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upload */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Enviar nova versão</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                handleUpload();
              }}
              className={cn(
                "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors",
                dragging ? "border-brand bg-brand/5" : "border-border bg-secondary/30",
              )}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/10">
                <UploadCloud className="h-7 w-7 text-brand" />
              </div>
              <p className="mt-4 text-sm font-medium text-foreground">
                Arraste o PDF da política ou clique para selecionar
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                PDF até 10 MB · a nova versão é ativada automaticamente
              </p>
              <Button onClick={handleUpload} disabled={mutation.isPending} variant="outline" className="mt-5">
                {mutation.isPending ? "Processando…" : "Selecionar arquivo"}
              </Button>
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-accent/40 p-3 text-sm text-accent-foreground">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              <p>
                Ao publicar, a IA relê as cláusulas e passa a citá-las nas próximas análises de despesas.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview de regras estruturadas */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="h-4 w-4 text-brand" />
            Regras estruturadas extraídas da política
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Versão legível para humanos do que a IA enxerga ao avaliar um comprovante.
          </p>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-6 py-2.5 font-medium">Código</th>
                  <th className="px-4 py-2.5 font-medium">Título</th>
                  <th className="px-4 py-2.5 font-medium">Categoria</th>
                  <th className="px-4 py-2.5 font-medium">Limite</th>
                  <th className="px-4 py-2.5 font-medium">Base do limite</th>
                  <th className="px-4 py-2.5 font-medium">Texto da regra</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rules.map((r) => {
                  const Icon = ruleIcons[r.category];
                  return (
                    <tr key={r.code} className="align-top transition-colors hover:bg-secondary/40">
                      <td className="px-6 py-3">
                        <span className="font-semibold tabular-nums text-brand">{r.code}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 font-medium text-foreground">
                          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-accent-foreground">
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          {r.title}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                          {categoryLabel(r.category)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold tabular-nums text-foreground">{r.limit}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.basis}</td>
                      <td className="max-w-md px-4 py-3 text-muted-foreground">{r.text}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Histórico de versões</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="divide-y divide-border border-t border-border">
            {data.map((p: PolicyVersion) => (
              <div key={p.id} className="flex items-center gap-4 px-6 py-3.5">
                <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold tabular-nums text-foreground">{p.version}</p>
                    {p.active ? (
                      <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
                        Ativa
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" /> Arquivada
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.fileName} · {p.pages} págs · {p.sizeKb} KB
                  </p>
                </div>
                <div className="hidden text-right text-xs text-muted-foreground sm:block">
                  <p>{p.uploadedBy}</p>
                  <p className="tabular-nums">{formatDateTime(p.uploadedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className="truncate text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
