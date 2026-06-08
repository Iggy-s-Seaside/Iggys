-- ─────────────────────────────────────────────────────────────
-- add-space-fields.sql — add the `space` column to parties + events
-- Idempotent: safe to re-run. Run in Supabase SQL Editor (or via the
-- Supabase MCP `apply_migration`).
--
-- SPACE MODEL — independent spaces:
--   space TEXT IN ('upstairs' | 'downstairs' | 'whole'), nullable.
--   Labels: upstairs → "Upstairs", downstairs → "Downstairs", whole → "Entire building".
--
--   NULL/undefined space === "whole" for conflict purposes (conservative;
--   covers legacy rows that predate this column).
--
--   Two bookings share physical space IFF
--     (a||'whole')==='whole' || (b||'whole')==='whole' || a===b
--   so upstairs vs downstairs = NO conflict, but either vs whole = conflict.
--
--   A request conflicts with an existing booking/event IFF
--     time overlaps AND the two spaces conflict (per the rule above).
-- ─────────────────────────────────────────────────────────────

ALTER TABLE parties ADD COLUMN IF NOT EXISTS space TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS space TEXT;
