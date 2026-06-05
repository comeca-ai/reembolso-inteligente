import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { isAuthenticated, hasPolicyUploaded } from "@/lib/auth";

export const Route = createFileRoute("/_app")({
  // Auth mockada vive em localStorage (client-side), então desligamos SSR
  // para que o guard rode no cliente e evite loops de redirecionamento.
  ssr: false,
  beforeLoad: () => {
    if (!isAuthenticated()) {
      throw redirect({ to: "/login" });
    }
    // Trava obrigatória: enquanto a política de reembolso não for enviada,
    // o admin fica preso no onboarding (peça-chave do sistema).
    if (!hasPolicyUploaded()) {
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
