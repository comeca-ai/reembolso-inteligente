/**
 * Funções de servidor para a Política de reembolso (reembolso.ia.br).
 *
 * - getPolicyState: lista versões + regras da política ativa (RLS do usuário).
 * - uploadAndExtractPolicy: recebe o PDF, guarda no storage, usa a IA para
 *   extrair as regras-chave e grava tudo no banco, ativando a nova versão.
 * - evaluateExpense: avalia uma despesa contra as regras vigentes.
 *
 * As escritas e a leitura do arquivo usam o cliente admin (import dinâmico
 * dentro do handler, para não vazar segredos no bundle do cliente).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText } from "ai";
import {
  createLovableAiGatewayProvider,
  getLovableApiKey,
} from "@/lib/ai-gateway.server";

const CATEGORIES = [
  "combustivel",
  "refeicao",
  "hospedagem",
  "transporte",
  "pedagio",
  "material",
  "documentos",
  "outros",
] as const;

export type PolicyCategory = (typeof CATEGORIES)[number];

export interface PolicyRuleDTO {
  id: string;
  code: string;
  title: string;
  category: PolicyCategory;
  limit: string;
  basis: string;
  text: string;
}

export interface PolicyVersionDTO {
  id: string;
  version: string;
  fileName: string;
  uploadedBy: string;
  uploadedAt: string;
  active: boolean;
  pages: number;
  sizeKb: number;
  status: string;
  source: string;
  sourceText: string;
}

export interface PolicyState {
  versions: PolicyVersionDTO[];
  rules: PolicyRuleDTO[];
  activePolicyId: string | null;
  draft: PolicyVersionDTO | null;
  draftRules: PolicyRuleDTO[];
}

const ruleSchema = z.object({
  code: z.string().describe("Código/numeração da cláusula, ex.: '4.1'"),
  title: z.string().describe("Título curto da regra"),
  category: z.enum(CATEGORIES),
  limit: z
    .string()
    .describe("Limite legível, ex.: 'R$ 350,00 / abastecimento'. Vazio se não houver."),
  basis: z
    .string()
    .describe("Base do limite: por abastecimento, por diária, por refeição, etc."),
  text: z.string().describe("Texto da regra extraído da política, resumido."),
});

function normalizeCategory(value: unknown): PolicyCategory {

  const v = String(value ?? "").toLowerCase().trim();
  return (CATEGORIES as readonly string[]).includes(v) ? (v as PolicyCategory) : "outros";
}

/** Faz parse tolerante do JSON devolvido pela IA (pode vir com cercas markdown). */
function parseExtraction(raw: string): { pages: number; rules: z.infer<typeof ruleSchema>[] } {
  let txt = (raw ?? "").trim();
  // Remove cercas ```json ... ``` se existirem.
  const fence = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) txt = fence[1].trim();
  // Pega do primeiro { ao último } para descartar texto extra.
  const first = txt.indexOf("{");
  const last = txt.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    txt = txt.slice(first, last + 1);
  }

  let data: any;
  try {
    data = JSON.parse(txt);
  } catch {
    throw new Error("Resposta da IA não estava em JSON válido.");
  }

  const rawRules = Array.isArray(data?.rules) ? data.rules : [];
  const rules = rawRules
    .map((r: any) => ({
      code: String(r?.code ?? "").trim(),
      title: String(r?.title ?? "").trim(),
      category: normalizeCategory(r?.category),
      limit: String(r?.limit ?? "").trim(),
      basis: String(r?.basis ?? "").trim(),
      text: String(r?.text ?? "").trim(),
    }))
    .filter((r: z.infer<typeof ruleSchema>) => r.title || r.text);

  const pages =
    typeof data?.pages === "number" && Number.isFinite(data.pages)
      ? Math.max(0, Math.round(data.pages))
      : 0;

  return { pages, rules };
}

/** Parser para o rascunho gerado a partir de áudio/texto: { transcript, rules }. */
function parseDraft(raw: string): { transcript: string; rules: z.infer<typeof ruleSchema>[] } {
  let txt = (raw ?? "").trim();
  const fence = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) txt = fence[1].trim();
  const first = txt.indexOf("{");
  const last = txt.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) txt = txt.slice(first, last + 1);

  let data: any;
  try {
    data = JSON.parse(txt);
  } catch {
    throw new Error("Resposta da IA não estava em JSON válido.");
  }

  const rawRules = Array.isArray(data?.rules) ? data.rules : [];
  const rules = rawRules
    .map((r: any) => ({
      code: String(r?.code ?? "").trim(),
      title: String(r?.title ?? "").trim(),
      category: normalizeCategory(r?.category),
      limit: String(r?.limit ?? "").trim(),
      basis: String(r?.basis ?? "").trim(),
      text: String(r?.text ?? "").trim(),
    }))
    .filter((r: z.infer<typeof ruleSchema>) => r.title || r.text);

  const transcript = String(data?.transcript ?? "").trim();
  return { transcript, rules };
}


function extractJsonObject(raw: string) {
  let txt = (raw ?? "").trim();
  const fence = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) txt = fence[1].trim();
  const first = txt.indexOf("{");
  const last = txt.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) txt = txt.slice(first, last + 1);
  return JSON.parse(txt);
}

function parseEvaluation(raw: string): ExpenseEvaluation {
  const parsed = extractJsonObject(raw);
  return evaluationSchema.parse({
    verdict: parsed?.verdict,
    confidence: Number(parsed?.confidence ?? 0.5),
    summary: String(parsed?.summary ?? "Despesa marcada para revisão."),
    citedRuleCode: String(parsed?.citedRuleCode ?? ""),
    citedClause: String(parsed?.citedClause ?? ""),
    checks: Array.isArray(parsed?.checks) ? parsed.checks : [],
  });
}

// ---------------------------------------------------------------------------
// Leitura do estado atual da política
// ---------------------------------------------------------------------------

export const getPolicyState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PolicyState> => {
    const { supabase } = context;

    const { data: policies, error: pErr } = await supabase
      .from("policies")
      .select("*")
      .order("created_at", { ascending: false });
    if (pErr) throw pErr;

    const versions: PolicyVersionDTO[] = (policies ?? []).map((p) => ({
      id: p.id,
      version: p.version,
      fileName: p.file_name,
      uploadedBy: p.uploaded_by ?? "",
      uploadedAt: p.created_at,
      active: p.active,
      pages: p.pages ?? 0,
      sizeKb: p.size_kb ?? 0,
      status: p.status ?? "ativa",
      source: (p as { source?: string }).source ?? "upload",
      sourceText: (p as { source_text?: string }).source_text ?? "",
    }));

    const loadRules = async (policyId: string): Promise<PolicyRuleDTO[]> => {
      const { data: r, error: rErr } = await supabase
        .from("policy_rules")
        .select("*")
        .eq("policy_id", policyId)
        .order("code");
      if (rErr) throw rErr;
      return (r ?? []).map((row) => ({
        id: row.id,
        code: row.code,
        title: row.title,
        category: (row.category as PolicyCategory) ?? "outros",
        limit: row.rule_limit ?? "",
        basis: row.rule_basis ?? "",
        text: row.rule_text ?? "",
      }));
    };

    const active = (policies ?? []).find((p) => p.active);
    const rules = active ? await loadRules(active.id) : [];

    // Rascunho mais recente (gerado por áudio/texto), ainda não publicado.
    const draftRow = (policies ?? []).find((p) => !p.active && p.status === "rascunho");
    const draft = draftRow ? versions.find((v) => v.id === draftRow.id) ?? null : null;
    const draftRules = draftRow ? await loadRules(draftRow.id) : [];

    return {
      versions,
      rules,
      activePolicyId: active?.id ?? null,
      draft,
      draftRules,
    };
  });


// ---------------------------------------------------------------------------
// Upload do PDF + extração das regras pela IA
// ---------------------------------------------------------------------------

const uploadInput = z.object({
  fileName: z.string().min(1).max(255),
  fileBase64: z.string().min(1),
});

export const uploadAndExtractPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => uploadInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("company_id, nome")
      .eq("id", userId)
      .single();
    if (profErr) throw profErr;
    const companyId = profile?.company_id;
    if (!companyId) throw new Error("Empresa não encontrada para o usuário.");

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) {
      throw new Error("Apenas administradores podem publicar a política.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const bytes = Buffer.from(data.fileBase64, "base64");
    const sizeKb = Math.max(1, Math.round(bytes.length / 1024));

    const policyId = crypto.randomUUID();
    const path = `${companyId}/${policyId}.pdf`;

    const uploaded = await supabaseAdmin.storage
      .from("policies")
      .upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (uploaded.error) throw uploaded.error;

    const { data: existing } = await supabaseAdmin
      .from("policies")
      .select("id")
      .eq("company_id", companyId);
    const versionLabel = `v${(existing?.length ?? 0) + 1}.0`;

    const { error: insErr } = await supabaseAdmin.from("policies").insert({
      id: policyId,
      company_id: companyId,
      version: versionLabel,
      file_name: data.fileName,
      file_path: path,
      uploaded_by: profile?.nome ?? "",
      size_kb: sizeKb,
      status: "processando",
      active: false,
    });
    if (insErr) throw insErr;

    // Extração via IA — Gemini lê o PDF e devolve JSON (parse tolerante).
    let extracted: { pages: number; rules: z.infer<typeof ruleSchema>[] };
    try {
      const gateway = createLovableAiGatewayProvider(getLovableApiKey());
      const { text } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Você é um analista de políticas de reembolso corporativo. " +
                  "Leia o PDF da política em anexo e extraia as regras-chave que " +
                  "serão usadas para avaliar despesas.\n\n" +
                  "Responda APENAS com um objeto JSON válido (sem markdown, sem ```), " +
                  "no formato:\n" +
                  '{ "pages": number, "rules": [ { "code": string, "title": string, ' +
                  '"category": string, "limit": string, "basis": string, "text": string } ] }\n\n' +
                  "Para cada regra: code = numeração da cláusula (ex.: '4.1'); title = título curto; " +
                  `category = uma de [${CATEGORIES.join(", ")}]; limit = valor/condição (ex.: 'R$ 350,00'); ` +
                  "basis = base do limite (ex.: 'por abastecimento'); text = texto resumido da regra. " +
                  "Se um campo não existir, use string vazia. Responda em português do Brasil.",
              },
              { type: "file", data: bytes, mediaType: "application/pdf" },
            ],
          },
        ],
      });
      extracted = parseExtraction(text);
      if (extracted.rules.length === 0) {
        throw new Error("Nenhuma regra identificada no documento.");
      }
    } catch (err) {
      await supabaseAdmin
        .from("policies")
        .update({ status: "erro" })
        .eq("id", policyId);
      console.error("[policy] falha na extração da IA:", err);
      throw new Error(
        "Não foi possível ler a política com a IA. Verifique se o PDF contém texto legível e tente novamente.",
      );
    }


    if (extracted.rules.length > 0) {
      const { error: rulesErr } = await supabaseAdmin.from("policy_rules").insert(
        extracted.rules.map((r) => ({
          policy_id: policyId,
          company_id: companyId,
          code: r.code || "—",
          title: r.title,
          category: r.category,
          rule_limit: r.limit,
          rule_basis: r.basis,
          rule_text: r.text,
        })),
      );
      if (rulesErr) throw rulesErr;
    }

    // Ativa a nova versão e desativa as demais.
    await supabaseAdmin
      .from("policies")
      .update({ active: false })
      .eq("company_id", companyId);
    await supabaseAdmin
      .from("policies")
      .update({ active: true, status: "ativa", pages: extracted.pages })
      .eq("id", policyId);

    return { ok: true, policyId, rulesCount: extracted.rules.length };
  });

// ---------------------------------------------------------------------------
// Avaliação de uma despesa contra as regras vigentes
// ---------------------------------------------------------------------------

const evaluateInput = z.object({
  category: z.string().min(1).max(60),
  amount: z.number().nonnegative(),
  establishment: z.string().max(200).optional().default(""),
  date: z.string().max(40).optional().default(""),
  description: z.string().max(2000).optional().default(""),
});

const evaluationSchema = z.object({
  verdict: z.enum(["aprovar", "revisar", "recusar"]),
  confidence: z.number().min(0).max(1),
  summary: z.string(),
  citedRuleCode: z.string().optional().default(""),
  citedClause: z.string().optional().default(""),
  checks: z
    .array(
      z.object({
        label: z.string(),
        status: z.enum(["ok", "alerta", "violado"]),
        detail: z.string(),
      }),
    )
    .default([]),
});

export type ExpenseEvaluation = z.infer<typeof evaluationSchema>;

export const evaluateExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => evaluateInput.parse(input))
  .handler(async ({ data, context }): Promise<ExpenseEvaluation> => {
    const { supabase } = context;

    const { data: active } = await supabase
      .from("policies")
      .select("id")
      .eq("active", true)
      .maybeSingle();

    let rules: PolicyRuleDTO[] = [];
    if (active) {
      const { data: r } = await supabase
        .from("policy_rules")
        .select("*")
        .eq("policy_id", active.id)
        .order("code");
      rules = (r ?? []).map((row) => ({
        id: row.id,
        code: row.code,
        title: row.title,
        category: (row.category as PolicyCategory) ?? "outros",
        limit: row.rule_limit ?? "",
        basis: row.rule_basis ?? "",
        text: row.rule_text ?? "",
      }));
    }

    if (rules.length === 0) {
      return {
        verdict: "revisar",
        confidence: 0.3,
        summary:
          "Nenhuma política ativa com regras extraídas. Publique a política para que a IA possa avaliar automaticamente.",
        citedRuleCode: "",
        citedClause: "",
        checks: [],
      };
    }

    const rulesText = rules
      .map(
        (r) =>
          `- [${r.code}] ${r.title} (categoria: ${r.category}; limite: ${r.limit || "n/d"}; base: ${r.basis || "n/d"}): ${r.text}`,
      )
      .join("\n");

    const gateway = createLovableAiGatewayProvider(getLovableApiKey());
    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      messages: [
        {
          role: "user",
          content:
            "Você avalia despesas de reembolso contra a política da empresa. " +
            "Regras vigentes:\n" +
            rulesText +
            "\n\nDespesa a avaliar:\n" +
            `- Categoria: ${data.category}\n` +
            `- Valor: R$ ${data.amount.toFixed(2)}\n` +
            `- Estabelecimento: ${data.establishment || "n/d"}\n` +
            `- Data: ${data.date || "n/d"}\n` +
            `- Descrição: ${data.description || "n/d"}\n\n` +
            "Decida entre aprovar, revisar ou recusar. Cite o código da cláusula " +
            "que justifica a decisão e liste verificações por regra. Responda APENAS " +
            "com JSON válido no formato: " +
            '{ "verdict": "aprovar|revisar|recusar", "confidence": 0.8, "summary": string, "citedRuleCode": string, "citedClause": string, "checks": [{ "label": string, "status": "ok|alerta|violado", "detail": string }] }.',
        },
      ],
    });

    return parseEvaluation(text);
  });

// ---------------------------------------------------------------------------
// Edição manual de regras pelo administrador
// ---------------------------------------------------------------------------

const ruleInput = z.object({
  id: z.string().uuid().optional(),
  policyId: z.string().uuid().optional(),
  code: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(160),
  category: z.enum(CATEGORIES),
  limit: z.string().trim().max(160).optional().default(""),
  basis: z.string().trim().max(160).optional().default(""),
  text: z.string().trim().max(2000).optional().default(""),
});


async function assertAdmin(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<string> {
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .single();
  if (profErr) throw profErr;
  const companyId = profile?.company_id as string | undefined;
  if (!companyId) throw new Error("Empresa não encontrada para o usuário.");

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
  if (!isAdmin) throw new Error("Apenas administradores podem editar as regras.");

  return companyId;
}

export const savePolicyRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ruleInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const companyId = await assertAdmin(supabase, userId);

    const payload = {
      code: data.code,
      title: data.title,
      category: data.category,
      rule_limit: data.limit,
      rule_basis: data.basis,
      rule_text: data.text,
    };

    if (data.id) {
      const { error } = await supabase
        .from("policy_rules")
        .update(payload)
        .eq("id", data.id)
        .eq("company_id", companyId);
      if (error) throw error;
      return { ok: true, id: data.id };
    }

    const { data: active, error: actErr } = await supabase
      .from("policies")
      .select("id")
      .eq("company_id", companyId)
      .eq("active", true)
      .maybeSingle();
    if (actErr) throw actErr;
    if (!active) {
      throw new Error("Publique uma política ativa antes de adicionar regras.");
    }

    const { data: inserted, error } = await supabase
      .from("policy_rules")
      .insert({ ...payload, policy_id: active.id, company_id: companyId })
      .select("id")
      .single();
    if (error) throw error;
    return { ok: true, id: inserted.id };
  });

const deleteInput = z.object({ id: z.string().uuid() });

export const deletePolicyRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => deleteInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const companyId = await assertAdmin(supabase, userId);

    const { error } = await supabase
      .from("policy_rules")
      .delete()
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw error;
    return { ok: true };
  });
