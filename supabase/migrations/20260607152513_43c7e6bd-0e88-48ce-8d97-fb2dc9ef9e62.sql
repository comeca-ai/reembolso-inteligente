CREATE POLICY "Empresa vê seus comprovantes"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'comprovantes'
  AND (storage.foldername(name))[1] = public.current_company_id()::text
);