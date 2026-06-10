import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { ShieldCheck, Sparkles, FileCheck2 } from "lucide-react";

/**
 * Layout de tela de autenticação (split premium).
 * Painel esquerdo de marca (apenas desktop) + formulário à direita.
 */
export function AuthLayout({
  children,
  eyebrow,
  title,
  subtitle,
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="grid min-h-screen w-full lg:grid-cols-2">
      {/* Painel de marca */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-8 text-sidebar-foreground lg:flex lg:sticky lg:top-0 lg:h-screen xl:p-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(120% 80% at 0% 0%, oklch(0.55 0.09 200 / 0.25), transparent 60%)",
          }}
        />
        <div className="relative">
          <Logo variant="light" />
        </div>

        <div className="relative space-y-6">
          <h2 className="max-w-sm text-2xl font-semibold leading-snug text-sidebar-foreground">
            Reembolsos de equipes de campo no automático, com decisão humana.
          </h2>
          <ul className="space-y-3.5 text-sm text-sidebar-foreground/80">
            <li className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-sidebar-primary" />
              IA extrai os dados do comprovante e compara com a sua política.
            </li>
            <li className="flex items-start gap-3">
              <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-sidebar-primary" />
              Recomendação explicável para o aprovador decidir em segundos.
            </li>
            <li className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sidebar-primary" />
              Trilha de auditoria, LGPD e política versionada por padrão.
            </li>
          </ul>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-sidebar-foreground/60">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sidebar-border/60 px-2.5 py-1 font-medium text-sidebar-foreground/80">
            Configuração da solução
          </span>
          <span>· IA explicável com decisão humana</span>
        </div>
      </aside>

      {/* Formulário */}
      <main className="flex min-h-screen items-start justify-center px-5 py-6 sm:px-8 sm:py-8">
        <div className="w-full max-w-xl py-2 lg:my-auto">
          <div className="mb-6 lg:hidden">
            <Logo />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">{eyebrow}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-4 sm:mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
