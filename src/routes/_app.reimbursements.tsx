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
  type InboundReimbursementDTO,
} from "@/lib/reimbursements.functions";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton, TableSkeleton } from "@/components/shared/Skeletons";
import {
  Inbox,
  Copy,
  Check,
  MessageCircle,
  Mail,
  Link2,
  RefreshCw,
  Paperclip,
  UserCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/reimbursements")({
  head: () => ({ meta: [{ title: "Reembolsos recebidos · reembolsa.aí" }] }),
  beforeLoad: () => {
    const role = getCurrentUser()?.role;
    if (!canAccess("/reimbursements", role)) {
      throw redirect({ to: landingForRole(role) });
    }
  },
  component: ReimbursementsPage,
});

const WEBHOOK_PATH = "/api/public/reimbursements";

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

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5 shrink-0"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success(`${label} copiado`);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Não foi possível copiar.");
        }
      }}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      Copiar
    </Button>
  );
}

function ReimbursementsPage() {
  const fetchConfig = useServerFn(getReimbursementsConfig);
  const updateStatus = useServerFn(updateReimbursementStatus);
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

  const webhookUrl =
    typeof window !== "undefined" ? `${window.location.origin}${WEBHOOK_PATH}` : WEBHOOK_PATH;

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
        description="Mensagens enviadas pelos colaboradores via webhook (WhatsApp, e-mail ou outro canal) chegam aqui para triagem."
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

      {data?.isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Link2 className="h-4 w-4 text-primary" />
              Endpoint do webhook
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                URL (POST)
              </p>
              <div className="flex items-center gap-2">
                <code className="block w-full overflow-x-auto rounded-md bg-muted px-3 py-2 text-sm">
                  {webhookUrl}
                </code>
                <CopyButton value={webhookUrl} label="URL" />
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Token da empresa (header <code>x-webhook-token</code>)
              </p>
              <div className="flex items-center gap-2">
                <code className="block w-full overflow-x-auto rounded-md bg-muted px-3 py-2 text-sm">
                  {data.webhookToken ?? "—"}
                </code>
                {data.webhookToken && (
                  <CopyButton value={data.webhookToken} label="Token" />
                )}
              </div>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Envie um <span className="font-medium text-foreground">POST</span> com o cabeçalho{" "}
              <code>x-webhook-token</code> e um corpo JSON contendo ao menos{" "}
              <code>sender</code>. Campos opcionais: <code>sender_name</code>,{" "}
              <code>channel</code>, <code>message</code>, <code>attachment_url</code>,{" "}
              <code>amount</code>, <code>category</code>.
            </p>
          </CardContent>
        </Card>
      )}

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
                : "Assim que um colaborador enviar um comprovante pelo webhook, ele aparece aqui automaticamente."
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
                onAdvance={(status) => mutation.mutate({ id: m.id, status })}
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
  onAdvance,
}: {
  item: InboundReimbursementDTO;
  pending: boolean;
  onAdvance: (status: (typeof STATUS_FLOW)[number]) => void;
}) {
  const ChannelIcon = item.channel === "email" ? Mail : MessageCircle;
  const idx = STATUS_FLOW.indexOf(item.status as (typeof STATUS_FLOW)[number]);
  const next = idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;

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
      </div>

      {next && (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={pending}
          onClick={() => onAdvance(next)}
        >
          Marcar como {statusLabels[next]}
        </Button>
      )}
    </div>
  );
}
