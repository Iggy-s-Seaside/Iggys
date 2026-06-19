-- ============================================================
-- Iggy's — SHIFT LOG / MOD JOURNAL  (Luna's eyes on the floor)
-- Table: shift_log
--
-- The tagged, searchable record of what happened on a shift: 86'd items,
-- incidents, VIPs, maintenance, and free-form notes. Each entry can be
-- attributed to a shift via a NULLABLE shift_id (a LOGICAL reference to
-- shift_sessions.id — intentionally NOT a hard FK so this migration stays
-- independently runnable from the rest of the shift-spine wave).
--
-- Append-only in spirit: rows are created on the floor and (at most) marked
-- resolved. created_at is a server default so the timeline can't be faked.
--
-- Run in: Supabase Dashboard > SQL Editor (test on a branch first).
-- CREATE-only & idempotent (re-runnable). Follows new-table-template.sql:
-- post-Oct-2026 Supabase no longer auto-exposes new public tables, so the
-- explicit GRANTs below are REQUIRED or supabase-js can't see the table.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- shift_log — one journal entry on a shift.
--   shift_id    nullable LOGICAL ref to shift_sessions.id (no hard FK)
--   author      manager email who wrote it (audit trail)
--   tag         '86' | 'incident' | 'vip' | 'maintenance' | 'note'
--   body        the entry text
--   item_ref    free-text name of the menu item / thing referenced (e.g. an 86)
--   photo_url   optional photo (broken tap, incident, etc.)
--   resolved    has this been handled? (incidents/maintenance close out)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shift_log (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  shift_id    INTEGER,                                   -- logical ref to shift_sessions.id (no FK)
  author      TEXT,
  tag         TEXT NOT NULL DEFAULT 'note',              -- '86'|'incident'|'vip'|'maintenance'|'note'
  body        TEXT NOT NULL DEFAULT '',
  item_ref    TEXT,
  photo_url   TEXT,
  resolved    BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS shift_log_created_idx  ON public.shift_log (created_at DESC);
CREATE INDEX IF NOT EXISTS shift_log_shift_idx    ON public.shift_log (shift_id);
CREATE INDEX IF NOT EXISTS shift_log_tag_idx      ON public.shift_log (tag);

-- ---- GRANTS (required — without these the table is invisible to the Data API) ----
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_log TO authenticated; -- manager dashboard: full CRUD
-- No anon grant: the floor journal is manager-only (never read by the public site).
-- Identity PK needs no sequence grant.

-- ---- Row Level Security + policies ----
ALTER TABLE public.shift_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read" ON public.shift_log;
CREATE POLICY "Auth read" ON public.shift_log
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth insert" ON public.shift_log;
CREATE POLICY "Auth insert" ON public.shift_log
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Auth update" ON public.shift_log;
CREATE POLICY "Auth update" ON public.shift_log
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth delete" ON public.shift_log;
CREATE POLICY "Auth delete" ON public.shift_log
  FOR DELETE TO authenticated USING (true);

-- ---- Realtime — the journal drives the live floor feed across devices ----
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_log;
  EXCEPTION WHEN duplicate_object THEN
    NULL; -- already in the publication
  END;
END $$;

-- ============================================================
-- 86 FLAG on the public menu.
-- When a manager 86's an item, we both write a '86' shift_log entry AND
-- flip menu_items.is_86d=true so the PUBLIC menu can hide / grey it out.
-- "Un-86" clears the flag. Idempotent add — safe to re-run.
-- (The public site is NOT edited here; it should later filter is_86d items.)
-- ============================================================
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS is_86d BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS menu_items_is_86d_idx ON public.menu_items (is_86d);
