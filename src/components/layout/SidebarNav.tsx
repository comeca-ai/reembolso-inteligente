import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/Logo";
import {
  LayoutDashboard,
  ReceiptText,
  FileCheck2,
  Users,
  BarChart3,
  Sparkles,
} from "lucide-react";

const nav = [
  { to: "/overview", label: "Visão geral", icon: LayoutDashboard },
  { to: "/expenses", label: "Despesas", icon: ReceiptText },
  { to: "/policy", label: "Política", icon: FileCheck2 },
  { to: "/users", label: "Cadastros", icon: Users },
  { to: "/reports", label: "Relatórios", icon: BarChart3 },
] as const;

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center px-5">
        <Logo variant="light" />
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          Operação
        </p>
        {nav.map((item) => {
          const active =
            pathname === item.to || (item.to !== "/overview" && pathname.startsWith(item.to));
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="m-3 rounded-xl bg-sidebar-accent/50 p-4 ring-1 ring-sidebar-border">
        <div className="flex items-center gap-2 text-sidebar-primary">
          <Sparkles className="h-4 w-4" />
          <span className="text-xs font-semibold">IA ativa</span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-sidebar-foreground/70">
          Comprovantes recebidos por WhatsApp e e-mail são analisados automaticamente.
        </p>
      </div>
    </div>
  );
}
