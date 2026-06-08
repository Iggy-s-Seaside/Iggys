-- ============================================================
-- Add calendar time fields to parties + events
-- Run in: Supabase Dashboard > SQL Editor (or via Supabase MCP apply_migration)
-- Idempotent: safe to run multiple times (ADD COLUMN IF NOT EXISTS).
-- ============================================================
--
-- TIME SEMANTICS
-- --------------
-- start_min / end_min are integers representing MINUTES-FROM-MIDNIGHT
-- of the event's local day. Examples:
--   0      = 12:00 AM (midnight)
--   330    = 5:30 AM
--   1020   = 5:00 PM
--   1439   = 11:59 PM
--
-- AFTER-MIDNIGHT EVENTS
-- ---------------------
-- An event that runs past midnight is encoded with end_min > 1440.
-- The end time is still measured from the SAME midnight as start_min,
-- so it can legitimately exceed a single day (1440 min).
--   start_min = 1320 (10:00 PM), end_min = 1560 (2:00 AM next day)
-- To render: hours = floor(end_min / 60) % 24, mins = end_min % 60.
-- This keeps a single event_date while still expressing a late close.
--
-- ALL-DAY EVENTS
-- --------------
-- When all_day = true, start_min / end_min are ignored by the UI and
-- the event is treated as spanning the entire event_date (no clock time).
-- start_min / end_min may be left NULL for all-day events.
--
-- These INT columns sit alongside the existing human-readable start_time /
-- end_time TEXT fields (e.g. "5:30 PM"); the TEXT fields remain the display
-- source while the INT fields enable sorting, overlap checks, and the
-- calendar grid layout.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- parties
-- ─────────────────────────────────────────────────────────────
ALTER TABLE parties ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS start_min INT;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS end_min INT;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS all_day BOOLEAN NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────────────────────
-- events
-- ─────────────────────────────────────────────────────────────
ALTER TABLE events ADD COLUMN IF NOT EXISTS start_min INT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_min INT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS all_day BOOLEAN NOT NULL DEFAULT false;
