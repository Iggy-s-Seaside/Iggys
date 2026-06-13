-- Messages table for contact form submissions
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unread',
  replied_at TIMESTAMPTZ,
  reply_text TEXT,
  replied_by TEXT,
  notes TEXT
);

-- RLS policies
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$
BEGIN
  DROP POLICY IF EXISTS "Public insert" ON messages;
  DROP POLICY IF EXISTS "Auth read" ON messages;
  DROP POLICY IF EXISTS "Auth update" ON messages;
END $$;

-- Public can INSERT (contact form submissions from the website)
CREATE POLICY "Public insert" ON messages
  FOR INSERT WITH CHECK (true);

-- Only authenticated users (managers) can read messages
CREATE POLICY "Auth read" ON messages
  FOR SELECT TO authenticated USING (true);

-- Only authenticated users (managers) can update messages
CREATE POLICY "Auth update" ON messages
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ── Gmail inbox sync (added 2026-06-12) ──────────────────────────────
-- Mirror real Gmail inbox mail into this table so it shows in the dashboard
-- Inbox. Deduped by Gmail message id; `source` distinguishes website vs gmail.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS gmail_id TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'contact_form';
-- Real UNIQUE constraint (not a partial index) so PostgREST upsert
-- on_conflict=gmail_id works. Nullable column → multiple NULLs allowed.
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_gmail_id_unique;
ALTER TABLE messages ADD CONSTRAINT messages_gmail_id_unique UNIQUE (gmail_id);

-- ── Gmail conversation threading (added 2026-06-12) ──────────────────
ALTER TABLE messages ADD COLUMN IF NOT EXISTS gmail_thread_id TEXT;
CREATE INDEX IF NOT EXISTS messages_gmail_thread_id_idx ON messages (gmail_thread_id) WHERE gmail_thread_id IS NOT NULL;

-- Auto-reply webhook guard: the "Thanks for contacting Iggy's!" auto-reply must
-- fire ONLY for website contact-form submissions, never for mail synced from the
-- Gmail inbox (source='gmail') — otherwise syncing emails customers an unwanted
-- auto-reply and can loop. The on_new_message trigger calls this function.
CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  payload jsonb;
  request_id bigint;
BEGIN
  IF COALESCE(NEW.source, 'contact_form') <> 'contact_form' THEN
    RETURN NEW;  -- gmail-synced / non-form rows never auto-reply
  END IF;
  payload := jsonb_build_object('type', 'INSERT', 'table', 'messages', 'record', row_to_json(NEW));
  SELECT net.http_post(
    url := 'https://nouxyrqpulkbjusriugx.supabase.co/functions/v1/auto-reply'::text,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <ANON_KEY>'),
    body := payload::jsonb
  ) INTO request_id;
  RETURN NEW;
END;
$function$;
