import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Webhook público para receber mensagens de reembolso dos colaboradores.
 *
 * Cada empresa tem um `webhook_token` único. O integrador (gateway de
 * WhatsApp, e-mail, formulário, etc.) deve chamar:
 *
 *   POST /api/public/reimbursements
 *   Header:  x-webhook-token: <token da empresa>
 *   Body (JSON):
 *     {
 *       "sender": "+5511999999999",   // obrigatório (telefone ou e-mail)
 *       "sender_name": "João Silva",  // opcional
 *       "channel": "whatsapp",        // whatsapp | email (default whatsapp)
 *       "message": "Almoço com cliente", // opcional
 *       "attachment_url": "https://...",  // opcional (comprovante)
 *       "amount": 89.90,              // opcional
 *       "category": "refeicao"        // opcional
 *     }
 *
 * O token também pode ser enviado via query string (?token=...).
 */

const PayloadSchema = z.object({
  sender: z.string().min(1).max(320),
  sender_name: z.string().min(1).max(255).optional(),
  channel: z.enum(["whatsapp", "email"]).default("whatsapp"),
  message: z.string().max(5000).optional(),
  attachment_url: z.string().url().max(2048).optional(),
  amount: z.number().min(0).max(1_000_000).optional(),
  category: z
    .enum([
      "combustivel",
      "refeicao",
      "hospedagem",
      "transporte",
      "pedagio",
      "material",
      "outros",
    ])
    .optional(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-webhook-token",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/public/reimbursements")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),

      POST: async ({ request }) => {
        // 1. Token da empresa (header ou query string)
        const url = new URL(request.url);
        const token =
          request.headers.get("x-webhook-token") ??
          url.searchParams.get("token") ??
          "";

        if (!token || !UUID_RE.test(token)) {
          return json({ error: "Token inválido ou ausente." }, 401);
        }

        // 2. Valida o corpo
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

        // 3. Resolve a empresa pelo token
        const { data: company, error: companyError } = await supabaseAdmin
          .from("companies")
          .select("id")
          .eq("webhook_token", token)
          .maybeSingle();

        if (companyError) {
          return json({ error: "Erro ao validar a empresa." }, 500);
        }
        if (!company) {
          return json({ error: "Token não reconhecido." }, 401);
        }

        // 4. Grava a mensagem recebida
        const data = parsed.data;
        const { data: inserted, error: insertError } = await supabaseAdmin
          .from("inbound_reimbursements")
          .insert({
            company_id: company.id,
            channel: data.channel,
            sender: data.sender,
            sender_name: data.sender_name ?? null,
            message: data.message ?? null,
            attachment_url: data.attachment_url ?? null,
            amount: data.amount ?? null,
            category: data.category ?? null,
            status: "recebido",
            raw_payload: raw as Record<string, unknown>,
          })
          .select("id, created_at")
          .single();

        if (insertError) {
          return json({ error: "Falha ao registrar a mensagem." }, 500);
        }

        return json(
          {
            ok: true,
            id: inserted.id,
            received_at: inserted.created_at,
          },
          201,
        );
      },
    },
  },
});
