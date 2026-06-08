/**
 * Cliente Supabase — reembolso.ia.br
 *
 * IMPORTANTE: Existe um ÚNICO cliente Supabase na aplicação, definido em
 * `@/integrations/supabase/client`. Este módulo apenas o reexporta e expõe
 * utilitários de compatibilidade.
 *
 * Por que isso importa:
 *   - Criar um segundo `createClient` faz o navegador instanciar duas
 *     instâncias do GoTrueClient sobre a mesma chave de storage
 *     ("Multiple GoTrueClient instances detected"). Isso causa
 *     comportamento indefinido na sessão (login intermitente, botão
 *     "Entrar" que aparenta não funcionar, refresh de token concorrente).
 *   - Mantendo um cliente único, a sessão de auth e as queries de dados
 *     compartilham o mesmo token — RLS funciona como o usuário logado.
 *
 * Regras de segurança:
 *   - A service role key NUNCA é usada no frontend.
 *   - Operações sensíveis devem rodar no backend (server functions / rotas).
 */

import { supabase } from "@/integrations/supabase/client";

export { supabase };

/**
 * `true` quando a camada de DADOS está apontada para um backend real.
 *
 * Mantemos o gate na `VITE_SUPABASE_ANON_KEY` (variável de dados, separada da
 * chave de auth). Enquanto ela não estiver definida, a aplicação continua
 * usando os dados de demonstração (mock) — exatamente como antes desta
 * refatoração. O importante aqui é que a AUTENTICAÇÃO já usa o cliente único
 * (reexportado acima), eliminando a duplicação de GoTrueClient.
 */
export const isSupabaseConfigured = Boolean(
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) &&
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined),
);

/** `true` quando a aplicação está rodando com dados de demonstração (mock). */
export const isUsingMockData = !isSupabaseConfigured;

/**
 * Invoca uma edge function do Supabase para operações sensíveis que NÃO devem
 * ser executadas diretamente do frontend.
 */
export async function invokeFunction<T = unknown>(
  name: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (error) throw error;
  return data as T;
}
