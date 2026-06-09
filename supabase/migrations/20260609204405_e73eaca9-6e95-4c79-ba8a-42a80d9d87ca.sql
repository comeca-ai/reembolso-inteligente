-- Resolve a empresa a partir do TELEFONE DO REMETENTE (colaborador) que
-- enviou o comprovante. Como o número de WhatsApp do SaaS é compartilhado por
-- todas as empresas, a empresa é determinada pelo perfil do colaborador
-- cadastrado (companies via profiles). Compara os últimos 8 dígitos.
CREATE OR REPLACE FUNCTION public.resolve_company_by_sender_whatsapp(_sender text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.company_id
  FROM public.profiles p
  WHERE length(regexp_replace(COALESCE(p.whatsapp, ''), '\D', '', 'g')) >= 8
    AND right(regexp_replace(p.whatsapp, '\D', '', 'g'), 8)
        = right(regexp_replace(COALESCE(_sender, ''), '\D', '', 'g'), 8)
  ORDER BY p.created_at ASC
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.resolve_company_by_sender_whatsapp(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_company_by_sender_whatsapp(text) TO service_role;