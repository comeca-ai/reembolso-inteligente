import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { isAuthenticated, hasPolicyUploadedSync } from "@/lib/auth";

export const Route = createFileRoute("/_app")({
  // Sessão vive no cliente (Auth + localStorage), então desligamos SSR
  // para que o guard rode no cliente e evite loops de redirecionamento.
  ssr: false,
  beforeLoad: async () => {
    if (!(await isAuthenticated())) {
      throw redirect({ to: "/login" });
    }
    // Trava obrigatória: enquanto a política de reembolso não for enviada,
    // o admin fica preso no onboarding (peça-chave do sistema).
    if (!hasPolicyUploadedSync()) {
      throw redirect({ to: "/onboarding" });
    }
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
