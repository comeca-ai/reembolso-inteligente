import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Webhook público para receber despesas (recibos) enviados pelo WhatsApp.
 *
 * O integrador (n8n, etc.) faz um POST com o telefone do colaborador e o
 * recibo (texto ou URL do comprovante). A linha é gravada na tabela `despesas`
 * DESTE projeto, e a página /expenses atualiza em tempo real via Realtime.
 *
 *   POST /api/public/despesas
 *   Header:
 *     Authorization: Bearer <DESPESAS_WEBHOOK_TOKEN>
 *   Body (JSON):
 *     {
 *       "telefone": "+5511999999999",         // obrigatório
 *       "recibo": "https://.../comprovante.jpg" // obrigatório (URL ou texto)
 *     }
 */

const PayloadSchema = z.object({
  telefone: z.string().min(3).max(50),
  recibo: z.string().min(1).max(5000),
});

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

export const Route = createFileRoute("/api/public/despesas")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: corsHeaders }),

      POST: async ({ request }) => {
        // 1. Verifica o token de autenticação do webhook.
        const expected = process.env.DESPESAS_WEBHOOK_TOKEN;
        if (!expected) {
          return json({ error: "Webhook não configurado." }, 500);
        }
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.replace(/^Bearer\s+/i, "").trim();
        if (token !== expected) {
          return json({ error: "Token inválido." }, 401);
        }

        // 2. Valida o corpo.
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return json({ error: "Corpo JSON inválido." }, 400);
        }
        const parsed = PayloadSchema.safeParse(raw);
        if (!parsed.success) {
          return json(
            { error: "Dados inválidos.", issues: parsed.error.flatten() },
            400,
          );
        }
        const data = parsed.data;

        // 3. Grava a despesa.
        const { data: inserted, error } = await supabaseAdmin
          .from("despesas")
          .insert({ telefone: data.telefone, recibo: data.recibo })
          .select("id, created_at")
          .single();

        if (error) {
          console.error("[despesas webhook] insert falhou:", error);
          return json({ error: "Falha ao registrar a despesa." }, 500);
        }

        return json(
          { ok: true, id: inserted.id, received_at: inserted.created_at },
          201,
        );
      },
    },
  },
});
