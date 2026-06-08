CREATE POLICY "Admins and approvers can update inbound reimbursements"
ON public.inbound_reimbursements
FOR UPDATE
TO authenticated
USING (
  company_id = public.current_company_id()
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'approver'))
)
WITH CHECK (
  company_id = public.current_company_id()
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'approver'))
);