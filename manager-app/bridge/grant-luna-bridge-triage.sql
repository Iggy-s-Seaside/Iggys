-- grant-luna-bridge-triage.sql
-- Lets the least-privilege luna_bridge role WRITE email-triage verdicts back to
-- the messages table. Applied to prod 2026-06-15 (Supabase migrations
-- `add_message_triage` + `luna_bridge_update_messages_policy`).
--
-- GOTCHA worth remembering: a table GRANT is NOT enough when RLS is enabled.
-- messages has RLS on; luna_bridge could SELECT (policy "Bridge read messages")
-- but its UPDATEs silently affected 0 rows until a matching UPDATE *row policy*
-- existed — no error, the daemon just logged "classified N" while nothing
-- persisted. Both the GRANT and the POLICY are required.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'luna_bridge') THEN
    -- Table privilege (also set by the add_message_triage migration).
    GRANT SELECT, UPDATE ON public.messages TO luna_bridge;

    -- RLS row policy for the UPDATE (mirrors the existing "Bridge read messages"
    -- SELECT policy). Without this, RLS filters every row out of the UPDATE.
    DROP POLICY IF EXISTS "Bridge update messages" ON public.messages;
    CREATE POLICY "Bridge update messages" ON public.messages
      FOR UPDATE TO luna_bridge USING (true) WITH CHECK (true);
  END IF;
END $$;
