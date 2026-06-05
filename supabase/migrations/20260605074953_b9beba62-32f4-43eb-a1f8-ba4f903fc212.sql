-- Tabela de versões da política de reembolso
CREATE TABLE public.policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT,
  uploaded_by TEXT,
  pages INTEGER NOT NULL DEFAULT 0,
  size_kb INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'processando',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.policies TO authenticated;
GRANT ALL ON public.policies TO service_role;

ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their company policies"
  ON public.policies FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY "Admins can insert company policies"
  ON public.policies FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update company policies"
  ON public.policies FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (company_id = public.current_company_id() AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete company policies"
  ON public.policies FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_policies_updated_at
  BEFORE UPDATE ON public.policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Regras estruturadas extraídas da política pela IA
CREATE TABLE public.policy_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_id UUID NOT NULL REFERENCES public.policies(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'outros',
  rule_limit TEXT,
  rule_basis TEXT,
  rule_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.policy_rules TO authenticated;
GRANT ALL ON public.policy_rules TO service_role;

ALTER TABLE public.policy_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their company policy rules"
  ON public.policy_rules FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY "Admins can manage company policy rules"
  ON public.policy_rules FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (company_id = public.current_company_id() AND public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_policy_rules_policy_id ON public.policy_rules(policy_id);
CREATE INDEX idx_policies_company_active ON public.policies(company_id, active);