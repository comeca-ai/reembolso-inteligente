import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Testes do fluxo de pré-cadastro (signUpCompany).
 *
 * Mockamos o cliente Supabase para validar a lógica de ramificação:
 *  - sem sessão devolvida → "confirmation_required" (confirmação de e-mail pendente)
 *  - com sessão devolvida → "active" (usuário já logado)
 *  - erro no Auth → propaga a exceção
 */

const signUp = vi.fn();
const getUser = vi.fn();
const from = vi.fn();
const rpc = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { signUp: (...a: unknown[]) => signUp(...a), getUser: (...a: unknown[]) => getUser(...a) },
    from: (...a: unknown[]) => from(...a),
    rpc: (...a: unknown[]) => rpc(...a),
  },
}));

const baseInput = {
  razaoSocial: "Empresa Teste",
  cnpj: "12.345.678/0001-99",
  nomeResponsavel: "Maria Silva",
  email: "Maria@Empresa.com.BR",
  whatsapp: "(11) 99999-9999",
  senha: "Reembolso#Forte2026!",
};

beforeEach(() => {
  vi.resetModules();
  signUp.mockReset();
  getUser.mockReset();
  from.mockReset();
  rpc.mockReset();
  // window.location.origin é usado para o emailRedirectTo
  (globalThis as { window?: unknown }).window = {
    location: { origin: "https://app.teste" },
  };
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("signUpCompany (pré-cadastro)", () => {
  it("normaliza e-mail e envia os metadados da empresa para o Auth", async () => {
    signUp.mockResolvedValue({ data: { session: null, user: null }, error: null });
    const { signUpCompany } = await import("./auth");

    await signUpCompany(baseInput);

    expect(signUp).toHaveBeenCalledTimes(1);
    const arg = signUp.mock.calls[0][0];
    expect(arg.email).toBe("maria@empresa.com.br");
    expect(arg.password).toBe(baseInput.senha);
    expect(arg.options.emailRedirectTo).toBe("https://app.teste/overview");
    expect(arg.options.data.razao_social).toBe("Empresa Teste");
    expect(arg.options.data.nome).toBe("Maria Silva");
  });

  it("retorna confirmation_required quando o Auth não devolve sessão", async () => {
    signUp.mockResolvedValue({ data: { session: null, user: null }, error: null });
    const { signUpCompany } = await import("./auth");

    const result = await signUpCompany(baseInput);

    expect(result.status).toBe("confirmation_required");
    expect(result.user).toBeNull();
    // não deve tentar carregar a sessão
    expect(getUser).not.toHaveBeenCalled();
  });

  it("retorna active e carrega o usuário quando há sessão", async () => {
    signUp.mockResolvedValue({
      data: { session: { access_token: "t" }, user: { id: "u1" } },
      error: null,
    });
    getUser.mockResolvedValue({ data: { user: { id: "u1", email: "maria@empresa.com.br" } }, error: null });

    const maybeSingle = vi.fn().mockResolvedValue({ data: null });
    const eq = vi.fn(() => ({ maybeSingle, then: undefined }));
    // profiles/companies usam .maybeSingle(); user_roles usa .eq() que resolve array
    from.mockImplementation((table: string) => {
      if (table === "user_roles") {
        return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [{ role: "admin" }] }) }) };
      }
      return { select: () => ({ eq }) };
    });
    rpc.mockResolvedValue({ error: null });

    const { signUpCompany } = await import("./auth");
    const result = await signUpCompany(baseInput);

    expect(result.status).toBe("active");
    expect(result.user?.role).toBe("admin");
    expect(result.user?.email).toBe("maria@empresa.com.br");
  });

  it("propaga erro do Auth (ex.: senha vazada)", async () => {
    signUp.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "Password is known to be weak and pwned" },
    });
    const { signUpCompany } = await import("./auth");

    await expect(signUpCompany(baseInput)).rejects.toMatchObject({
      message: expect.stringMatching(/pwned/i),
    });
  });
});
