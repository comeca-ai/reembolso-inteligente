import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const employeeInviteSchema = z.object({
  email: z.string().email().max(255),
  nome: z.string().min(1).max(255),
  whatsapp: z.string().max(40).optional(),
  approverName: z.string().max(255).optional(),
  origin: z.string().url().max(255),
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function employeeEmailHtml(params: {
  nome: string;
  companyName: string;
  whatsapp?: string;
  approverName?: string;
}): string {
  const { nome, companyName, whatsapp, approverName } = params;
  const approverLine = approverName
    ? `<p style="font-size:15px;line-height:1.6;margin:0 0 12px;">Seu aprovador responsável é <strong>${escapeHtml(approverName)}</strong>.</p>`
    : "";
  const whatsappLine = whatsapp
    ? `<p style="font-size:13px;line-height:1.6;color:#64807f;margin:0 0 4px;">WhatsApp cadastrado: <strong>${escapeHtml(whatsapp)}</strong></p>`
    : "";
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background-color:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#0f2e2e;">
    <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
      <h1 style="font-size:20px;margin:0 0 16px;">Você foi cadastrado no reembolso.ia.br</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 12px;">Olá, ${escapeHtml(nome)}!</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 12px;">
        A empresa <strong>${escapeHtml(companyName)}</strong> cadastrou você como colaborador de campo
        no reembolso.ia.br. Você <strong>não precisa fazer login</strong>: basta enviar a foto do
        comprovante por WhatsApp ou e-mail e nós cuidamos do resto.
      </p>
      ${approverLine}
      <div style="background-color:#f3f7f6;border-radius:10px;padding:16px 18px;margin:20px 0;">
        <p style="font-size:14px;line-height:1.6;margin:0 0 8px;font-weight:bold;">Como enviar uma despesa</p>
        <p style="font-size:14px;line-height:1.6;margin:0 0 6px;">1. Tire uma foto nítida do comprovante.</p>
        <p style="font-size:14px;line-height:1.6;margin:0 0 6px;">2. Envie pelo WhatsApp ou e-mail cadastrado pela empresa.</p>
        <p style="font-size:14px;line-height:1.6;margin:0;">3. A IA lê os dados e encaminha para aprovação automaticamente.</p>
      </div>
      ${whatsappLine}
      <hr style="border:none;border-top:1px solid #e2e8e8;margin:24px 0;" />
      <p style="font-size:12px;color:#94a3a3;margin:0;">
        Se você não reconhece este cadastro, pode ignorar este e-mail.
      </p>
    </div>
  </body>
</html>`;
}

/**
 * Envia um e-mail de boas-vindas/onboarding para um funcionário (usuário de
 * campo). Funcionários não fazem login — o e-mail apenas explica como enviar
 * comprovantes por WhatsApp ou e-mail. O remetente deve ser admin.
 */
export const inviteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => employeeInviteSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1) Apenas admins podem convidar colaboradores.
    const { data: roleRows, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (roleError) throw new Error("Não foi possível verificar suas permissões.");
    const isAdmin = (roleRows ?? []).some((r) => r.role === "admin");
    if (!isAdmin) {
      throw new Error("Apenas administradores podem convidar colaboradores.");
    }

    // 2) Empresa do admin (para personalizar o e-mail).
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();

    let companyName = "Sua empresa";
    if (profile?.company_id) {
      const { data: company } = await supabase
        .from("companies")
        .select("razao_social")
        .eq("id", profile.company_id)
        .maybeSingle();
      companyName = company?.razao_social ?? companyName;
    }

    const email = data.email.trim().toLowerCase();

    // 3) Envia o e-mail pelo SMTP2GO.
    const smtp2goApiKey = process.env.SMTP2GO_API_KEY;
    if (!smtp2goApiKey) {
      throw new Error("Envio de e-mail indisponível: configuração ausente.");
    }
    const sender = process.env.SMTP2GO_SENDER ?? "reembolso.ia.br <nao-responder@reembolso.ia.br>";

    const res = await fetch("https://api.smtp2go.com/v3/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Smtp2go-Api-Key": smtp2goApiKey,
      },
      body: JSON.stringify({
        sender,
        to: [email],
        subject: `Você foi cadastrado no reembolso.ia.br — ${companyName}`,
        html_body: employeeEmailHtml({
          nome: data.nome.trim(),
          companyName,
          whatsapp: data.whatsapp?.trim() || undefined,
          approverName: data.approverName?.trim() || undefined,
        }),
      }),
    });

    const result = (await res.json().catch(() => null)) as
      | { data?: { succeeded?: number; failures?: unknown[] } }
      | null;

    if (!res.ok || !result?.data?.succeeded) {
      console.error(`[SMTP2GO] ${res.status}: ${JSON.stringify(result)}`);
      throw new Error(
        "Não foi possível enviar o e-mail. Verifique a API key do SMTP2GO e o domínio do remetente.",
      );
    }

    return { ok: true as const, email };
  });
