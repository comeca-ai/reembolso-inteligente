import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/Logo";
import { getCurrentUser, signOut } from "@/lib/auth";
import { canAccess, landingForRole } from "@/lib/permissions";
import {
  LayoutDashboard,
  ReceiptText,
  FileCheck2,
  Users,
  BarChart3,
  Sparkles,
  ShieldCheck,
  LogOut,
  Inbox,
  FileSearch,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

const nav = [
  { to: "/overview", label: "Visão geral", icon: LayoutDashboard },
  { to: "/expenses", label: "Despesas", icon: ReceiptText },
  { to: "/reimbursements", label: "Reembolsos recebidos", icon: Inbox },
  { to: "/policy", label: "Política", icon: FileCheck2 },
  { to: "/users", label: "Cadastros", icon: Users },
  { to: "/reports", label: "Relatórios", icon: BarChart3 },
] as const;

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const role = getCurrentUser()?.role;
  const visibleNav = nav.filter((item) => canAccess(item.to, role));

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center border-b border-sidebar-border/60 px-5">
        <Link to={landingForRole(role)} aria-label="reembolso.ia.br — Início">
          <Logo variant="light" className="h-7" />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          Operação
        </p>
        {visibleNav.map((item) => {
          const active =
            pathname === item.to || (item.to !== "/overview" && pathname.startsWith(item.to));
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              {active && (
                <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-sidebar-primary" />
              )}
              <Icon
                className={cn(
                  "h-[18px] w-[18px] transition-colors",
                  active ? "text-sidebar-primary" : "text-sidebar-foreground/60",
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 p-3">
        <button
          onClick={async () => {
            await signOut();
            toast.success("Você saiu da sua conta", {
              description: "Até a próxima!",
            });
            navigate({ to: "/login" });
            onNavigate?.();
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        >
          <LogOut className="h-[18px] w-[18px] text-sidebar-foreground/60" />
          Sair da aplicação
        </button>

        <div className="space-y-3">
          <div className="rounded-xl bg-sidebar-accent/50 p-4 ring-1 ring-sidebar-border">
            <div className="flex items-center gap-2 text-sidebar-primary">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-semibold">IA ativa</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-sidebar-foreground/70">
              Comprovantes recebidos por WhatsApp e e-mail são analisados automaticamente.
            </p>
          </div>

          <div className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 ring-1 ring-sidebar-border/60">
            <ShieldCheck className="h-4 w-4 shrink-0 text-sidebar-primary" />
            <div className="leading-tight">
              <p className="text-xs font-semibold text-sidebar-foreground">Política v3.2 · vigente</p>
              <p className="text-[11px] text-sidebar-foreground/60">Auditoria e LGPD ativas</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
