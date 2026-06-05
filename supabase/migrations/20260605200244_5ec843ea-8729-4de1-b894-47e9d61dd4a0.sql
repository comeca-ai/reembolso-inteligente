-- Per-company webhook token
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS webhook_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS companies_webhook_token_key ON public.companies(webhook_token);

-- Inbound reimbursement messages received via webhook
CREATE TABLE public.inbound_reimbursements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'whatsapp',
  sender text NOT NULL,
  sender_name text,
  message text,
  attachment_url text,
  amount numeric(12,2),
  category text,
  status text NOT NULL DEFAULT 'recebido',
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.inbound_reimbursements TO authenticated;
GRANT ALL ON public.inbound_reimbursements TO service_role;

ALTER TABLE public.inbound_reimbursements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their company inbound reimbursements"
ON public.inbound_reimbursements
FOR SELECT
TO authenticated
USING (company_id = public.current_company_id());

CREATE INDEX idx_inbound_reimbursements_company ON public.inbound_reimbursements(company_id, created_at DESC);

CREATE TRIGGER update_inbound_reimbursements_updated_at
BEFORE UPDATE ON public.inbound_reimbursements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();