-- ============================================================
-- Iggy's — LABOR / SCHEDULING suite
-- Tables: staff, staff_availability, time_off_requests, shifts, tip_pools
--
-- The labor spine for the manager app's /schedule board:
--   * staff               — the roster (name, role, hourly wage, certs, active)
--   * staff_availability   — recurring weekly availability windows per person
--   * time_off_requests    — date-range PTO requests (pending/approved/denied)
--   * shifts               — the schedule grid (one row = one assigned shift),
--                            draft until `published` is flipped
--   * tip_pools            — a saved tip-pool run for a date (total + method +
--                            computed per-staff allocations snapshot in JSONB)
--
-- Times are stored as integer minutes-from-midnight (start_min/end_min), matching
-- the existing parties/events convention (see add-calendar-time-fields.sql). weekday
-- is 0=Sunday … 6=Saturday to match JS Date.getDay().
--
-- Money: staff.wage is a plain numeric (dollars/hour). tip_pools.total_cents is an
-- INTEGER in cents to stay lossless, mirroring the close-out / cash tables.
--
-- shifts.staff_id / staff_availability.staff_id / time_off_requests.staff_id are
-- REAL foreign keys to staff(id) with ON DELETE CASCADE — these tables are
-- meaningless without their staff row, so a roster delete cleans up after itself.
--
-- Run in: Supabase Dashboard > SQL Editor (test on a branch first).
-- CREATE-only & idempotent (re-runnable). Follows new-table-template.sql:
-- post-Oct-2026 Supabase no longer auto-exposes new public tables, so the
-- explicit GRANTs below are REQUIRED or supabase-js can't see the table.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- staff — the roster.
--   name    display name
--   email   contact / login email (optional; nullable)
--   role    job role, e.g. 'bartender' | 'server' | 'barback' | 'manager' | 'kitchen'
--   wage    hourly wage in dollars (numeric, e.g. 18.50)
--   certs   jsonb array of certifications, e.g. ["OLCC","Food Handler"]
--   active  soft-delete / off-roster flag
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.staff (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  name        TEXT NOT NULL,
  email       TEXT,
  role        TEXT NOT NULL DEFAULT 'bartender',
  wage        NUMERIC NOT NULL DEFAULT 0,
  certs       JSONB NOT NULL DEFAULT '[]'::jsonb,
  active      BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS staff_active_idx ON public.staff (active);

-- ─────────────────────────────────────────────────────────────
-- staff_availability — recurring weekly availability windows.
--   weekday    0=Sunday … 6=Saturday (JS Date.getDay())
--   start_min  window start, minutes from midnight (e.g. 17:00 -> 1020)
--   end_min    window end,   minutes from midnight
-- One staffer can have multiple windows per weekday (split shifts).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.staff_availability (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  staff_id    BIGINT NOT NULL REFERENCES public.staff (id) ON DELETE CASCADE,
  weekday     INT NOT NULL,                 -- 0..6
  start_min   INT NOT NULL DEFAULT 0,
  end_min     INT NOT NULL DEFAULT 1440
);

CREATE INDEX IF NOT EXISTS staff_availability_staff_idx ON public.staff_availability (staff_id);
CREATE INDEX IF NOT EXISTS staff_availability_weekday_idx ON public.staff_availability (weekday);

-- ─────────────────────────────────────────────────────────────
-- time_off_requests — date-range PTO requests.
--   date_from / date_to  inclusive DATE range
--   status               'pending' | 'approved' | 'denied'
--   reason               optional free-form note
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.time_off_requests (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  staff_id    BIGINT NOT NULL REFERENCES public.staff (id) ON DELETE CASCADE,
  date_from   DATE NOT NULL,
  date_to     DATE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'denied'
  reason      TEXT
);

CREATE INDEX IF NOT EXISTS time_off_requests_staff_idx  ON public.time_off_requests (staff_id);
CREATE INDEX IF NOT EXISTS time_off_requests_status_idx ON public.time_off_requests (status);
CREATE INDEX IF NOT EXISTS time_off_requests_range_idx  ON public.time_off_requests (date_from, date_to);

-- ─────────────────────────────────────────────────────────────
-- shifts — the schedule grid. One row = one assigned shift.
--   date       calendar date (DATE)
--   start_min  shift start, minutes from midnight
--   end_min    shift end,   minutes from midnight
--   role       role worked on this shift (defaults from staff.role, overridable)
--   published  draft (false) vs published/visible to staff (true)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shifts (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  staff_id    BIGINT NOT NULL REFERENCES public.staff (id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  start_min   INT NOT NULL DEFAULT 1020,   -- 17:00 default open
  end_min     INT NOT NULL DEFAULT 1440,   -- 24:00 default close
  role        TEXT,
  published   BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS shifts_staff_idx     ON public.shifts (staff_id);
CREATE INDEX IF NOT EXISTS shifts_date_idx       ON public.shifts (date);
CREATE INDEX IF NOT EXISTS shifts_published_idx  ON public.shifts (published);

-- ─────────────────────────────────────────────────────────────
-- tip_pools — a saved tip-pool run for a date.
--   total_cents  pooled tips for the date, in cents (lossless integer)
--   method       'hours' (hours-weighted) | 'even' (equal split) | 'points'
--   allocations  jsonb snapshot of the computed split at save time, e.g.
--                [{ "staff_id": 3, "name": "Sam", "hours": 6.5,
--                   "share_cents": 4210 }]
-- One row per pool run (a date can have more than one, e.g. AM/PM).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tip_pools (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  date        DATE NOT NULL,
  total_cents INT NOT NULL DEFAULT 0,
  method      TEXT NOT NULL DEFAULT 'hours',  -- 'hours' | 'even' | 'points'
  allocations JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS tip_pools_date_idx ON public.tip_pools (date);

-- ============================================================
-- GRANTS (required — without these the tables are invisible to the Data API)
-- All labor tables are manager-only: NO anon grant (the public site never
-- reads staff/scheduling/tips). The service-role bypasses RLS.
-- Identity PKs need no sequence grant.
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_availability TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_off_requests  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shifts             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tip_pools          TO authenticated;

-- ============================================================
-- Row Level Security + policies — manager-only for ALL operations.
-- (Postgres has no CREATE POLICY IF NOT EXISTS, so drop-then-create to stay
-- idempotent / re-runnable without errors.)
-- ============================================================

-- ---- staff ----
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read"   ON public.staff;
CREATE POLICY "Auth read"   ON public.staff FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert" ON public.staff;
CREATE POLICY "Auth insert" ON public.staff FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update" ON public.staff;
CREATE POLICY "Auth update" ON public.staff FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Auth delete" ON public.staff;
CREATE POLICY "Auth delete" ON public.staff FOR DELETE TO authenticated USING (true);

-- ---- staff_availability ----
ALTER TABLE public.staff_availability ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read"   ON public.staff_availability;
CREATE POLICY "Auth read"   ON public.staff_availability FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert" ON public.staff_availability;
CREATE POLICY "Auth insert" ON public.staff_availability FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update" ON public.staff_availability;
CREATE POLICY "Auth update" ON public.staff_availability FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Auth delete" ON public.staff_availability;
CREATE POLICY "Auth delete" ON public.staff_availability FOR DELETE TO authenticated USING (true);

-- ---- time_off_requests ----
ALTER TABLE public.time_off_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read"   ON public.time_off_requests;
CREATE POLICY "Auth read"   ON public.time_off_requests FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert" ON public.time_off_requests;
CREATE POLICY "Auth insert" ON public.time_off_requests FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update" ON public.time_off_requests;
CREATE POLICY "Auth update" ON public.time_off_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Auth delete" ON public.time_off_requests;
CREATE POLICY "Auth delete" ON public.time_off_requests FOR DELETE TO authenticated USING (true);

-- ---- shifts ----
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read"   ON public.shifts;
CREATE POLICY "Auth read"   ON public.shifts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert" ON public.shifts;
CREATE POLICY "Auth insert" ON public.shifts FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update" ON public.shifts;
CREATE POLICY "Auth update" ON public.shifts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Auth delete" ON public.shifts;
CREATE POLICY "Auth delete" ON public.shifts FOR DELETE TO authenticated USING (true);

-- ---- tip_pools ----
ALTER TABLE public.tip_pools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read"   ON public.tip_pools;
CREATE POLICY "Auth read"   ON public.tip_pools FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert" ON public.tip_pools;
CREATE POLICY "Auth insert" ON public.tip_pools FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update" ON public.tip_pools;
CREATE POLICY "Auth update" ON public.tip_pools FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Auth delete" ON public.tip_pools;
CREATE POLICY "Auth delete" ON public.tip_pools FOR DELETE TO authenticated USING (true);

-- ---- Realtime — the schedule board updates live as shifts are edited/published ----
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.staff;             EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_availability; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.time_off_requests;  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.shifts;             EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tip_pools;          EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
