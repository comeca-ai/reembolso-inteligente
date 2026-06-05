import { cn } from "@/lib/utils";
import { type RuleCheckResult, type RuleStatus } from "@/lib/api";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

const config: Record<
  RuleStatus,
  { icon: typeof CheckCircle2; iconColor: string; ring: string; label: string }
> = {
  ok: { icon: CheckCircle2, iconColor: "text-success", ring: "ring-success/20 bg-success/5", label: "OK" },
  alerta: { icon: AlertTriangle, iconColor: "text-warning", ring: "ring-warning/25 bg-warning/5", label: "Atenção" },
  violado: { icon: XCircle, iconColor: "text-destructive", ring: "ring-destructive/20 bg-destructive/5", label: "Violado" },
};

/** Semáforo compacto: três pontos resumindo os checks. */
export function RuleTrafficLight({ rules, className }: { rules: RuleCheckResult[]; className?: string }) {
  const count = (s: RuleStatus) => rules.filter((r) => r.status === s).length;
  const items: Array<{ status: RuleStatus; n: number }> = [
    { status: "ok", n: count("ok") },
    { status: "alerta", n: count("alerta") },
    { status: "violado", n: count("violado") },
  ];
  const colorDot: Record<RuleStatus, string> = {
    ok: "bg-success",
    alerta: "bg-warning",
    violado: "bg-destructive",
  };
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      {items.map((it) => (
        <span key={it.status} className="inline-flex items-center gap-1">
          <span className={cn("h-2.5 w-2.5 rounded-full", it.n > 0 ? colorDot[it.status] : "bg-border")} />
          <span className="text-xs font-medium tabular-nums text-muted-foreground">{it.n}</span>
        </span>
      ))}
    </div>
  );
}

export function RuleCheckItem({ rule }: { rule: RuleCheckResult }) {
  const cfg = config[rule.status];
  const Icon = cfg.icon;
  return (
    <li className={cn("flex gap-3 rounded-lg p-3 ring-1", cfg.ring)}>
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", cfg.iconColor)} />
      <div className="min-w-0 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-foreground">{rule.label}</p>
          {rule.policyClause && (
            <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
              Cláusula {rule.policyClause}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{rule.detail}</p>
      </div>
    </li>
  );
}

export function RuleCheckList({ rules }: { rules: RuleCheckResult[] }) {
  return (
    <ul className="space-y-2">
      {rules.map((r) => (
        <RuleCheckItem key={r.id} rule={r} />
      ))}
    </ul>
  );
}
