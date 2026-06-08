import { describe, it, expect } from "vitest";
import { extractJsonObject, escapeHtml, generateTempPassword } from "@/lib/server-utils";

describe("extractJsonObject", () => {
  it("parses bare JSON", () => {
    expect(extractJsonObject('{"verdict":"aprovar"}')).toEqual({ verdict: "aprovar" });
  });

  it("parses JSON inside ```json fences", () => {
    const raw = 'Claro!\n```json\n{ "a": 1, "b": "x" }\n```\nfim';
    expect(extractJsonObject(raw)).toEqual({ a: 1, b: "x" });
  });

  it("parses JSON surrounded by prose (first/last brace)", () => {
    const raw = 'Resposta: {"confidence":0.8} — ok';
    expect(extractJsonObject(raw)).toEqual({ confidence: 0.8 });
  });

  it("throws on malformed JSON so callers can fall back", () => {
    expect(() => extractJsonObject("não é json")).toThrow();
    expect(() => extractJsonObject("{ quebrado: ")).toThrow();
  });
});

describe("escapeHtml", () => {
  it("escapes html-sensitive characters", () => {
    expect(escapeHtml('<b>"a"&\'b\'</b>')).toBe(
      "&lt;b&gt;&quot;a&quot;&amp;&#39;b&#39;&lt;/b&gt;",
    );
  });
});

describe("generateTempPassword", () => {
  it("respects the requested length and uses only the safe charset", () => {
    const pw = generateTempPassword(20);
    expect(pw).toHaveLength(20);
    expect(pw).toMatch(/^[A-HJ-NP-Za-hj-z2-9@#%*]+$/);
  });

  it("produces different values across calls", () => {
    expect(generateTempPassword()).not.toBe(generateTempPassword());
  });
});
