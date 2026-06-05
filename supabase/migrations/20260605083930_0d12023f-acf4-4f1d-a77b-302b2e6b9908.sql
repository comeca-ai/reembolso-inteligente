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
    -- Usuário convidado: entra na empresa existente, não cria nova.
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

  -- Fluxo padrão: novo cadastro de empresa (primeiro admin).
  INSERT INTO public.companies (razao_social, cnpj, politica_reembolso_arquivo)
  VALUES (
    COALESCE(NEW.raw_user_meta_data ->> 'razao_social', 'Empresa'),
    COALESCE(NEW.raw_user_meta_data ->> 'cnpj', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'politica_reembolso_arquivo', '')
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