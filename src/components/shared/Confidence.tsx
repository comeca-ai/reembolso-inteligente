import { cn } from "@/lib/utils";

function tone(confidence: number) {
  if (confidence >= 0.85) return { label: "Alta", bar: "bg-success", text: "text-success" };
  if (confidence >= 0.7) return { label: "Média", bar: "bg-warning", text: "text-warning-foreground" };
  return { label: "Baixa", bar: "bg-destructive", text: "text-destructive" };
}

export function ConfidenceBadge({
  confidence,
  className,
}: {
  confidence: number;
  className?: string;
}) {
  const pct = Math.round(confidence * 100);
  const t = tone(confidence);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground",
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", t.bar)} />
      <span className="tabular-nums">{pct}%</span>
      <span className="text-muted-foreground">· {t.label}</span>
    </span>
  );
}

export function ConfidenceMeter({
  confidence,
  className,
}: {
  confidence: number;
  className?: string;
}) {
  const pct = Math.round(confidence * 100);
  const t = tone(confidence);
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">Confiança da extração</span>
        <span className={cn("text-sm font-semibold tabular-nums", t.text)}>
          {pct}% · {t.label}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div className={cn("h-full rounded-full transition-all", t.bar)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
