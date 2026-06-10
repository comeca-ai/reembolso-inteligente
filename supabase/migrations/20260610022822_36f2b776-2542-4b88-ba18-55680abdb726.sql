-- Restringe a leitura do token de webhook das empresas.
-- Membros autenticados não podem mais ler a coluna webhook_token via Data API;
-- apenas o service_role (usado nos webhooks e no painel admin server-side) acessa.
REVOKE SELECT ON public.companies FROM authenticated;
GRANT SELECT (
  id,
  razao_social,
  cnpj,
  politica_reembolso_arquivo,
  created_at,
  updated_at,
  cartao_cnpj_arquivo,
  cartao_cnpj_path,
  whatsapp_number,
  evolution_instance
) ON public.companies TO authenticated;