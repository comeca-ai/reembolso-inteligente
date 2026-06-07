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
  invited_company_id uuid;
  invited_role app_role;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = uid) THEN
    RETURN;
  END IF;

  SELECT raw_user_meta_data, email INTO meta, user_email FROM auth.users WHERE id = uid;
  meta := COALESCE(meta, '{}'::jsonb);
  invited_company_id := NULLIF(meta ->> 'invited_company_id', '')::uuid;

  IF invited_company_id IS NOT NULL THEN
    invited_role := COALESCE(NULLIF(meta ->> 'invite_role', ''), 'approver')::app_role;

    INSERT INTO public.profiles (id, company_id, nome, email, whatsapp)
    VALUES (
      uid,
      invited_company_id,
      COALESCE(NULLIF(meta ->> 'nome', ''), user_email, 'Usuário'),
      user_email,
      NULLIF(meta ->> 'whatsapp', '')
    );

    INSERT INTO public.user_roles (user_id, role)
    VALUES (uid, invited_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    RETURN;
  END IF;

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

REVOKE EXECUTE ON FUNCTION public.ensure_current_user_profile() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_current_user_profile() FROM anon;
GRANT EXECUTE ON FUNCTION public.ensure_current_user_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_current_user_profile() TO service_role;