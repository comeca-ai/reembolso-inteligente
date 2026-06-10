import { describe, it, expect } from "vitest";
import { whatsappKey } from "./server-utils";

describe("whatsappKey", () => {
  it("reduz o número aos últimos 8 dígitos ignorando DDI/DDD e formatação", () => {
    expect(whatsappKey("+55 (11) 99876-5432")).toBe("98765432");
    expect(whatsappKey("5511998765432")).toBe("98765432");
  });

  it("considera o mesmo número em formatos diferentes como a mesma chave", () => {
    expect(whatsappKey("(11) 99876-5432")).toBe(whatsappKey("+55 11 99876 5432"));
  });

  it("retorna null quando não há dígitos suficientes", () => {
    expect(whatsappKey("1234")).toBeNull();
    expect(whatsappKey("")).toBeNull();
    expect(whatsappKey(null)).toBeNull();
    expect(whatsappKey(undefined)).toBeNull();
  });
});
