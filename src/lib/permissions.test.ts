import { describe, expect, it } from "vitest";

import {
  canAccess,
  canViewExpense,
  filterExpensesForUser,
  landingForRole,
} from "./permissions";
import type { AuthUser } from "./auth";
import type { Expense, FieldUser } from "./api";

const company: AuthUser["company"] = {
  id: "c1",
  razao_social: "Empresa",
  cnpj: "00.000.000/0001-00",
};

function user(role: AuthUser["role"], nome: string): AuthUser {
  return {
    id: nome,
    auth_user_id: nome,
    nome,
    email: `${nome}@x.com`,
    role,
    company,
    mustChangePassword: false,
  };
}

function expense(employeeName: string): Expense {
  return { id: employeeName + Math.random(), employeeName } as Expense;
}

function fieldUser(name: string, approverName: string): FieldUser {
  return { name, approverName } as FieldUser;
}

describe("permissions · canAccess", () => {
  it("restringe rotas de configuração a admin", () => {
    expect(canAccess("/policy", "admin")).toBe(true);
    expect(canAccess("/policy", "approver")).toBe(false);
    expect(canAccess("/users", "member")).toBe(false);
  });

  it("libera despesas para todos os papéis", () => {
    expect(canAccess("/expenses", "member")).toBe(true);
    expect(canAccess("/expenses", "approver")).toBe(true);
    expect(canAccess("/expenses", "admin")).toBe(true);
  });

  it("bloqueia visão geral para membro", () => {
    expect(canAccess("/overview", "member")).toBe(false);
    expect(canAccess("/overview", "approver")).toBe(true);
  });

  it("nega quando o papel é indefinido", () => {
    expect(canAccess("/expenses", undefined)).toBe(false);
  });

  it("libera rotas desconhecidas (RLS é o guard real)", () => {
    expect(canAccess("/rota-inexistente", "member")).toBe(true);
  });
});

describe("permissions · landingForRole", () => {
  it("membro cai em despesas, demais em visão geral", () => {
    expect(landingForRole("member")).toBe("/expenses");
    expect(landingForRole("admin")).toBe("/overview");
    expect(landingForRole("approver")).toBe("/overview");
    expect(landingForRole(undefined)).toBe("/overview");
  });
});

describe("permissions · filterExpensesForUser", () => {
  const expenses = [
    expense("Ana"),
    expense("Bruno"),
    expense("Carla"),
  ];
  const fieldUsers: FieldUser[] = [
    fieldUser("Bruno", "Ana"), // Bruno é aprovado pela Ana
    fieldUser("Carla", "Outro"),
  ];

  it("admin vê todas", () => {
    expect(filterExpensesForUser(expenses, user("admin", "Ana"), fieldUsers)).toHaveLength(3);
  });

  it("sem usuário retorna tudo (sem filtro)", () => {
    expect(filterExpensesForUser(expenses, null, fieldUsers)).toHaveLength(3);
  });

  it("membro vê apenas as próprias", () => {
    const result = filterExpensesForUser(expenses, user("member", "Ana"), fieldUsers);
    expect(result.map((e) => e.employeeName)).toEqual(["Ana"]);
  });

  it("aprovador vê as próprias e as de quem ele aprova", () => {
    const result = filterExpensesForUser(expenses, user("approver", "Ana"), fieldUsers);
    expect(result.map((e) => e.employeeName).sort()).toEqual(["Ana", "Bruno"]);
  });

  it("é insensível a caixa e espaços nos nomes", () => {
    const result = filterExpensesForUser(
      [expense("  ANA  ")],
      user("member", "ana"),
      fieldUsers,
    );
    expect(result).toHaveLength(1);
  });
});

describe("permissions · canViewExpense", () => {
  const fieldUsers: FieldUser[] = [fieldUser("Bruno", "Ana")];

  it("membro só vê a própria despesa", () => {
    expect(canViewExpense(expense("Ana"), user("member", "Ana"), fieldUsers)).toBe(true);
    expect(canViewExpense(expense("Bruno"), user("member", "Ana"), fieldUsers)).toBe(false);
  });

  it("aprovador vê a despesa de quem aprova", () => {
    expect(canViewExpense(expense("Bruno"), user("approver", "Ana"), fieldUsers)).toBe(true);
  });
});
