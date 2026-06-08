/**
 * Função de servidor para guardar o Cartão do CNPJ da empresa.
 *
 * O arquivo é enviado pelo cliente em base64, gravado no bucket privado
 * `cartoes-cnpj` (via cliente admin) e o caminho/nome ficam registrados na
 * empresa do usuário autenticado. Usado no pré-cadastro e nas configurações.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const uploadInput = z.object({
  fileName: z.string().min(1).max(255),
  fileBase64: z.string().min(1),
  contentType: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[\w.+-]+\/[\w.+-]+$/)
    .optional()
    .default("application/octet-stream"),
});

const EXT_BY_TYPE: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
};

export const uploadCartaoCnpj = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => uploadInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .single();
    if (profErr) throw profErr;
    const companyId = profile?.company_id;
    if (!companyId) throw new Error("Empresa não encontrada para o usuário.");

    const bytes = Buffer.from(data.fileBase64, "base64");
    // Limite defensivo de 10 MB.
    if (bytes.length > 10 * 1024 * 1024) {
      throw new Error("Arquivo muito grande (máx. 10 MB).");
    }

    const fromName = data.fileName.includes(".")
      ? data.fileName.slice(data.fileName.lastIndexOf(".") + 1).toLowerCase()
      : "";
    const ext = EXT_BY_TYPE[data.contentType] ?? (fromName || "bin");
    const path = `${companyId}/cartao-cnpj.${ext}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const uploaded = await supabaseAdmin.storage
      .from("cartoes-cnpj")
      .upload(path, bytes, { contentType: data.contentType, upsert: true });
    if (uploaded.error) throw uploaded.error;

    const { error: updErr } = await supabaseAdmin
      .from("companies")
      .update({ cartao_cnpj_arquivo: data.fileName, cartao_cnpj_path: path })
      .eq("id", companyId);
    if (updErr) throw updErr;

    return { ok: true, path };
  });
