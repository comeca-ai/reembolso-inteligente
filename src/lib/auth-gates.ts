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
  return user?.role === "admin" && !user.company.politica_reembolso_arquivo;
}