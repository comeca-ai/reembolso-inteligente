ALTER TABLE public.policies
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'upload',
  ADD COLUMN IF NOT EXISTS source_text text;

COMMENT ON COLUMN public.policies.source IS 'Origem da política: upload (PDF), audio (gravação), text (texto colado)';
COMMENT ON COLUMN public.policies.source_text IS 'Transcrição do áudio e/ou anotações coladas que originaram a política (auditável)';