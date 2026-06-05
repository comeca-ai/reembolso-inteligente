import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { isAuthenticated } from "@/lib/auth";

export const Route = createFileRoute("/_app")({
  // Auth mockada vive em localStorage (client-side), então desligamos SSR
  // para que o guard rode no cliente e evite loops de redirecionamento.
  ssr: false,
  beforeLoad: ({ location }) => {
    if (!isAuthenticated()) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
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
