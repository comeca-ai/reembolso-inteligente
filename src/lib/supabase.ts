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
 * `true` quando a camada de DADOS está apontada para um backend real e pronto.
 *
 * IMPORTANTE: a AUTENTICAÇÃO sempre usa o backend real (cliente único
 * reexportado acima). Esta flag controla apenas a camada de DADOS de negócio
 * (`api.ts`).
 *
 * Hoje as tabelas esperadas por `api.ts` (`expenses`, `user_accounts`,
 * `field_users`, ...) ainda NÃO existem no banco. Se apontássemos a camada de
 * dados para o backend, toda tela pós-login quebraria com
 * "Could not find the table public.expenses". Por isso mantemos os dados de
 * demonstração (mock) até que o schema de dados seja criado e mapeado.
 */
export const isSupabaseConfigured = false;

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
