import { useEffect, useMemo, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCurrentUser } from "@/lib/auth";
import { canAccess, landingForRole } from "@/lib/permissions";
import { supabase } from "@/integrations/supabase/client";
import {
  getReimbursementsConfig,
  updateReimbursementStatus,
  analyzeReimbursement,
  type InboundReimbursementDTO,
} from "@/lib/reimbursements.functions";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton, TableSkeleton } from "@/components/shared/Skeletons";
import {
  Inbox,
  MessageCircle,
  Mail,
  RefreshCw,
  Paperclip,
  UserCheck,
  UserX,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/reimbursements")({
  head: () => ({ meta: [{ title: "Reembolsos recebidos · reembolso.ia.br" }] }),
  beforeLoad: () => {
    const role = getCurrentUser()?.role;
    if (!canAccess("/reimbursements", role)) {
      throw redirect({ to: landingForRole(role) });
    }
  },
  component: ReimbursementsPage,
});

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

const STATUS_FLOW = ["recebido", "em_analise", "processado", "arquivado"] as const;

const verdictConfig: Record<
  string,
  { label: string; icon: typeof CheckCircle2; box: string; chip: string }
> = {
  aprovar: {
    label: "Em linha com a política",
    icon: CheckCircle2,
    box: "border-success/30 bg-success/10",
    chip: "bg-success/15 text-success ring-1 ring-success/30",
  },
  revisar: {
    label: "Requer revisão",
    icon: AlertTriangle,
    box: "border-warning/30 bg-warning/10",
    chip: "bg-warning/15 text-warning-foreground ring-1 ring-warning/30",
  },
  recusar: {
    label: "Fora da política",
    icon: XCircle,
    box: "border-destructive/30 bg-destructive/10",
    chip: "bg-destructive/15 text-destructive ring-1 ring-destructive/30",
  },
};

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

function ReimbursementsPage() {
  const fetchConfig = useServerFn(getReimbursementsConfig);
  const updateStatus = useServerFn(updateReimbursementStatus);
  const analyze = useServerFn(analyzeReimbursement);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["reimbursements-config"],
    queryFn: () => fetchConfig(),
  });

  const mutation = useMutation({
    mutationFn: (vars: { id: string; status: (typeof STATUS_FLOW)[number] }) =>
      updateStatus({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reimbursements-config"] });
    },
    onError: () => toast.error("Não foi possível atualizar o status."),
  });

  const analysisMutation = useMutation({
    mutationFn: (vars: { id: string }) => analyze({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reimbursements-config"] });
      toast.success("Análise da IA concluída.");
    },
    onError: () => toast.error("Não foi possível analisar com a IA."),
  });

  // Atualização em tempo real: novos comprovantes vindos do WhatsApp aparecem
  // automaticamente. A chave de roteamento é sempre o número de telefone.
  useEffect(() => {
    const channel = supabase
      .channel("inbound-reimbursements-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inbound_reimbursements" },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["reimbursements-config"] });
          if (payload.eventType === "INSERT") {
            const row = payload.new as { sender_name?: string; sender?: string };
            toast.success("Novo comprovante recebido", {
              description: row.sender_name || row.sender || "Remetente desconhecido",
            });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const messages = data?.messages ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter(
      (m) =>
        m.sender.toLowerCase().includes(q) ||
        (m.senderName ?? "").toLowerCase().includes(q) ||
        (m.collaboratorName ?? "").toLowerCase().includes(q) ||
        (m.message ?? "").toLowerCase().includes(q),
    );
  }, [messages, search]);

  if (isLoading) {
    return (
      <PageSkeleton>
        <TableSkeleton rows={6} cols={5} />
      </PageSkeleton>
    );
  }

  return (
    <div className="animate-fade-rise space-y-8">
      <PageHeader
        eyebrow="Integração"
        title="Reembolsos recebidos"
        description="Comprovantes enviados pelos colaboradores (WhatsApp, e-mail ou outro canal) chegam aqui. A IA analisa se cada um está em linha com a política."
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
            {messages.length} {messages.length === 1 ? "mensagem" : "mensagens"} recebida
            {messages.length === 1 ? "" : "s"}
          </p>
          <div className="w-full lg:w-80">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por remetente ou mensagem…"
              className="h-9"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Nenhuma mensagem por aqui"
            description={
              search
                ? "Nada encontrado com esse termo. Tente outra busca."
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
          <div className="divide-y divide-border">
            {filtered.map((m) => (
              <ReimbursementRow
                key={m.id}
                item={m}
                pending={mutation.isPending && mutation.variables?.id === m.id}
                analyzing={
                  analysisMutation.isPending && analysisMutation.variables?.id === m.id
                }
                onAdvance={(status) => mutation.mutate({ id: m.id, status })}
                onAnalyze={() => analysisMutation.mutate({ id: m.id })}
              />
            ))}
          </div>
        )}

        {isError && (
          <div className="border-t border-border p-4 text-sm text-destructive">
            Não foi possível carregar as mensagens. Tente atualizar.
          </div>
        )}
      </Card>
    </div>
  );
}

function ReimbursementRow({
  item,
  pending,
  analyzing,
  onAdvance,
  onAnalyze,
}: {
  item: InboundReimbursementDTO;
  pending: boolean;
  analyzing: boolean;
  onAdvance: (status: (typeof STATUS_FLOW)[number]) => void;
  onAnalyze: () => void;
}) {
  const ChannelIcon = item.channel === "email" ? Mail : MessageCircle;
  const idx = STATUS_FLOW.indexOf(item.status as (typeof STATUS_FLOW)[number]);
  const next = idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
  const verdict = item.policyVerdict ? verdictConfig[item.policyVerdict] : null;

  return (
    <div className="flex flex-col gap-3 p-4 transition-colors hover:bg-secondary/40 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">
            {item.senderName || item.sender}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <ChannelIcon className="h-3.5 w-3.5" />
            {item.sender}
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
              statusConfig[item.status] ?? "bg-muted text-muted-foreground ring-1 ring-border",
            )}
          >
            {statusLabels[item.status] ?? item.status}
          </span>
          {item.collaboratorName ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success ring-1 ring-success/30">
              <UserCheck className="h-3.5 w-3.5" />
              {item.collaboratorName}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border">
              <UserX className="h-3.5 w-3.5" />
              Sem colaborador
            </span>
          )}
          {verdict && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                verdict.chip,
              )}
            >
              <verdict.icon className="h-3.5 w-3.5" />
              {verdict.label}
            </span>
          )}
        </div>
        {item.message && (
          <p className="mt-1.5 text-sm text-muted-foreground">{item.message}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {item.category && (
            <span className="capitalize">Categoria: {item.category}</span>
          )}
          {item.amount !== null && (
            <span className="font-medium text-foreground">{formatBRL(item.amount)}</span>
          )}
          <span>{formatDateTime(item.createdAt)}</span>
          {item.attachmentUrl && (
            <a
              href={item.attachmentUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <Paperclip className="h-3.5 w-3.5" />
              Comprovante
            </a>
          )}
        </div>

        {/* Observação da IA sobre conformidade com a política */}
        {verdict ? (
          <div className={cn("mt-3 rounded-lg border p-3", verdict.box)}>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Observação da IA
              {item.policyCitedRule && (
                <span className="font-normal text-muted-foreground">
                  · cláusula {item.policyCitedRule}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-foreground/90">{item.policySummary}</p>
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            A IA ainda não avaliou este comprovante.
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
        <Button
          variant={verdict ? "ghost" : "secondary"}
          size="sm"
          className="gap-1.5"
          disabled={analyzing}
          onClick={onAnalyze}
        >
          {analyzing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {verdict ? "Reanalisar" : "Analisar com IA"}
        </Button>
        {next && (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => onAdvance(next)}
          >
            Marcar como {statusLabels[next]}
          </Button>
        )}
      </div>
    </div>
  );
}
