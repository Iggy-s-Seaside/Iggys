-- add-business-day.sql
-- Add a nullable business_day key to shift_sessions so today's checklists are
-- driven by the SERVICE day (9am Pacific cutoff) rather than status=open. The
-- app stamps business_day on open (todaysBusinessDay()); the service session is
-- then resolved as the most recent row WHERE business_day = today's business
-- day. Nullable so existing/legacy rows are untouched. Idempotent.

ALTER TABLE public.shift_sessions
  ADD COLUMN IF NOT EXISTS business_day date;

-- Speeds up the "most recent session for today's business day" lookup.
CREATE INDEX IF NOT EXISTS shift_sessions_business_day_idx
  ON public.shift_sessions (business_day);

COMMENT ON COLUMN public.shift_sessions.business_day IS
  'Service day (YYYY-MM-DD), 9am Pacific cutoff. Stamped on open; drives today''s checklists/line-checks/log resolution. See src/utils/businessDay.ts.';
