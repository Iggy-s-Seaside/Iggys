-- ============================================================
-- Iggy's — RESERVATIONS + virtual WAITLIST
-- Tables: sections, floor_tables, reservations, waitlist_entries
--
-- Powers the "tonight" host board (/reservations): a reservations
-- timeline laid over a small floor plan, plus a live virtual waitlist
-- (add → notify → seat → cancel) with a wait-quote.
--
--   sections          a named area of the room (e.g. "Patio", "Bar")
--   floor_tables      a physical table inside a section (seats = capacity)
--   reservations      a booked party for a specific time, optionally
--                     assigned to a floor_table
--   waitlist_entries  a walk-in party waiting for a table; "Notify" texts
--                     the guest via the gated send-sms function (which
--                     writes an sms_log row). The waitlist is "virtual":
--                     no buzzers, the guest's phone is the pager.
--
-- Run in: Supabase Dashboard > SQL Editor (test on a branch first).
-- CREATE-only & idempotent (re-runnable). Follows new-table-template.sql:
-- post-Oct-2026 Supabase no longer auto-exposes new public tables, so the
-- explicit GRANTs below are REQUIRED or supabase-js can't see the table.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- sections — a named area of the floor.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sections (
  id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name  TEXT NOT NULL
);

-- ─────────────────────────────────────────────────────────────
-- floor_tables — a physical table within a section.
--   section_id  the area this table sits in (nullable: unassigned)
--   name        label shown on the board (e.g. "T1", "Booth 4")
--   seats       capacity used to match party size to a table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.floor_tables (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  section_id  BIGINT REFERENCES public.sections (id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  seats       INT  NOT NULL DEFAULT 2
);

CREATE INDEX IF NOT EXISTS floor_tables_section_idx ON public.floor_tables (section_id);

-- ─────────────────────────────────────────────────────────────
-- reservations — a booked party for a specific time.
--   reserved_for   when the party is due (drives the timeline)
--   status         'booked' | 'confirmed' | 'seated' | 'completed'
--                  | 'cancelled' | 'no_show'
--   table_id       assigned floor_table (nullable until seated)
--   deposit_status 'none' | 'requested' | 'paid' (held parties)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reservations (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  guest_name      TEXT NOT NULL,
  phone           TEXT,
  party_size      INT  NOT NULL DEFAULT 2,
  reserved_for    TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'booked',
  table_id        BIGINT REFERENCES public.floor_tables (id) ON DELETE SET NULL,
  notes           TEXT,
  deposit_status  TEXT NOT NULL DEFAULT 'none'
);

CREATE INDEX IF NOT EXISTS reservations_reserved_for_idx ON public.reservations (reserved_for);
CREATE INDEX IF NOT EXISTS reservations_status_idx       ON public.reservations (status);

-- ─────────────────────────────────────────────────────────────
-- waitlist_entries — a walk-in party waiting for a table.
--   status          'waiting' | 'notified' | 'seated' | 'cancelled'
--   quoted_minutes  the wait quote given to the guest at add time
--   notified_at     stamped when "Notify" fires the send-sms text
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.waitlist_entries (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  guest_name      TEXT NOT NULL,
  phone           TEXT,
  party_size      INT  NOT NULL DEFAULT 2,
  status          TEXT NOT NULL DEFAULT 'waiting',  -- 'waiting' | 'notified' | 'seated' | 'cancelled'
  quoted_minutes  INT,
  notified_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS waitlist_entries_status_idx     ON public.waitlist_entries (status);
CREATE INDEX IF NOT EXISTS waitlist_entries_created_at_idx ON public.waitlist_entries (created_at);

-- ---- GRANTS (required — without these the tables are invisible to the Data API) ----
-- Host board is manager-only; nothing here is read by the public website.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sections          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.floor_tables      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservations      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waitlist_entries  TO authenticated;
-- Identity PKs need no sequence grant; the service-role bypasses RLS.

-- ---- Row Level Security + policies (manager-only for all operations) ----
ALTER TABLE public.sections         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.floor_tables     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;

-- sections
DROP POLICY IF EXISTS "Auth read"   ON public.sections;
CREATE POLICY "Auth read"   ON public.sections FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert" ON public.sections;
CREATE POLICY "Auth insert" ON public.sections FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update" ON public.sections;
CREATE POLICY "Auth update" ON public.sections FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Auth delete" ON public.sections;
CREATE POLICY "Auth delete" ON public.sections FOR DELETE TO authenticated USING (true);

-- floor_tables
DROP POLICY IF EXISTS "Auth read"   ON public.floor_tables;
CREATE POLICY "Auth read"   ON public.floor_tables FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert" ON public.floor_tables;
CREATE POLICY "Auth insert" ON public.floor_tables FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update" ON public.floor_tables;
CREATE POLICY "Auth update" ON public.floor_tables FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Auth delete" ON public.floor_tables;
CREATE POLICY "Auth delete" ON public.floor_tables FOR DELETE TO authenticated USING (true);

-- reservations
DROP POLICY IF EXISTS "Auth read"   ON public.reservations;
CREATE POLICY "Auth read"   ON public.reservations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert" ON public.reservations;
CREATE POLICY "Auth insert" ON public.reservations FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update" ON public.reservations;
CREATE POLICY "Auth update" ON public.reservations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Auth delete" ON public.reservations;
CREATE POLICY "Auth delete" ON public.reservations FOR DELETE TO authenticated USING (true);

-- waitlist_entries
DROP POLICY IF EXISTS "Auth read"   ON public.waitlist_entries;
CREATE POLICY "Auth read"   ON public.waitlist_entries FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert" ON public.waitlist_entries;
CREATE POLICY "Auth insert" ON public.waitlist_entries FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update" ON public.waitlist_entries;
CREATE POLICY "Auth update" ON public.waitlist_entries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Auth delete" ON public.waitlist_entries;
CREATE POLICY "Auth delete" ON public.waitlist_entries FOR DELETE TO authenticated USING (true);

-- ---- Realtime — the board updates live as the host works the floor ----
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.waitlist_entries;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.floor_tables;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.sections;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ---- Seed: a couple of sections + a few tables (idempotent) ----
-- Only seeds when the tables are empty, so re-running never duplicates.
INSERT INTO public.sections (name)
SELECT v.name
FROM (VALUES ('Main Floor'), ('Patio'), ('Bar')) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM public.sections);

INSERT INTO public.floor_tables (section_id, name, seats)
SELECT s.id, t.name, t.seats
FROM (
  VALUES
    ('Main Floor', 'T1', 4),
    ('Main Floor', 'T2', 4),
    ('Main Floor', 'T3', 6),
    ('Patio',      'P1', 2),
    ('Patio',      'P2', 4),
    ('Bar',        'B1', 2),
    ('Bar',        'B2', 2)
) AS t(section_name, name, seats)
JOIN public.sections s ON s.name = t.section_name
WHERE NOT EXISTS (SELECT 1 FROM public.floor_tables);
