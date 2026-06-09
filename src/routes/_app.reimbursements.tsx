import { useEffect, useMemo, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { getCurrentUser } from "@/lib/auth";
import { canAccess, landingForRole } from "@/lib/permissions";
import { supabase } from "@/integrations/supabase/client";
import {
  getReimbursementsConfig,
  updateReimbursementStatus,
  analyzeReimbursement,
  decideReimbursement,
  setCompanyWhatsapp,
  setCompanyEvolutionInstance,
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
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  ChevronRight,
  Calendar,
  Tag,
  Banknote,
  Smartphone,
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
  pendente_leitura: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  recebido: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  em_analise: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  processado: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  arquivado: "bg-slate-50 text-slate-500 ring-1 ring-slate-200",
};

const statusLabels: Record<string, string> = {
  pendente_leitura: "Revisar leitura",
  recebido: "Recebido",
  em_analise: "Em análise",
  processado: "Processado",
  arquivado: "Arquivado",
};

const STATUS_FLOW = ["recebido", "em_analise", "processado", "arquivado"] as const;

const verdictConfig: Record<
  string,
  { label: string; icon: typeof CheckCircle2; gradient: string; chip: string; glow: string }
> = {
  aprovar: {
    label: "Em linha com a política",
    icon: CheckCircle2,
    gradient: "from-emerald-500/10 via-emerald-500/5 to-transparent",
    chip: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    glow: "shadow-emerald-500/10",
  },
  revisar: {
    label: "Requer revisão",
    icon: AlertTriangle,
    gradient: "from-amber-500/10 via-amber-500/5 to-transparent",
    chip: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    glow: "shadow-amber-500/10",
  },
  recusar: {
    label: "Fora da política",
    icon: XCircle,
    gradient: "from-rose-500/10 via-rose-500/5 to-transparent",
    chip: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
    glow: "shadow-rose-500/10",
  },
};

const decisionConfig: Record<string, { label: string; chip: string; icon: typeof ThumbsUp }> = {
  aprovado: {
    label: "Aprovado",
    chip: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    icon: ThumbsUp,
  },
  negado: {
    label: "Negado",
    chip: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
    icon: ThumbsDown,
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

function formatDate(value: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function ReimbursementsPage() {
  const fetchConfig = useServerFn(getReimbursementsConfig);
  const updateStatus = useServerFn(updateReimbursementStatus);
  const analyze = useServerFn(analyzeReimbursement);
  const decide = useServerFn(decideReimbursement);
  const saveWhatsapp = useServerFn(setCompanyWhatsapp);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [waInput, setWaInput] = useState("");
  const [waDirty, setWaDirty] = useState(false);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["reimbursements-config"],
    queryFn: () => fetchConfig(),
  });

  useEffect(() => {
    if (!waDirty && data?.whatsappNumber != null) {
      setWaInput(data.whatsappNumber);
    }
  }, [data?.whatsappNumber, waDirty]);

  const whatsappMutation = useMutation({
    mutationFn: (vars: { whatsappNumber: string }) => saveWhatsapp({ data: vars }),
    onSuccess: () => {
      setWaDirty(false);
      queryClient.invalidateQueries({ queryKey: ["reimbursements-config"] });
      toast.success("Número de WhatsApp salvo.");
    },
    onError: () => toast.error("Não foi possível salvar o número."),
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

  const decisionMutation = useMutation({
    mutationFn: (vars: { id: string; decision: "pendente" | "aprovado" | "negado" }) =>
      decide({ data: vars }),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["reimbursements-config"] });
      toast.success(
        vars.decision === "aprovado"
          ? "Reembolso aprovado."
          : vars.decision === "negado"
            ? "Reembolso negado."
            : "Decisão reaberta.",
      );
    },
    onError: () => toast.error("Não foi possível registrar a decisão."),
  });

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
    <div className="space-y-8">
      <PageHeader
        eyebrow="Integração"
        title="Reembolsos recebidos"
        description="Comprovantes enviados pelos colaboradores chegam aqui. A IA analisa automaticamente se cada um está em linha com a política da empresa."
        actions={
          <Button
            variant="outline"
            className="gap-2 rounded-lg border-slate-200 hover:bg-slate-50"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            Atualizar
          </Button>
        }
      />

      {data?.isAdmin && (
        <Card className="rounded-[22px] border border-slate-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_40px_-24px_rgba(15,23,42,0.25)]">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-inset ring-primary/10">
              <Smartphone className="h-[18px] w-[18px] text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold tracking-tight text-slate-800">
                WhatsApp da empresa
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Cadastre o número da linha de WhatsApp que recebe os comprovantes.
                É por esse número que identificamos a sua empresa — não é mais
                necessário token no webhook.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  value={waInput}
                  onChange={(e) => {
                    setWaInput(e.target.value);
                    setWaDirty(true);
                  }}
                  placeholder="Ex.: +55 11 99999-9999"
                  className="h-10 max-w-xs rounded-xl border-slate-200 bg-white shadow-sm focus-visible:ring-primary/30"
                />
                <Button
                  className="h-10 gap-2 rounded-xl"
                  disabled={
                    whatsappMutation.isPending ||
                    !waInput.trim() ||
                    (!waDirty && data?.whatsappNumber != null)
                  }
                  onClick={() =>
                    whatsappMutation.mutate({ whatsappNumber: waInput })
                  }
                >
                  {whatsappMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Salvar
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}


      <Card className="overflow-hidden rounded-[22px] border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_40px_-24px_rgba(15,23,42,0.25)]">
        <div className="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-inset ring-primary/10">
              <Inbox className="h-[18px] w-[18px] text-primary" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight text-slate-800">
                {messages.length} {messages.length === 1 ? "mensagem" : "mensagens"}
              </p>
              <p className="text-xs text-slate-400">na caixa de entrada</p>
            </div>
          </div>
          <div className="w-full lg:w-80">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por remetente ou mensagem…"
              className="h-10 rounded-xl border-slate-200 bg-white shadow-sm focus-visible:ring-primary/30"
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
          <div className="divide-y divide-slate-100">
            <AnimatePresence mode="popLayout">
              {filtered.map((m, index) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.35, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
                >
                  <ReimbursementRow
                    item={m}
                    pending={mutation.isPending && mutation.variables?.id === m.id}
                    analyzing={
                      analysisMutation.isPending && analysisMutation.variables?.id === m.id
                    }
                    deciding={
                      decisionMutation.isPending && decisionMutation.variables?.id === m.id
                    }
                    onAdvance={(status) => mutation.mutate({ id: m.id, status })}
                    onAnalyze={() => analysisMutation.mutate({ id: m.id })}
                    onDecide={(decision) => decisionMutation.mutate({ id: m.id, decision })}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {isError && (
          <div className="border-t border-slate-100 p-5 text-sm text-destructive">
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
  deciding,
  onAdvance,
  onAnalyze,
  onDecide,
}: {
  item: InboundReimbursementDTO;
  pending: boolean;
  analyzing: boolean;
  deciding: boolean;
  onAdvance: (status: (typeof STATUS_FLOW)[number]) => void;
  onAnalyze: () => void;
  onDecide: (decision: "pendente" | "aprovado" | "negado") => void;
}) {
  const ChannelIcon = item.channel === "email" ? Mail : MessageCircle;
  const idx = STATUS_FLOW.indexOf(item.status as (typeof STATUS_FLOW)[number]);
  const next =
    item.status === "pendente_leitura"
      ? STATUS_FLOW[0]
      : idx >= 0 && idx < STATUS_FLOW.length - 1
        ? STATUS_FLOW[idx + 1]
        : null;
  const verdict = item.policyVerdict ? verdictConfig[item.policyVerdict] : null;
  const decision = decisionConfig[item.decision];

  return (
    <motion.div
      whileHover={{ backgroundColor: "rgba(248, 250, 252, 0.7)" }}
      transition={{ duration: 0.2 }}
      className="group relative flex flex-col gap-4 px-6 py-5 transition-colors sm:flex-row sm:items-start sm:justify-between"
    >
      {/* Subtle left accent line */}
      <div
        className={cn(
          "absolute left-0 top-5 bottom-5 w-[3px] rounded-full transition-opacity opacity-0 group-hover:opacity-100",
          verdict
            ? item.policyVerdict === "aprovar"
              ? "bg-emerald-400"
              : item.policyVerdict === "revisar"
                ? "bg-amber-400"
                : "bg-rose-400"
            : "bg-slate-300",
        )}
      />

      <div className="flex min-w-0 flex-1 gap-3.5 pl-0 sm:pl-3">
        {/* Avatar */}
        <div className="mt-0.5 hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold uppercase text-slate-500 ring-1 ring-inset ring-slate-200/80 sm:flex">
          {(item.senderName || item.sender || "?").trim().charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
        {/* Header row */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold tracking-tight text-slate-800">
            {item.senderName || item.sender}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
            <ChannelIcon className="h-3.5 w-3.5" />
            {item.sender}
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              statusConfig[item.status] ?? "bg-slate-50 text-slate-500 ring-1 ring-slate-200",
            )}
          >
            {statusLabels[item.status] ?? item.status}
          </span>
          {item.collaboratorName ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
              <UserCheck className="h-3.5 w-3.5" />
              {item.collaboratorName}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-400 ring-1 ring-slate-200">
              <UserX className="h-3.5 w-3.5" />
              Sem colaborador
            </span>
          )}
          {verdict && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                verdict.chip,
              )}
            >
              <verdict.icon className="h-3.5 w-3.5" />
              {verdict.label}
            </span>
          )}
          {decision && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                decision.chip,
              )}
            >
              <decision.icon className="h-3.5 w-3.5" />
              {decision.label}
            </span>
          )}
        </div>

        {/* Message */}
        {item.message && (
          <p className="mt-2 text-sm leading-relaxed text-slate-500">{item.message}</p>
        )}

        {/* Metadata row */}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-400">
          {item.category && (
            <span className="inline-flex items-center gap-1 capitalize">
              <Tag className="h-3.5 w-3.5" />
              {item.category}
            </span>
          )}
          {item.amount !== null && (
            <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
              <Banknote className="h-3.5 w-3.5 text-slate-400" />
              {formatBRL(item.amount)}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {formatDateTime(item.createdAt)}
          </span>
          {item.attachmentUrl && (
            <a
              href={item.attachmentUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:text-primary/80 hover:underline transition-colors"
            >
              <Paperclip className="h-3.5 w-3.5" />
              Comprovante
            </a>
          )}
        </div>

        {/* AI Verdict Box */}
        {verdict ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ duration: 0.3 }}
            className={cn(
              "mt-4 overflow-hidden rounded-xl border bg-gradient-to-r p-4",
              verdict.gradient,
              item.policyVerdict === "aprovar"
                ? "border-emerald-200/60"
                : item.policyVerdict === "revisar"
                  ? "border-amber-200/60"
                  : "border-rose-200/60",
            )}
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/80 shadow-sm">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </div>
              Observação da IA
              {item.policyCitedRule && (
                <span className="font-normal text-slate-400">
                  · cláusula {item.policyCitedRule}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.policySummary}</p>
          </motion.div>
        ) : (
          <p className="mt-3 text-xs text-slate-400">
            A IA ainda não avaliou este comprovante.
          </p>
        )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 flex-col items-stretch gap-2.5 sm:items-end sm:pt-1">
        {/* AI Analysis Button */}
        <Button
          variant={verdict ? "ghost" : "secondary"}
          size="sm"
          className={cn(
            "gap-2 rounded-lg text-xs font-medium",
            verdict
              ? "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200",
          )}
          disabled={analyzing}
          onClick={onAnalyze}
        >
          {analyzing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {verdict ? "Reanalisar" : "Analisar com IA"}
        </Button>

        {/* Decision Buttons */}
        {item.decision === "pendente" ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 rounded-lg border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 text-xs font-medium"
              disabled={deciding}
              onClick={() => onDecide("aprovado")}
            >
              {deciding ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ThumbsUp className="h-3.5 w-3.5" />
              )}
              Aprovar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 rounded-lg border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 text-xs font-medium"
              disabled={deciding}
              onClick={() => onDecide("negado")}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
              Negar
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            disabled={deciding}
            onClick={() => onDecide("pendente")}
          >
            {deciding ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
            Reabrir decisão
          </Button>
        )}

        {/* Status Advance */}
        {next && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 rounded-lg text-xs font-medium text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            disabled={pending}
            onClick={() => onAdvance(next)}
          >
            Marcar como {statusLabels[next]}
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </motion.div>
  );
}

