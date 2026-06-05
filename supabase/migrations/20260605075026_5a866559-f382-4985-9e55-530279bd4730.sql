CREATE POLICY "Members can read their company policy files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'policies'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
  );

CREATE POLICY "Admins can upload company policy files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'policies'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can update company policy files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'policies'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can delete company policy files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'policies'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
    AND public.has_role(auth.uid(), 'admin')
  );