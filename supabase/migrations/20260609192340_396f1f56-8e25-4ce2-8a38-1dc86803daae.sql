ALTER TABLE public.inbound_reimbursements ADD COLUMN IF NOT EXISTS wa_message_id text;

CREATE UNIQUE INDEX IF NOT EXISTS inbound_reimbursements_company_wa_message_id_key
  ON public.inbound_reimbursements (company_id, wa_message_id)
  WHERE wa_message_id IS NOT NULL;