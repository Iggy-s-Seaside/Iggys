-- ============================================================
-- add-party-timeline.sql — add the run-of-show timeline to parties
-- Run in: Supabase Dashboard > SQL Editor (or via the Supabase MCP apply_migration).
-- Idempotent: safe to re-run (ADD COLUMN IF NOT EXISTS).
-- ============================================================
--
-- RUN-OF-SHOW SHAPE
-- -----------------
-- run_of_show is a JSONB array of ordered timeline rows the team works off
-- on the day of the event (5:00 setup, 6:00 doors, 7:00 toast, …):
--
--   [
--     { "time": "5:00 PM", "label": "Setup — tables + bar" },
--     { "time": "6:00 PM", "label": "Doors open" },
--     { "time": "7:00 PM", "label": "Toast" }
--   ]
--
-- Each row is { time: text, label: text }. Stored as JSONB (not a free-text
-- column) so the BEO / day-of view can render and re-order rows structurally
-- without a separate table. NULL = no timeline set yet.
-- ============================================================

ALTER TABLE parties ADD COLUMN IF NOT EXISTS run_of_show JSONB;

COMMENT ON COLUMN parties.run_of_show IS
  'Run-of-show timeline for the BEO / day-of view: JSONB array of [{ time text, label text }] rows in event order.';
