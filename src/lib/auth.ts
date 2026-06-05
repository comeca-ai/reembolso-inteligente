/**
 * Camada de autenticação — reembolsa.aí
 *
 * Implementação MOCK baseada em `localStorage`, organizada para ser
 * substituída por Supabase Auth no futuro sem mexer na UI.
 *
 * Princípios já preparados para o backend real:
 *   - A SENHA nunca é persistida em tabela própria. Aqui ela é apenas
 *     comparada em memória (mock) e descartada. Em produção, a senha vai
 *     exclusivamente para o Supabase Auth (auth.users).
 *   - `UserAccount` guarda apenas dados do usuário + `auth_user_id`.
 *   - `Company` guarda apenas dados da empresa.
 *
 * Para migrar para Supabase:
 *   - signUpCompany → supabase.auth.signUp + insert em company/user_account
 *     (idealmente via edge function para criar a empresa e o primeiro admin).
 *   - signIn        → supabase.auth.signInWithPassword
 *   - signOut       → supabase.auth.signOut
 *   - getCurrentUser→ supabase.auth.getUser + join em user_account/company
 *   - isAuthenticated → !!(await supabase.auth.getSession()).data.session
 */

const STORAGE_KEY = "reembolsa.auth.session.v1";

export interface AuthCompany {
  id: string;
  razao_social: string;
  cnpj: string;
  /**
   * Nome do arquivo da política/plano de reembolso enviado no pré-cadastro.
   * Apenas metadado (mock). Em produção o arquivo vai para o Supabase Storage
   * e aqui guardamos a referência (path/URL) — nunca o binário.
   */
  politica_reembolso_arquivo?: string;
}

export interface AuthUser {
  id: string;
  /** Em produção, este é o id de auth.users (Supabase Auth). */
  auth_user_id: string;
  nome: string;
  email: string;
  whatsapp?: string;
  role: "admin";
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

function isBrowser() {
  return typeof window !== "undefined";
}

function genId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function readSession(): AuthUser | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function writeSession(user: AuthUser) {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

function clearSession() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}

/** Remove todos os dados de demonstração (mock) para recomeçar o fluxo. */
export function resetMockAuth() {
  clearSession();
  if (isBrowser()) {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}


/** Pequena espera para simular latência de rede (loading states). */
function delay(ms = 700) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Cria a empresa e o primeiro admin (mock).
 *
 * Em produção este fluxo deve:
 *   1. Criar o usuário no Supabase Auth (senha vai só pra lá).
 *   2. Criar a `company`.
 *   3. Criar o `user_account` com `auth_user_id` e role admin.
 * Idealmente tudo numa edge function transacional.
 */
export async function signUpCompany(input: SignUpInput): Promise<AuthUser> {
  await delay();

  const authUserId = genId("authusr");
  const user: AuthUser = {
    id: genId("usr"),
    auth_user_id: authUserId,
    nome: input.nomeResponsavel.trim(),
    email: input.email.trim().toLowerCase(),
    whatsapp: input.whatsapp.trim(),
    role: "admin",
    company: {
      id: genId("co"),
      razao_social: input.razaoSocial.trim(),
      cnpj: input.cnpj.trim(),
      politica_reembolso_arquivo: input.politicaReembolsoArquivo?.trim() || undefined,
    },
  };

  // A senha (input.senha) é deliberadamente descartada aqui.
  writeSession(user);
  return user;
}

/**
 * Valida credenciais (mock). Aceita qualquer e-mail/senha válidos para a demo,
 * ou reutiliza a sessão previamente cadastrada se o e-mail bater.
 */
export async function signIn(input: SignInInput): Promise<AuthUser> {
  await delay();

  const email = input.email.trim().toLowerCase();

  // Se já existe uma conta cadastrada com este e-mail, reutiliza os dados.
  const existing = readSession();
  if (existing && existing.email === email) {
    return existing;
  }

  // Caso demo: cria uma sessão padrão para o e-mail informado.
  const user: AuthUser = {
    id: genId("usr"),
    auth_user_id: genId("authusr"),
    nome: emailToName(email),
    email,
    role: "admin",
    company: {
      id: genId("co"),
      razao_social: "Transtech Logística",
      cnpj: "12.345.678/0001-90",
    },
  };

  writeSession(user);
  return user;
}

export async function signOut(): Promise<void> {
  await delay(300);
  clearSession();
}

export function getCurrentUser(): AuthUser | null {
  return readSession();
}

export function isAuthenticated(): boolean {
  return readSession() !== null;
}

function emailToName(email: string): string {
  const local = email.split("@")[0] ?? "Usuário";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}
