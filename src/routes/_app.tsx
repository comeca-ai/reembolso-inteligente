import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { isAuthenticated, hasPolicyUploadedSync, getCurrentUser } from "@/lib/auth";

export const Route = createFileRoute("/_app")({
  // Sessão vive no cliente (Auth + localStorage), então desligamos SSR
  // para que o guard rode no cliente e evite loops de redirecionamento.
  ssr: false,
  beforeLoad: async () => {
    if (!(await isAuthenticated())) {
      throw redirect({ to: "/login" });
    }
    // Trava de onboarding (envio da política) é exclusiva do admin que está
    // configurando a empresa. Usuários convidados (approver/member) — que não
    // necessariamente passaram pelo pré-cadastro — entram direto na aplicação.
    const role = getCurrentUser()?.role;
    if (role === "admin" && !hasPolicyUploadedSync()) {
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
