import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Testes do carregamento de sessão (loadSession).
 *
 * Foco: a retentativa da consulta da empresa. Logo após o login a consulta
 * pode falhar de forma transitória (token sendo anexado / RLS avaliando
 * auth.uid()). Sem retentativa, o admin caía no objeto-empresa padrão (sem
 * política) e era mandado de volta ao onboarding indevidamente.
 */

const getUser = vi.fn();
const from = vi.fn();
const rpc = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: (...a: unknown[]) => getUser(...a) },
    from: (...a: unknown[]) => from(...a),
    rpc: (...a: unknown[]) => rpc(...a),
  },
}));

beforeEach(() => {
  vi.resetModules();
  getUser.mockReset();
  from.mockReset();
  rpc.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

function mockTables(opts: {
  profile: unknown;
  companyResults: Array<unknown>;
  roleRows: Array<{ role: string }>;
}) {
  const companyQueue = [...opts.companyResults];
  from.mockImplementation((table: string) => {
    if (table === "profiles") {
      return {
        select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: opts.profile }) }) }),
      };
    }
    if (table === "companies") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: vi.fn().mockImplementation(() =>
              Promise.resolve({ data: companyQueue.length ? companyQueue.shift() : null }),
            ),
          }),
        }),
      };
    }
    if (table === "user_roles") {
      return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: opts.roleRows }) }) };
    }
    throw new Error(`tabela inesperada: ${table}`);
  });
}

describe("loadSession (retentativa da empresa)", () => {
  it("carrega a política mesmo quando a 1ª consulta da empresa volta vazia", async () => {
    vi.useFakeTimers();
    getUser.mockResolvedValue({ data: { user: { id: "u1", email: "admin@empresa.com" } }, error: null });
    mockTables({
      profile: { id: "u1", nome: "Admin", email: "admin@empresa.com", whatsapp: null, company_id: "c1", must_change_password: false },
      // 1ª tentativa falha (null), 2ª devolve a empresa com política
      companyResults: [
        null,
        { id: "c1", razao_social: "Empresa", cnpj: "00", politica_reembolso_arquivo: "politica.pdf", cartao_cnpj_arquivo: null },
      ],
      roleRows: [{ role: "admin" }],
    });
    rpc.mockResolvedValue({ error: null });

    const { loadSession } = await import("./auth");
    const promise = loadSession();
    await vi.runAllTimersAsync();
    const user = await promise;

    expect(user?.company.id).toBe("c1");
    expect(user?.company.politica_reembolso_arquivo).toBe("politica.pdf");
  });

  it("mantém company.id vazio quando todas as tentativas falham", async () => {
    vi.useFakeTimers();
    getUser.mockResolvedValue({ data: { user: { id: "u1", email: "admin@empresa.com" } }, error: null });
    mockTables({
      profile: { id: "u1", nome: "Admin", email: "admin@empresa.com", whatsapp: null, company_id: "c1", must_change_password: false },
      companyResults: [null, null, null],
      roleRows: [{ role: "admin" }],
    });
    rpc.mockResolvedValue({ error: null });

    const { loadSession } = await import("./auth");
    const promise = loadSession();
    await vi.runAllTimersAsync();
    const user = await promise;

    // empresa não carregou → id vazio (a trava de onboarding não deve disparar)
    expect(user?.company.id).toBe("");
  });
});
