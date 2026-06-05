import { cn } from "@/lib/utils";
import { type Verdict, verdictLabels } from "@/lib/api";
import { ThumbsUp, AlertTriangle, ThumbsDown } from "lucide-react";

const config: Record<Verdict, { className: string; dot: string; icon: typeof ThumbsUp }> = {
  aprovar: {
    className: "bg-success/12 text-success ring-1 ring-success/25",
    dot: "bg-success",
    icon: ThumbsUp,
  },
  revisar: {
    className: "bg-warning/15 text-warning-foreground ring-1 ring-warning/30",
    dot: "bg-warning",
    icon: AlertTriangle,
  },
  recusar: {
    className: "bg-destructive/12 text-destructive ring-1 ring-destructive/25",
    dot: "bg-destructive",
    icon: ThumbsDown,
  },
};

export function VerdictBadge({
  verdict,
  size = "md",
  withIcon = true,
  className,
}: {
  verdict: Verdict;
  size?: "sm" | "md";
  withIcon?: boolean;
  className?: string;
}) {
  const cfg = config[verdict];
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap",
        cfg.className,
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
        className,
      )}
    >
      {withIcon ? (
        <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
      ) : (
        <span className={cn("h-2 w-2 rounded-full", cfg.dot)} />
      )}
      {verdictLabels[verdict]}
    </span>
  );
}
