-- ============================================================
-- Bring the LIVE Supabase schema up to date for the calendar + spaces feature.
-- Idempotent (ADD COLUMN IF NOT EXISTS) — safe to run multiple times.
-- Run in: Supabase Dashboard > SQL Editor.
--
-- As of 2026-06-07 the live DB had ONLY the `space` columns applied; the
-- time/visibility columns below were never applied to prod. This brings
-- parties + events fully in sync with the app + edge functions.
--
-- TIME: start_min/end_min are minutes-from-midnight; after-midnight uses
--       end_min > 1440 (1:00 AM = 1500). all_day = whole-day block.
-- SPACE: 'upstairs' | 'downstairs' | 'whole'  (NULL is treated as 'whole').
-- is_private=false on a party = coexisting "general" request (never blocks).
-- ============================================================

-- ── parties ──────────────────────────────────────────────
ALTER TABLE parties ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS start_min  INT;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS end_min    INT;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS all_day    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS space      TEXT;   -- already applied; harmless to re-run

-- ── events ───────────────────────────────────────────────
ALTER TABLE events  ADD COLUMN IF NOT EXISTS start_min  INT;
ALTER TABLE events  ADD COLUMN IF NOT EXISTS end_min    INT;
ALTER TABLE events  ADD COLUMN IF NOT EXISTS all_day    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE events  ADD COLUMN IF NOT EXISTS space      TEXT;   -- already applied; harmless to re-run
ALTER TABLE events  ADD COLUMN IF NOT EXISTS category   TEXT;

-- Sanity check (optional): list the new columns
-- SELECT table_name, column_name FROM information_schema.columns
-- WHERE table_schema='public' AND table_name IN ('parties','events')
--   AND column_name IN ('is_private','start_min','end_min','all_day','space','category')
-- ORDER BY table_name, column_name;
