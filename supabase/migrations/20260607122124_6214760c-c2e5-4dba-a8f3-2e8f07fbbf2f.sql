ALTER TABLE public.inbound_reimbursements REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inbound_reimbursements;