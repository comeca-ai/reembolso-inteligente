ALTER TABLE public.inbound_reimbursements
  ADD COLUMN IF NOT EXISTS compliance_report jsonb,
  ADD COLUMN IF NOT EXISTS compliance_status text,
  ADD COLUMN IF NOT EXISTS compliance_at timestamptz;