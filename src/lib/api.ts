/**
 * Mock API — reembolsa.aí
 *
 * Sem backend real nesta etapa. Todos os dados são simulados e ficam em memória.
 * As funções retornam Promises com pequenos delays para imitar latência de rede.
 * Quando o backend existir, basta substituir o corpo destas funções.
 */

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type Channel = "whatsapp" | "email";

export type ExpenseCategory =
  | "combustivel"
  | "refeicao"
  | "hospedagem"
  | "transporte"
  | "pedagio"
  | "material"
  | "outros";

export type ExpenseStatus =
  | "pendente"
  | "extraindo"
  | "em_analise"
  | "aprovado"
  | "aprovado_ressalva"
  | "recusado";

export type Verdict = "aprovar" | "revisar" | "recusar";

export type RuleStatus = "ok" | "alerta" | "violado";

export interface RuleCheckResult {
  id: string;
  label: string;
  status: RuleStatus;
  detail: string;
  policyClause?: string;
}

export interface PolicyCitation {
  clause: string;
  text: string;
}

export interface ExtractedField {
  label: string;
  value: string;
  confidence: number; // 0..1
}

export interface AiAnalysis {
  verdict: Verdict;
  confidence: number; // 0..1
  summary: string;
  rules: RuleCheckResult[];
  citations: PolicyCitation[];
}

export interface Expense {
  id: string;
  protocol: string;
  employeeId: string;
  employeeName: string;
  category: ExpenseCategory;
  merchant: string;
  cnpj?: string;
  description: string;
  amount: number; // BRL
  date: string; // ISO
  submittedAt: string; // ISO
  channel: Channel;
  status: ExpenseStatus;
  receiptUrl: string;
  extracted: ExtractedField[];
  ai: AiAnalysis;
  costCenter: string;
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
}

export type UserRole = "campo" | "aprovador";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  team: string;
  costCenter: string;
  status: "ativo" | "inativo";
  phone?: string;
  monthlyLimit?: number;
}

export interface PolicyVersion {
  id: string;
  version: string;
  fileName: string;
  uploadedBy: string;
  uploadedAt: string;
  active: boolean;
  pages: number;
  sizeKb: number;
}

// ---------------------------------------------------------------------------
// Rótulos legíveis (pt-BR)
// ---------------------------------------------------------------------------

export const categoryLabels: Record<ExpenseCategory, string> = {
  combustivel: "Combustível",
  refeicao: "Refeição",
  hospedagem: "Hospedagem",
  transporte: "Transporte",
  pedagio: "Pedágio",
  material: "Material",
  outros: "Outros",
};

export const statusLabels: Record<ExpenseStatus, string> = {
  pendente: "Pendente",
  extraindo: "Extraindo",
  em_analise: "Em análise",
  aprovado: "Aprovada",
  aprovado_ressalva: "Parcial",
  recusado: "Recusada",
};

export const verdictLabels: Record<Verdict, string> = {
  aprovar: "Aprovar",
  revisar: "Revisar",
  recusar: "Recusar",
};

export const channelLabels: Record<Channel, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const delay = (ms = 320) => new Promise((r) => setTimeout(r, ms));

// Placeholder de comprovante (SVG data-uri "nota fiscal")
function receipt(merchant: string, amount: number, date: string, cnpj?: string | null): string {
  const cnpjLine = cnpj
    ? `<text x='52' y='104' font-family='monospace' font-size='12' fill='#64807f'>CNPJ ${cnpj}</text>`
    : `<text x='52' y='104' font-family='monospace' font-size='12' fill='#c0392b'>** SEM CNPJ — RECIBO SIMPLES **</text>`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='420' height='560' viewBox='0 0 420 560'>
    <rect width='420' height='560' fill='#f8fafa'/>
    <rect x='28' y='28' width='364' height='504' rx='10' fill='#ffffff' stroke='#e2e8e8'/>
    <text x='52' y='78' font-family='monospace' font-size='17' fill='#0f2e2e' font-weight='bold'>${merchant}</text>
    ${cnpjLine}
    <line x1='52' y1='126' x2='368' y2='126' stroke='#e2e8e8' stroke-dasharray='4 4'/>
    <text x='52' y='160' font-family='monospace' font-size='12' fill='#64807f'>CUPOM FISCAL ELETRÔNICO</text>
    <text x='52' y='196' font-family='monospace' font-size='12' fill='#334e4e'>Data: ${formatDate(date)}</text>
    <text x='52' y='220' font-family='monospace' font-size='12' fill='#334e4e'>Item 001 ............. ${formatBRL(amount)}</text>
    <line x1='52' y1='250' x2='368' y2='250' stroke='#e2e8e8' stroke-dasharray='4 4'/>
    <text x='52' y='292' font-family='monospace' font-size='20' fill='#0f2e2e' font-weight='bold'>TOTAL</text>
    <text x='368' y='292' font-family='monospace' font-size='20' fill='#0f2e2e' font-weight='bold' text-anchor='end'>${formatBRL(amount)}</text>
    <text x='52' y='340' font-family='monospace' font-size='11' fill='#64807f'>Forma de pagamento: Cartão corporativo</text>
    <rect x='52' y='372' width='316' height='52' fill='#0f2e2e'/>
    <text x='210' y='404' font-family='monospace' font-size='11' fill='#ffffff' text-anchor='middle' letter-spacing='3'>||| |||| | ||| |||| || |||</text>
    <text x='52' y='470' font-family='monospace' font-size='10' fill='#94a3a3'>Obrigado pela preferência</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ---------------------------------------------------------------------------
// Dados — Usuários
// ---------------------------------------------------------------------------

const users: AppUser[] = [
  { id: "u-001", name: "Carla Menezes", email: "carla.menezes@empresa.com.br", role: "aprovador", team: "Operações Sul", costCenter: "OPS-SUL", status: "ativo", phone: "(51) 99812-4456" },
  { id: "u-002", name: "Roberto Tavares", email: "roberto.tavares@empresa.com.br", role: "aprovador", team: "Comercial", costCenter: "COM-01", status: "ativo", phone: "(11) 99654-2210" },
  { id: "u-101", name: "Diego Albuquerque", email: "diego.alb@empresa.com.br", role: "campo", team: "Técnica Campo SP", costCenter: "FLD-SP", status: "ativo", phone: "(11) 98123-7788", monthlyLimit: 2500 },
  { id: "u-102", name: "Fernanda Lima", email: "fernanda.lima@empresa.com.br", role: "campo", team: "Técnica Campo SP", costCenter: "FLD-SP", status: "ativo", phone: "(11) 98233-1190", monthlyLimit: 2500 },
  { id: "u-103", name: "Marcos Vinícius Souza", email: "marcos.souza@empresa.com.br", role: "campo", team: "Instalações RS", costCenter: "FLD-RS", status: "ativo", phone: "(51) 98990-6622", monthlyLimit: 3000 },
  { id: "u-104", name: "Patrícia Gomes", email: "patricia.gomes@empresa.com.br", role: "campo", team: "Instalações RS", costCenter: "FLD-RS", status: "ativo", phone: "(51) 99001-2255", monthlyLimit: 2200 },
  { id: "u-105", name: "Anderson Ribeiro", email: "anderson.ribeiro@empresa.com.br", role: "campo", team: "Manutenção MG", costCenter: "FLD-MG", status: "ativo", phone: "(31) 98777-4431", monthlyLimit: 2000 },
  { id: "u-106", name: "Juliana Castro", email: "juliana.castro@empresa.com.br", role: "campo", team: "Manutenção MG", costCenter: "FLD-MG", status: "inativo", phone: "(31) 98654-9090", monthlyLimit: 2000 },
];

// ---------------------------------------------------------------------------
// Dados — Despesas
// ---------------------------------------------------------------------------

function buildExpenses(): Expense[] {
  const raw: Array<Omit<Partial<Expense>, "cnpj"> & {
    employeeName: string;
    category: ExpenseCategory;
    merchant: string;
    amount: number;
    date: string;
    submittedAt: string;
    channel: Channel;
    status: ExpenseStatus;
    verdict: Verdict;
    confidence: number;
    rules: RuleCheckResult[];
    summary: string;
    citations: PolicyCitation[];
    cnpj?: string | null;
    extra?: ExtractedField[];
  }> = [
    // --- Cenário: comprovante recém-recebido, IA ainda extraindo ---
    {
      employeeName: "Fernanda Lima",
      category: "combustivel",
      merchant: "Posto BR Contorno",
      description: "Comprovante recém-recebido por WhatsApp — em extração pela IA",
      amount: 175.3,
      date: "2025-06-05",
      submittedAt: "2025-06-05T09:12:00",
      channel: "whatsapp",
      status: "extraindo",
      costCenter: "FLD-SP",
      cnpj: "29.553.110/0001-04",
      verdict: "revisar",
      confidence: 0.41,
      summary:
        "Comprovante em processamento. A IA está extraindo os dados do cupom enviado pelo colaborador; a análise de política será concluída em instantes.",
      rules: [
        { id: "r1", label: "Extração de dados", status: "alerta", detail: "Processamento em andamento; análise de política ainda pendente." },
      ],
      citations: [],
    },
    // --- Cenário: alimentação acima do limite ---
    {
      employeeName: "Diego Albuquerque",
      category: "refeicao",
      merchant: "Churrascaria Boi na Brasa",
      description: "Almoço durante força-tarefa em Campinas",
      amount: 96.5,
      date: "2025-06-04",
      submittedAt: "2025-06-04T13:20:00",
      channel: "whatsapp",
      status: "em_analise",
      costCenter: "FLD-SP",
      cnpj: "18.422.901/0001-55",
      verdict: "revisar",
      confidence: 0.73,
      summary:
        "Valor de refeição acima do teto individual de R$ 60,00. Comprovante legível, mas o montante sugere mais de uma pessoa. Recomenda-se revisão antes de aprovar.",
      rules: [
        { id: "r1", label: "Dentro do limite por refeição (R$ 60)", status: "violado", detail: "R$ 96,50 excede o teto individual em R$ 36,50.", policyClause: "3.1" },
        { id: "r2", label: "Refeição individual", status: "alerta", detail: "Valor compatível com mais de uma pessoa; pode exigir autorização prévia.", policyClause: "3.4" },
        { id: "r3", label: "Comprovante legível", status: "ok", detail: "Cupom fiscal com CNPJ, itens e total identificados." },
      ],
      citations: [
        { clause: "3.1", text: "Refeições individuais são reembolsáveis até R$ 60,00 por evento em deslocamento." },
        { clause: "3.4", text: "Despesas coletivas exigem autorização prévia do gestor responsável." },
      ],
    },
    // --- Cenário: combustível aprovado ---
    {
      employeeName: "Fernanda Lima",
      category: "combustivel",
      merchant: "Posto Ipiranga BR-116",
      description: "Abastecimento do veículo da frota — placa FLT-2231",
      amount: 268.0,
      date: "2025-06-03",
      submittedAt: "2025-06-03T18:05:00",
      channel: "email",
      status: "aprovado",
      costCenter: "FLD-SP",
      cnpj: "33.014.556/0001-96",
      verdict: "aprovar",
      confidence: 0.95,
      decidedBy: "Carla Menezes",
      decidedAt: "2025-06-03T19:10:00",
      summary:
        "Abastecimento dentro do limite, veículo vinculado à equipe e cupom fiscal íntegro. Aprovação recomendada.",
      rules: [
        { id: "r1", label: "Dentro do limite de combustível (R$ 350)", status: "ok", detail: "R$ 268,00 abaixo do teto por abastecimento.", policyClause: "4.2" },
        { id: "r2", label: "Veículo vinculado ao colaborador", status: "ok", detail: "Placa FLT-2231 consta na frota da equipe FLD-SP." },
        { id: "r3", label: "Comprovante legível", status: "ok", detail: "Cupom fiscal com CNPJ, data e total." },
      ],
      citations: [
        { clause: "4.2", text: "Combustível é reembolsável até R$ 350,00 por abastecimento mediante cupom fiscal." },
      ],
    },
    // --- Cenário: hospedagem com alerta ---
    {
      employeeName: "Marcos Vinícius Souza",
      category: "hospedagem",
      merchant: "Hotel Executivo Centro",
      description: "Diária de hospedagem — instalação em Caxias do Sul",
      amount: 389.0,
      date: "2025-06-02",
      submittedAt: "2025-06-02T08:05:00",
      channel: "whatsapp",
      status: "em_analise",
      costCenter: "FLD-RS",
      cnpj: "07.918.234/0001-10",
      verdict: "revisar",
      confidence: 0.68,
      summary:
        "Diária acima do teto da política em R$ 39,00. Deslocamento legítimo e comprovante válido. Pode ser aprovada com ressalva mediante justificativa do aprovador.",
      rules: [
        { id: "r1", label: "Dentro do limite de diária (R$ 350)", status: "violado", detail: "R$ 389,00 excede o teto de R$ 350,00 em R$ 39,00.", policyClause: "5.1" },
        { id: "r2", label: "Comprovante legível", status: "ok", detail: "Nota com CNPJ e data da diária." },
        { id: "r3", label: "Deslocamento autorizado", status: "ok", detail: "Ordem de serviço aberta para Caxias do Sul." },
        { id: "r4", label: "Categoria reembolsável", status: "ok", detail: "Hospedagem elegível em deslocamentos acima de 100 km.", policyClause: "2.2" },
      ],
      citations: [
        { clause: "5.1", text: "Hospedagem reembolsável até R$ 350,00 por diária em deslocamentos autorizados." },
        { clause: "5.3", text: "Valores acima do teto podem ser aprovados com ressalva mediante justificativa do gestor." },
      ],
    },
    // --- Cenário: recibo sem CNPJ recusado ---
    {
      employeeName: "Patrícia Gomes",
      category: "refeicao",
      merchant: "Lanche Rápido (sem identificação)",
      description: "Refeição em estabelecimento sem nota fiscal",
      amount: 54.0,
      date: "2025-06-01",
      submittedAt: "2025-06-01T12:48:00",
      channel: "whatsapp",
      status: "recusado",
      costCenter: "FLD-RS",
      cnpj: null,
      verdict: "recusar",
      confidence: 0.82,
      decidedBy: "Roberto Tavares",
      decidedAt: "2025-06-01T15:00:00",
      decisionNote: "Comprovante sem CNPJ não atende à política fiscal. Solicitar cupom fiscal válido.",
      summary:
        "O comprovante enviado é um recibo simples, sem CNPJ identificável. A política exige cupom ou nota fiscal com CNPJ. Recomenda-se recusa.",
      rules: [
        { id: "r1", label: "Comprovante com CNPJ", status: "violado", detail: "Não foi possível identificar CNPJ no comprovante.", policyClause: "1.2" },
        { id: "r2", label: "Documento fiscal válido", status: "violado", detail: "Recibo manual não substitui cupom ou nota fiscal eletrônica.", policyClause: "1.1" },
        { id: "r3", label: "Dentro do limite por refeição (R$ 60)", status: "ok", detail: "R$ 54,00 dentro do teto, porém sem documento fiscal válido.", policyClause: "3.1" },
      ],
      citations: [
        { clause: "1.1", text: "Somente cupom ou nota fiscal eletrônica com CNPJ são aceitos como comprovante." },
        { clause: "1.2", text: "Comprovantes sem CNPJ identificável serão automaticamente recusados." },
      ],
    },
    // --- Cenário: reembolso por quilometragem (KM) aprovado ---
    {
      employeeName: "Anderson Ribeiro",
      category: "transporte",
      merchant: "Reembolso por KM — veículo próprio",
      description: "Deslocamento de 84 km (ida e volta) — atendimento em cidade vizinha",
      amount: 84.0,
      date: "2025-05-31",
      submittedAt: "2025-05-31T17:30:00",
      channel: "whatsapp",
      status: "aprovado",
      costCenter: "FLD-MG",
      cnpj: null,
      verdict: "aprovar",
      confidence: 0.92,
      decidedBy: "Roberto Tavares",
      decidedAt: "2025-05-31T18:15:00",
      summary:
        "Reembolso por quilometragem com hodômetro inicial e final informados. 84 km × R$ 1,00/km, dentro da regra de uso de veículo próprio autorizado. Aprovação recomendada.",
      rules: [
        { id: "r1", label: "Quilometragem informada", status: "ok", detail: "Hodômetro inicial 45.210 e final 45.294 registrados (84 km).", policyClause: "4.4" },
        { id: "r2", label: "Uso de veículo próprio autorizado", status: "ok", detail: "Termo de uso de veículo próprio vigente.", policyClause: "4.3" },
        { id: "r3", label: "Valor por KM dentro da tabela (R$ 1,00/km)", status: "ok", detail: "R$ 84,00 = 84 km × R$ 1,00.", policyClause: "4.5" },
      ],
      citations: [
        { clause: "4.4", text: "Reembolso por quilometragem exige hodômetro inicial e final." },
        { clause: "4.5", text: "Valor de R$ 1,00 por quilômetro rodado em veículo próprio autorizado." },
      ],
      extra: [
        { label: "KM percorridos", value: "84 km", confidence: 0.9 },
        { label: "Hodômetro (ini/fim)", value: "45.210 / 45.294", confidence: 0.88 },
      ],
    },
    {
      employeeName: "Diego Albuquerque",
      category: "refeicao",
      merchant: "Restaurante Sabor Mineiro",
      description: "Almoço durante visita técnica em Campinas",
      amount: 48.9,
      date: "2025-06-02",
      submittedAt: "2025-06-02T13:42:00",
      channel: "whatsapp",
      status: "pendente",
      costCenter: "FLD-SP",
      verdict: "aprovar",
      confidence: 0.94,
      summary:
        "Refeição individual dentro do limite diário, com comprovante legível e data compatível com a agenda de campo. Recomenda-se aprovação automática.",
      rules: [
        { id: "r1", label: "Dentro do limite por refeição (R$ 60)", status: "ok", detail: "Valor de R$ 48,90 abaixo do teto de R$ 60,00.", policyClause: "3.1" },
        { id: "r2", label: "Comprovante legível", status: "ok", detail: "Cupom fiscal com CNPJ, data e total identificados." },
        { id: "r3", label: "Categoria reembolsável", status: "ok", detail: "Refeição é categoria elegível para equipe de campo.", policyClause: "2.2" },
        { id: "r4", label: "Sem indícios de duplicidade", status: "ok", detail: "Nenhum lançamento semelhante nas últimas 72h." },
      ],
      citations: [
        { clause: "3.1", text: "Refeições individuais são reembolsáveis até R$ 60,00 por evento em deslocamento." },
        { clause: "2.2", text: "São elegíveis: combustível, refeição, hospedagem, transporte e pedágio." },
      ],
    },
    {
      employeeName: "Fernanda Lima",
      category: "combustivel",
      merchant: "Posto Ipiranga BR-116",
      description: "Abastecimento do veículo da frota — placa FLT-2231",
      amount: 312.5,
      date: "2025-06-01",
      submittedAt: "2025-06-01T18:10:00",
      channel: "email",
      status: "em_analise",
      costCenter: "FLD-SP",
      verdict: "revisar",
      confidence: 0.71,
      summary:
        "Abastecimento acima da média do colaborador para o período. Valor compatível com tanque cheio, mas sem registro de KM. Sugere-se revisão manual antes de aprovar.",
      rules: [
        { id: "r1", label: "Dentro do limite de combustível (R$ 350)", status: "ok", detail: "R$ 312,50 abaixo do teto mensal por abastecimento.", policyClause: "4.2" },
        { id: "r2", label: "Veículo vinculado ao colaborador", status: "ok", detail: "Placa FLT-2231 consta na frota da equipe FLD-SP." },
        { id: "r3", label: "Registro de quilometragem", status: "alerta", detail: "Comprovante não informa o hodômetro; KM não validável nesta etapa.", policyClause: "4.4" },
        { id: "r4", label: "Frequência de abastecimento", status: "alerta", detail: "3º abastecimento em 7 dias — acima da média da equipe." },
      ],
      citations: [
        { clause: "4.2", text: "Combustível é reembolsável até R$ 350,00 por abastecimento mediante cupom fiscal." },
        { clause: "4.4", text: "Recomenda-se informar a quilometragem no momento do envio do comprovante." },
      ],
    },
    {
      employeeName: "Marcos Vinícius Souza",
      category: "hospedagem",
      merchant: "Hotel Executivo Centro",
      description: "Diária de hospedagem — instalação em Caxias do Sul",
      amount: 389.0,
      date: "2025-05-30",
      submittedAt: "2025-05-31T08:05:00",
      channel: "whatsapp",
      status: "pendente",
      costCenter: "FLD-RS",
      verdict: "revisar",
      confidence: 0.66,
      summary:
        "Diária acima do teto da política em R$ 39,00. Deslocamento legítimo e comprovante válido. Pode ser aprovada com ressalva mediante justificativa do aprovador.",
      rules: [
        { id: "r1", label: "Dentro do limite de diária (R$ 350)", status: "violado", detail: "R$ 389,00 excede o teto de R$ 350,00 em R$ 39,00.", policyClause: "5.1" },
        { id: "r2", label: "Comprovante legível", status: "ok", detail: "Nota com CNPJ e data da diária." },
        { id: "r3", label: "Deslocamento autorizado", status: "ok", detail: "Ordem de serviço aberta para Caxias do Sul." },
        { id: "r4", label: "Categoria reembolsável", status: "ok", detail: "Hospedagem elegível em deslocamentos acima de 100 km.", policyClause: "2.2" },
      ],
      citations: [
        { clause: "5.1", text: "Hospedagem reembolsável até R$ 350,00 por diária em deslocamentos autorizados." },
        { clause: "5.3", text: "Valores acima do teto podem ser aprovados com ressalva mediante justificativa do gestor." },
      ],
    },
    {
      employeeName: "Patrícia Gomes",
      category: "transporte",
      merchant: "99 Pop",
      description: "Corrida até cliente sem acesso ao veículo da frota",
      amount: 27.4,
      date: "2025-05-29",
      submittedAt: "2025-05-29T10:22:00",
      channel: "whatsapp",
      status: "aprovado",
      costCenter: "FLD-RS",
      verdict: "aprovar",
      confidence: 0.9,
      decidedBy: "Carla Menezes",
      decidedAt: "2025-05-29T14:00:00",
      summary: "Transporte pontual dentro do limite, com origem e destino coerentes com a agenda.",
      rules: [
        { id: "r1", label: "Dentro do limite de transporte (R$ 80)", status: "ok", detail: "R$ 27,40 abaixo do teto por corrida.", policyClause: "6.1" },
        { id: "r2", label: "Comprovante legível", status: "ok", detail: "Recibo do aplicativo com trajeto e valor." },
        { id: "r3", label: "Categoria reembolsável", status: "ok", detail: "Transporte por app elegível na ausência de frota.", policyClause: "6.2" },
      ],
      citations: [
        { clause: "6.1", text: "Transporte por aplicativo reembolsável até R$ 80,00 por corrida." },
        { clause: "6.2", text: "Permitido quando não houver veículo da frota disponível." },
      ],
    },
    {
      employeeName: "Anderson Ribeiro",
      category: "refeicao",
      merchant: "Lanchonete da Esquina",
      description: "Jantar — plantão de manutenção emergencial",
      amount: 132.0,
      date: "2025-05-28",
      submittedAt: "2025-05-28T21:48:00",
      channel: "email",
      status: "recusado",
      costCenter: "FLD-MG",
      verdict: "recusar",
      confidence: 0.88,
      decidedBy: "Roberto Tavares",
      decidedAt: "2025-05-29T09:15:00",
      decisionNote: "Valor incompatível com refeição individual; solicitar detalhamento.",
      summary:
        "Valor muito acima do teto por refeição individual e indício de despesa coletiva sem autorização prévia. Recomenda-se recusa.",
      rules: [
        { id: "r1", label: "Dentro do limite por refeição (R$ 60)", status: "violado", detail: "R$ 132,00 excede o teto individual em R$ 72,00.", policyClause: "3.1" },
        { id: "r2", label: "Refeição individual", status: "violado", detail: "Valor sugere mais de uma pessoa; despesa coletiva exige aprovação prévia.", policyClause: "3.4" },
        { id: "r3", label: "Comprovante legível", status: "ok", detail: "Cupom legível com itens e total." },
      ],
      citations: [
        { clause: "3.1", text: "Refeições individuais são reembolsáveis até R$ 60,00 por evento." },
        { clause: "3.4", text: "Despesas coletivas exigem autorização prévia do gestor responsável." },
      ],
    },
    {
      employeeName: "Diego Albuquerque",
      category: "pedagio",
      merchant: "AutoBAn — Praça Perus",
      description: "Pedágio rodovia Anhanguera — visita Jundiaí",
      amount: 14.8,
      date: "2025-05-27",
      submittedAt: "2025-05-27T09:01:00",
      channel: "whatsapp",
      status: "aprovado",
      costCenter: "FLD-SP",
      verdict: "aprovar",
      confidence: 0.96,
      decidedBy: "Carla Menezes",
      decidedAt: "2025-05-27T11:30:00",
      summary: "Pedágio de baixo valor, rota coerente com a ordem de serviço.",
      rules: [
        { id: "r1", label: "Categoria reembolsável", status: "ok", detail: "Pedágio elegível em deslocamento autorizado.", policyClause: "2.2" },
        { id: "r2", label: "Comprovante legível", status: "ok", detail: "Recibo da concessionária com data e praça." },
        { id: "r3", label: "Rota compatível", status: "ok", detail: "Praça na rota Jundiaí registrada na agenda." },
      ],
      citations: [
        { clause: "2.2", text: "São elegíveis: combustível, refeição, hospedagem, transporte e pedágio." },
      ],
    },
    {
      employeeName: "Marcos Vinícius Souza",
      category: "material",
      merchant: "Ferragens União",
      description: "Conectores e fita isolante para instalação",
      amount: 86.7,
      date: "2025-05-26",
      submittedAt: "2025-05-26T16:33:00",
      channel: "email",
      status: "em_analise",
      costCenter: "FLD-RS",
      verdict: "revisar",
      confidence: 0.62,
      summary:
        "Compra de material operacional sem requisição vinculada. Reembolsável, porém requer confirmação de que não há almoxarifado disponível na regional.",
      rules: [
        { id: "r1", label: "Categoria reembolsável", status: "alerta", detail: "Material só é reembolsável sem estoque na regional.", policyClause: "7.1" },
        { id: "r2", label: "Requisição vinculada", status: "alerta", detail: "Nenhuma requisição interna associada à compra.", policyClause: "7.2" },
        { id: "r3", label: "Comprovante legível", status: "ok", detail: "Nota com itens e total identificados." },
      ],
      citations: [
        { clause: "7.1", text: "Material operacional reembolsável apenas quando não houver estoque na regional." },
        { clause: "7.2", text: "Recomenda-se vincular a compra a uma requisição interna." },
      ],
    },
    {
      employeeName: "Fernanda Lima",
      category: "refeicao",
      merchant: "Padaria Pão Quente",
      description: "Café da manhã em rota antes da primeira visita",
      amount: 19.5,
      date: "2025-05-26",
      submittedAt: "2025-05-26T07:18:00",
      channel: "whatsapp",
      status: "aprovado",
      costCenter: "FLD-SP",
      verdict: "aprovar",
      confidence: 0.93,
      decidedBy: "Carla Menezes",
      decidedAt: "2025-05-26T08:40:00",
      summary: "Refeição leve dentro do limite, comprovante íntegro.",
      rules: [
        { id: "r1", label: "Dentro do limite por refeição (R$ 60)", status: "ok", detail: "R$ 19,50 bem abaixo do teto.", policyClause: "3.1" },
        { id: "r2", label: "Comprovante legível", status: "ok", detail: "Cupom com CNPJ e total." },
      ],
      citations: [
        { clause: "3.1", text: "Refeições individuais são reembolsáveis até R$ 60,00 por evento." },
      ],
    },
    {
      employeeName: "Anderson Ribeiro",
      category: "combustivel",
      merchant: "Posto Shell Av. Amazonas",
      description: "Abastecimento veículo próprio em uso autorizado",
      amount: 198.0,
      date: "2025-05-25",
      submittedAt: "2025-05-25T19:55:00",
      channel: "whatsapp",
      status: "pendente",
      costCenter: "FLD-MG",
      verdict: "aprovar",
      confidence: 0.85,
      summary: "Abastecimento dentro do limite com veículo próprio autorizado. Recomenda-se aprovação.",
      rules: [
        { id: "r1", label: "Dentro do limite de combustível (R$ 350)", status: "ok", detail: "R$ 198,00 abaixo do teto.", policyClause: "4.2" },
        { id: "r2", label: "Uso de veículo próprio autorizado", status: "ok", detail: "Termo de uso de veículo próprio vigente.", policyClause: "4.3" },
        { id: "r3", label: "Comprovante legível", status: "ok", detail: "Cupom fiscal com data e total." },
      ],
      citations: [
        { clause: "4.2", text: "Combustível reembolsável até R$ 350,00 por abastecimento." },
        { clause: "4.3", text: "Uso de veículo próprio exige termo de autorização vigente." },
      ],
    },
    {
      employeeName: "Patrícia Gomes",
      category: "outros",
      merchant: "Estacionamento Center Park",
      description: "Estacionamento durante atendimento de 4h",
      amount: 32.0,
      date: "2025-05-24",
      submittedAt: "2025-05-24T17:12:00",
      channel: "email",
      status: "aprovado_ressalva",
      costCenter: "FLD-RS",
      verdict: "revisar",
      confidence: 0.74,
      decidedBy: "Roberto Tavares",
      decidedAt: "2025-05-24T18:30:00",
      decisionNote: "Aprovado com ressalva: categoria 'outros' deve ser evitada; classificar como transporte.",
      summary: "Despesa legítima, porém em categoria genérica. Sugere-se reclassificação.",
      rules: [
        { id: "r1", label: "Categoria reembolsável", status: "alerta", detail: "'Outros' exige descrição detalhada e revisão.", policyClause: "2.4" },
        { id: "r2", label: "Comprovante legível", status: "ok", detail: "Ticket com data, horário e valor." },
      ],
      citations: [
        { clause: "2.4", text: "Despesas em 'Outros' exigem descrição detalhada e passam por revisão manual." },
      ],
    },
    {
      employeeName: "Diego Albuquerque",
      category: "transporte",
      merchant: "Uber",
      description: "Deslocamento entre dois clientes na zona sul",
      amount: 41.2,
      date: "2025-05-23",
      submittedAt: "2025-05-23T15:40:00",
      channel: "whatsapp",
      status: "pendente",
      costCenter: "FLD-SP",
      verdict: "aprovar",
      confidence: 0.91,
      summary: "Corrida dentro do limite, trajeto coerente com a agenda do dia.",
      rules: [
        { id: "r1", label: "Dentro do limite de transporte (R$ 80)", status: "ok", detail: "R$ 41,20 abaixo do teto.", policyClause: "6.1" },
        { id: "r2", label: "Comprovante legível", status: "ok", detail: "Recibo com trajeto e valor." },
        { id: "r3", label: "Sem indícios de duplicidade", status: "ok", detail: "Nenhuma corrida semelhante registrada no dia." },
      ],
      citations: [
        { clause: "6.1", text: "Transporte por aplicativo reembolsável até R$ 80,00 por corrida." },
      ],
    },
    {
      employeeName: "Juliana Castro",
      category: "hospedagem",
      merchant: "Pousada Recanto",
      description: "Diária — atendimento emergencial em cidade vizinha",
      amount: 220.0,
      date: "2025-05-22",
      submittedAt: "2025-05-22T22:05:00",
      channel: "email",
      status: "aprovado",
      costCenter: "FLD-MG",
      verdict: "aprovar",
      confidence: 0.89,
      decidedBy: "Roberto Tavares",
      decidedAt: "2025-05-23T08:00:00",
      summary: "Diária dentro do teto, deslocamento emergencial autorizado.",
      rules: [
        { id: "r1", label: "Dentro do limite de diária (R$ 350)", status: "ok", detail: "R$ 220,00 abaixo do teto.", policyClause: "5.1" },
        { id: "r2", label: "Deslocamento autorizado", status: "ok", detail: "Chamado emergencial registrado." },
      ],
      citations: [
        { clause: "5.1", text: "Hospedagem reembolsável até R$ 350,00 por diária." },
      ],
    },
  ];

  const userByName = new Map(users.map((u) => [u.name, u]));

  return raw.map((r, i) => {
    const emp = userByName.get(r.employeeName);
    const id = `EXP-2025-${String(1042 - i).padStart(4, "0")}`;
    const hasCnpj = r.cnpj !== null;
    const cnpjValue = r.cnpj === null ? "Não identificado" : r.cnpj ?? "12.345.678/0001-90";
    const cnpjConfidence = r.cnpj === null ? 0.34 : Math.max(0.6, r.confidence - 0.08);
    const extracted: ExtractedField[] = [
      { label: "Estabelecimento", value: r.merchant, confidence: Math.min(0.99, r.confidence + 0.05) },
      { label: "Valor total", value: formatBRL(r.amount), confidence: Math.min(0.99, r.confidence + 0.03) },
      { label: "Data", value: formatDate(r.date), confidence: Math.min(0.98, r.confidence) },
      { label: "Categoria", value: categoryLabels[r.category], confidence: Math.max(0.55, r.confidence - 0.1) },
      { label: "CNPJ", value: cnpjValue, confidence: cnpjConfidence },
      ...(r.extra ?? []),
    ];

    return {
      id,
      protocol: id,
      employeeId: emp?.id ?? "u-000",
      employeeName: r.employeeName,
      category: r.category,
      merchant: r.merchant,
      cnpj: hasCnpj ? r.cnpj ?? "12.345.678/0001-90" : undefined,
      description: r.description ?? "",
      amount: r.amount,
      date: r.date,
      submittedAt: r.submittedAt,
      channel: r.channel,
      status: r.status,
      receiptUrl: receipt(r.merchant, r.amount, r.date),
      extracted,
      costCenter: r.costCenter ?? emp?.costCenter ?? "—",
      decidedBy: r.decidedBy,
      decidedAt: r.decidedAt,
      decisionNote: r.decisionNote,
      ai: {
        verdict: r.verdict,
        confidence: r.confidence,
        summary: r.summary,
        rules: r.rules,
        citations: r.citations,
      },
    } satisfies Expense;
  });
}

let expenses: Expense[] = buildExpenses();

// ---------------------------------------------------------------------------
// Dados — Política
// ---------------------------------------------------------------------------

let policyVersions: PolicyVersion[] = [
  { id: "pol-3", version: "v3.2", fileName: "politica-reembolso-2025.pdf", uploadedBy: "Carla Menezes", uploadedAt: "2025-05-15T10:00:00", active: true, pages: 12, sizeKb: 348 },
  { id: "pol-2", version: "v3.1", fileName: "politica-reembolso-2024-rev.pdf", uploadedBy: "Roberto Tavares", uploadedAt: "2024-11-02T09:30:00", active: false, pages: 11, sizeKb: 331 },
  { id: "pol-1", version: "v3.0", fileName: "politica-reembolso-2024.pdf", uploadedBy: "Carla Menezes", uploadedAt: "2024-01-10T14:20:00", active: false, pages: 10, sizeKb: 298 },
];

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export interface OverviewMetrics {
  pending: number;
  approvedThisMonth: number;
  totalReimbursedMonth: number;
  avgDecisionHours: number;
  autoApprovalRate: number;
  flaggedForReview: number;
  byCategory: Array<{ category: ExpenseCategory; label: string; total: number; count: number }>;
  weekly: Array<{ week: string; aprovados: number; recusados: number }>;
  recent: Expense[];
}

export const api = {
  async getOverview(): Promise<OverviewMetrics> {
    await delay();
    const pending = expenses.filter((e) => e.status === "pendente" || e.status === "em_analise").length;
    const approved = expenses.filter((e) => e.status === "aprovado" || e.status === "aprovado_ressalva");
    const totalReimbursedMonth = approved.reduce((s, e) => s + e.amount, 0);
    const autoApprovable = expenses.filter((e) => e.ai.verdict === "aprovar").length;
    const flaggedForReview = expenses.filter((e) => e.ai.verdict === "revisar").length;

    const catMap = new Map<ExpenseCategory, { total: number; count: number }>();
    for (const e of expenses) {
      const cur = catMap.get(e.category) ?? { total: 0, count: 0 };
      cur.total += e.amount;
      cur.count += 1;
      catMap.set(e.category, cur);
    }
    const byCategory = Array.from(catMap.entries())
      .map(([category, v]) => ({ category, label: categoryLabels[category], ...v }))
      .sort((a, b) => b.total - a.total);

    return {
      pending,
      approvedThisMonth: approved.length,
      totalReimbursedMonth,
      avgDecisionHours: 3.4,
      autoApprovalRate: Math.round((autoApprovable / expenses.length) * 100),
      flaggedForReview,
      byCategory,
      weekly: [
        { week: "Sem 1", aprovados: 18, recusados: 2 },
        { week: "Sem 2", aprovados: 24, recusados: 3 },
        { week: "Sem 3", aprovados: 21, recusados: 1 },
        { week: "Sem 4", aprovados: 27, recusados: 4 },
      ],
      recent: [...expenses]
        .sort((a, b) => +new Date(b.submittedAt) - +new Date(a.submittedAt))
        .slice(0, 5),
    };
  },

  async listExpenses(): Promise<Expense[]> {
    await delay();
    return [...expenses].sort((a, b) => +new Date(b.submittedAt) - +new Date(a.submittedAt));
  },

  async getExpense(id: string): Promise<Expense | undefined> {
    await delay();
    return expenses.find((e) => e.id === id);
  },

  async decideExpense(
    id: string,
    decision: Extract<ExpenseStatus, "aprovado" | "aprovado_ressalva" | "recusado">,
    note?: string,
    decidedBy = "Carla Menezes",
  ): Promise<Expense> {
    await delay(450);
    expenses = expenses.map((e) =>
      e.id === id
        ? { ...e, status: decision, decidedBy, decidedAt: new Date().toISOString(), decisionNote: note }
        : e,
    );
    const updated = expenses.find((e) => e.id === id);
    if (!updated) throw new Error("Despesa não encontrada");
    return updated;
  },

  async listUsers(): Promise<AppUser[]> {
    await delay();
    return [...users];
  },

  async listPolicyVersions(): Promise<PolicyVersion[]> {
    await delay();
    return [...policyVersions].sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt));
  },

  async uploadPolicy(fileName: string, uploadedBy = "Carla Menezes"): Promise<PolicyVersion> {
    await delay(600);
    const nextNum = policyVersions.length + 1;
    const created: PolicyVersion = {
      id: `pol-${nextNum}`,
      version: `v3.${policyVersions.length}`,
      fileName,
      uploadedBy,
      uploadedAt: new Date().toISOString(),
      active: true,
      pages: 12,
      sizeKb: 352,
    };
    policyVersions = [created, ...policyVersions.map((p) => ({ ...p, active: false }))];
    return created;
  },

  async exportReportCsv(): Promise<{ fileName: string; content: string; rows: number }> {
    await delay(700);
    const header = [
      "Protocolo",
      "Colaborador",
      "Centro de Custo",
      "Categoria",
      "Estabelecimento",
      "Valor",
      "Data",
      "Canal",
      "Status",
      "Veredito IA",
      "Confianca IA",
      "Decidido por",
    ];
    const lines = expenses.map((e) =>
      [
        e.protocol,
        e.employeeName,
        e.costCenter,
        categoryLabels[e.category],
        e.merchant,
        e.amount.toFixed(2).replace(".", ","),
        formatDate(e.date),
        channelLabels[e.channel],
        statusLabels[e.status],
        verdictLabels[e.ai.verdict],
        `${Math.round(e.ai.confidence * 100)}%`,
        e.decidedBy ?? "",
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(";"),
    );
    return {
      fileName: `relatorio-reembolsos-${new Date().toISOString().slice(0, 10)}.csv`,
      content: [header.join(";"), ...lines].join("\n"),
      rows: lines.length,
    };
  },
};
