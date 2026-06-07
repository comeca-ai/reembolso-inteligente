REVOKE EXECUTE ON FUNCTION public.ensure_current_user_profile() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_current_user_profile() FROM anon;
GRANT EXECUTE ON FUNCTION public.ensure_current_user_profile() TO authenticated;