import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { escapeHtml, generateTempPassword } from "@/lib/server-utils";

const inviteSchema = z.object({
  email: z.string().email().max(255),
  nome: z.string().min(1).max(255),
  jobTitle: z.string().max(255).optional(),
  whatsapp: z.string().max(40).optional(),
  origin: z.string().url().max(255),
});

function inviteEmailHtml(params: {
  nome: string;
  companyName: string;
  email: string;
  tempPassword: string;
  loginUrl: string;
}): string {
  const { nome, companyName, email, tempPassword, loginUrl } = params;
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background-color:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#0f2e2e;">
    <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
      <h1 style="font-size:20px;margin:0 0 16px;">Você foi convidado para o reembolso.ia.br</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 12px;">Olá, ${escapeHtml(nome)}!</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 12px;">
        Você foi convidado por <strong>${escapeHtml(companyName)}</strong> para aprovar despesas
        na plataforma reembolso.ia.br. Sua conta já está criada — basta entrar com a senha
        temporária abaixo.
      </p>
      <div style="background-color:#f3f7f6;border-radius:10px;padding:16px 18px;margin:20px 0;">
        <p style="font-size:14px;line-height:1.6;margin:0 0 8px;font-weight:bold;">Seus dados de acesso</p>
        <p style="font-size:14px;line-height:1.6;margin:0 0 4px;">E-mail: <strong>${escapeHtml(email)}</strong></p>
        <p style="font-size:14px;line-height:1.6;margin:0;">Senha temporária: <strong style="font-family:monospace;font-size:16px;letter-spacing:1px;">${escapeHtml(tempPassword)}</strong></p>
      </div>
      <div style="background-color:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:14px 18px;margin:0 0 20px;">
        <p style="font-size:13px;line-height:1.6;margin:0;color:#9a3412;">
          🔒 Por segurança, no <strong>primeiro acesso</strong> você precisará criar uma nova senha
          antes de usar o painel.
        </p>
      </div>
      <p style="text-align:center;margin:28px 0;">
        <a href="${loginUrl}"
           style="display:inline-block;background-color:#0f2e2e;color:#ffffff;text-decoration:none;
                  padding:12px 28px;border-radius:8px;font-size:15px;font-weight:bold;">
          Entrar no painel
        </a>
      </p>
      <p style="font-size:13px;line-height:1.6;color:#64807f;margin:0 0 8px;">
        Se o botão não funcionar, copie e cole este link no navegador:
      </p>
      <p style="font-size:12px;line-height:1.5;color:#64807f;word-break:break-all;margin:0 0 24px;">
        ${escapeHtml(loginUrl)}
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
 * Convida um aprovador: cria o usuário já com senha temporária (anexado à
 * empresa do admin via gatilho handle_new_user) e envia as credenciais por
 * e-mail usando o SMTP2GO. A troca de senha é obrigatória no primeiro acesso.
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

    // 3) Roteamento determinístico: o mesmo WhatsApp não pode estar cadastrado
    // em outra empresa (senão a despesa enviada por esse número iria para a
    // empresa errada).
    if (data.whatsapp?.trim()) {
      const { findWhatsappConflict } = await import("@/lib/webhook-auth.server");
      const conflict = await findWhatsappConflict(data.whatsapp, profile.company_id);
      if (conflict) {
        throw new Error(
          "Este WhatsApp já está cadastrado em outra empresa. Use um número diferente para garantir que os comprovantes cheguem na empresa certa.",
        );
      }
    }



    // 3) Cria o usuário já com senha temporária (e-mail confirmado).
    const tempPassword = generateTempPassword();
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        invited_company_id: profile.company_id,
        invite_role: "approver",
        nome: data.nome.trim(),
        whatsapp: data.whatsapp?.trim() ?? "",
      },
    });

    if (createError || !created?.user) {
      const message = createError?.message ?? "";
      if (/already.*registered|exist|duplicate/i.test(message)) {
        throw new Error("Já existe um usuário com este e-mail.");
      }
      throw new Error("Não foi possível criar o acesso. Tente novamente.");
    }

    // 4) Marca a senha como temporária (troca obrigatória no 1º acesso).
    await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", created.user.id);

    const loginUrl = `${data.origin.replace(/\/$/, "")}/login`;

    // 5) Envia o e-mail pelo SMTP2GO.
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
        html_body: inviteEmailHtml({
          nome: data.nome.trim(),
          companyName,
          email,
          tempPassword,
          loginUrl,
        }),
      }),
    });

    const result = (await res.json().catch(() => null)) as
      | { data?: { succeeded?: number; failures?: unknown[] } }
      | null;

    if (!res.ok || !result?.data?.succeeded) {
      console.error(`[SMTP2GO] ${res.status}: ${JSON.stringify(result)}`);
      // Rollback: remove o usuário recém-criado para não deixar conta órfã
      // (sem credenciais entregues). O admin pode então reenviar o convite.
      await supabaseAdmin.auth.admin.deleteUser(created.user.id).catch(() => {});
      throw new Error(
        "O e-mail de convite não pôde ser enviado e o cadastro foi desfeito. Verifique o SMTP2GO e tente novamente.",
      );
    }

    return { ok: true as const, email };
  });
