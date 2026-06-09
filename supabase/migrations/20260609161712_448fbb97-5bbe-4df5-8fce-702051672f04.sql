-- Prevent authenticated users from moving their profile to another company (tenant escalation)
DROP TRIGGER IF EXISTS enforce_profile_company_immutable_trg ON public.profiles;
CREATE TRIGGER enforce_profile_company_immutable_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_company_immutable();