import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inviteSchema = z.object({
  email: z.string().email().max(255),
  nome: z.string().min(1).max(255),
  jobTitle: z.string().max(255).optional(),
  whatsapp: z.string().max(40).optional(),
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

function inviteEmailHtml(params: {
  nome: string;
  companyName: string;
  actionLink: string;
}): string {
  const { nome, companyName, actionLink } = params;
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background-color:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#0f2e2e;">
    <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
      <h1 style="font-size:20px;margin:0 0 16px;">Você foi convidado para o reembolso.ia.br</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 12px;">Olá, ${escapeHtml(nome)}!</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 12px;">
        Você foi convidado por <strong>${escapeHtml(companyName)}</strong> para aprovar despesas
        na plataforma reembolso.ia.br.
      </p>
      <div style="background-color:#f3f7f6;border-radius:10px;padding:16px 18px;margin:20px 0;">
        <p style="font-size:14px;line-height:1.6;margin:0 0 8px;font-weight:bold;">Como começar</p>
        <p style="font-size:14px;line-height:1.6;margin:0 0 6px;">1. Acesse <a href="https://reeembolsa-ai-landing.lovable.app/" style="color:#0f2e2e;text-decoration:underline;">https://reeembolsa-ai-landing.lovable.app/</a></p>
        <p style="font-size:14px;line-height:1.6;margin:0 0 6px;">2. Para ativar seu acesso, use o botão <strong>Ativar meu acesso</strong> abaixo e crie sua senha.</p>
        <p style="font-size:14px;line-height:1.6;margin:0;">3. Depois, entre no painel e complete o onboarding para começar a aprovar despesas.</p>
      </div>
      <p style="text-align:center;margin:28px 0;">
        <a href="${actionLink}"
           style="display:inline-block;background-color:#0f2e2e;color:#ffffff;text-decoration:none;
                  padding:12px 28px;border-radius:8px;font-size:15px;font-weight:bold;">
          Ativar meu acesso
        </a>
      </p>
      <p style="font-size:13px;line-height:1.6;color:#64807f;margin:0 0 8px;">
        Se o botão não funcionar, copie e cole este link no navegador:
      </p>
      <p style="font-size:12px;line-height:1.5;color:#64807f;word-break:break-all;margin:0 0 24px;">
        ${escapeHtml(actionLink)}
      </p>
      <hr style="border:none;border-top:1px solid #e2e8e8;margin:24px 0;" />
      <p style="font-size:12px;color:#94a3a3;margin:0;">
        Se você não esperava este convite, pode ignorar este e-mail.
      </p>
    </div>
  </body>
</html>`;
}

/**
 * Convida um aprovador: cria o usuário (anexado à empresa do admin via gatilho
 * handle_new_user) e envia o link de ativação por e-mail usando o Resend.
 */
export const inviteApprover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inviteSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1) Apenas admins podem convidar.
    const { data: roleRows, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (roleError) throw new Error("Não foi possível verificar suas permissões.");
    const isAdmin = (roleRows ?? []).some((r) => r.role === "admin");
    if (!isAdmin) {
      throw new Error("Apenas administradores podem convidar aprovadores.");
    }

    // 2) Empresa do admin.
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    if (profileError || !profile?.company_id) {
      throw new Error("Empresa do administrador não encontrada.");
    }

    const { data: company } = await supabase
      .from("companies")
      .select("razao_social")
      .eq("id", profile.company_id)
      .maybeSingle();
    const companyName = company?.razao_social ?? "Sua empresa";

    const email = data.email.trim().toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 3) Gera o link de convite (cria o usuário em auth.users).
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        data: {
          invited_company_id: profile.company_id,
          invite_role: "approver",
          nome: data.nome.trim(),
          whatsapp: data.whatsapp?.trim() ?? "",
        },
        redirectTo: `${data.origin.replace(/\/$/, "")}/reset-password?mode=invite`,
      },
    });

    if (linkError || !linkData?.properties?.action_link) {
      const message = linkError?.message ?? "";
      if (/already.*registered|exist/i.test(message)) {
        throw new Error("Já existe um usuário com este e-mail.");
      }
      throw new Error("Não foi possível gerar o convite. Tente novamente.");
    }

    const actionLink = linkData.properties.action_link;

    // 4) Envia o e-mail pelo SMTP2GO.
    const smtp2goApiKey = process.env.SMTP2GO_API_KEY;
    if (!smtp2goApiKey) {
      throw new Error("Envio de e-mail indisponível: configuração ausente.");
    }
    // Remetente: precisa pertencer a um domínio verificado no SMTP2GO.
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
        subject: `Convite para o reembolso.ia.br — ${companyName}`,
        html_body: inviteEmailHtml({ nome: data.nome.trim(), companyName, actionLink }),
      }),
    });

    const result = (await res.json().catch(() => null)) as
      | { data?: { succeeded?: number; failures?: unknown[] } }
      | null;

    if (!res.ok || !result?.data?.succeeded) {
      console.error(`[SMTP2GO] ${res.status}: ${JSON.stringify(result)}`);
      throw new Error(
        "Convite criado, mas o e-mail não pôde ser enviado. Verifique a API key do SMTP2GO e o domínio do remetente.",
      );
    }

    return { ok: true as const, email };
  });
