-- 1. Restrict despesas SELECT: users only see expenses from their own phone number
DROP POLICY IF EXISTS "Authenticated employees can view despesas" ON public.despesas;

CREATE POLICY "Users can view their own despesas"
ON public.despesas
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND length(regexp_replace(COALESCE(p.whatsapp, ''), '\D', '', 'g')) >= 8
      AND right(regexp_replace(COALESCE(p.whatsapp, ''), '\D', '', 'g'), 8)
        = right(regexp_replace(COALESCE(despesas.telefone, ''), '\D', '', 'g'), 8)
  )
);

-- 2. Comprovantes storage: explicit write policies scoped to the company folder + role
CREATE POLICY "Admins and approvers can upload comprovantes"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'comprovantes'
  AND (storage.foldername(name))[1] = (current_company_id())::text
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'approver'::app_role))
);

CREATE POLICY "Admins and approvers can update comprovantes"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'comprovantes'
  AND (storage.foldername(name))[1] = (current_company_id())::text
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'approver'::app_role))
)
WITH CHECK (
  bucket_id = 'comprovantes'
  AND (storage.foldername(name))[1] = (current_company_id())::text
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'approver'::app_role))
);

CREATE POLICY "Admins and approvers can delete comprovantes"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'comprovantes'
  AND (storage.foldername(name))[1] = (current_company_id())::text
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'approver'::app_role))
);

-- 3. Set fixed search_path on the email/queue helper functions (search_path mutable fix)
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$function$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
 RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$function$;

-- 4. Revoke public/anon EXECUTE on SECURITY DEFINER functions; grant only needed roles
-- Internal queue helpers: server (service_role) only
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;

REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;

-- Trigger functions: not meant to be called directly by API roles
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_profile_company_immutable() FROM PUBLIC, anon, authenticated;

-- Helper used by signed-in app code / RLS: authenticated only (drop anon)
REVOKE ALL ON FUNCTION public.ensure_current_user_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_current_user_profile() TO authenticated;

-- RLS helper functions: needed by authenticated for policy evaluation, drop anon/public
REVOKE ALL ON FUNCTION public.current_company_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_company_id() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.can_view_reimbursement(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_reimbursement(text) TO authenticated, service_role;