import type { AuthUser } from "@/lib/auth";

type Role = AuthUser["role"];

const VALID_ROLES: Role[] = ["admin", "approver", "member"];

export function resolveSessionRole(
  roleRows: Array<{ role: string | null }> | null | undefined,
  fallback: Role = "member",
): Role {
  const roles = (roleRows ?? [])
    .map((row) => row.role)
    .filter((role): role is Role => VALID_ROLES.includes(role as Role));

  return roles.includes("admin") ? "admin" : roles[0] ?? fallback;
}

export function shouldRequirePolicyOnboarding(
  user: Pick<AuthUser, "role" | "company"> | null | undefined,
): boolean {
  // Só exige onboarding quando a empresa foi efetivamente carregada
  // (company.id presente) e ainda está sem política. Se a consulta da empresa
  // falhou de forma transitória (corrida de sessão), o id vem vazio — nesse
  // caso NÃO travamos o admin no onboarding indevidamente.
  return (
    user?.role === "admin" &&
    !!user.company.id &&
    !user.company.politica_reembolso_arquivo
  );
}

const SKIP_KEY = "skipPolicyOnboarding";

/**
 * Marca que o admin optou por entrar sem enviar a política/pré-cadastro agora.
 * Persiste na sessão do navegador para não voltar a travar no onboarding.
 */
export function skipPolicyOnboarding(): void {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(SKIP_KEY, "1");
  }
}

/** Indica se o admin pediu para entrar sem concluir o pré-cadastro. */
export function policyOnboardingSkipped(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(SKIP_KEY) === "1";
}