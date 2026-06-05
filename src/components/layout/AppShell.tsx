import { useState, type ReactNode } from "react";
import { SidebarNav } from "./SidebarNav";
import { Logo } from "@/components/brand/Logo";
import { DemoDataBadge } from "@/components/shared/DemoDataBadge";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Menu, Search, Bell } from "lucide-react";
import { Input } from "@/components/ui/input";


export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen w-full bg-background">
      {/* Sidebar fixa (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <SidebarNav />
      </aside>

      <div className="lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur sm:px-6">
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

          <div className="relative hidden flex-1 sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por protocolo, colaborador ou estabelecimento…"
              className="h-9 max-w-md pl-9"
            />
          </div>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
            <DemoDataBadge />
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive ring-2 ring-card" />
            </Button>

            <div className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 hover:bg-secondary">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-brand text-brand-foreground text-xs font-semibold">
                  CM
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left leading-tight sm:block">
                <p className="text-sm font-medium text-foreground">Carla Menezes</p>
                <p className="text-xs text-muted-foreground">Aprovadora · Ops Sul</p>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
