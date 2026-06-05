import { ShieldCheck, FileCheck2, History, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const signals = [
  {
    icon: ShieldCheck,
    label: "LGPD",
    detail: "Dados pessoais mascarados e tratados conforme a LGPD.",
  },
  {
    icon: FileCheck2,
    label: "Política versionada",
    detail: "Toda recomendação cita a versão vigente da política.",
  },
  {
    icon: History,
    label: "Trilha de auditoria",
    detail: "Cada decisão fica registrada com autor, data e justificativa.",
  },
  {
    icon: UserCheck,
    label: "Decisão humana",
    detail: "A IA recomenda; a aprovação final é sempre de uma pessoa.",
  },
];

/**
 * Faixa de sinais de confiança — reforça segurança e governança para o
 * financeiro da empresa-piloto.
 */
export function TrustStrip({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "grid gap-px overflow-hidden rounded-xl border bg-border shadow-[var(--shadow-card)] sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {signals.map((s) => {
        const Icon = s.icon;
        return (
          <div key={s.label} className="flex items-start gap-3 bg-card p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Icon className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{s.label}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{s.detail}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Versão compacta para rodapés e barras laterais. */
export function TrustChips({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2", className)}>
      {signals.map((s) => {
        const Icon = s.icon;
        return (
          <span
            key={s.label}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
          >
            <Icon className="h-3.5 w-3.5 text-brand" />
            {s.label}
          </span>
        );
      })}
    </div>
  );
}
