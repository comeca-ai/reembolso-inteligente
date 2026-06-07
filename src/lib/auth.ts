/**
 * Camada de autenticação — reembolsa.aí
 *
 * Implementação real com Lovable Cloud (Supabase Auth + Postgres).
 *
 * Modelo de dados:
 *   - auth.users        → credenciais (e-mail/senha) gerenciadas pelo Auth.
 *   - public.companies  → dados da empresa.
 *   - public.profiles   → dados do usuário, ligado à empresa.
 *   - public.user_roles → papéis (admin/approver/member).
 *
 * No signup, um gatilho no banco cria automaticamente a empresa, o perfil e
 * o papel de admin a partir dos metadados enviados em `auth.signUp`.
 *
 * Para evitar reescrever toda a UI (que lê o usuário de forma síncrona),
 * mantemos um cache em memória populado nos `beforeLoad` das rotas.
 */

import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export interface AuthCompany {
  id: string;
  razao_social: string;
  cnpj: string;
  politica_reembolso_arquivo?: string;
}

export interface AuthUser {
  id: string;
  /** id de auth.users (Supabase Auth). */
  auth_user_id: string;
  nome: string;
  email: string;
  whatsapp?: string;
  role: "admin" | "approver" | "member";
  company: AuthCompany;
}

export interface SignUpInput {
  razaoSocial: string;
  cnpj: string;
  nomeResponsavel: string;
  email: string;
  whatsapp: string;
  senha: string;
  /** Nome do arquivo da política de reembolso (opcional). */
  politicaReembolsoArquivo?: string;
}

export interface SignInInput {
  email: string;
  senha: string;
}

/** Cache em memória do usuário autenticado (populado em loadSession). */
let cachedUser: AuthUser | null = null;
let sessionLoaded = false;

function getMetadataText(authUser: User, key: string, fallback = ""): string {
  const value = authUser.user_metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

async function ensureProfileRows(authUser: User): Promise<void> {
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", authUser.id)
    .maybeSingle();

  if (existingProfile) return;

  const politicaArquivo = getMetadataText(authUser, "politica_reembolso_arquivo");
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert({
      razao_social: getMetadataText(authUser, "razao_social", "Empresa"),
      cnpj: getMetadataText(authUser, "cnpj"),
      politica_reembolso_arquivo: politicaArquivo || null,
    })
    .select("id")
    .single();

  if (companyError) throw companyError;

  const { error: profileError } = await supabase.from("profiles").insert({
    id: authUser.id,
    company_id: company.id,
    nome: getMetadataText(authUser, "nome", authUser.email ?? "Usuário"),
    email: authUser.email ?? getMetadataText(authUser, "email"),
    whatsapp: getMetadataText(authUser, "whatsapp") || null,
  });

  if (profileError) throw profileError;

  const { error: roleError } = await supabase.from("user_roles").insert({
    user_id: authUser.id,
    role: "admin",
  });

  if (roleError && roleError.code !== "23505") throw roleError;
}

/**
 * Carrega a sessão atual a partir do Auth + perfil + empresa + papel.
 * Atualiza o cache em memória. Deve ser chamado nos `beforeLoad`.
 */
export async function loadSession(): Promise<AuthUser | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    cachedUser = null;
    sessionLoaded = true;
    return null;
  }

  const authUser = userData.user;

  let { data: profile } = await supabase
    .from("profiles")
    .select("id, nome, email, whatsapp, company_id")
    .eq("id", authUser.id)
    .maybeSingle();

  if (!profile) {
    await ensureProfileRows(authUser);
    const { data: repairedProfile } = await supabase
      .from("profiles")
      .select("id, nome, email, whatsapp, company_id")
      .eq("id", authUser.id)
      .maybeSingle();
    profile = repairedProfile;
  }

  let company: AuthCompany = {
    id: "",
    razao_social: "Sua Empresa",
    cnpj: "",
  };

  if (profile?.company_id) {
    const { data: companyRow } = await supabase
      .from("companies")
      .select("id, razao_social, cnpj, politica_reembolso_arquivo")
      .eq("id", profile.company_id)
      .maybeSingle();
    if (companyRow) {
      company = {
        id: companyRow.id,
        razao_social: companyRow.razao_social,
        cnpj: companyRow.cnpj,
        politica_reembolso_arquivo: companyRow.politica_reembolso_arquivo ?? undefined,
      };
    }
  }

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", authUser.id);

  const role =
    (roleRows?.find((r) => r.role === "admin")?.role as AuthUser["role"]) ??
    (roleRows?.[0]?.role as AuthUser["role"]) ??
    "admin";

  cachedUser = {
    id: profile?.id ?? authUser.id,
    auth_user_id: authUser.id,
    nome: profile?.nome ?? authUser.email ?? "Usuário",
    email: profile?.email ?? authUser.email ?? "",
    whatsapp: profile?.whatsapp ?? undefined,
    role,
    company,
  };
  sessionLoaded = true;
  return cachedUser;
}

/** Leitura síncrona do usuário em cache (use após loadSession). */
export function getCurrentUser(): AuthUser | null {
  return cachedUser;
}

/** Versão assíncrona — garante que a sessão foi carregada ao menos uma vez. */
export async function getCurrentUserAsync(): Promise<AuthUser | null> {
  if (!sessionLoaded) return loadSession();
  return cachedUser;
}

/** Verifica autenticação (assíncrono — consulta o Auth). */
export async function isAuthenticated(): Promise<boolean> {
  const user = await loadSession();
  return user !== null;
}

/**
 * Indica se a empresa já enviou a política de reembolso.
 * Sem política a IA não consegue avaliar despesas, por isso o admin fica
 * travado no onboarding até concluir esta etapa.
 */
export async function hasPolicyUploaded(): Promise<boolean> {
  const user = await getCurrentUserAsync();
  return !!user?.company.politica_reembolso_arquivo;
}

/** Versão síncrona (lê do cache). */
export function hasPolicyUploadedSync(): boolean {
  return !!cachedUser?.company.politica_reembolso_arquivo;
}

/** Marca a política como enviada, atualizando a empresa no banco. */
export async function markPolicyUploaded(fileName: string): Promise<AuthUser | null> {
  const user = cachedUser ?? (await loadSession());
  if (!user?.company.id) return null;

  const { error } = await supabase
    .from("companies")
    .update({ politica_reembolso_arquivo: fileName.trim() })
    .eq("id", user.company.id);

  if (error) throw error;

  return loadSession();
}

/**
 * Cria a empresa e o primeiro admin via Supabase Auth.
 * O gatilho `handle_new_user` no banco cria empresa + perfil + papel admin
 * a partir dos metadados abaixo.
 */
export async function signUpCompany(input: SignUpInput): Promise<AuthUser> {
  const { error } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.senha,
    options: {
      emailRedirectTo: `${window.location.origin}/overview`,
      data: {
        razao_social: input.razaoSocial.trim(),
        cnpj: input.cnpj.trim(),
        nome: input.nomeResponsavel.trim(),
        whatsapp: input.whatsapp.trim(),
        politica_reembolso_arquivo: input.politicaReembolsoArquivo?.trim() || "",
      },
    },
  });

  if (error) throw error;

  const user = await loadSession();
  if (!user) throw new Error("Falha ao carregar a sessão após o cadastro.");
  return user;
}

/** Valida credenciais via Supabase Auth. */
export async function signIn(input: SignInInput): Promise<AuthUser> {
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.senha,
  });

  if (error) throw error;

  const user = await loadSession();
  if (!user) throw new Error("Falha ao carregar a sessão após o login.");
  return user;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  cachedUser = null;
  sessionLoaded = true;
}
