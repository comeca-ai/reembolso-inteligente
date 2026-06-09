import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  CircleDashed,
  Loader2,
  ShieldCheck,
  Play,
} from "lucide-react";
import {
  evaluateCompliance,
  type ComplianceReport,
  type ComplianceStatus,
  type ComplianceStep,
} from "@/lib/compliance.functions";

const statusMeta: Record<
  ComplianceStatus,
  { label: string; icon: typeof CheckCircle2; className: string; dot: string }
> = {
  ok: {
    label: "OK",
    icon: CheckCircle2,
    className: "bg-success/10 text-success ring-success/30",
    dot: "bg-success",
  },
  alerta: {
    label: "Atenção",
    icon: AlertTriangle,
    className: "bg-warning/15 text-warning-foreground ring-warning/30",
    dot: "bg-warning",
  },
  violado: {
    label: "Violado",
    icon: XCircle,
    className: "bg-destructive/10 text-destructive ring-destructive/30",
    dot: "bg-destructive",
  },
  manual: {
    label: "Conferir manual",
    icon: ShieldAlert,
    className: "bg-warning/15 text-warning-foreground ring-warning/30",
    dot: "bg-warning",
  },
  pendente: {
    label: "Pendente",
    icon: CircleDashed,
    className: "bg-muted text-muted-foreground ring-border",
    dot: "bg-muted-foreground/40",
  },
};

function StatusPill({ status }: { status: ComplianceStatus }) {
  const m = statusMeta[status];
  const Icon = m.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1",
        m.className,
      )}
    >
      <Icon className="h-3 w-3" />
      {m.label}
    </span>
  );
}

function StepCard({ step }: { step: ComplianceStep }) {
  const m = statusMeta[step.status];
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("h-2.5 w-2.5 rounded-full", m.dot)} />
        <p className="text-sm font-medium text-foreground">{step.label}</p>
        <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {step.skill}
        </span>
        {step.score !== null && (
          <span className="text-xs tabular-nums text-muted-foreground">
            score {step.score}
            {step.id === "triagem" ? "/100" : step.id === "foto" ? "/10" : ""}
          </span>
        )}
        <span className="ml-auto">
          <StatusPill status={step.status} />
        </span>
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">{step.summary}</p>
      {step.details.length > 0 && (
        <ul className="mt-2 space-y-1">
          {step.details.map((d, i) => (
            <li
              key={i}
              className="flex items-start gap-1.5 text-xs text-muted-foreground"
            >
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-border" />
              <span>{d}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ComplianceDialog({
  open,
  onOpenChange,
  reimbursementId,
  title,
  initialReport,
  onEvaluated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  reimbursementId: string;
  title: string;
  initialReport: ComplianceReport | null;
  onEvaluated?: (report: ComplianceReport) => void;
}) {
  const run = useServerFn(evaluateCompliance);
  const [report, setReport] = useState<ComplianceReport | null>(initialReport);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (open) setReport(initialReport);
  }, [open, initialReport]);

  async function handleRun() {
    setRunning(true);
    try {
      const result = await run({ data: { id: reimbursementId } });
      setReport(result);
      onEvaluated?.(result);
      if (result.overall === "ok") toast.success("Compliance: tudo certo.");
      else if (result.overall === "violado")
        toast.error("Compliance: violação encontrada.");
      else toast.warning("Compliance: revisar os pontos sinalizados.");
    } catch {
      toast.error("Falha ao avaliar compliance. Tente novamente.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Compliance da nota
          </DialogTitle>
          <DialogDescription>
            As três habilidades rodam uma a uma sobre {title}: triagem
            estrutural, verificação na SEFAZ e forense de imagem.
          </DialogDescription>
        </DialogHeader>

        {report ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2">
              <span className="text-sm font-medium text-foreground">
                Veredito geral
              </span>
              <StatusPill status={report.overall} />
            </div>
            <ScrollArea className="max-h-[50vh] pr-2">
              <div className="space-y-2">
                {report.steps.map((s) => (
                  <StepCard key={s.id} step={s} />
                ))}
              </div>
            </ScrollArea>
            <p className="text-center text-[11px] text-muted-foreground">
              Avaliado em{" "}
              {new Date(report.evaluatedAt).toLocaleString("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              })}{" "}
              · apoio à decisão, não veredito legal.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhuma avaliação de compliance ainda. Rode o pipeline para
            analisar esta nota.
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={running}
          >
            Fechar
          </Button>
          <Button className="gap-2" onClick={handleRun} disabled={running}>
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {report ? "Reavaliar" : "Avaliar compliance"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
