-- ============================================================
-- Iggy's — SPECIALS AUTO-EXPIRE (scheduling window)
-- Run in: Supabase Dashboard > SQL Editor (test on a Supabase branch first)
--
-- WHY THIS EXISTS:
-- A special should only show publicly inside its window. These two
-- nullable columns add an optional start/end bound on top of the
-- existing `active` flag:
--   starts_at  — special is hidden publicly BEFORE this instant.
--                NULL = no lower bound (live as soon as `active`).
--   expires_at — special is hidden publicly AT/AFTER this instant.
--                NULL = no upper bound (never auto-expires).
-- Both NULL  => behaves exactly like today (purely `active`-driven).
-- The window is advisory metadata only; `active` is still the master
-- on/off switch. Public visibility = active AND now within window.
-- The filtering happens in app code (utils/specialsWindow.ts:isSpecialLive),
-- NOT in a DB policy, so the manager keeps seeing scheduled/expired rows.
--
-- `specials` is an EXISTING table, so no new GRANTs/RLS are needed here
-- (the Oct-2026 auto-exposure rule only applies to newly created tables).
-- This migration is idempotent — safe to re-run.
-- ============================================================

alter table public.specials
  add column if not exists starts_at  timestamptz,
  add column if not exists expires_at timestamptz;

comment on column public.specials.starts_at is
  'Optional start of the public visibility window (timestamptz). NULL = no lower bound. Special is hidden publicly before this instant; combined with `active` and `expires_at`.';

comment on column public.specials.expires_at is
  'Optional end of the public visibility window (timestamptz). NULL = no upper bound (never auto-expires). Special is hidden publicly at/after this instant; combined with `active` and `starts_at`.';
