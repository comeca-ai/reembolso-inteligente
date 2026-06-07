import { describe, expect, it } from "vitest";

import { resolveSessionRole, shouldRequirePolicyOnboarding } from "./auth-gates";
import type { AuthUser } from "./auth";

const company: AuthUser["company"] = {
  id: "company-1",
  razao_social: "Empresa Teste",
  cnpj: "00.000.000/0001-00",
};

describe("auth gates", () => {
  it("não trata usuário sem papel carregado como admin", () => {
    expect(resolveSessionRole([])).toBe("member");
    expect(resolveSessionRole(null)).toBe("member");
  });

  it("mantém prioridade de admin quando o papel existe", () => {
    expect(resolveSessionRole([{ role: "member" }, { role: "admin" }])).toBe("admin");
  });

  it("exige onboarding somente para admin sem política", () => {
    expect(shouldRequirePolicyOnboarding({ role: "admin", company })).toBe(true);
    expect(shouldRequirePolicyOnboarding({ role: "approver", company })).toBe(false);
    expect(shouldRequirePolicyOnboarding({ role: "member", company })).toBe(false);
  });

  it("libera admin quando a política já existe", () => {
    expect(
      shouldRequirePolicyOnboarding({
        role: "admin",
        company: { ...company, politica_reembolso_arquivo: "politica.pdf" },
      }),
    ).toBe(false);
  });
});