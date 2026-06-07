import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ReceiptText, RefreshCw, Paperclip, Phone } from "lucide-react";
import { PageSkeleton, TableSkeleton } from "@/components/shared/Skeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface Despesa {
  id: number;
  telefone: string | null;
  recibo: string | null;
  created_at: string;
}

const DESPESAS_KEY = ["despesas"] as const;

async function fetchDespesas(): Promise<Despesa[]> {
  const { data, error } = await supabase
    .from("despesas")
    .select("id, telefone, recibo, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Despesa[];
}

export const Route = createFileRoute("/_app/expenses/")({
  head: () => ({ meta: [{ title: "Despesas · reembolsa.aí" }] }),
  pendingComponent: () => (
    <PageSkeleton>
      <TableSkeleton rows={8} cols={3} />
    </PageSkeleton>
  ),
  component: ExpensesPage,
});

function formatDateTime(value: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function isUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

function ExpensesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: DESPESAS_KEY,
    queryFn: fetchDespesas,
  });

  const despesas = useMemo(() => data ?? [], [data]);

  // Realtime: novas despesas inseridas (ex.: enviadas pelo WhatsApp) aparecem
  // automaticamente no topo da lista, sem recarregar a página.
  useEffect(() => {
    const channel = supabase
      .channel("despesas-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "despesas" },
        (payload) => {
          const nova = payload.new as Despesa;
          queryClient.setQueryData<Despesa[]>(DESPESAS_KEY, (prev) => {
            const list = prev ?? [];
            if (list.some((d) => d.id === nova.id)) return list;
            return [nova, ...list];
          });
          toast.success("Nova despesa recebida", {
            description: nova.telefone ?? undefined,
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
    if (!q) return despesas;
    return despesas.filter((d) => (d.telefone ?? "").toLowerCase().includes(q));
  }, [despesas, search]);

  if (isLoading) {
    return (
      <PageSkeleton>
        <TableSkeleton rows={8} cols={3} />
      </PageSkeleton>
    );
  }

  return (
    <div className="animate-fade-rise space-y-8">
      <PageHeader
        eyebrow="Recebidos"
        title="Despesas"
        description="Comprovantes enviados pelos colaboradores. Novas despesas aparecem aqui em tempo real."
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
          <p className="text-sm font-medium text-foreground">
            {despesas.length} {despesas.length === 1 ? "despesa" : "despesas"}
          </p>
          <div className="relative w-full lg:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por telefone…"
              className="h-9 pl-9"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="Nenhuma despesa por aqui"
            description={
              search
                ? "Não encontramos nenhuma despesa com esse telefone. Tente outro termo ou limpe a busca."
                : "Assim que um colaborador enviar um comprovante, ele aparece aqui automaticamente."
            }
            action={
              search ? (
                <Button variant="outline" onClick={() => setSearch("")}>
                  Limpar busca
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Telefone</th>
                  <th className="px-5 py-3 font-medium">Recibo</th>
                  <th className="whitespace-nowrap px-5 py-3 text-right font-medium">
                    Recebido em
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((d) => (
                  <tr key={d.id} className="transition-colors hover:bg-secondary/40">
                    <td className="whitespace-nowrap px-5 py-4 align-top">
                      <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        {d.telefone ?? "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-top">
                      {d.recibo ? (
                        isUrl(d.recibo) ? (
                          <a
                            href={d.recibo}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                            Abrir comprovante
                          </a>
                        ) : (
                          <span className="block max-w-[28rem] whitespace-pre-wrap text-foreground">
                            {d.recibo}
                          </span>
                        )
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right align-top tabular-nums text-muted-foreground">
                      {formatDateTime(d.created_at)}
                    </td>
                  </tr>
                ))}
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
            {filtered.length} {filtered.length === 1 ? "despesa exibida" : "despesas exibidas"}
          </span>
        </div>
      </Card>
    </div>
  );
}
