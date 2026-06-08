import { describe, expect, it } from "vitest";

import {
  digitsOnly,
  matchCollaborator,
  phoneTail,
  phonesMatch,
} from "./phone-match";

describe("phone-match · digitsOnly", () => {
  it("remove tudo que não é dígito", () => {
    expect(digitsOnly("+55 (11) 99999-8888")).toBe("5511999998888");
    expect(digitsOnly("abc")).toBe("");
  });

  it("trata null/undefined como string vazia", () => {
    expect(digitsOnly(null)).toBe("");
    expect(digitsOnly(undefined)).toBe("");
  });
});

describe("phone-match · phoneTail", () => {
  it("retorna os últimos 8 dígitos", () => {
    expect(phoneTail("+5511999998888")).toBe("99998888");
  });

  it("retorna vazio quando há menos de 8 dígitos", () => {
    expect(phoneTail("1234567")).toBe("");
    expect(phoneTail("")).toBe("");
  });
});

describe("phone-match · phonesMatch", () => {
  it("casa números com DDI/DDD/formatação diferentes mas mesmo final", () => {
    expect(phonesMatch("+55 11 99999-8888", "011999998888")).toBe(true);
    expect(phonesMatch("5511999998888", "(11) 99999-8888")).toBe(true);
  });

  it("não casa números diferentes", () => {
    expect(phonesMatch("11999998888", "11999990000")).toBe(false);
  });

  it("não casa quando algum lado é curto ou vazio", () => {
    expect(phonesMatch("123", "11999998888")).toBe(false);
    expect(phonesMatch(null, "11999998888")).toBe(false);
    expect(phonesMatch("", "")).toBe(false);
  });
});

describe("phone-match · matchCollaborator", () => {
  const profiles = [
    { id: "a", nome: "Ana", whatsapp: "+55 11 90000-1111" },
    { id: "b", nome: "Bruno", whatsapp: "11 90000-2222" },
    { id: "c", nome: null, whatsapp: "11 90000-3333" },
  ];

  it("encontra o colaborador pelo final do telefone", () => {
    expect(matchCollaborator("5511900002222", profiles)).toEqual({
      id: "b",
      nome: "Bruno",
    });
  });

  it("usa nome padrão quando o perfil não tem nome", () => {
    expect(matchCollaborator("900003333", profiles)).toEqual({
      id: "c",
      nome: "Colaborador",
    });
  });

  it("retorna null quando nenhum casa", () => {
    expect(matchCollaborator("11912340000", profiles)).toBeNull();
  });

  it("retorna null para remetente curto/inválido", () => {
    expect(matchCollaborator("123", profiles)).toBeNull();
    expect(matchCollaborator("", profiles)).toBeNull();
  });
});
