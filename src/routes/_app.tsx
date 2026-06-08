import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { isAuthenticated, getCurrentUser } from "@/lib/auth";
import { shouldRequirePolicyOnboarding, policyOnboardingSkipped } from "@/lib/auth-gates";

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
    if (shouldRequirePolicyOnboarding(getCurrentUser()) && !policyOnboardingSkipped()) {
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
