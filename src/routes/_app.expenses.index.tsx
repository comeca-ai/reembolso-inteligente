import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  ReceiptText,
  RefreshCw,
  Paperclip,
  Phone,
  MessageCircle,
  Mail,
  Filter,
} from "lucide-react";
import { PageSkeleton, TableSkeleton } from "@/components/shared/Skeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface RichDespesa {
  id: string;
  channel: string;
  sender: string;
  senderName: string | null;
  message: string | null;
  attachmentUrl: string | null;
  amount: number | null;
  category: string | null;
  danfeKey: string | null;
  status: string;
  createdAt: string;
}

const DESPESAS_KEY = ["despesas-rich"] as const;

const statusConfig: Record<string, string> = {
  recebido: "bg-warning/15 text-warning-foreground ring-1 ring-warning/30",
  em_analise: "bg-primary/10 text-primary ring-1 ring-primary/25",
  processado: "bg-success/15 text-success ring-1 ring-success/30",
  arquivado: "bg-muted text-muted-foreground ring-1 ring-border",
};

const statusLabels: Record<string, string> = {
  recebido: "Recebido",
  em_analise: "Em análise",
  processado: "Processado",
  arquivado: "Arquivado",
};

async function fetchDespesas(): Promise<RichDespesa[]> {
  const { data, error } = await supabase
    .from("inbound_reimbursements")
    .select(
      "id, channel, sender, sender_name, message, attachment_url, amount, category, danfe_key, status, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    channel: row.channel,
    sender: row.sender,
    senderName: row.sender_name,
    message: row.message,
    attachmentUrl: row.attachment_url,
    amount: row.amount === null ? null : Number(row.amount),
    category: row.category,
    danfeKey: row.danfe_key,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export const Route = createFileRoute("/_app/expenses/")({
  head: () => ({ meta: [{ title: "Despesas · reembolso.ia.br" }] }),
  pendingComponent: () => (
    <PageSkeleton>
      <TableSkeleton rows={8} cols={6} />
    </PageSkeleton>
  ),
  component: ExpensesPage,
});

function formatBRL(value: number | null) {
  if (value === null) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateTime(value: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function ExpensesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: DESPESAS_KEY,
    queryFn: fetchDespesas,
  });

  const despesas = useMemo(() => data ?? [], [data]);

  // Abre o comprovante: links http/data abrem direto; caminhos do Storage
  // geram uma URL assinada temporária (bucket privado "comprovantes").
  async function openComprovante(attachmentUrl: string) {
    if (/^(https?:|data:)/i.test(attachmentUrl)) {
      window.open(attachmentUrl, "_blank", "noopener");
      return;
    }
    const { data: signed, error } = await supabase.storage
      .from("comprovantes")
      .createSignedUrl(attachmentUrl, 60 * 5);
    if (error || !signed?.signedUrl) {
      toast.error("Não foi possível abrir o comprovante");
      return;
    }
    window.open(signed.signedUrl, "_blank", "noopener");
  }



  // Realtime: novas despesas inseridas aparecem automaticamente no topo.
  useEffect(() => {
    const channel = supabase
      .channel("inbound-reimbursements-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "inbound_reimbursements" },
        (payload) => {
          const nova = payload.new as Record<string, unknown>;
          queryClient.setQueryData<RichDespesa[]>(DESPESAS_KEY, (prev) => {
            const list = prev ?? [];
            const newId = String(nova.id ?? "");
            if (list.some((d) => d.id === newId)) return list;
            const mapped: RichDespesa = {
              id: newId,
              channel: String(nova.channel ?? "whatsapp"),
              sender: String(nova.sender ?? ""),
              senderName: (nova.sender_name as string | null) ?? null,
              message: (nova.message as string | null) ?? null,
              attachmentUrl: (nova.attachment_url as string | null) ?? null,
              amount: nova.amount === null ? null : Number(nova.amount),
              category: (nova.category as string | null) ?? null,
              danfeKey: (nova.danfe_key as string | null) ?? null,
              status: String(nova.status ?? "recebido"),
              createdAt: String(nova.created_at ?? new Date().toISOString()),
            };
            return [mapped, ...list];
          });
          const desc = (nova.sender_name as string | null) || (nova.sender as string | null);
          toast.success("Nova despesa recebida", {
            description: desc ?? undefined,
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = despesas;
    if (statusFilter) {
      list = list.filter((d) => d.status === statusFilter);
    }
    if (!q) return list;
    return list.filter(
      (d) =>
        (d.sender ?? "").toLowerCase().includes(q) ||
        (d.senderName ?? "").toLowerCase().includes(q) ||
        (d.message ?? "").toLowerCase().includes(q) ||
        (d.category ?? "").toLowerCase().includes(q) ||
        (d.danfeKey ?? "").toLowerCase().includes(q.replace(/\D/g, "")) ||
        (d.danfeKey ?? "").toLowerCase().includes(q),
    );
  }, [despesas, search, statusFilter]);

  const totalAmount = useMemo(
    () => filtered.reduce((sum, d) => sum + (d.amount ?? 0), 0),
    [filtered],
  );

  if (isLoading) {
    return (
      <PageSkeleton>
        <TableSkeleton rows={8} cols={6} />
      </PageSkeleton>
    );
  }

  return (
    <div className="animate-fade-rise space-y-8">
      <PageHeader
        eyebrow="Recebidos"
        title="Despesas"
        description="Comprovantes enviados pelos colaboradores. Valor, categoria e descrição extraídos automaticamente por IA."
        actions={
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            Atualizar
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-foreground">
              {despesas.length} {despesas.length === 1 ? "despesa" : "despesas"}
            </p>
            <p className="text-xs text-muted-foreground">
              Total filtrado: <span className="font-medium text-foreground">{formatBRL(totalAmount)}</span>
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por telefone, nome, categoria, chave DANFE…"
                className="h-9 pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Todos os status</option>
                <option value="recebido">Recebido</option>
                <option value="em_analise">Em análise</option>
                <option value="processado">Processado</option>
                <option value="arquivado">Arquivado</option>
              </select>
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="Nenhuma despesa por aqui"
            description={
              search || statusFilter
                ? "Não encontramos nenhuma despesa com esses filtros. Tente limpar."
                : "Assim que um colaborador enviar um comprovante, ele aparece aqui automaticamente com valor e categoria lidos por IA."
            }
            action={
              search || statusFilter ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("");
                  }}
                >
                  Limpar filtros
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1020px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Remetente</th>
                  <th className="px-5 py-3 font-medium">Descrição / Categoria</th>
                  <th className="px-5 py-3 font-medium">Valor</th>
                  <th className="px-5 py-3 font-medium">Chave DANFE</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Comprovante</th>
                  <th className="whitespace-nowrap px-5 py-3 text-right font-medium">
                    Recebido em
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((d) => {
                  const ChannelIcon =
                    d.channel === "email" ? Mail : MessageCircle;
                  return (
                    <tr
                      key={d.id}
                      className="transition-colors hover:bg-secondary/40"
                    >
                      <td className="whitespace-nowrap px-5 py-4 align-top">
                        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          {d.senderName || d.sender}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          <ChannelIcon className="inline h-3 w-3" /> {d.sender}
                        </span>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <p className="max-w-[20rem] truncate text-foreground">
                          {d.message || "—"}
                        </p>
                        {d.category && (
                          <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground ring-1 ring-border">
                            {d.category}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 align-top tabular-nums font-medium text-foreground">
                        {formatBRL(d.amount)}
                      </td>
                      <td className="px-5 py-4 align-top">
                        {d.danfeKey ? (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(d.danfeKey!);
                              toast.success("Chave DANFE copiada");
                            }}
                            title={`${d.danfeKey} (clique para copiar)`}
                            className="font-mono text-xs tabular-nums text-foreground hover:text-primary"
                          >
                            …{d.danfeKey.slice(-12)}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 align-top">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                            statusConfig[d.status] ??
                              "bg-muted text-muted-foreground ring-1 ring-border",
                          )}
                        >
                          {statusLabels[d.status] ?? d.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 align-top">
                        {d.attachmentUrl ? (
                          <button
                            type="button"
                            onClick={() => openComprovante(d.attachmentUrl!)}
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                            Ver comprovante
                          </button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right align-top tabular-nums text-muted-foreground">
                        {formatDateTime(d.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {isError && (
          <div className="border-t border-border p-4 text-sm text-destructive">
            Não foi possível carregar as despesas. Tente atualizar.
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            {filtered.length}{" "}
            {filtered.length === 1 ? "despesa exibida" : "despesas exibidas"}
          </span>
          <span className="text-muted-foreground">
            Total filtrado: <span className="font-medium text-foreground">{formatBRL(totalAmount)}</span>
          </span>
        </div>
      </Card>
    </div>
  );
}
