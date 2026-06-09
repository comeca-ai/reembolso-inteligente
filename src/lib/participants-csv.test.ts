import { describe, it, expect } from "vitest";
import { parseParticipantsCsv, mapRole } from "./participants-csv";

describe("mapRole", () => {
  it("mapeia variações de cargo para papéis", () => {
    expect(mapRole("Admin")).toBe("admin");
    expect(mapRole("administrador")).toBe("admin");
    expect(mapRole("Aprovador")).toBe("approver");
    expect(mapRole("gestor")).toBe("approver");
    expect(mapRole("Colaborador")).toBe("member");
    expect(mapRole("")).toBe("member");
    expect(mapRole(undefined)).toBe("member");
  });
});

describe("parseParticipantsCsv", () => {
  it("faz parsing de CSV com vírgula e acentos no cabeçalho", () => {
    const csv = "Nome,E-mail,WhatsApp,Cargo/Função\nMaria Silva,maria@empresa.com,(11) 99999-0000,Aprovador\nJoão,joao@empresa.com,,Colaborador";
    const { rows, error } = parseParticipantsCsv(csv);
    expect(error).toBeUndefined();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ nome: "Maria Silva", email: "maria@empresa.com", role: "approver" });
    expect(rows[1]).toMatchObject({ nome: "João", email: "joao@empresa.com", role: "member" });
  });

  it("aceita separador ponto e vírgula", () => {
    const csv = "nome;email;cargo\nAna;ana@x.com;admin";
    const { rows } = parseParticipantsCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe("admin");
  });

  it("marca linhas com e-mail inválido ou nome em branco", () => {
    const csv = "Nome,E-mail\n,sememail@x.com\nPedro,invalido";
    const { rows } = parseParticipantsCsv(csv);
    expect(rows[0].error).toBe("Nome em branco.");
    expect(rows[1].error).toBe("E-mail inválido.");
  });

  it("erro quando faltam colunas obrigatórias", () => {
    const csv = "Coluna1,Coluna2\na,b";
    const { error } = parseParticipantsCsv(csv);
    expect(error).toContain("Cabeçalho inválido");
  });

  it("erro quando só tem cabeçalho", () => {
    const { error } = parseParticipantsCsv("Nome,E-mail");
    expect(error).toBeTruthy();
  });
});
