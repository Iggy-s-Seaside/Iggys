-- ============================================================
-- Iggy's — MARKETING / CRM + CAMPAIGNS + SMS RAIL
-- Extends:  contacts (CRM enrichment + per-channel consent)
-- Tables:   consent_events, segments, campaigns, sms_log
--
-- The "front door" to the customer list: dedupe-by-phone/email, simple
-- segments, and an email/SMS campaign composer with a NON-BYPASSABLE
-- consent gate (a send is blocked for any contact lacking the matching
-- opt-in). The SMS rail (send-sms / sms-webhook functions) is gated behind
-- SMS_ENABLED + TWILIO_* secrets — ALL intentionally absent until A2P 10DLC
-- registration lands, so nothing is ever texted for real before then.
--
-- consent_events + sms_log are APPEND-ONLY in spirit (audit / compliance
-- trail): never UPDATE/DELETE rows — write a new event instead.
--
-- Run in: Supabase Dashboard > SQL Editor (test on a branch first).
-- CREATE-only & idempotent (re-runnable). Follows new-table-template.sql:
-- post-Oct-2026 Supabase no longer auto-exposes new public tables, so the
-- explicit GRANTs below are REQUIRED or supabase-js can't see the table.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. contacts — CRM enrichment + per-channel consent.
-- The existing `contacts` table (setup-events-suite.sql) already has
-- name/email/phone/company/tags/marketing_opt_in/notes/last_event_date.
-- These columns add visit/spend history, explicit per-channel opt-in (the
-- consent gate reads sms_opt_in / email_opt_in — NOT the legacy
-- marketing_opt_in), a birthday-month segment key, and a normalized E.164
-- phone used as the SMS dedupe key.
-- ADD COLUMN IF NOT EXISTS keeps this re-runnable.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS first_seen       TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS last_visit       TIMESTAMPTZ;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS visit_count      INT DEFAULT 0;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS total_spend      NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS email_opt_in     BOOLEAN DEFAULT false;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS sms_opt_in       BOOLEAN DEFAULT false;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS birthday_month   INT;   -- 1-12 (NULL = unknown)
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS normalized_phone TEXT;  -- E.164 ("+15035550123"), SMS dedupe key

-- Dedupe / segment helpers.
CREATE INDEX IF NOT EXISTS contacts_normalized_phone_idx ON public.contacts (normalized_phone);
CREATE INDEX IF NOT EXISTS contacts_birthday_month_idx   ON public.contacts (birthday_month);
CREATE INDEX IF NOT EXISTS contacts_last_visit_idx       ON public.contacts (last_visit);

-- ─────────────────────────────────────────────────────────────
-- 2. consent_events — APPEND-ONLY opt-in/opt-out audit log.
-- One row per consent change. The current opt-in state lives on
-- contacts.{email,sms}_opt_in; this table is the immutable WHY/WHEN trail
-- (TCPA / CAN-SPAM defensibility). Inbound "STOP" from the SMS webhook and
-- manager toggles both append here.
--   channel  'sms' | 'email'
--   action   'opt_in' | 'opt_out'
--   source   'manager' | 'website' | 'sms_keyword' | 'import' | 'webhook'
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consent_events (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT now(),
  contact_id  BIGINT REFERENCES public.contacts(id) ON DELETE CASCADE,
  channel     TEXT NOT NULL,                       -- 'sms' | 'email'
  action      TEXT NOT NULL,                       -- 'opt_in' | 'opt_out'
  source      TEXT NOT NULL DEFAULT 'manager'      -- 'manager' | 'website' | 'sms_keyword' | 'import' | 'webhook'
);
CREATE INDEX IF NOT EXISTS consent_events_contact_idx ON public.consent_events (contact_id);
CREATE INDEX IF NOT EXISTS consent_events_created_idx ON public.consent_events (created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 3. segments — saved audience definitions.
-- `rule` is a small JSON predicate the UI evaluates client-side against the
-- contact list (kept deliberately simple: no server-side query builder).
-- Examples: {"type":"sms_opted_in"}  {"type":"birthday_this_month"}
--           {"type":"lapsed","days":90}  {"type":"all"}
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.segments (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT now(),
  name        TEXT NOT NULL,
  rule        JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- ─────────────────────────────────────────────────────────────
-- 4. campaigns — one email/SMS blast (draft → scheduled → sending → sent).
-- The composer enforces the consent gate BEFORE a campaign can be marked
-- sent: recipients are the matching segment ∩ contacts holding the
-- channel-appropriate opt-in. `sent_count` is the number actually delivered.
--   channel  'email' | 'sms'
--   status   'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled'
--   subject  email subject (NULL for SMS)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campaigns (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at    TIMESTAMPTZ DEFAULT now(),
  name          TEXT NOT NULL,
  channel       TEXT NOT NULL DEFAULT 'email',      -- 'email' | 'sms'
  subject       TEXT,                               -- email only
  body          TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'draft',      -- draft|scheduled|sending|sent|cancelled
  scheduled_at  TIMESTAMPTZ,
  sent_count    INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS campaigns_status_idx  ON public.campaigns (status);
CREATE INDEX IF NOT EXISTS campaigns_created_idx ON public.campaigns (created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 5. sms_log — APPEND-ONLY record of every SMS the system sends/receives.
-- Written by send-sms (outbound) and sms-webhook (inbound). While the rail
-- is gated OFF, outbound rows are written with status 'blocked' and NO real
-- Twilio call is made — so this doubles as the dry-run audit trail.
--   direction 'outbound' | 'inbound'
--   status    'queued' | 'sent' | 'delivered' | 'received' | 'blocked' | 'failed'
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sms_log (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT now(),
  to_number   TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  direction   TEXT NOT NULL DEFAULT 'outbound',     -- 'outbound' | 'inbound'
  status      TEXT NOT NULL DEFAULT 'queued',       -- queued|sent|delivered|received|blocked|failed
  error       TEXT
);
CREATE INDEX IF NOT EXISTS sms_log_to_idx      ON public.sms_log (to_number);
CREATE INDEX IF NOT EXISTS sms_log_created_idx ON public.sms_log (created_at DESC);

-- ============================================================
-- GRANTS (required — without these the tables are invisible to the Data API).
-- These are manager-only marketing tables: no anon grant. The send-sms /
-- sms-webhook functions write with the SERVICE ROLE, which bypasses RLS.
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consent_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.segments       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_log        TO authenticated;
-- Identity PKs need no sequence grant.

-- ============================================================
-- Row Level Security + policies (manager-only; no public read).
-- consent_events + sms_log are append-only in spirit: we still grant
-- UPDATE/DELETE to authenticated for operational fixes, but the app never
-- mutates them — it only inserts. The service role bypasses RLS for the
-- function writes.
-- ============================================================

-- consent_events
ALTER TABLE public.consent_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read"   ON public.consent_events;
CREATE POLICY "Auth read"   ON public.consent_events FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert" ON public.consent_events;
CREATE POLICY "Auth insert" ON public.consent_events FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update" ON public.consent_events;
CREATE POLICY "Auth update" ON public.consent_events FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Auth delete" ON public.consent_events;
CREATE POLICY "Auth delete" ON public.consent_events FOR DELETE TO authenticated USING (true);

-- segments
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read"   ON public.segments;
CREATE POLICY "Auth read"   ON public.segments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert" ON public.segments;
CREATE POLICY "Auth insert" ON public.segments FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update" ON public.segments;
CREATE POLICY "Auth update" ON public.segments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Auth delete" ON public.segments;
CREATE POLICY "Auth delete" ON public.segments FOR DELETE TO authenticated USING (true);

-- campaigns
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read"   ON public.campaigns;
CREATE POLICY "Auth read"   ON public.campaigns FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert" ON public.campaigns;
CREATE POLICY "Auth insert" ON public.campaigns FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update" ON public.campaigns;
CREATE POLICY "Auth update" ON public.campaigns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Auth delete" ON public.campaigns;
CREATE POLICY "Auth delete" ON public.campaigns FOR DELETE TO authenticated USING (true);

-- sms_log
ALTER TABLE public.sms_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read"   ON public.sms_log;
CREATE POLICY "Auth read"   ON public.sms_log FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert" ON public.sms_log;
CREATE POLICY "Auth insert" ON public.sms_log FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update" ON public.sms_log;
CREATE POLICY "Auth update" ON public.sms_log FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Auth delete" ON public.sms_log;
CREATE POLICY "Auth delete" ON public.sms_log FOR DELETE TO authenticated USING (true);

-- ---- Realtime — campaigns + sms_log drive live manager UI updates ----
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.campaigns; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.sms_log;   EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
