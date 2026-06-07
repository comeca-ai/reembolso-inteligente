DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;

CREATE POLICY "New users can create first company"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);