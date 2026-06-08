-- S6: admins/aprovadores podem ver perfis da própria empresa (além do próprio).
-- current_company_id() é SECURITY DEFINER (não recorre na RLS de profiles).
CREATE POLICY "Company members can view company profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (company_id = public.current_company_id());

-- S5: políticas de escrita no bucket privado 'cartoes-cnpj' (somente admin,
-- escopadas à pasta da própria empresa). Antes só existia SELECT.
CREATE POLICY "Admins can upload company cnpj files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'cartoes-cnpj'
  AND (storage.foldername(name))[1] = (public.current_company_id())::text
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can update company cnpj files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'cartoes-cnpj'
  AND (storage.foldername(name))[1] = (public.current_company_id())::text
  AND public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  bucket_id = 'cartoes-cnpj'
  AND (storage.foldername(name))[1] = (public.current_company_id())::text
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can delete company cnpj files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'cartoes-cnpj'
  AND (storage.foldername(name))[1] = (public.current_company_id())::text
  AND public.has_role(auth.uid(), 'admin')
);