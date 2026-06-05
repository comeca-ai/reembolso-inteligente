/**
 * Funções de servidor para a Política de reembolso (reembolsa.aí).
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
import { generateObject } from "ai";
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
}

export interface PolicyState {
  versions: PolicyVersionDTO[];
  rules: PolicyRuleDTO[];
  activePolicyId: string | null;
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

const extractionSchema = z.object({
  pages: z.number().int().nonnegative().describe("Número aproximado de páginas do documento."),
  rules: z.array(ruleSchema).min(1).describe("Regras-chave estruturadas extraídas da política."),
});

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
    }));

    const active = (policies ?? []).find((p) => p.active);
    let rules: PolicyRuleDTO[] = [];
    if (active) {
      const { data: r, error: rErr } = await supabase
        .from("policy_rules")
        .select("*")
        .eq("policy_id", active.id)
        .order("code");
      if (rErr) throw rErr;
      rules = (r ?? []).map((row) => ({
        code: row.code,
        title: row.title,
        category: (row.category as PolicyCategory) ?? "outros",
        limit: row.rule_limit ?? "",
        basis: row.rule_basis ?? "",
        text: row.rule_text ?? "",
      }));
    }

    return { versions, rules, activePolicyId: active?.id ?? null };
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

    // Extração via IA — Gemini lê o PDF diretamente.
    let extracted: z.infer<typeof extractionSchema>;
    try {
      const gateway = createLovableAiGatewayProvider(getLovableApiKey());
      const result = await generateObject({
        model: gateway("google/gemini-3-flash-preview"),
        schema: extractionSchema,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Você é um analista de políticas de reembolso corporativo. " +
                  "Leia o PDF da política em anexo e extraia as regras-chave que " +
                  "serão usadas para avaliar despesas. Para cada regra identifique: " +
                  "código/numeração da cláusula, um título curto, a categoria de " +
                  "despesa, o limite (valor ou condição), a base do limite e o texto " +
                  "resumido da regra. Use as categorias disponíveis. Responda em " +
                  "português do Brasil. Se um campo não existir, deixe vazio.",
              },
              { type: "file", data: bytes, mediaType: "application/pdf" },
            ],
          },
        ],
      });
      extracted = result.object;
    } catch (err) {
      await supabaseAdmin
        .from("policies")
        .update({ status: "erro" })
        .eq("id", policyId);
      console.error("[policy] falha na extração da IA:", err);
      throw new Error(
        "Não foi possível ler a política com a IA. Tente novamente em instantes.",
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
    const { object } = await generateObject({
      model: gateway("google/gemini-3-flash-preview"),
      schema: evaluationSchema,
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
            "que justifica a decisão e liste verificações por regra. Responda em " +
            "português do Brasil.",
        },
      ],
    });

    return object;
  });
