import { createFileRoute, redirect } from "@tanstack/react-router";

// Alias em português para a página de pré-cadastro.
export const Route = createFileRoute("/pre-cadastro")({
  beforeLoad: () => {
    throw redirect({ to: "/signup" });
  },
});
