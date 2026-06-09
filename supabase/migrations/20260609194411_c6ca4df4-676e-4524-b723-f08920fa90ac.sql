-- Identificação da empresa pelo número de WhatsApp que recebe os recibos
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS whatsapp_number text;

COMMENT ON COLUMN public.companies.whatsapp_number IS
  'Número da linha de WhatsApp (instância Evolution) que recebe os comprovantes. Usado para resolver a empresa no webhook, no lugar do token.';

-- Resolve a empresa comparando os últimos 8 dígitos do número (tolerante a
-- DDI/DDD e formatação). SECURITY DEFINER pois é usada por webhook público.
CREATE OR REPLACE FUNCTION public.resolve_company_by_whatsapp(_number text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.companies
  WHERE length(regexp_replace(COALESCE(whatsapp_number, ''), '\D', '', 'g')) >= 8
    AND right(regexp_replace(whatsapp_number, '\D', '', 'g'), 8)
        = right(regexp_replace(COALESCE(_number, ''), '\D', '', 'g'), 8)
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.resolve_company_by_whatsapp(text) TO service_role;