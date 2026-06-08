ALTER TABLE public.inbound_reimbursements
  ADD COLUMN IF NOT EXISTS nfe_status text,
  ADD COLUMN IF NOT EXISTS nfe_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS nfe_raw jsonb;