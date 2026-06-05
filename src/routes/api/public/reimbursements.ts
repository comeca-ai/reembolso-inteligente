import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Webhook público e simples para receber mensagens de reembolso.
 *
 * Sem autenticação: qualquer integrador pode chamar e o backend (Lovable
 * Cloud / Supabase) grava a mensagem na tabela inbound_reimbursements.
 *
 *   POST /api/public/reimbursements
 *   Body (JSON):
 *     {
 *       "sender": "+5511999999999",      // obrigatório (telefone ou e-mail)
 *       "sender_name": "João Silva",     // opcional
 *       "channel": "whatsapp",           // whatsapp | email (default whatsapp)
 *       "message": "Almoço com cliente", // opcional
 *       "attachment_url": "https://...", // opcional (comprovante)
 *       "amount": 89.90,                 // opcional
 *       "category": "refeicao",          // opcional
 *       "company_id": "uuid"             // opcional (usa a 1ª empresa se ausente)
 *     }
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
  company_id: z.string().uuid().optional(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

export const Route = createFileRoute("/api/public/reimbursements")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: corsHeaders }),

      POST: async ({ request }) => {
        // 1. Valida o corpo
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

        // 2. Resolve a empresa: usa o company_id informado ou a primeira empresa.
        let companyId = data.company_id ?? null;
        if (!companyId) {
          const { data: company, error: companyError } = await supabaseAdmin
            .from("companies")
            .select("id")
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          if (companyError) {
            return json({ error: "Erro ao resolver a empresa." }, 500);
          }
          companyId = company?.id ?? null;
        }

        if (!companyId) {
          return json({ error: "Nenhuma empresa encontrada." }, 400);
        }

        // 3. Grava a mensagem recebida
        const { data: inserted, error: insertError } = await supabaseAdmin
          .from("inbound_reimbursements")
          .insert({
            company_id: companyId,
            channel: data.channel,
            sender: data.sender,
            sender_name: data.sender_name ?? null,
            message: data.message ?? null,
            attachment_url: data.attachment_url ?? null,
            amount: data.amount ?? null,
            category: data.category ?? null,
            status: "recebido",
            raw_payload: raw as never,
          })
          .select("id, created_at")
          .single();

        if (insertError) {
          return json({ error: "Falha ao registrar a mensagem." }, 500);
        }

        return json(
          { ok: true, id: inserted.id, received_at: inserted.created_at },
          201,
        );
      },
    },
  },
});
