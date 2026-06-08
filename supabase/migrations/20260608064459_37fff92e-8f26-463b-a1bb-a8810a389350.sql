ALTER TABLE public.inbound_reimbursements
  ADD COLUMN IF NOT EXISTS policy_verdict text,
  ADD COLUMN IF NOT EXISTS policy_summary text,
  ADD COLUMN IF NOT EXISTS policy_cited_rule text,
  ADD COLUMN IF NOT EXISTS policy_confidence numeric,
  ADD COLUMN IF NOT EXISTS policy_analyzed_at timestamptz;