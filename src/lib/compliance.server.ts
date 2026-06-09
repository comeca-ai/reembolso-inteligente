/**
 * Núcleo SERVER-ONLY do pipeline de compliance de nota fiscal.
 *
 * NUNCA importar em código de cliente (sufixo `.server.ts`). Usa o Lovable AI
 * Gateway (LOVABLE_API_KEY), o cliente admin do banco e o núcleo da consulta
 * SEFAZ (`checkKey`).
 *
 * Executa, em ordem, as três habilidades adaptadas:
 *   1. triagem-nota-fiscal  → estrutura/completude
 *   2. verifica-nota-sefaz  → situação na SEFAZ
 *   3. recibo-foto-de-foto  → forense de imagem (via IA)
 */
import { generateObject } from "ai";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  createLovableAiGatewayProvider,
  getLovableApiKey,
} from "@/lib/ai-gateway.server";
import { validarChave } from "@/lib/nfe-chave";
import { checkKey, normalizeDanfeKey } from "@/lib/nfe-verify.server";
import type {
  ComplianceReport,
  ComplianceStatus,
  ComplianceStep,
} from "@/lib/compliance.functions";

interface PipelineInput {
  id: string;
  danfeKey: string | null;
  attachmentUrl: string | null;
  amount: number | null;
}

const SEVERITY = ["bloqueante", "alta", "media", "baixa"] as const;

/** Schema enxuto da triagem (leitura do documento via IA). */
const TriagemSchema = z.object({
  parece_nota: z
    .boolean()
    .describe("true se o documento é uma NF-e/NFC-e (DANFE ou cupom)."),
  parece_em_branco: z
    .boolean()
    .describe("true se o documento está em branco ou ilegível."),
  legibilidade: z.enum(["alta", "media", "baixa"]),
  problemas: z
    .array(
      z.object({
        campo: z.string().describe("campo afetado (ex.: valor_total)"),
        severidade: z.enum(SEVERITY),
        descricao: z.string().describe("problema, em uma frase curta"),
      }),
    )
    .describe("Campos obrigatórios ausentes ou inconsistentes."),
});

/** Schema enxuto da forense de imagem (foto de foto). */
const FotoSchema = z.object({
  score: z
    .number()
    .describe("Suspeita de recaptura/edição: 0 (original) a 10 (muito suspeito)."),
  sinais: z
    .array(z.string())
    .describe("Sinais observados (ex.: borda de tela, moiré, reflexo)."),
  recomendacao: z.string().describe("Recomendação prática curta."),
});

function pickWorst(...statuses: ComplianceStatus[]): ComplianceStatus {
  const order: ComplianceStatus[] = [
    "violado",
    "alerta",
    "manual",
    "pendente",
    "ok",
  ];
  for (const s of order) if (statuses.includes(s)) return s;
  return "ok";
}

/** ETAPA 1 — triagem estrutural + completude. */
async function runTriagem(
  input: PipelineInput,
  model: ReturnType<ReturnType<typeof createLovableAiGatewayProvider>>,
): Promise<ComplianceStep> {
  const details: string[] = [];
  const key = normalizeDanfeKey(input.danfeKey);
  let score = 100;
  let estruturaViolada = false;

  // 1a. Validação estrutural offline da chave (sempre roda).
  if (key.length === 44) {
    const estrutura = validarChave(key);
    details.push(`Estrutura da chave: ${estrutura.veredito}`);
    if (!estrutura.estruturaOk) {
      estruturaViolada = true;
      score -= 50;
      for (const e of estrutura.erros) details.push(`Chave: ${e}`);
    }
    for (const a of estrutura.alertas) details.push(`Chave: ${a}`);
    if (estrutura.alertas.length > 0) score -= 5 * estrutura.alertas.length;
  } else {
    details.push("Sem chave de DANFE de 44 dígitos para validar estrutura.");
    score -= 30;
  }

  // 1b. Leitura do documento pela IA (completude), se houver imagem.
  let bloqueante = false;
  let alta = false;
  if (input.attachmentUrl) {
    try {
      const { object } = await generateObject({
        model,
        schema: TriagemSchema,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Faça a triagem estrutural deste comprovante de nota fiscal " +
                  "(NF-e modelo 55 ou NFC-e modelo 65). Verifique se é mesmo uma " +
                  "nota, se está legível/preenchida e liste os campos obrigatórios " +
                  "ausentes ou inconsistentes (chave, CNPJ emitente, valor total, " +
                  "data, número). Responda em português.",
              },
              { type: "image", image: input.attachmentUrl },
            ],
          },
        ],
      });

      if (!object.parece_nota) {
        bloqueante = true;
        details.push("Documento não parece ser uma NF-e/NFC-e.");
      }
      if (object.parece_em_branco) {
        bloqueante = true;
        details.push("Documento em branco ou ilegível.");
      }
      if (object.legibilidade === "baixa") {
        alta = true;
        details.push("Legibilidade baixa — conferência recomendada.");
      }
      for (const p of object.problemas) {
        details.push(`${p.severidade.toUpperCase()} · ${p.campo}: ${p.descricao}`);
        if (p.severidade === "bloqueante") {
          bloqueante = true;
          score -= 40;
        } else if (p.severidade === "alta") {
          alta = true;
          score -= 20;
        } else if (p.severidade === "media") score -= 10;
        else score -= 3;
      }
    } catch (e) {
      console.error("[compliance] triagem IA falhou:", e);
      details.push("Não foi possível ler o documento automaticamente agora.");
    }
  } else {
    details.push("Sem imagem do comprovante para triagem de completude.");
  }

  score = Math.max(0, Math.min(100, score));
  let status: ComplianceStatus;
  if (estruturaViolada || bloqueante || score < 50) status = "violado";
  else if (alta || score < 85) status = "alerta";
  else status = "ok";

  const summary =
    status === "ok"
      ? "Nota completa e estruturalmente íntegra."
      : status === "alerta"
        ? "Nota com ressalvas — conferência recomendada."
        : "Nota reprovada na triagem estrutural.";

  return {
    id: "triagem",
    skill: "triagem-nota-fiscal",
    label: "Triagem estrutural",
    status,
    score,
    summary,
    details,
  };
}

/** ETAPA 2 — situação na SEFAZ. */
async function runSefaz(input: PipelineInput): Promise<ComplianceStep> {
  const key = normalizeDanfeKey(input.danfeKey);
  if (key.length !== 44) {
    return {
      id: "sefaz",
      skill: "verifica-nota-sefaz",
      label: "Verificação SEFAZ",
      status: "pendente",
      score: null,
      summary: "Sem chave de DANFE válida para consultar a SEFAZ.",
      details: [],
    };
  }

  const { result, raw } = await checkKey(key);

  // Persiste o resultado da SEFAZ (igual à verificação automática do webhook).
  if (result.verifiedAt) {
    await supabaseAdmin
      .from("inbound_reimbursements")
      .update({
        danfe_key: key,
        nfe_status: result.status,
        nfe_verified_at: result.verifiedAt,
        nfe_raw: raw as never,
      } as never)
      .eq("id", input.id);
  }

  const map: Record<string, ComplianceStatus> = {
    autorizada: "ok",
    cancelada: "violado",
    denegada: "violado",
    inexistente: "violado",
    manual: "manual",
    erro: "manual",
  };
  const status = map[result.status] ?? "manual";
  const details = [`Fonte: ${result.source}`];
  if (result.code) details.push(`Código: ${result.code}`);

  return {
    id: "sefaz",
    skill: "verifica-nota-sefaz",
    label: "Verificação SEFAZ",
    status,
    score: null,
    summary: result.message,
    details,
  };
}

/** ETAPA 3 — forense de imagem (foto de foto), via IA. */
async function runFoto(
  input: PipelineInput,
  model: ReturnType<ReturnType<typeof createLovableAiGatewayProvider>>,
): Promise<ComplianceStep> {
  if (!input.attachmentUrl) {
    return {
      id: "foto",
      skill: "recibo-foto-de-foto",
      label: "Forense de imagem",
      status: "pendente",
      score: null,
      summary: "Sem imagem do comprovante para análise forense.",
      details: [],
    };
  }

  try {
    const { object } = await generateObject({
      model,
      schema: FotoSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Você é um perito em imagem. Avalie se esta foto de comprovante " +
                "parece uma 'foto de foto' (recaptura de tela ou papel " +
                "re-fotografado) ou imagem editada. Dê um score de suspeita de 0 " +
                "(original provável) a 10 (muito suspeito), liste os sinais " +
                "observados (borda/moldura de tela, moiré, reflexo, pixels de " +
                "tela, recorte, sobreposição de valor) e uma recomendação. " +
                "Lembre que apps de mensagem recomprimem a imagem, então ausência " +
                "de metadados é sinal fraco. Responda em português.",
            },
            { type: "image", image: input.attachmentUrl },
          ],
        },
      ],
    });

    const score = Math.max(0, Math.min(10, Math.round(object.score)));
    const status: ComplianceStatus =
      score >= 7 ? "violado" : score >= 5 ? "alerta" : "ok";
    const details = [...object.sinais];
    if (object.recomendacao) details.push(`Recomendação: ${object.recomendacao}`);

    return {
      id: "foto",
      skill: "recibo-foto-de-foto",
      label: "Forense de imagem",
      status,
      score,
      summary:
        status === "ok"
          ? "Imagem provavelmente original."
          : status === "alerta"
            ? "Imagem com sinais de atenção — revisar."
            : "Alta suspeita de foto-de-foto / adulteração.",
      details,
    };
  } catch (e) {
    console.error("[compliance] forense IA falhou:", e);
    return {
      id: "foto",
      skill: "recibo-foto-de-foto",
      label: "Forense de imagem",
      status: "manual",
      score: null,
      summary: "Não foi possível analisar a imagem automaticamente agora.",
      details: [],
    };
  }
}

/** Executa o pipeline completo, persiste o laudo e devolve o relatório. */
export async function runCompliancePipeline(
  input: PipelineInput,
): Promise<ComplianceReport> {
  const provider = createLovableAiGatewayProvider(getLovableApiKey());
  const model = provider("google/gemini-3-flash-preview");

  // Uma a uma, na ordem das skills.
  const triagem = await runTriagem(input, model);
  const sefaz = await runSefaz(input);
  const foto = await runFoto(input, model);

  const steps = [triagem, sefaz, foto];
  const overall = pickWorst(...steps.map((s) => s.status));
  const report: ComplianceReport = {
    overall,
    steps,
    evaluatedAt: new Date().toISOString(),
  };

  // Persiste o laudo (tolerante a falhas — não derruba a resposta).
  try {
    await supabaseAdmin
      .from("inbound_reimbursements")
      .update({
        compliance_report: report as never,
        compliance_status: overall,
        compliance_at: report.evaluatedAt,
      } as never)
      .eq("id", input.id);
  } catch (e) {
    console.error("[compliance] falha ao gravar laudo:", e);
  }

  return report;
}
