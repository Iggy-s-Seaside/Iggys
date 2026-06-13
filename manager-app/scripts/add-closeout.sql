-- ============================================================
-- Iggy's — CLOSE-OUT (cash reconciliation + End-of-Night report)
-- Tables: cash_counts, eon_reports
--
-- The /shift/close screen is the second great owner-demo: at the end of a
-- shift the manager counts the till (denomination grid -> over/short) and
-- taps one button to compose + email the owner the whole night's report.
--
-- SHIFT SPINE: both tables carry a NULLABLE INTEGER shift_id that LOGICALLY
-- references shift_sessions.id (NO hard FK — kept soft so this migration runs
-- independently of the rest of the shift wave). A reading still works standalone
-- when no shift is open (shift_id stays NULL).
--
-- APPEND-ONLY IN SPIRIT: these are compliance/log rows. created_at is a
-- server default; nothing here mutates a prior count. eon_reports.emailed_at
-- is the one field patched after the fact (when the owner email goes out).
--
-- Run in: Supabase Dashboard > SQL Editor (test on a branch first).
-- CREATE-only & idempotent (re-runnable). Follows new-table-template.sql:
-- post-Oct-2026 Supabase no longer auto-exposes new public tables, so the
-- explicit GRANTs below are REQUIRED or supabase-js can't see the table.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- cash_counts — one till count at close (or any point in a shift).
--   shift_id          logical shift_sessions.id this count belongs to (nullable)
--   counted_by        manager email who counted the drawer (audit trail)
--   expected_cents    what the system/float says SHOULD be in the till
--   counted_cents     what the manager actually counted (sum of the grid)
--   over_short_cents  counted - expected: positive = over, negative = short
--   denominations     { "10000": 3, "2000": 5, ... } cents-per-bill/coin -> count
--   note              free-text ("pulled $200 to safe", "rolled coin", ...)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cash_counts (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  shift_id          INTEGER,                              -- logical -> shift_sessions.id (no hard FK)
  counted_by        TEXT,
  expected_cents    INTEGER NOT NULL DEFAULT 0,
  counted_cents     INTEGER NOT NULL DEFAULT 0,
  over_short_cents  INTEGER NOT NULL DEFAULT 0,           -- counted - expected
  denominations     JSONB DEFAULT '{}'::jsonb,            -- { cents_denom: count }
  note              TEXT
);

CREATE INDEX IF NOT EXISTS cash_counts_shift_idx   ON public.cash_counts (shift_id);
CREATE INDEX IF NOT EXISTS cash_counts_created_idx ON public.cash_counts (created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- eon_reports — one composed End-of-Night report per close.
--   shift_id          logical shift_sessions.id this report covers (nullable)
--   generated_by      manager email who generated it (audit trail)
--   summary           the plain-text report body (server-composed, emailed)
--   metrics           structured snapshot { events, checklist, lineChecks,
--                       logHighlights, lowStock, cash } so it can be re-rendered
--   emailed_at        set when the owner email actually went out (patched later)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.eon_reports (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  shift_id      INTEGER,                                  -- logical -> shift_sessions.id (no hard FK)
  generated_by  TEXT,
  summary       TEXT NOT NULL DEFAULT '',
  metrics       JSONB DEFAULT '{}'::jsonb,
  emailed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS eon_reports_shift_idx   ON public.eon_reports (shift_id);
CREATE INDEX IF NOT EXISTS eon_reports_created_idx ON public.eon_reports (created_at DESC);

-- ---- GRANTS (required — without these the tables are invisible to the Data API) ----
-- Manager-only: the public site never reads close-out data, so no anon grant.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_counts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eon_reports TO authenticated;
-- Identity PKs need no sequence grant; the generate-eon service role bypasses RLS.

-- ---- Row Level Security + policies ----
-- Manager-only for ALL operations (no public read). The generate-eon function
-- writes/patches eon_reports with the SERVICE ROLE, which bypasses RLS.
ALTER TABLE public.cash_counts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read" ON public.cash_counts;
CREATE POLICY "Auth read" ON public.cash_counts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth insert" ON public.cash_counts;
CREATE POLICY "Auth insert" ON public.cash_counts
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Auth update" ON public.cash_counts;
CREATE POLICY "Auth update" ON public.cash_counts
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth delete" ON public.cash_counts;
CREATE POLICY "Auth delete" ON public.cash_counts
  FOR DELETE TO authenticated USING (true);

ALTER TABLE public.eon_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read" ON public.eon_reports;
CREATE POLICY "Auth read" ON public.eon_reports
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth insert" ON public.eon_reports;
CREATE POLICY "Auth insert" ON public.eon_reports
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Auth update" ON public.eon_reports;
CREATE POLICY "Auth update" ON public.eon_reports
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth delete" ON public.eon_reports;
CREATE POLICY "Auth delete" ON public.eon_reports
  FOR DELETE TO authenticated USING (true);
