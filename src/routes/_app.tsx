import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { isAuthenticated } from "@/lib/auth";

export const Route = createFileRoute("/_app")({
  // Sessão vive no cliente (Auth + localStorage), então desligamos SSR
  // para que o guard rode no cliente e evite loops de redirecionamento.
  ssr: false,
  beforeLoad: async () => {
    if (!(await isAuthenticated())) {
      throw redirect({ to: "/login" });
    }
    // Login é apenas e-mail/senha: quem entra vai direto para a aplicação.
    // O envio da política é etapa do fluxo de setup ("Configurar a solução")
    // e acontece lá, não como trava no acesso ao app.
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
