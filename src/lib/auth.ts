/**
 * Camada de autenticação — reembolso.ia.br
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
import { resolveSessionRole } from "@/lib/auth-gates";

export interface AuthCompany {
  id: string;
  razao_social: string;
  cnpj: string;
  politica_reembolso_arquivo?: string;
  cartao_cnpj_arquivo?: string;
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
  /** Senha ainda é a temporária do convite — troca obrigatória no 1º acesso. */
  mustChangePassword: boolean;
}

export interface SignUpInput {
  razaoSocial: string;
  cnpj: string;
  nomeResponsavel: string;
  email: string;
  whatsapp: string;
  senha: string;
}

export interface SignInInput {
  email: string;
  senha: string;
}

/** Resultado do cadastro: ou cria sessão na hora, ou pede confirmação de e-mail. */
export interface SignUpResult {
  /** "active" = já logado; "confirmation_required" = precisa confirmar o e-mail. */
  status: "active" | "confirmation_required";
  user: AuthUser | null;
}

/** Etapas do pré-cadastro, na ordem em que acontecem. */
export type SignUpStep =
  | "validando"
  | "criando_conta"
  | "provisionando"
  | "carregando_sessao"
  | "concluido";

/** Rótulos amigáveis para exibir o progresso ao usuário. */
export const SIGN_UP_STEP_LABELS: Record<SignUpStep, string> = {
  validando: "Validando os dados informados",
  criando_conta: "Criando a conta de acesso",
  provisionando: "Provisionando empresa e perfil",
  carregando_sessao: "Carregando sua sessão",
  concluido: "Cadastro concluído",
};

/** Ordem das etapas — usada para saber até onde o processo chegou. */
export const SIGN_UP_STEPS: SignUpStep[] = [
  "validando",
  "criando_conta",
  "provisionando",
  "carregando_sessao",
  "concluido",
];

/**
 * Erro de cadastro que carrega a etapa em que parou e o que já foi concluído,
 * permitindo que a UI mostre "até onde foi feito".
 */
export class SignUpStepError extends Error {
  step: SignUpStep;
  completedSteps: SignUpStep[];
  constructor(message: string, step: SignUpStep, completedSteps: SignUpStep[]) {
    super(message);
    this.name = "SignUpStepError";
    this.step = step;
    this.completedSteps = completedSteps;
  }
}

export interface ResetPasswordInput {
  email: string;
}

/** Cache em memória do usuário autenticado (populado em loadSession). */
let cachedUser: AuthUser | null = null;
let sessionLoaded = false;

/**
 * Garante que o usuário autenticado tenha empresa + perfil + papel admin.
 *
 * A criação acontece exclusivamente no servidor, via função SECURITY DEFINER
 * `ensure_current_user_profile`, que só age sobre o próprio `auth.uid()` e
 * apenas quando ainda não existe perfil. Isso impede que o cliente escolha um
 * `company_id` arbitrário ou se conceda o papel admin diretamente.
 */
async function ensureProfileRows(_authUser: User): Promise<void> {
  const { error } = await supabase.rpc("ensure_current_user_profile");
  if (error) throw error;
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
    .select("id, nome, email, whatsapp, company_id, must_change_password")
    .eq("id", authUser.id)
    .maybeSingle();

  if (!profile) {
    await ensureProfileRows(authUser);
    const { data: repairedProfile } = await supabase
      .from("profiles")
      .select("id, nome, email, whatsapp, company_id, must_change_password")
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

  let { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", authUser.id);

  if (!roleRows?.length) {
    await ensureProfileRows(authUser);
    const { data: repairedRoleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", authUser.id);
    roleRows = repairedRoleRows;
  }

  const role = resolveSessionRole(roleRows);

  cachedUser = {
    id: profile?.id ?? authUser.id,
    auth_user_id: authUser.id,
    nome: profile?.nome ?? authUser.email ?? "Usuário",
    email: profile?.email ?? authUser.email ?? "",
    whatsapp: profile?.whatsapp ?? undefined,
    role,
    company,
    mustChangePassword: profile?.must_change_password ?? false,
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
export async function signUpCompany(
  input: SignUpInput,
  onProgress?: (step: SignUpStep) => void,
): Promise<SignUpResult> {
  const completed: SignUpStep[] = [];
  const advance = (step: SignUpStep) => {
    onProgress?.(step);
  };

  // 1) Validação local básica (os dados já chegam validados da UI).
  advance("validando");
  completed.push("validando");

  // 2) Criação da conta de acesso no Auth.
  advance("criando_conta");
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.senha,
    options: {
      emailRedirectTo: `${window.location.origin}/overview`,
      data: {
        razao_social: input.razaoSocial.trim(),
        cnpj: input.cnpj.trim(),
        nome: input.nomeResponsavel.trim(),
        whatsapp: input.whatsapp.trim(),
      },
    },
  });

  if (error) {
    throw new SignUpStepError(error.message, "criando_conta", [...completed]);
  }
  completed.push("criando_conta");

  // Quando a confirmação de e-mail está exigida, o signUp NÃO devolve sessão.
  // Nesse caso o cadastro foi criado com sucesso, mas o acesso só é liberado
  // após o usuário confirmar o e-mail — então não tratamos isso como falha.
  if (!data.session) {
    advance("provisionando");
    return { status: "confirmation_required", user: null };
  }

  // 3) Provisionamento de empresa + perfil + papel (gatilho/ensure no banco).
  advance("provisionando");
  try {
    await ensureProfileRows(data.session.user);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao provisionar a empresa.";
    throw new SignUpStepError(message, "provisionando", [...completed]);
  }
  completed.push("provisionando");

  // 4) Carregamento da sessão completa (perfil + empresa + papel).
  advance("carregando_sessao");
  let user: AuthUser | null = null;
  try {
    user = await loadSession();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao carregar a sessão.";
    throw new SignUpStepError(message, "carregando_sessao", [...completed]);
  }
  if (!user) {
    throw new SignUpStepError(
      "Não foi possível carregar a sessão após o cadastro.",
      "carregando_sessao",
      [...completed],
    );
  }
  completed.push("carregando_sessao");

  advance("concluido");
  return { status: "active", user };
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

export async function sendPasswordReset(input: ResetPasswordInput): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(input.email.trim().toLowerCase(), {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) throw error;
}

export async function updatePassword(senha: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) throw error;
}

/**
 * Conclui a troca obrigatória da senha temporária no primeiro acesso:
 * atualiza a senha no Auth, zera a flag no perfil e recarrega a sessão.
 */
export async function completeMandatoryPasswordChange(senha: string): Promise<AuthUser | null> {
  const { error: pwError } = await supabase.auth.updateUser({ password: senha });
  if (pwError) throw pwError;

  const { data: userData } = await supabase.auth.getUser();
  if (userData.user) {
    const { error } = await supabase
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", userData.user.id);
    if (error) throw error;
  }

  return loadSession();
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  cachedUser = null;
  sessionLoaded = true;
}
