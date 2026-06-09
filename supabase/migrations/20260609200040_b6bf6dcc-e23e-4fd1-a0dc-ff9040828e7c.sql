-- Identificação da empresa pelo NOME DA INSTÂNCIA do Evolution (campo sempre
-- presente no payload), além do número de WhatsApp já existente.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS evolution_instance text;

-- Resolve a empresa pelo nome da instância (case-insensitive, sem espaços nas pontas).
CREATE OR REPLACE FUNCTION public.resolve_company_by_instance(_instance text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.companies
  WHERE evolution_instance IS NOT NULL
    AND lower(btrim(evolution_instance)) = lower(btrim(COALESCE(_instance, '')))
    AND btrim(COALESCE(_instance, '')) <> ''
  LIMIT 1
$$;

-- Pré-preenche a instância da empresa que já estava usando o WhatsApp.
UPDATE public.companies
SET evolution_instance = 'Reembolsa aí'
WHERE id = '00b28419-606b-4f4f-9138-6f562d8dc1cb'
  AND evolution_instance IS NULL;

-- Remove os 2 registros de diagnóstico criados no teste do webhook.
DELETE FROM public.inbound_reimbursements
WHERE wa_message_id IN ('TESTDIAG0001', 'TESTDIAG0002');