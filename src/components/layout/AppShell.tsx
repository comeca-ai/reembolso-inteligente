import { useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { SidebarNav } from "./SidebarNav";
import { Logo } from "@/components/brand/Logo";

import { TrustChips } from "@/components/shared/TrustStrip";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, Search, Bell, ChevronDown, LogOut, UserCog, LifeBuoy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getCurrentUser, signOut } from "@/lib/auth";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const user = getCurrentUser();

  const userName = user?.nome ?? "Usuário";
  const userEmail = user?.email ?? "";
  const companyName = user?.company.razao_social ?? "Sua Empresa";
  const companyCnpj = user?.company.cnpj ?? "";

  async function handleSignOut() {
    await signOut();
    toast.success("Você saiu da sua conta", {
      description: "Até a próxima!",
    });
    navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen w-full bg-background">
      {/* Sidebar fixa (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <SidebarNav />
      </aside>

      <div className="flex min-h-screen flex-col lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card/85 px-4 backdrop-blur-md sm:px-6">
          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 border-0 p-0">
              <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
              <SidebarNav onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="lg:hidden">
            <Logo withWordmark={false} />
          </div>

          {/* Empresa + ambiente */}
          <div className="hidden items-center gap-2.5 lg:flex">
            <div className="leading-tight">
              <p className="text-sm font-semibold text-foreground">{companyName}</p>
              {companyCnpj && (
                <p className="text-xs text-muted-foreground">CNPJ {companyCnpj}</p>
              )}
            </div>
          </div>

          <div className="relative ml-auto hidden max-w-md flex-1 md:block lg:ml-6">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por protocolo, colaborador ou estabelecimento…"
              className="h-9 pl-9"
            />
          </div>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-3 md:ml-0">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive ring-2 ring-card" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2.5 transition-colors hover:bg-secondary">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-brand text-brand-foreground text-xs font-semibold">
                      {initials(userName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden text-left leading-tight sm:block">
                    <p className="text-sm font-medium text-foreground">{userName}</p>
                    <p className="text-xs text-muted-foreground">Admin · {companyName}</p>
                  </div>
                  <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <p className="text-sm font-medium text-foreground">{userName}</p>
                  {userEmail && (
                    <p className="text-xs text-muted-foreground">{userEmail}</p>
                  )}
                  <span className="mt-1.5 inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                    Admin
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <UserCog className="h-4 w-4" />
                  Perfil e permissões
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <LifeBuoy className="h-4 w-4" />
                  Ajuda e suporte
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
          {children}
        </main>

        {/* Rodapé de confiança */}
        <footer className="border-t border-border bg-card/40">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <TrustChips />
            <p className="text-xs text-muted-foreground">
              reembolsa.aí · IA explicável com decisão humana
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
