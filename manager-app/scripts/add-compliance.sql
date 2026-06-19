-- ============================================================
-- Iggy's — COMPLIANCE VAULT  (the "show the inspector" trust layer)
--
-- The legally-defensible record of how the bar runs: alcohol refusals / cut-offs,
-- incident reports, walk-in & cooler temperature logs, and license/cert expiries.
-- Plus push_subscriptions for the web-push trust pings.
--
-- APPEND-ONLY IN SPIRIT: refusal_logs, incidents, and temperature_logs are records
-- of things that HAPPENED — they get created on the floor and are never edited or
-- deleted by staff (no UPDATE/DELETE grant to `authenticated`). created_at is a
-- server default so the timeline can't be back-dated. temp_units & credentials are
-- managed reference/registry data and DO allow edit (a unit gets renamed, a renewed
-- license gets a new expiry), but their child *log* rows stay immutable.
--
-- shift_id is a NULLABLE LOGICAL reference to shift_sessions.id (intentionally NOT a
-- hard FK) so this migration stays independently runnable from the shift-spine wave.
--
-- Run in: Supabase Dashboard > SQL Editor (test on a branch first).
-- CREATE-only & idempotent (re-runnable). Follows new-table-template.sql:
-- post-Oct-2026 Supabase no longer auto-exposes new public tables, so the explicit
-- GRANTs below are REQUIRED or supabase-js can't see the table.
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- refusal_logs — every alcohol refusal / cut-off, the dram-shop defense.
--   shift_id  nullable logical ref to shift_sessions.id (no FK)
--   server    staff member who made the call (free text — name/initials)
--   reason    'intoxicated' | 'no_id' | 'underage' | 'fake_id' | 'other' (free text)
--   notes     what happened, descriptions, witnesses
-- IMMUTABLE: no UPDATE/DELETE grant — a refusal record can never be altered.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.refusal_logs (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  shift_id    INTEGER,
  server      TEXT,
  reason      TEXT NOT NULL DEFAULT 'other',
  notes       TEXT
);

CREATE INDEX IF NOT EXISTS refusal_logs_created_idx ON public.refusal_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS refusal_logs_shift_idx   ON public.refusal_logs (shift_id);

GRANT SELECT, INSERT ON public.refusal_logs TO authenticated; -- append-only: read + create, never edit/delete

ALTER TABLE public.refusal_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read" ON public.refusal_logs;
CREATE POLICY "Auth read" ON public.refusal_logs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth insert" ON public.refusal_logs;
CREATE POLICY "Auth insert" ON public.refusal_logs
  FOR INSERT TO authenticated WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────
-- incidents — incident reports (slip, fight, injury, theft, ejection, etc.).
--   type          'injury' | 'altercation' | 'ejection' | 'property' | 'medical' | 'other'
--   description   what happened
--   action_taken  what staff did (911, first aid, trespass, refund, …)
--   photo_url     optional evidence photo
-- IMMUTABLE: no UPDATE/DELETE grant — an incident report is a permanent record.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.incidents (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  shift_id      INTEGER,
  type          TEXT NOT NULL DEFAULT 'other',
  description   TEXT NOT NULL DEFAULT '',
  action_taken  TEXT,
  photo_url     TEXT
);

CREATE INDEX IF NOT EXISTS incidents_created_idx ON public.incidents (created_at DESC);
CREATE INDEX IF NOT EXISTS incidents_shift_idx   ON public.incidents (shift_id);
CREATE INDEX IF NOT EXISTS incidents_type_idx    ON public.incidents (type);

GRANT SELECT, INSERT ON public.incidents TO authenticated; -- append-only

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read" ON public.incidents;
CREATE POLICY "Auth read" ON public.incidents
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth insert" ON public.incidents;
CREATE POLICY "Auth insert" ON public.incidents
  FOR INSERT TO authenticated WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────
-- temp_units — the registry of monitored cold/hot units (walk-in, beer cooler,
--   raw bar, hot well, …) with their safe range. REFERENCE data: editable.
--   min_f / max_f  inclusive safe range in °F. A reading outside is out-of-range.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.temp_units (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  name        TEXT NOT NULL,
  min_f       NUMERIC NOT NULL DEFAULT 33,
  max_f       NUMERIC NOT NULL DEFAULT 40,
  active      BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS temp_units_active_idx ON public.temp_units (active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.temp_units TO authenticated; -- registry: full CRUD

ALTER TABLE public.temp_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read" ON public.temp_units;
CREATE POLICY "Auth read" ON public.temp_units
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth insert" ON public.temp_units;
CREATE POLICY "Auth insert" ON public.temp_units
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Auth update" ON public.temp_units;
CREATE POLICY "Auth update" ON public.temp_units
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth delete" ON public.temp_units;
CREATE POLICY "Auth delete" ON public.temp_units
  FOR DELETE TO authenticated USING (true);


-- ─────────────────────────────────────────────────────────────
-- temperature_logs — a single timestamped reading for a unit.
--   unit_id    logical ref to temp_units.id (no hard FK — units may be soft-removed)
--   value_f    the reading in °F
--   in_range   computed by the app at log time vs the unit's min/max (audit snapshot
--              of compliance AT THE MOMENT logged — kept even if the range later changes)
-- IMMUTABLE: no UPDATE/DELETE grant — a reading is a record of a measurement.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.temperature_logs (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  unit_id     INTEGER,
  value_f     NUMERIC NOT NULL,
  in_range    BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS temperature_logs_created_idx ON public.temperature_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS temperature_logs_unit_idx    ON public.temperature_logs (unit_id);

GRANT SELECT, INSERT ON public.temperature_logs TO authenticated; -- append-only

ALTER TABLE public.temperature_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read" ON public.temperature_logs;
CREATE POLICY "Auth read" ON public.temperature_logs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth insert" ON public.temperature_logs;
CREATE POLICY "Auth insert" ON public.temperature_logs
  FOR INSERT TO authenticated WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────
-- credentials — the license / cert / permit tracker (liquor license, food-handler,
--   TIPS/ServSafe, health permit, fire inspection, COI, …) with expiry chips.
--   type        'liquor' | 'food_handler' | 'serving' | 'health' | 'fire' | 'insurance' | 'other'
--   holder      who/what it belongs to (the venue, or a staff member's name)
--   expires_on  the date it lapses → drives 90/60/30/7-day expiry chips in the UI
-- REGISTRY data: editable (a renewed license gets a new expires_on).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.credentials (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'other',
  holder      TEXT,
  expires_on  DATE
);

CREATE INDEX IF NOT EXISTS credentials_expires_idx ON public.credentials (expires_on);
CREATE INDEX IF NOT EXISTS credentials_type_idx    ON public.credentials (type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.credentials TO authenticated; -- registry: full CRUD

ALTER TABLE public.credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read" ON public.credentials;
CREATE POLICY "Auth read" ON public.credentials
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth insert" ON public.credentials;
CREATE POLICY "Auth insert" ON public.credentials
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Auth update" ON public.credentials;
CREATE POLICY "Auth update" ON public.credentials
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth delete" ON public.credentials;
CREATE POLICY "Auth delete" ON public.credentials
  FOR DELETE TO authenticated USING (true);


-- ─────────────────────────────────────────────────────────────
-- push_subscriptions — Web Push (VAPID) endpoints for the manager PWA.
-- One row per browser/device that has granted notification permission. The
-- web-push edge function reads these to send. Each subscription is keyed by its
-- unique `endpoint`; keys/p256dh/auth come from the PushSubscription JSON.
--   endpoint    the push service URL (UNIQUE — re-subscribing upserts)
--   p256dh      client public key (base64url)
--   auth        client auth secret (base64url)
--   user_email  who subscribed (audit / targeting)
--   user_agent  device hint for the UI
-- Subscriptions ARE deletable: a browser can revoke / a stale endpoint must be
-- prunable when the push service returns 404/410.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  user_email  TEXT,
  user_agent  TEXT
);

CREATE INDEX IF NOT EXISTS push_subscriptions_email_idx ON public.push_subscriptions (user_email);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read" ON public.push_subscriptions;
CREATE POLICY "Auth read" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth insert" ON public.push_subscriptions;
CREATE POLICY "Auth insert" ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Auth update" ON public.push_subscriptions;
CREATE POLICY "Auth update" ON public.push_subscriptions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth delete" ON public.push_subscriptions;
CREATE POLICY "Auth delete" ON public.push_subscriptions
  FOR DELETE TO authenticated USING (true);


-- ─────────────────────────────────────────────────────────────
-- Seed a couple of common temp units so the Temperature Wall isn't empty on day 1.
-- Idempotent: only inserts when the table is still empty.
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.temp_units (name, min_f, max_f)
SELECT * FROM (VALUES
  ('Walk-in Cooler', 33, 40),
  ('Beer Cooler',    33, 40),
  ('Raw Bar / Seafood', 30, 38),
  ('Reach-in Freezer', -10, 10)
) AS seed(name, min_f, max_f)
WHERE NOT EXISTS (SELECT 1 FROM public.temp_units);
