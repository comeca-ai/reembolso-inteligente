import { cn } from "@/lib/utils";
import {
  type ExpenseStatus,
  type Channel,
  statusLabels,
  channelLabels,
} from "@/lib/api";
import { CheckCircle2, Clock, Loader2, XCircle, ShieldCheck, MessageCircle, Mail } from "lucide-react";

const statusConfig: Record<
  ExpenseStatus,
  { className: string; icon: typeof CheckCircle2 }
> = {
  pendente: { className: "bg-warning/15 text-warning-foreground ring-1 ring-warning/30", icon: Clock },
  extraindo: { className: "bg-muted text-muted-foreground ring-1 ring-border", icon: Loader2 },
  em_analise: { className: "bg-primary/10 text-primary ring-1 ring-primary/25", icon: Loader2 },
  aprovado: { className: "bg-success/15 text-success ring-1 ring-success/30", icon: CheckCircle2 },
  aprovado_ressalva: { className: "bg-success/10 text-success ring-1 ring-success/25", icon: ShieldCheck },
  recusado: { className: "bg-destructive/12 text-destructive ring-1 ring-destructive/25", icon: XCircle },
};

export function StatusBadge({ status, className }: { status: ExpenseStatus; className?: string }) {
  const cfg = statusConfig[status];
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        cfg.className,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {statusLabels[status]}
    </span>
  );
}

export function ChannelBadge({ channel, className }: { channel: Channel; className?: string }) {
  const Icon = channel === "whatsapp" ? MessageCircle : Mail;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {channelLabels[channel]}
    </span>
  );
}
