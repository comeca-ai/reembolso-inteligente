-- 1) Impedir que um usuário altere o company_id do próprio perfil.
--    current_company_id() lê company_id de profiles, então permitir essa troca
--    daria acesso a dados de outra empresa. Função trigger em SECURITY INVOKER
--    para que current_user reflita o papel real (authenticated) do chamador.
CREATE OR REPLACE FUNCTION public.enforce_profile_company_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS DISTINCT FROM OLD.company_id
     AND current_user = 'authenticated' THEN
    RAISE EXCEPTION 'company_id não pode ser alterado';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_profile_company_immutable ON public.profiles;
CREATE TRIGGER trg_enforce_profile_company_immutable
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_company_immutable();

-- 2) Bloqueio de escalonamento de privilégios em user_roles.
--    Papéis só devem ser definidos via trigger SECURITY DEFINER (handle_new_user)
--    ou pelo service_role. Remover qualquer privilégio de escrita dos papéis
--    expostos pela API.
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated;
REVOKE ALL ON public.user_roles FROM anon;

-- 3) anon não deve escrever em profiles (criação é feita pelo trigger no signup).
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM anon;