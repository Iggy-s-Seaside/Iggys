-- ============================================================
-- Iggy's — SHIFT SESSIONS spine
-- Table: shift_sessions
--
-- A shift_sessions row represents ONE open->close bar shift. It is the
-- spine every other shift reading hangs off: line checks, the shift log,
-- and the cash / end-of-night close each carry a nullable integer
-- shift_id (a LOGICAL reference to shift_sessions.id — intentionally NOT a
-- hard FK, so those migrations stay independently runnable).
--
-- Lifecycle: a manager "opens the bar" (status='open', opened_by stamped
-- from their auth email) and later "closes the bar" (status='closed',
-- closed_at + closed_by stamped). At most one open shift at a time, by
-- convention — the app/useShift hook picks the latest open row.
--
-- Run in: Supabase Dashboard > SQL Editor (test on a branch first).
-- CREATE-only & idempotent (re-runnable). Follows new-table-template.sql:
-- post-Oct-2026 Supabase no longer auto-exposes new public tables, so the
-- explicit GRANTs below are REQUIRED or supabase-js can't see the table.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- shift_sessions — one open->close bar shift.
--   opened_at   server-stamped open time (the shift "started" clock)
--   opened_by   manager email who opened the bar (audit trail)
--   closed_at   server-stamped close time (null while open)
--   closed_by   manager email who closed the bar (null while open)
--   status      'open' | 'closed'
--   notes       free-form shift notes (handoff, anything notable)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shift_sessions (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  opened_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  opened_by   TEXT,
  closed_at   TIMESTAMPTZ,
  closed_by   TEXT,
  status      TEXT NOT NULL DEFAULT 'open',   -- 'open' | 'closed'
  notes       TEXT
);

CREATE INDEX IF NOT EXISTS shift_sessions_status_idx    ON public.shift_sessions (status);
CREATE INDEX IF NOT EXISTS shift_sessions_opened_at_idx ON public.shift_sessions (opened_at DESC);

-- ---- GRANTS (required — without these the table is invisible to the Data API) ----
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_sessions TO authenticated; -- manager: open/close/edit shifts
-- No anon grant: shift state is manager-only (never read by the public site).
-- Identity PK needs no sequence grant; the service-role bypasses RLS.

-- ---- Row Level Security + policies ----
-- Manager-only for ALL operations (no public read).
ALTER TABLE public.shift_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read" ON public.shift_sessions;
CREATE POLICY "Auth read" ON public.shift_sessions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth insert" ON public.shift_sessions;
CREATE POLICY "Auth insert" ON public.shift_sessions
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Auth update" ON public.shift_sessions;
CREATE POLICY "Auth update" ON public.shift_sessions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth delete" ON public.shift_sessions;
CREATE POLICY "Auth delete" ON public.shift_sessions
  FOR DELETE TO authenticated USING (true);

-- ---- Realtime — the open/closed state drives live manager UI updates ----
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_sessions;
  EXCEPTION WHEN duplicate_object THEN
    NULL; -- already in the publication
  END;
END $$;
