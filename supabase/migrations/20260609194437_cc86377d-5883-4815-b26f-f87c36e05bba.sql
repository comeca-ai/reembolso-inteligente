REVOKE EXECUTE ON FUNCTION public.resolve_company_by_whatsapp(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_company_by_whatsapp(text) TO service_role;