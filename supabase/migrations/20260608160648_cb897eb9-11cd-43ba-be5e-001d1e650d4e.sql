ALTER TABLE public.inbound_reimbursements ADD COLUMN IF NOT EXISTS danfe_key text;

COMMENT ON COLUMN public.inbound_reimbursements.danfe_key IS 'Chave de acesso da NF-e/DANFE (44 dígitos), extraída do comprovante pela IA quando disponível.';