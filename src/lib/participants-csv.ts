import type { ParticipantInput } from "@/lib/participants-invite.functions";

export interface ParsedParticipantRow {
  line: number;
  nome: string;
  email: string;
  whatsapp?: string;
  role: ParticipantInput["role"];
  error?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Normaliza um cabeçalho de coluna: minúsculo, sem acentos e sem espaços. */
function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
}

/** Mapeia o texto do cargo para um papel da plataforma. */
export function mapRole(value: string | undefined): ParticipantInput["role"] {
  const v = (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/admin/.test(v)) return "admin";
  if (/aprov|approver|gestor|gerente/.test(v)) return "approver";
  return "member";
}

/** Divide uma linha CSV respeitando aspas duplas e separadores , ou ; */
function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

const HEADER_ALIASES: Record<keyof Omit<ParsedParticipantRow, "line" | "error" | "role">, string[]> = {
  nome: ["nome", "name", "nomecompleto", "participante", "colaborador"],
  email: ["email", "mail", "correio", "emailcorporativo"],
  whatsapp: ["whatsapp", "telefone", "celular", "fone", "phone", "tel"],
};

/**
 * Faz o parsing de um CSV de participantes do piloto.
 * Aceita separador "," ou ";" e cabeçalhos em PT/EN com/sem acento.
 * Colunas esperadas: Nome, E-mail, WhatsApp, Cargo/Função.
 */
export function parseParticipantsCsv(text: string): {
  rows: ParsedParticipantRow[];
  error?: string;
} {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    return { rows: [], error: "A planilha está vazia ou só tem o cabeçalho." };
  }

  const delimiter = lines[0].includes(";") && !lines[0].includes(",") ? ";" : lines[0].includes(";") ? ";" : ",";
  const headers = splitCsvLine(lines[0], delimiter).map(normalizeHeader);

  const findCol = (aliases: string[]) =>
    headers.findIndex((h) => aliases.includes(h));

  const nomeIdx = findCol(HEADER_ALIASES.nome);
  const emailIdx = findCol(HEADER_ALIASES.email);
  const whatsappIdx = findCol(HEADER_ALIASES.whatsapp);
  const roleIdx = headers.findIndex((h) =>
    ["cargo", "funcao", "papel", "role", "perfil", "cargofuncao"].includes(h),
  );

  if (nomeIdx === -1 || emailIdx === -1) {
    return {
      rows: [],
      error: "Cabeçalho inválido. Inclua ao menos as colunas Nome e E-mail.",
    };
  }

  const rows: ParsedParticipantRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], delimiter);
    const nome = (cols[nomeIdx] ?? "").trim();
    const email = (cols[emailIdx] ?? "").trim().toLowerCase();
    const whatsapp = whatsappIdx >= 0 ? (cols[whatsappIdx] ?? "").trim() : "";
    const role = mapRole(roleIdx >= 0 ? cols[roleIdx] : undefined);

    let error: string | undefined;
    if (!nome) error = "Nome em branco.";
    else if (!email) error = "E-mail em branco.";
    else if (!EMAIL_RE.test(email)) error = "E-mail inválido.";

    rows.push({
      line: i + 1,
      nome,
      email,
      whatsapp: whatsapp || undefined,
      role,
      error,
    });
  }

  return { rows };
}
