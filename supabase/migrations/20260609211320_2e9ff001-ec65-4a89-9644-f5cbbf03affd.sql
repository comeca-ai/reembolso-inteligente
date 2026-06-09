
DROP POLICY IF EXISTS "Admins can read webhook debug" ON public.webhook_debug;
CREATE POLICY "Admins can read own company webhook debug"
ON public.webhook_debug
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND resolved_company = current_company_id()
);
