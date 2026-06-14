-- add-waitlist-area.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds an "area" concept to the waitlist (Waitlist-only refactor).
--
-- The family does NOT take table reservations — the host stand runs purely off a
-- walk-up waitlist. Each waiting party belongs to an area of the room so the host
-- can split the board later (bar / patio / main dining). For now everything
-- defaults to 'main-restaurant'; bar/patio can be added without a schema change.
--
-- Idempotent: safe to run repeatedly. No enum change is needed because
-- waitlist_entries.status is free text — the new 'no_show' status just slots in
-- alongside the existing waiting / notified / seated / cancelled values.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.waitlist_entries
  ADD COLUMN IF NOT EXISTS area text NOT NULL DEFAULT 'main-restaurant';

-- Helpful when the board starts filtering by area (bar / patio / main-restaurant).
CREATE INDEX IF NOT EXISTS waitlist_entries_area_idx
  ON public.waitlist_entries (area);
