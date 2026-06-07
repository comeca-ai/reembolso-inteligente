DROP POLICY IF EXISTS "Users can create own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can create own initial admin role" ON public.user_roles;
DROP POLICY IF EXISTS "New users can create first company" ON public.companies;

CREATE OR REPLACE FUNCTION public.ensure_current_user_profile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  meta jsonb;
  user_email text;
  new_company_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = uid) THEN
    RETURN;
  END IF;

  SELECT raw_user_meta_data, email INTO meta, user_email FROM auth.users WHERE id = uid;
  meta := COALESCE(meta, '{}'::jsonb);

  INSERT INTO public.companies (razao_social, cnpj, politica_reembolso_arquivo)
  VALUES (
    COALESCE(NULLIF(meta ->> 'razao_social', ''), 'Empresa'),
    COALESCE(meta ->> 'cnpj', ''),
    NULLIF(meta ->> 'politica_reembolso_arquivo', '')
  )
  RETURNING id INTO new_company_id;

  INSERT INTO public.profiles (id, company_id, nome, email, whatsapp)
  VALUES (
    uid,
    new_company_id,
    COALESCE(NULLIF(meta ->> 'nome', ''), user_email, 'Usuário'),
    user_email,
    NULLIF(meta ->> 'whatsapp', '')
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (uid, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.ensure_current_user_profile() TO authenticated;