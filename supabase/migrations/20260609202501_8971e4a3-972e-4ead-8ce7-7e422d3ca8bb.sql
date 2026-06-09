CREATE TABLE public.webhook_debug (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source text NOT NULL DEFAULT 'evolution',
  event_name text,
  instance text,
  owner_number text,
  resolved_company uuid,
  reason text,
  payload jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.webhook_debug TO authenticated;
GRANT ALL ON public.webhook_debug TO service_role;

ALTER TABLE public.webhook_debug ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read webhook debug"
ON public.webhook_debug
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));