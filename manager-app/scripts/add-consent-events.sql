-- ============================================================
-- Iggy's — CONSENT EVENTS + per-channel opt-in (PUBLIC website list-growth)
-- Extends:  contacts (email_opt_in / sms_opt_in)
-- Table:    consent_events (append-only opt-in/opt-out audit trail)
--
-- WHY THIS EXISTS:
-- The public website (subscribe edge fn + booking/contact lead forms) now
-- captures explicit per-channel marketing consent. Each opted channel writes
-- an immutable consent_events row (TCPA / CAN-SPAM defensibility) and flips
-- the matching boolean on contacts. NOTHING is ever sent from these writes —
-- the send rails (send-sms / campaigns) read these flags as a non-bypassable
-- gate, and remain disabled until A2P 10DLC + provider creds land.
--
-- IDEMPOTENT / CREATE-only (re-runnable). This OVERLAPS add-marketing.sql on
-- purpose: consent_events + the contacts opt-in columns may already exist from
-- that migration. Every statement here is guarded (IF NOT EXISTS / drop-then-
-- create) so running this on a DB where add-marketing.sql already ran is a
-- harmless no-op, and running it on a fresh DB stands up the table alone.
--
-- NOTE on the FK ON DELETE behavior: if consent_events already exists (from
-- add-marketing.sql) it keeps its existing FK (ON DELETE CASCADE). We do NOT
-- ALTER a live constraint here. The CREATE below uses ON DELETE SET NULL so a
-- *fresh* DB preserves the consent audit row even if the contact is deleted —
-- the spirit of an append-only compliance log. Both are acceptable; we never
-- destructively migrate the shipped table.
--
-- Run in: Supabase Dashboard > SQL Editor (test on a branch first).
-- Follows new-table-template.sql: post-Oct-2026 Supabase no longer auto-exposes
-- new public tables, so the explicit GRANTs below are REQUIRED.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. contacts — ensure per-channel opt-in booleans exist (default OFF).
-- The consent gate reads these (NOT the legacy marketing_opt_in). Default
-- false means nothing is mailable until the customer explicitly opts in.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS email_opt_in BOOLEAN DEFAULT false;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS sms_opt_in   BOOLEAN DEFAULT false;

-- ─────────────────────────────────────────────────────────────
-- 2. consent_events — APPEND-ONLY opt-in/opt-out audit log.
-- One row per consent change. Current state lives on contacts.{email,sms}_opt_in;
-- this is the immutable WHY/WHEN trail.
--   channel  'sms' | 'email'
--   action   'opt_in' | 'opt_out'
--   source   'website' | 'manager' | 'sms_keyword' | 'import' | 'webhook'
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consent_events (
  id          BIGSERIAL PRIMARY KEY,
  contact_id  BIGINT REFERENCES public.contacts(id) ON DELETE SET NULL,
  channel     TEXT,                                 -- 'sms' | 'email'
  action      TEXT,                                 -- 'opt_in' | 'opt_out'
  source      TEXT,                                 -- 'website' | 'manager' | ...
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS consent_events_contact_idx ON public.consent_events (contact_id);
CREATE INDEX IF NOT EXISTS consent_events_created_idx ON public.consent_events (created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 3. GRANTS (required — without these the table is invisible to the Data API).
-- Manager-only table: no anon grant. The subscribe / submit-* edge functions
-- write with the SERVICE ROLE, which bypasses RLS entirely.
-- ─────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consent_events TO authenticated;
-- bigserial → grant the backing sequence so authenticated inserts can get an id.
-- (Harmless if the table was created with an identity column instead.)
DO $$
BEGIN
  EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE public.consent_events_id_seq TO authenticated';
EXCEPTION WHEN undefined_table THEN
  -- table uses GENERATED IDENTITY (no standalone sequence) — nothing to grant.
  NULL;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 4. Row Level Security + policies (manager-only; no public read).
-- Append-only in spirit; we still grant UPDATE/DELETE to authenticated for
-- operational fixes, but the app only inserts. Service role bypasses RLS.
-- drop-then-create keeps this idempotent (Postgres has no CREATE POLICY IF NOT EXISTS).
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.consent_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read"   ON public.consent_events;
CREATE POLICY "Auth read"   ON public.consent_events FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth insert" ON public.consent_events;
CREATE POLICY "Auth insert" ON public.consent_events FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Auth update" ON public.consent_events;
CREATE POLICY "Auth update" ON public.consent_events FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth delete" ON public.consent_events;
CREATE POLICY "Auth delete" ON public.consent_events FOR DELETE TO authenticated USING (true);
