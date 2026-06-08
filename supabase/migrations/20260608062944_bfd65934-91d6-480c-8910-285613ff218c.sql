CREATE OR REPLACE FUNCTION public.can_view_reimbursement(_sender text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- admin e aprovador veem tudo da empresa
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'approver')
    -- membro: apenas os próprios (telefone pelos últimos 8 dígitos ou e-mail)
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          (
            length(regexp_replace(COALESCE(p.whatsapp, ''), '\D', '', 'g')) >= 8
            AND right(regexp_replace(COALESCE(p.whatsapp, ''), '\D', '', 'g'), 8)
              = right(regexp_replace(COALESCE(_sender, ''), '\D', '', 'g'), 8)
          )
          OR (
            COALESCE(p.email, '') <> ''
            AND lower(p.email) = lower(COALESCE(_sender, ''))
          )
        )
    )
$$;

DROP POLICY IF EXISTS "Members can view their company inbound reimbursements" ON public.inbound_reimbursements;

CREATE POLICY "Scoped view of inbound reimbursements"
ON public.inbound_reimbursements
FOR SELECT
TO authenticated
USING (
  company_id = public.current_company_id()
  AND public.can_view_reimbursement(sender)
);