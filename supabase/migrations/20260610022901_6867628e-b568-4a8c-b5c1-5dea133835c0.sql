-- Estas funções são usadas apenas server-side (via service_role) nos webhooks.
-- Remove a permissão de execução de usuários logados/anônimos.
REVOKE EXECUTE ON FUNCTION public.resolve_company_by_whatsapp(text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_company_by_instance(text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_company_by_sender_whatsapp(text) FROM public, anon, authenticated;