import { createFileRoute } from "@tanstack/react-router";

import { notifyAdminIfUnhealthy, runHealthChecks } from "@/lib/health-check.server";

/**
 * Health-check diário — verifica a consistência dos métodos críticos e avisa o
 * admin por e-mail quando algo falha.
 *
 *   POST /api/public/hooks/health-check
 *   Header:
 *     Authorization: Bearer <DESPESAS_WEBHOOK_TOKEN>   (obrigatório)
 *   Body (JSON, opcional):
 *     { "force": true }   // envia o e-mail mesmo se estiver tudo OK
 *
 * Chamado automaticamente por um agendamento (pg_cron) às 06h todo dia.
 * O GET é permitido apenas para diagnóstico manual autenticado.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function isAuthorized(request: Request): boolean {
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.replace(/^Bearer\s+/i, "").trim();
  const apikey = request.headers.get("apikey")?.trim() ?? "";

  // Disparo manual seguro: senha do webhook (DESPESAS_WEBHOOK_TOKEN).
  const webhookToken = process.env.DESPESAS_WEBHOOK_TOKEN;
  if (webhookToken && (bearer === webhookToken || apikey === webhookToken)) {
    return true;
  }

  // Disparo do agendamento (pg_cron): chave anônima/publicável no header apikey.
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (anonKey && (apikey === anonKey || bearer === anonKey)) {
    return true;
  }

  return false;
}

async function handle(request: Request, force: boolean) {
  if (!isAuthorized(request)) {
    return json({ error: "Token inválido." }, 401);
  }

  const report = await runHealthChecks();
  const notification = await notifyAdminIfUnhealthy(report, { force });

  console.log(
    `[health-check] healthy=${report.healthy} fail=${report.summary.fail} ` +
      `warn=${report.summary.warn} notified=${notification.notified}`,
  );

  return json({ ok: true, report, notification }, report.healthy ? 200 : 503);
}

export const Route = createFileRoute("/api/public/hooks/health-check")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),

      GET: async ({ request }) => handle(request, false),

      POST: async ({ request }) => {
        let force = false;
        try {
          const body = (await request.json()) as { force?: boolean };
          force = body?.force === true;
        } catch {
          // corpo vazio é válido
        }
        return handle(request, force);
      },
    },
  },
});
