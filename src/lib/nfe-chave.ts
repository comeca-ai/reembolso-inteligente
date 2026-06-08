/**
 * Validação ESTRUTURAL (offline) da chave de acesso de NF-e (mod. 55) / NFC-e (mod. 65).
 *
 * Portado do skill `verifica-nota-sefaz` (scripts/valida_chave.py). Roda em
 * qualquer ambiente (não precisa de rede nem certificado). Desmembra os campos
 * embutidos na chave, recalcula o dígito verificador (módulo 11), valida o CNPJ
 * do emitente e — opcionalmente — cruza os campos contra os dados impressos no
 * cupom/DANFE para flagrar adulteração.
 *
 * IMPORTANTE: passar nessa validação significa apenas que a chave é "bem-formada
 * e coerente". NÃO prova que a nota foi autorizada — isso exige a consulta SEFAZ.
 */

export const UF_BY_CODE: Record<string, string> = {
  "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP",
  "17": "TO", "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB",
  "26": "PE", "27": "AL", "28": "SE", "29": "BA", "31": "MG", "32": "ES",
  "33": "RJ", "35": "SP", "41": "PR", "42": "SC", "43": "RS", "50": "MS",
  "51": "MT", "52": "GO", "53": "DF",
};

const MODELO: Record<string, string> = { "55": "NF-e", "65": "NFC-e" };

const TP_EMIS: Record<string, string> = {
  "1": "Normal", "2": "Contingência FS-IA", "3": "Contingência SCAN",
  "4": "Contingência DPEC", "5": "Contingência FS-DA", "6": "Contingência SVC-AN",
  "7": "Contingência SVC-RS", "9": "Contingência offline NFC-e",
};

export interface NfeChaveCampos {
  uf: { codigo: string; sigla: string };
  anoMesEmissao: string;
  cnpjEmitente: string;
  modelo: { codigo: string; tipo: string };
  serie: number;
  numero: number;
  tipoEmissao: { codigo: string; descricao: string };
  codigoNumerico: number;
  digitoVerificador: number;
}

export interface NfeChaveResultado {
  chaveNormalizada: string;
  estruturaOk: boolean;
  veredito: string;
  erros: string[];
  alertas: string[];
  campos: NfeChaveCampos | null;
  checagens: {
    dvMod11: { esperado: number; naChave: number; ok: boolean };
    cnpjValido: boolean;
    ufReconhecida: boolean;
    modeloReconhecido: boolean;
  } | null;
}

/** Dados impressos no cupom/DANFE para cruzamento (todos opcionais). */
export interface NfeImpresso {
  cnpj?: string;
  numero?: string | number;
  serie?: string | number;
  dataEmissao?: string; // dd/mm/aaaa ou aaaa-mm-dd
  uf?: string;
}

function onlyDigits(v: string | number | undefined | null): string {
  return String(v ?? "").replace(/\D/g, "");
}

/** Remove prefixo "NFe", espaços e qualquer não-dígito. */
export function limpaChave(bruto: string): string {
  return bruto.replace(/^nfe/i, "").replace(/\D/g, "");
}

/** Dígito verificador da chave (módulo 11, pesos 2..9 da direita p/ esquerda). */
function dvMod11(chave43: string): number {
  const pesos = [2, 3, 4, 5, 6, 7, 8, 9];
  let soma = 0;
  const reversed = chave43.split("").reverse();
  for (let i = 0; i < reversed.length; i++) {
    soma += Number(reversed[i]) * pesos[i % 8];
  }
  const resto = soma % 11;
  return resto === 0 || resto === 1 ? 0 : 11 - resto;
}

/** Valida os dois dígitos verificadores do CNPJ numérico (14 dígitos). */
function validaCnpj(cnpj: string): boolean {
  if (cnpj.length !== 14 || new Set(cnpj).size === 1) return false;
  const c = cnpj.split("").map(Number);
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let d1 = 11 - (p1.reduce((s, p, i) => s + c[i] * p, 0) % 11);
  d1 = d1 > 9 ? 0 : d1;
  const p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let d2 = 11 - (p2.reduce((s, p, i) => s + c[i] * p, 0) % 11);
  d2 = d2 > 9 ? 0 : d2;
  return d1 === c[12] && d2 === c[13];
}

function fmtCnpj(c: string): string {
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

interface ChaveParts {
  cUF: string; AAMM: string; CNPJ: string; mod: string; serie: string;
  nNF: string; tpEmis: string; cNF: string; cDV: string;
}

function parse(chave: string): ChaveParts {
  return {
    cUF: chave.slice(0, 2),
    AAMM: chave.slice(2, 6),
    CNPJ: chave.slice(6, 20),
    mod: chave.slice(20, 22),
    serie: chave.slice(22, 25),
    nNF: chave.slice(25, 34),
    tpEmis: chave.slice(34, 35),
    cNF: chave.slice(35, 43),
    cDV: chave.slice(43, 44),
  };
}

function crossCheck(p: ChaveParts, impresso?: NfeImpresso): string[] {
  const flags: string[] = [];
  if (!impresso) return flags;

  if (impresso.cnpj && onlyDigits(impresso.cnpj) !== p.CNPJ) {
    flags.push(
      `CNPJ impresso (${impresso.cnpj}) difere do CNPJ na chave (${fmtCnpj(p.CNPJ)})`,
    );
  }
  if (
    impresso.numero != null &&
    onlyDigits(impresso.numero).replace(/^0+/, "") !== p.nNF.replace(/^0+/, "")
  ) {
    flags.push(
      `Número impresso (${impresso.numero}) difere do número na chave (${Number(p.nNF)})`,
    );
  }
  if (
    impresso.serie != null &&
    onlyDigits(impresso.serie).replace(/^0+/, "") !== p.serie.replace(/^0+/, "")
  ) {
    flags.push(
      `Série impressa (${impresso.serie}) difere da série na chave (${Number(p.serie)})`,
    );
  }
  if (impresso.dataEmissao) {
    const d = onlyDigits(impresso.dataEmissao);
    let ano: string | null = null;
    let mes: string | null = null;
    if (/^\d{2}\/\d{2}\/\d{4}/.test(impresso.dataEmissao)) {
      mes = d.slice(2, 4);
      ano = d.slice(4, 8);
    } else if (/^\d{4}-\d{2}-\d{2}/.test(impresso.dataEmissao)) {
      ano = d.slice(0, 4);
      mes = d.slice(4, 6);
    }
    if (ano && mes) {
      const aammImp = ano.slice(2) + mes;
      if (aammImp !== p.AAMM) {
        flags.push(
          `Data impressa (${impresso.dataEmissao}) → ${aammImp} difere do AAMM da chave (${p.AAMM})`,
        );
      }
    }
  }
  if (impresso.uf) {
    const sigla = UF_BY_CODE[p.cUF];
    if (sigla && impresso.uf.trim().toUpperCase() !== sigla) {
      flags.push(`UF impressa (${impresso.uf}) difere da UF da chave (${sigla})`);
    }
  }
  return flags;
}

/**
 * Valida a estrutura de uma chave de acesso. `bruto` pode vir com espaços,
 * prefixo "NFe" etc. `impresso` é opcional e habilita o cruzamento anti-fraude.
 */
export function validarChave(
  bruto: string,
  impresso?: NfeImpresso,
): NfeChaveResultado {
  const chave = limpaChave(bruto);
  const out: NfeChaveResultado = {
    chaveNormalizada: chave,
    estruturaOk: false,
    veredito: "",
    erros: [],
    alertas: [],
    campos: null,
    checagens: null,
  };

  if (chave.length !== 44) {
    out.erros.push(`Chave deve ter 44 dígitos; recebido ${chave.length}.`);
    out.veredito = "CHAVE INVÁLIDA — reprovada na validação estrutural";
    return out;
  }

  const p = parse(chave);
  const dvCalc = dvMod11(chave.slice(0, 43));
  const cnpjOk = validaCnpj(p.CNPJ);
  const dvOk = String(dvCalc) === p.cDV;

  out.campos = {
    uf: { codigo: p.cUF, sigla: UF_BY_CODE[p.cUF] ?? "DESCONHECIDA" },
    anoMesEmissao: `20${p.AAMM.slice(0, 2)}-${p.AAMM.slice(2)}`,
    cnpjEmitente: fmtCnpj(p.CNPJ),
    modelo: { codigo: p.mod, tipo: MODELO[p.mod] ?? "DESCONHECIDO" },
    serie: Number(p.serie),
    numero: Number(p.nNF),
    tipoEmissao: { codigo: p.tpEmis, descricao: TP_EMIS[p.tpEmis] ?? "?" },
    codigoNumerico: Number(p.cNF),
    digitoVerificador: Number(p.cDV),
  };
  out.checagens = {
    dvMod11: { esperado: dvCalc, naChave: Number(p.cDV), ok: dvOk },
    cnpjValido: cnpjOk,
    ufReconhecida: p.cUF in UF_BY_CODE,
    modeloReconhecido: p.mod in MODELO,
  };

  if (!dvOk) {
    out.erros.push(
      `Dígito verificador inválido: chave traz ${p.cDV}, cálculo mod 11 dá ${dvCalc}.`,
    );
  }
  if (!cnpjOk) {
    out.erros.push("CNPJ do emitente tem dígitos verificadores inválidos.");
  }
  if (!(p.cUF in UF_BY_CODE)) {
    out.alertas.push(`Código de UF '${p.cUF}' não reconhecido.`);
  }
  if (!(p.mod in MODELO)) {
    out.alertas.push(`Modelo '${p.mod}' não é 55 (NF-e) nem 65 (NFC-e).`);
  }

  const inconsist = crossCheck(p, impresso);
  if (inconsist.length > 0) out.alertas.push(...inconsist);

  out.estruturaOk = out.erros.length === 0;
  if (out.estruturaOk && inconsist.length === 0) {
    out.veredito = "CHAVE BEM-FORMADA E COERENTE (estrutura válida)";
  } else if (out.estruturaOk && inconsist.length > 0) {
    out.veredito =
      "DV/CNPJ ok, MAS há divergência com os dados impressos — investigar";
  } else {
    out.veredito = "CHAVE INVÁLIDA — reprovada na validação estrutural";
  }
  return out;
}
