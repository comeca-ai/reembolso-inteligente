import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ShieldQuestion,
  ExternalLink,
  Loader2,
  FileSearch,
  Check,
  X,
  AlertTriangle,
} from "lucide-react";
import { PageSkeleton, TableSkeleton } from "@/components/shared/Skeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  verifyNfe,
  verifyNfeKey,
  type NfeStatus,
  type NfeVerifyResult,
  SEFAZ_PORTAL_URL,
} from "@/lib/nfe.functions";
import { validarChave, type NfeChaveResultado } from "@/lib/nfe-chave";
import { ComplianceDialog } from "@/components/nfe/ComplianceDialog";
import type {
  ComplianceReport,
  ComplianceStatus,
} from "@/lib/compliance.functions";

interface NfeRow {
  id: string;
  sender: string;
  senderName: string | null;
  amount: number | null;
  danfeKey: string;
  createdAt: string;
  nfeStatus: NfeStatus | null;
  nfeVerifiedAt: string | null;
  nfeSource?: string | null;
  complianceStatus: ComplianceStatus | null;
  complianceReport: ComplianceReport | null;
}

interface TestResult extends NfeVerifyResult {
  inputKey: string;
}

const NFE_KEY = ["nfe-dashboard"] as const;

const badge: Record<
  NfeStatus,
  { label: string; className: string; Icon: typeof ShieldCheck }
> = {
  autorizada: {
    label: "Autorizada",
    className: "bg-success/15 text-success ring-1 ring-success/30",
    Icon: ShieldCheck,
  },
  cancelada: {
    label: "Cancelada",
    className: "bg-destructive/10 text-destructive ring-1 ring-destructive/30",
    Icon: ShieldX,
  },
  denegada: {
    label: "Denegada",
    className: "bg-destructive/10 text-destructive ring-1 ring-destructive/30",
    Icon: ShieldX,
  },
  inexistente: {
    label: "Não encontrada",
    className: "bg-destructive/10 text-destructive ring-1 ring-destructive/30",
    Icon: ShieldX,
  },
  erro: {
    label: "Indeterminado",
    className: "bg-warning/15 text-warning-foreground ring-1 ring-warning/30",
    Icon: ShieldAlert,
  },
  manual: {
    label: "Conferir manual",
    className: "bg-warning/15 text-warning-foreground ring-1 ring-warning/30",
    Icon: ShieldAlert,
  },
};

const complianceBadge: Record<
  ComplianceStatus,
  { label: string; className: string }
> = {
  ok: { label: "OK", className: "bg-success/10 text-success ring-1 ring-success/30" },
  alerta: {
    label: "Atenção",
    className: "bg-warning/15 text-warning-foreground ring-1 ring-warning/30",
  },
  violado: {
    label: "Violado",
    className: "bg-destructive/10 text-destructive ring-1 ring-destructive/30",
  },
  manual: {
    label: "Manual",
    className: "bg-warning/15 text-warning-foreground ring-1 ring-warning/30",
  },
  pendente: {
    label: "Pendente",
    className: "bg-muted text-muted-foreground ring-1 ring-border",
  },
};



async function fetchNfe(): Promise<NfeRow[]> {
  const { data, error } = await supabase
    .from("inbound_reimbursements")
    .select(
      "id, sender, sender_name, amount, danfe_key, created_at, nfe_status, nfe_verified_at, compliance_status, compliance_report",
    )
    .not("danfe_key", "is", null)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  return (data ?? [])
    .filter((r) => String(r.danfe_key ?? "").replace(/\D/g, "").length === 44)
    .map((row) => ({
      id: row.id,
      sender: row.sender,
      senderName: row.sender_name,
      amount: row.amount === null ? null : Number(row.amount),
      danfeKey: row.danfe_key as string,
      createdAt: row.created_at,
      nfeStatus: (row.nfe_status as NfeStatus | null) ?? null,
      nfeVerifiedAt: (row.nfe_verified_at as string | null) ?? null,
      complianceStatus:
        (row.compliance_status as ComplianceStatus | null) ?? null,
      complianceReport:
        (row.compliance_report as unknown as ComplianceReport | null) ?? null,
    }));
}

export const Route = createFileRoute("/_app/nfe")({
  head: () => ({ meta: [{ title: "NF-e · reembolso.ia.br" }] }),
  pendingComponent: () => (
    <PageSkeleton>
      <TableSkeleton rows={8} cols={5} />
    </PageSkeleton>
  ),
  component: NfeDashboard,
});

function formatBRL(value: number | null) {
  if (value === null) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function StatCard({
  label,
  value,
  className,
  Icon,
}: {
  label: string;
  value: number;
  className?: string;
  Icon: typeof ShieldCheck;
}) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
          className,
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="leading-tight">
        <p className="text-2xl font-semibold tabular-nums text-foreground">
          {value}
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
        ok
          ? "bg-success/10 text-success"
          : "bg-destructive/10 text-destructive",
      )}
    >
      {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {label}
    </span>
  );
}

/**
 * Camada 1 — validação estrutural offline da chave. Mostra os campos
 * desmembrados, as checagens (DV mod 11, CNPJ, UF, modelo) e os alertas.
 */
function NfeStructureDetails({
  structure,
}: {
  structure: NfeChaveResultado;
}) {
  const { campos, checagens, alertas, veredito, estruturaOk } = structure;

  return (
    <div className="rounded-md bg-secondary/40 p-2.5 text-xs">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="font-medium text-foreground">Estrutura da chave</span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-medium",
            estruturaOk
              ? "bg-success/10 text-success"
              : "bg-destructive/10 text-destructive",
          )}
        >
          {veredito}
        </span>
      </div>

      {checagens && (
        <div className="flex flex-wrap gap-1.5">
          <CheckRow
            ok={checagens.dvMod11.ok}
            label={`DV mód.11 (${checagens.dvMod11.esperado})`}
          />
          <CheckRow ok={checagens.cnpjValido} label="CNPJ" />
          <CheckRow ok={checagens.ufReconhecida} label="UF" />
          <CheckRow ok={checagens.modeloReconhecido} label="Modelo" />
        </div>
      )}

      {campos && (
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground sm:grid-cols-4">
          <div>
            <dt className="text-[10px] uppercase tracking-wide">UF</dt>
            <dd className="text-foreground">{campos.uf.sigla}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide">Modelo</dt>
            <dd className="text-foreground">{campos.modelo.tipo}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide">Emissão</dt>
            <dd className="text-foreground">{campos.anoMesEmissao}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide">Série/Nº</dt>
            <dd className="text-foreground">
              {campos.serie}/{campos.numero}
            </dd>
          </div>
          <div className="col-span-2 sm:col-span-4">
            <dt className="text-[10px] uppercase tracking-wide">CNPJ emitente</dt>
            <dd className="font-mono text-foreground">{campos.cnpjEmitente}</dd>
          </div>
        </dl>
      )}

      {alertas.length > 0 && (
        <ul className="mt-2 space-y-1">
          {alertas.map((a, idx) => (
            <li
              key={idx}
              className="flex items-start gap-1 text-warning-foreground"
            >
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{a}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NfeDashboard() {
  const queryClient = useQueryClient();
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [sourceById, setSourceById] = useState<Record<string, string>>({});
  const [testInput, setTestInput] = useState("");
  const [testRunning, setTestRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [complianceRow, setComplianceRow] = useState<NfeRow | null>(null);
  const runVerifyNfe = useServerFn(verifyNfe);
  const runVerifyNfeKey = useServerFn(verifyNfeKey);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: NFE_KEY,
    queryFn: fetchNfe,
  });

  const rows = useMemo(() => data ?? [], [data]);

  const stats = useMemo(() => {
    const s = {
      total: rows.length,
      autorizada: 0,
      problema: 0,
      pendente: 0,
      manual: 0,
    };
    for (const r of rows) {
      if (!r.nfeStatus) s.pendente += 1;
      else if (r.nfeStatus === "autorizada") s.autorizada += 1;
      else if (r.nfeStatus === "manual" || r.nfeStatus === "erro") s.manual += 1;
      else s.problema += 1;
    }
    return s;
  }, [rows]);

  function applyResult(id: string, status: NfeStatus, verifiedAt: string | null) {
    queryClient.setQueryData<NfeRow[]>(NFE_KEY, (prev) =>
      (prev ?? []).map((item) =>
        item.id === id
          ? { ...item, nfeStatus: status, nfeVerifiedAt: verifiedAt }
          : item,
      ),
    );
  }

  function applyCompliance(id: string, report: ComplianceReport) {
    queryClient.setQueryData<NfeRow[]>(NFE_KEY, (prev) =>
      (prev ?? []).map((item) =>
        item.id === id
          ? {
              ...item,
              complianceStatus: report.overall,
              complianceReport: report,
            }
          : item,
      ),
    );
    setComplianceRow((prev) =>
      prev && prev.id === id
        ? { ...prev, complianceStatus: report.overall, complianceReport: report }
        : prev,
    );
  }

  async function handleVerify(r: NfeRow) {
    setVerifyingId(r.id);
    try {
      const result = await runVerifyNfe({ data: { id: r.id } });
      applyResult(r.id, result.status, result.verifiedAt);
      setSourceById((prev) => ({ ...prev, [r.id]: result.source }));
      if (result.status === "autorizada")
        toast.success(`${result.message} (fonte: ${result.source})`);
      else if (result.status === "manual")
        toast.warning(result.message, {
          description: `Fonte: ${result.source}`,
          action: {
            label: "Abrir SEFAZ",
            onClick: () => window.open(result.sefazUrl, "_blank", "noopener"),
          },
        });
      else toast.error(`${result.message} (fonte: ${result.source})`);
    } catch {
      toast.error("Falha ao verificar a nota. Tente novamente.");
    } finally {
      setVerifyingId(null);
    }
  }

  async function handleVerifyPending() {
    const pending = rows.filter((r) => !r.nfeStatus);
    if (pending.length === 0) {
      toast.info("Nenhuma nota pendente para verificar.");
      return;
    }
    setBulkRunning(true);
    let ok = 0;
    for (const r of pending) {
      try {
        const result = await runVerifyNfe({ data: { id: r.id } });
        applyResult(r.id, result.status, result.verifiedAt);
        setSourceById((prev) => ({ ...prev, [r.id]: result.source }));
        ok += 1;
      } catch {
        /* segue para a próxima */
      }
    }
    setBulkRunning(false);
    toast.success(`Verificação concluída para ${ok} de ${pending.length} notas.`);
  }

  async function handleTest() {
    const keys = Array.from(
      new Set(
        testInput
          .split(/[\s,;]+/)
          .map((k) => k.replace(/\D/g, ""))
          .filter((k) => k.length > 0),
      ),
    );
    if (keys.length === 0) {
      toast.info("Cole ao menos uma chave DANFE (44 dígitos) para testar.");
      return;
    }
    setTestRunning(true);
    setTestResults([]);
    const collected: TestResult[] = [];
    for (const key of keys) {
      try {
        const result = await runVerifyNfeKey({ data: { key } });
        collected.push({ ...result, inputKey: key });
      } catch {
        collected.push({
          inputKey: key,
          key: key.length === 44 ? key : null,
          status: "erro",
          message: "Falha ao consultar esta chave.",
          code: null,
          verifiedAt: null,
          sefazUrl: SEFAZ_PORTAL_URL,
          source: "Erro de rede",
          structure: validarChave(key),
        });
      }
      setTestResults([...collected]);
    }
    setTestRunning(false);
  }


  // Realtime: novas notas aparecem automaticamente.
  useEffect(() => {
    const channel = supabase
      .channel("nfe-dashboard-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inbound_reimbursements" },
        () => {
          queryClient.invalidateQueries({ queryKey: NFE_KEY });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  if (isLoading) {
    return (
      <PageSkeleton>
        <TableSkeleton rows={8} cols={5} />
      </PageSkeleton>
    );
  }

  return (
    <div className="animate-fade-rise space-y-8">
      <PageHeader
        eyebrow="Fiscal"
        title="Verificação de NF-e"
        description="Autenticidade das notas fiscais recebidas, conferidas junto à SEFAZ pela chave de acesso (DANFE)."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
              Atualizar
            </Button>
            <Button
              className="gap-2"
              onClick={handleVerifyPending}
              disabled={bulkRunning || stats.pendente === 0}
            >
              {bulkRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSearch className="h-4 w-4" />
              )}
              Verificar pendentes ({stats.pendente})
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Autorizadas"
          value={stats.autorizada}
          Icon={ShieldCheck}
          className="bg-success/15 text-success"
        />
        <StatCard
          label="Com problema"
          value={stats.problema}
          Icon={ShieldX}
          className="bg-destructive/10 text-destructive"
        />
        <StatCard
          label="Conferir manual"
          value={stats.manual}
          Icon={ShieldAlert}
          className="bg-warning/15 text-warning-foreground"
        />
        <StatCard
          label="Pendentes"
          value={stats.pendente}
          Icon={ShieldQuestion}
          className="bg-muted text-muted-foreground"
        />
      </div>

      {/* Teste rápido por chave — verifica qualquer DANFE sem precisar cadastrar. */}
      <Card className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileSearch className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-foreground">
              Testar chaves de acesso
            </p>
            <p className="text-xs text-muted-foreground">
              Cole uma ou mais chaves DANFE (44 dígitos) — uma por linha. Cada
              chave passa por duas camadas: validação estrutural offline
              (dígito verificador, CNPJ, UF, modelo e campos da chave) e a
              consulta da situação na fonte oficial (SEFAZ).
            </p>

          </div>
        </div>

        <Textarea
          value={testInput}
          onChange={(e) => setTestInput(e.target.value)}
          rows={3}
          placeholder={"3525...  (cole aqui — várias chaves, uma por linha)"}
          className="font-mono text-xs"
        />

        <div className="flex items-center justify-end">
          <Button className="gap-2" onClick={handleTest} disabled={testRunning}>
            {testRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSearch className="h-4 w-4" />
            )}
            Verificar chaves
          </Button>
        </div>

        {testResults.length > 0 && (
          <div className="space-y-2 border-t border-border pt-4">
            {testResults.map((res, i) => {
              const meta = badge[res.status];
              const Icon = meta.Icon;
              return (
                <div
                  key={`${res.inputKey}-${i}`}
                  className="space-y-2 rounded-lg border border-border p-3"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                        meta.className,
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {meta.label}
                    </span>
                    <span className="font-mono text-xs text-foreground">
                      …{res.inputKey.slice(-12)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {res.message}
                    </span>
                    <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <ExternalLink className="h-3 w-3" />
                      Fonte: {res.source}
                    </span>
                  </div>
                  <NfeStructureDetails structure={res.structure} />
                </div>
              );
            })}
          </div>
        )}
      </Card>


      <Card>
        <div className="space-y-1 border-b border-border p-4">
          <p className="text-sm font-medium text-foreground">
            {rows.length} {rows.length === 1 ? "nota fiscal" : "notas fiscais"}{" "}
            recebida{rows.length === 1 ? "" : "s"} com chave de acesso (DANFE)
          </p>
          <p className="text-xs text-muted-foreground">
            Cada linha é uma nota fiscal eletrônica. A coluna{" "}
            <span className="font-medium text-foreground">Situação</span> mostra a
            autenticidade junto à SEFAZ e{" "}
            <span className="font-medium text-foreground">Compliance</span> o
            resultado das regras da empresa. Clique numa etiqueta para ver os
            detalhes.
          </p>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={FileSearch}
            title="Nenhuma nota com chave DANFE"
            description="Assim que um comprovante com chave de acesso (44 dígitos) for recebido, ele aparece aqui para verificação na SEFAZ."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 font-medium" title="Quem enviou a nota (nome e WhatsApp/e-mail)">
                    Remetente
                  </th>
                  <th className="px-5 py-3 font-medium" title="Valor total da nota fiscal">
                    Valor
                  </th>
                  <th className="px-5 py-3 font-medium" title="Chave de acesso de 44 dígitos da DANFE — clique para copiar">
                    Chave de acesso
                  </th>
                  <th className="px-5 py-3 font-medium" title="Autenticidade da nota junto à SEFAZ">
                    Situação na SEFAZ
                  </th>
                  <th className="px-5 py-3 font-medium" title="Resultado das regras de compliance da empresa">
                    Compliance
                  </th>
                  <th className="px-5 py-3 font-medium" title="De onde veio a informação da verificação">
                    Fonte
                  </th>
                  <th className="px-5 py-3 font-medium" title="Data e hora da última verificação">
                    Verificado em
                  </th>
                  <th className="px-5 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="transition-colors hover:bg-secondary/40"
                  >
                    <td className="whitespace-nowrap px-5 py-4 align-top">
                      <span className="font-medium text-foreground">
                        {r.senderName || r.sender}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {r.sender}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 align-top tabular-nums font-medium text-foreground">
                      {formatBRL(r.amount)}
                    </td>
                    <td className="px-5 py-4 align-top">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(r.danfeKey);
                          toast.success("Chave DANFE copiada");
                        }}
                        title={`${r.danfeKey} (clique para copiar)`}
                        className="font-mono text-xs tabular-nums text-foreground hover:text-primary"
                      >
                        …{r.danfeKey.slice(-12)}
                      </button>
                      {(() => {
                        const st = validarChave(r.danfeKey);
                        return (
                          <span
                            className={cn(
                              "mt-1 flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                              st.estruturaOk
                                ? "bg-success/10 text-success"
                                : "bg-destructive/10 text-destructive",
                            )}
                            title={st.veredito}
                          >
                            {st.estruturaOk ? (
                              <Check className="h-2.5 w-2.5" />
                            ) : (
                              <X className="h-2.5 w-2.5" />
                            )}
                            {st.estruturaOk
                              ? st.alertas.length > 0
                                ? "Estrutura ok · alertas"
                                : "Estrutura válida"
                              : "Estrutura inválida"}
                          </span>
                        );
                      })()}
                    </td>

                    <td className="px-5 py-4 align-top">
                      {r.nfeStatus ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                            badge[r.nfeStatus].className,
                          )}
                        >
                          {(() => {
                            const Icon = badge[r.nfeStatus].Icon;
                            return <Icon className="h-3 w-3" />;
                          })()}
                          {badge[r.nfeStatus].label}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border">
                          <ShieldQuestion className="h-3 w-3" />
                          Pendente
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 align-top">
                      <button
                        type="button"
                        onClick={() => setComplianceRow(r)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-80",
                          complianceBadge[r.complianceStatus ?? "pendente"]
                            .className,
                        )}
                        title="Ver / rodar avaliação de compliance"
                      >
                        <ShieldCheck className="h-3 w-3" />
                        {complianceBadge[r.complianceStatus ?? "pendente"].label}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 align-top text-xs text-muted-foreground">
                      {sourceById[r.id] ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 align-top text-xs text-muted-foreground">
                      {formatDateTime(r.nfeVerifiedAt)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right align-top">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1.5 px-2 text-xs"
                          disabled={verifyingId === r.id || bulkRunning}
                          onClick={() => handleVerify(r)}
                        >
                          {verifyingId === r.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <FileSearch className="h-3 w-3" />
                          )}
                          Verificar
                        </Button>
                        <a
                          href={SEFAZ_PORTAL_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground ring-1 ring-border transition-colors hover:text-primary"
                          title="Abrir portal da SEFAZ"
                        >
                          <ExternalLink className="h-3 w-3" />
                          SEFAZ
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Veja todas as despesas na página de{" "}
        <Link to="/expenses" className="font-medium text-primary hover:underline">
          Despesas
        </Link>
        .
      </p>

      <ComplianceDialog
        open={complianceRow !== null}
        onOpenChange={(v) => {
          if (!v) setComplianceRow(null);
        }}
        reimbursementId={complianceRow?.id ?? ""}
        title={
          complianceRow
            ? `a nota …${complianceRow.danfeKey.slice(-8)}`
            : "a nota"
        }
        initialReport={complianceRow?.complianceReport ?? null}
        onEvaluated={(report) => {
          if (complianceRow) applyCompliance(complianceRow.id, report);
        }}
      />
    </div>
  );
}
