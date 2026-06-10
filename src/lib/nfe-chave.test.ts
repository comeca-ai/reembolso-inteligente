import { describe, it, expect } from "vitest";
import { limpaChave, validarChave } from "./nfe-chave";

// Chave estruturalmente válida (cUF 35/SP, mod 55, CNPJ e DV corretos).
const CHAVE_VALIDA = "35240111222333000181550010000000011123456788";

describe("limpaChave", () => {
  it("remove prefixo NFe, espaços e separadores", () => {
    expect(limpaChave("NFe 3524 0111 2223")).toBe("352401112223");
    expect(limpaChave("nfe35240111222333000181")).toBe("35240111222333000181");
  });
});

describe("validarChave", () => {
  it("aprova uma chave bem-formada e coerente", () => {
    const r = validarChave(CHAVE_VALIDA);
    expect(r.estruturaOk).toBe(true);
    expect(r.erros).toHaveLength(0);
    expect(r.checagens?.dvMod11.ok).toBe(true);
    expect(r.checagens?.cnpjValido).toBe(true);
    expect(r.campos?.uf.sigla).toBe("SP");
    expect(r.campos?.modelo.tipo).toBe("NF-e");
    expect(r.veredito).toMatch(/COERENTE/);
  });

  it("reprova quando o tamanho difere de 44 dígitos", () => {
    const r = validarChave("123");
    expect(r.estruturaOk).toBe(false);
    expect(r.erros[0]).toMatch(/44 d[íi]gitos/);
  });

  it("detecta dígito verificador inválido", () => {
    const adulterada = CHAVE_VALIDA.slice(0, 43) + "0";
    const r = validarChave(adulterada);
    expect(r.estruturaOk).toBe(false);
    expect(r.checagens?.dvMod11.ok).toBe(false);
    expect(r.erros.join(" ")).toMatch(/verificador/i);
  });

  it("flagra divergência com os dados impressos (anti-fraude)", () => {
    const r = validarChave(CHAVE_VALIDA, { uf: "RJ", numero: 999 });
    expect(r.estruturaOk).toBe(true);
    expect(r.alertas.length).toBeGreaterThan(0);
    expect(r.veredito).toMatch(/diverg[êe]ncia/i);
  });

  it("aceita cruzamento consistente sem gerar alertas", () => {
    const r = validarChave(CHAVE_VALIDA, {
      uf: "SP",
      numero: 1,
      serie: 1,
      cnpj: "11.222.333/0001-81",
    });
    expect(r.alertas).toHaveLength(0);
    expect(r.veredito).toMatch(/COERENTE/);
  });
});
