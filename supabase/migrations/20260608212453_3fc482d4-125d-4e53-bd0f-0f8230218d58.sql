ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS cartao_cnpj_arquivo text,
  ADD COLUMN IF NOT EXISTS cartao_cnpj_path text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_company_id UUID;
  invited_company_id UUID;
  invited_role app_role;
BEGIN
  invited_company_id := NULLIF(NEW.raw_user_meta_data ->> 'invited_company_id', '')::uuid;

  IF invited_company_id IS NOT NULL THEN
    invited_role := COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'invite_role', ''), 'approver')::app_role;

    INSERT INTO public.profiles (id, company_id, nome, email, whatsapp)
    VALUES (
      NEW.id,
      invited_company_id,
      COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.email),
      NEW.email,
      NULLIF(NEW.raw_user_meta_data ->> 'whatsapp', '')
    );

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, invited_role);

    RETURN NEW;
  END IF;

  INSERT INTO public.companies (razao_social, cnpj, politica_reembolso_arquivo, cartao_cnpj_arquivo)
  VALUES (
    COALESCE(NEW.raw_user_meta_data ->> 'razao_social', 'Empresa'),
    COALESCE(NEW.raw_user_meta_data ->> 'cnpj', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'politica_reembolso_arquivo', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'cartao_cnpj_arquivo', '')
  )
  RETURNING id INTO new_company_id;

  INSERT INTO public.profiles (id, company_id, nome, email, whatsapp)
  VALUES (
    NEW.id,
    new_company_id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.email),
    NEW.email,
    NULLIF(NEW.raw_user_meta_data ->> 'whatsapp', '')
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin');

  RETURN NEW;
END;
$function$;

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
  resolved_role app_role;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT raw_user_meta_data, email INTO meta, user_email FROM auth.users WHERE id = uid;
  meta := COALESCE(meta, '{}'::jsonb);
  invited_company_id := NULLIF(meta ->> 'invited_company_id', '')::uuid;
  resolved_role := CASE
    WHEN invited_company_id IS NOT NULL THEN COALESCE(NULLIF(meta ->> 'invite_role', ''), 'approver')::app_role
    ELSE 'admin'::app_role
  END;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = uid) THEN
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = uid) THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (uid, resolved_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
    RETURN;
  END IF;

  IF invited_company_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, company_id, nome, email, whatsapp)
    VALUES (
      uid,
      invited_company_id,
      COALESCE(NULLIF(meta ->> 'nome', ''), user_email, 'Usuário'),
      user_email,
      NULLIF(meta ->> 'whatsapp', '')
    );

    INSERT INTO public.user_roles (user_id, role)
    VALUES (uid, resolved_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    RETURN;
  END IF;

  INSERT INTO public.companies (razao_social, cnpj, politica_reembolso_arquivo, cartao_cnpj_arquivo)
  VALUES (
    COALESCE(NULLIF(meta ->> 'razao_social', ''), 'Empresa'),
    COALESCE(meta ->> 'cnpj', ''),
    NULLIF(meta ->> 'politica_reembolso_arquivo', ''),
    NULLIF(meta ->> 'cartao_cnpj_arquivo', '')
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
  VALUES (uid, resolved_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$function$;

CREATE POLICY "Empresa ve o proprio cartao CNPJ"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'cartoes-cnpj'
  AND (storage.foldername(name))[1] = public.current_company_id()::text
);
