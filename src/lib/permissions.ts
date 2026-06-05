/**
 * Controle de acesso por papel (apenas interface).
 *
 * Papéis (de `AuthUser`):
 *   - admin    → vê tudo da empresa + configurações (Política, Cadastros).
 *   - approver → vê as próprias despesas + as dos colaboradores que aprova.
 *                Sem páginas de configuração.
 *   - member   → vê apenas as próprias despesas. Menu reduzido a "Despesas".
 *
 * Observação: este é um reforço de UI. A segurança definitiva deve ser feita
 * no banco (RLS) quando o modelo de dados real estiver conectado.
 */

import type { AuthUser } from "@/lib/auth";
import type { Expense, FieldUser } from "@/lib/api";

export type Role = AuthUser["role"]; // "admin" | "approver" | "member"

/** Rotas do app e quais papéis podem acessá-las. */
export const ROUTE_ACCESS: Record<string, Role[]> = {
  "/overview": ["admin", "approver"],
  "/expenses": ["admin", "approver", "member"],
  "/policy": ["admin"],
  "/users": ["admin"],
  "/reports": ["admin", "approver"],
};

export function canAccess(path: string, role: Role | undefined): boolean {
  const allowed = ROUTE_ACCESS[path];
  if (!allowed) return true;
  return !!role && allowed.includes(role);
}

/** Página inicial conforme o papel (membro não tem "Visão geral"). */
export function landingForRole(role: Role | undefined): "/overview" | "/expenses" {
  return role === "member" ? "/expenses" : "/overview";
}

const norm = (s: string | undefined | null) => (s ?? "").trim().toLowerCase();

/**
 * Filtra as despesas visíveis para o usuário atual.
 *   - admin    → todas.
 *   - approver → as próprias + as dos colaboradores roteados para ele.
 *   - member   → apenas as próprias.
 */
export function filterExpensesForUser(
  expenses: Expense[],
  user: AuthUser | null,
  fieldUsers: FieldUser[],
): Expense[] {
  if (!user || user.role === "admin") return expenses;

  const myName = norm(user.nome);

  if (user.role === "member") {
    return expenses.filter((e) => norm(e.employeeName) === myName);
  }

  // approver: próprias + as que ele aprova
  const approvedNames = new Set(
    fieldUsers
      .filter((fu) => norm(fu.approverName) === myName)
      .map((fu) => norm(fu.name)),
  );

  return expenses.filter(
    (e) => norm(e.employeeName) === myName || approvedNames.has(norm(e.employeeName)),
  );
}

/** Verifica se o usuário atual pode visualizar uma despesa específica. */
export function canViewExpense(
  expense: Expense,
  user: AuthUser | null,
  fieldUsers: FieldUser[],
): boolean {
  return filterExpensesForUser([expense], user, fieldUsers).length > 0;
}
