import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Estado vazio premium — ícone em destaque, título, copy de apoio e ação opcional.
 * Usado em listas e tabelas quando não há dados ou os filtros não retornam nada.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex animate-fade-rise flex-col items-center justify-center px-6 py-16 text-center",
        className,
      )}
    >
      <div className="relative mb-5">
        <div className="absolute inset-0 -z-10 rounded-full bg-brand/10 blur-xl" />
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-secondary ring-1 ring-border">
          <Icon className="h-6 w-6 text-brand" />
        </div>
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
