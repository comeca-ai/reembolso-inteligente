/**
 * Funções de servidor para os reembolsos recebidos via webhook.
 *
 * - getReimbursementsConfig: token do webhook da empresa (admin) + mensagens recebidas.
 * - updateReimbursementStatus: muda o status de uma mensagem recebida.
 *
 * O webhook em si vive em src/routes/api/public/reimbursements.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export interface InboundReimbursementDTO {
  id: string;
  channel: string;
  sender: string;
  senderName: string | null;
  message: string | null;
  attachmentUrl: string | null;
  amount: number | null;
  category: string | null;
  status: string;
  createdAt: string;
}

export interface ReimbursementsConfig {
  webhookToken: string | null;
  isAdmin: boolean;
  messages: InboundReimbursementDTO[];
}

function mapRow(row: {
  id: string;
  channel: string;
  sender: string;
  sender_name: string | null;
  message: string | null;
  attachment_url: string | null;
  amount: number | null;
  category: string | null;
  status: string;
  created_at: string;
}): InboundReimbursementDTO {
  return {
    id: row.id,
    channel: row.channel,
    sender: row.sender,
    senderName: row.sender_name,
    message: row.message,
    attachmentUrl: row.attachment_url,
    amount: row.amount === null ? null : Number(row.amount),
    category: row.category,
    status: row.status,
    createdAt: row.created_at,
  };
}

export const getReimbursementsConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReimbursementsConfig> => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    const companyId = profile?.company_id;

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");

    let webhookToken: string | null = null;
    if (isAdmin && companyId) {
      const { data: company } = await supabase
        .from("companies")
        .select("webhook_token")
        .eq("id", companyId)
        .maybeSingle();
      webhookToken = (company?.webhook_token as string | undefined) ?? null;
    }

    const { data: rows, error } = await supabase
      .from("inbound_reimbursements")
      .select(
        "id, channel, sender, sender_name, message, attachment_url, amount, category, status, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;

    return {
      webhookToken,
      isAdmin,
      messages: (rows ?? []).map(mapRow),
    };
  });

const statusInput = z.object({
  id: z.string().uuid(),
  status: z.enum(["recebido", "em_analise", "processado", "arquivado"]),
});

export const updateReimbursementStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => statusInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("inbound_reimbursements")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true, id: data.id, status: data.status };
  });
