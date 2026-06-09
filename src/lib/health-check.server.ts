/**
 * Health-check diário (server-only).
 *
 * Roda uma bateria de verificações de CONSISTÊNCIA dos métodos críticos do app
 * — banco, RPCs de roteamento, Storage, IA e e-mail — para garantir que nada
 * "pare e suma do nada". O resultado é resumido em um relatório e, quando algo
 * falha, o admin é avisado por e-mail (ver `notifyAdminIfUnhealthy`).
 *
 * O sufixo `.server.ts` garante que este módulo nunca vá para o bundle do
 * cliente (importa o client admin com a service role key).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { escapeHtml } from "@/lib/server-utils";

export type CheckStatus = "ok" | "warn" | "fail";

export interface CheckResult {
  name: string;
  status: CheckStatus;
  detail: string;
}

export interface HealthReport {
  healthy: boolean;
  ranAt: string;
  durationMs: number;
  checks: CheckResult[];
  summary: { ok: number; warn: number; fail: number };
}

/** Executa um check isolado, transformando exceções em status `fail`. */
async function runCheck(
  name: string,
  fn: () => Promise<Omit<CheckResult, "name">>,
): Promise<CheckResult> {
  try {
    const r = await fn();
    return { name, ...r };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { name, status: "fail", detail: `Exceção: ${detail}` };
  }
}

/** Confere se uma tabela responde a um SELECT com COUNT (sem trazer linhas). */
async function checkTable(table: string): Promise<Omit<CheckResult, "name">> {
  const { error, count } = await supabaseAdmin
    .from(table as never)
    .select("*", { count: "exact", head: true });
  if (error) return { status: "fail", detail: `Erro ao consultar: ${error.message}` };
  return { status: "ok", detail: `Acessível (${count ?? 0} registros).` };
}

/** Confere se uma RPC de roteamento existe e responde (mesmo retornando null). */
async function checkRpc(
  fn: string,
  args: Record<string, unknown>,
): Promise<Omit<CheckResult, "name">> {
  const { error } = await supabaseAdmin.rpc(fn as never, args as never);
  if (error) return { status: "fail", detail: `RPC falhou: ${error.message}` };
  return { status: "ok", detail: "RPC respondeu." };
}

/**
 * Roda todos os checks de consistência e devolve o relatório consolidado.
 */
export async function runHealthChecks(): Promise<HealthReport> {
  const startedAt = Date.now();

  const checks = await Promise.all([
    // 1) Tabelas críticas acessíveis.
    runCheck("Banco · companies", () => checkTable("companies")),
    runCheck("Banco · profiles", () => checkTable("profiles")),
    runCheck("Banco · inbound_reimbursements", () =>
      checkTable("inbound_reimbursements"),
    ),
    runCheck("Banco · despesas", () => checkTable("despesas")),
    runCheck("Banco · policies", () => checkTable("policies")),

    // 2) RPCs de roteamento (consistência dos métodos de webhook).
    runCheck("RPC · resolve_company_by_sender_whatsapp", () =>
      checkRpc("resolve_company_by_sender_whatsapp", { _sender: "00000000" }),
    ),
    runCheck("RPC · resolve_company_by_instance", () =>
      checkRpc("resolve_company_by_instance", { _instance: "__healthcheck__" }),
    ),
    runCheck("RPC · resolve_company_by_whatsapp", () =>
      checkRpc("resolve_company_by_whatsapp", { _number: "00000000" }),
    ),

    // 3) Storage: buckets esperados existem.
    runCheck("Storage · buckets", async () => {
      const { data, error } = await supabaseAdmin.storage.listBuckets();
      if (error) return { status: "fail", detail: `Erro: ${error.message}` };
      const names = new Set((data ?? []).map((b) => b.name));
      const expected = ["policies", "comprovantes", "cartoes-cnpj"];
      const missing = expected.filter((b) => !names.has(b));
      if (missing.length) {
        return { status: "fail", detail: `Buckets ausentes: ${missing.join(", ")}.` };
      }
      return { status: "ok", detail: `Buckets OK (${expected.join(", ")}).` };
    }),

    // 4) Secrets/integrações necessárias presentes.
    runCheck("Integração · IA (LOVABLE_API_KEY)", async () => {
      return process.env.LOVABLE_API_KEY
        ? { status: "ok", detail: "Chave da IA configurada." }
        : { status: "fail", detail: "LOVABLE_API_KEY ausente — IA indisponível." };
    }),
    runCheck("Integração · E-mail (SMTP2GO)", async () => {
      return process.env.SMTP2GO_API_KEY
        ? { status: "ok", detail: "SMTP2GO configurado." }
        : { status: "fail", detail: "SMTP2GO_API_KEY ausente — convites/avisos falham." };
    }),
    runCheck("Integração · Webhook de despesas", async () => {
      return process.env.DESPESAS_WEBHOOK_TOKEN
        ? { status: "ok", detail: "Token do webhook configurado." }
        : { status: "warn", detail: "DESPESAS_WEBHOOK_TOKEN ausente." };
    }),

    // 5) Roteamento: ao menos uma empresa tem como receber despesas.
    runCheck("Config · empresas com WhatsApp/instância", async () => {
      const { count, error } = await supabaseAdmin
        .from("companies")
        .select("*", { count: "exact", head: true })
        .or("whatsapp_number.not.is.null,evolution_instance.not.is.null");
      if (error) return { status: "fail", detail: `Erro: ${error.message}` };
      if (!count) {
        return {
          status: "warn",
          detail: "Nenhuma empresa cadastrou WhatsApp/instância — despesas não roteiam.",
        };
      }
      return { status: "ok", detail: `${count} empresa(s) prontas para roteamento.` };
    }),
  ]);

  const summary = {
    ok: checks.filter((c) => c.status === "ok").length,
    warn: checks.filter((c) => c.status === "warn").length,
    fail: checks.filter((c) => c.status === "fail").length,
  };

  return {
    healthy: summary.fail === 0,
    ranAt: new Date(startedAt).toISOString(),
    durationMs: Date.now() - startedAt,
    checks,
    summary,
  };
}

const STATUS_LABEL: Record<CheckStatus, string> = {
  ok: "✅ OK",
  warn: "⚠️ Atenção",
  fail: "❌ Falha",
};

function reportEmailHtml(report: HealthReport): string {
  const rows = report.checks
    .map(
      (c) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8e8;font-size:14px;">${escapeHtml(c.name)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8e8;font-size:14px;white-space:nowrap;">${STATUS_LABEL[c.status]}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8e8;font-size:13px;color:#475569;">${escapeHtml(c.detail)}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background-color:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#0f2e2e;">
    <div style="max-width:640px;margin:0 auto;padding:32px 24px;">
      <h1 style="font-size:20px;margin:0 0 8px;">Diagnóstico diário — reembolso.ia.br</h1>
      <p style="font-size:14px;color:#64807f;margin:0 0 20px;">
        Executado em ${escapeHtml(report.ranAt)} · ${report.durationMs} ms<br/>
        ${report.summary.fail} falha(s), ${report.summary.warn} atenção, ${report.summary.ok} OK.
      </p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8e8;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background-color:#f3f7f6;">
            <th style="text-align:left;padding:8px 12px;font-size:13px;">Verificação</th>
            <th style="text-align:left;padding:8px 12px;font-size:13px;">Status</th>
            <th style="text-align:left;padding:8px 12px;font-size:13px;">Detalhe</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="font-size:12px;color:#94a3a3;margin:24px 0 0;">
        Este aviso é enviado automaticamente quando alguma verificação crítica falha.
      </p>
    </div>
  </body>
</html>`;
}

/**
 * Envia o relatório por e-mail ao admin quando há falhas. Retorna se notificou.
 * Por padrão só notifica em caso de falha; passe `force` para enviar sempre.
 */
export async function notifyAdminIfUnhealthy(
  report: HealthReport,
  options: { force?: boolean; to?: string } = {},
): Promise<{ notified: boolean; reason?: string }> {
  if (report.healthy && !options.force) {
    return { notified: false, reason: "Tudo saudável; nenhum aviso necessário." };
  }

  const apiKey = process.env.SMTP2GO_API_KEY;
  if (!apiKey) {
    console.error("[health-check] SMTP2GO_API_KEY ausente — não foi possível avisar o admin.");
    return { notified: false, reason: "SMTP2GO_API_KEY ausente." };
  }

  const to = options.to ?? process.env.HEALTHCHECK_ADMIN_EMAIL ?? "jhonata.emerick@gmail.com";
  const sender =
    process.env.SMTP2GO_SENDER ?? "reembolso.ia.br <nao-responder@reembolso.ia.br>";
  const subject = report.healthy
    ? "✅ Diagnóstico diário OK — reembolso.ia.br"
    : `❌ Diagnóstico diário: ${report.summary.fail} falha(s) — reembolso.ia.br`;

  const res = await fetch("https://api.smtp2go.com/v3/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Smtp2go-Api-Key": apiKey },
    body: JSON.stringify({
      sender,
      to: [to],
      subject,
      html_body: reportEmailHtml(report),
    }),
  });
  const result = (await res.json().catch(() => null)) as
    | { data?: { succeeded?: number } }
    | null;

  if (!res.ok || !result?.data?.succeeded) {
    console.error(`[health-check] Falha ao enviar aviso: ${res.status} ${JSON.stringify(result)}`);
    return { notified: false, reason: `SMTP2GO ${res.status}` };
  }
  return { notified: true };
}
