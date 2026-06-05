import { cn } from "@/lib/utils";

/** Bloco base de skeleton com shimmer sutil. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted",
        "after:absolute after:inset-0 after:-translate-x-full after:bg-gradient-to-r after:from-transparent after:via-card/60 after:to-transparent after:[animation:shimmer_1.6s_infinite]",
        className,
      )}
    />
  );
}

/** Grade de cards KPI em carregamento. */
export function KpiSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="mt-4 h-7 w-24" />
          <Skeleton className="mt-2 h-4 w-28" />
          <Skeleton className="mt-1.5 h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Tabela densa em carregamento. */
export function TableSkeleton({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-xl border bg-card shadow-[var(--shadow-card)]">
      <div className="border-b border-border p-4">
        <Skeleton className="h-9 w-72" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 py-3.5">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton
                key={c}
                className={cn("h-5", c === 0 ? "w-20" : c === 1 ? "flex-1" : "w-16")}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Bloco de página completa com cabeçalho + conteúdo. */
export function PageSkeleton({ children }: { children?: React.ReactNode }) {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      {children}
    </div>
  );
}
