ALTER TABLE public.inbound_reimbursements
  ADD COLUMN IF NOT EXISTS decision text NOT NULL DEFAULT 'pendente'
    CHECK (decision IN ('pendente', 'aprovado', 'negado')),
  ADD COLUMN IF NOT EXISTS decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decided_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS decision_note text;