/**
 * Cliente Supabase — reembolso.ia.br
 *
 * Conecta a um projeto Supabase próprio usando APENAS as variáveis públicas
 * do cliente:
 *   - VITE_SUPABASE_URL
 *   - VITE_SUPABASE_ANON_KEY
 *
 * Regras de segurança:
 *   - A service role key NUNCA é usada no frontend.
 *   - Operações sensíveis (decisões, auditoria, cadastros administrativos)
 *     devem ser executadas via backend / edge function — ver `invokeFunction`.
 *   - Se as variáveis de ambiente não existirem, a aplicação cai
 *     automaticamente para os dados de demonstração (mock).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** `true` quando há URL + anon key configuradas para um Supabase real. */
export const isSupabaseConfigured = Boolean(
  SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL.startsWith("http"),
);

/** `true` quando a aplicação está rodando com dados de demonstração (mock). */
export const isUsingMockData = !isSupabaseConfigured;

/**
 * Instância do cliente Supabase, ou `null` quando não há configuração.
 * Usa somente a anon key — RLS deve proteger os dados no projeto Supabase.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

/**
 * Invoca uma edge function do Supabase para operações sensíveis que NÃO devem
 * ser executadas diretamente do frontend (decisões de reembolso, gravação de
 * auditoria, cadastros administrativos, etc.).
 *
 * Mantém a camada de dados preparada para o backend sem expor segredos.
 */
export async function invokeFunction<T = unknown>(
  name: string,
  body?: Record<string, unknown>,
): Promise<T> {
  if (!supabase) {
    throw new Error(
      `Supabase não configurado: a edge function "${name}" só está disponível com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.`,
    );
  }
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (error) throw error;
  return data as T;
}
