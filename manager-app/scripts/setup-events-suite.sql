-- Private Events Suite for Iggy's Manager App
-- Tables: contacts, parties, packages, party_packages, todos, message_templates
-- Internal manager data → RLS is authenticated-only for ALL operations (no public read).
-- Run in Supabase SQL Editor (or applied via the Supabase MCP `apply_migration`).

-- ─────────────────────────────────────────────────────────────
-- contacts — reusable email list / lightweight CRM
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  tags TEXT[] DEFAULT '{}',
  marketing_opt_in BOOLEAN DEFAULT true,
  notes TEXT,
  last_event_date DATE
);
CREATE INDEX IF NOT EXISTS contacts_email_idx ON contacts (lower(email));

-- ─────────────────────────────────────────────────────────────
-- parties — the private-party pipeline + invoice fields
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parties (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'inquiry',          -- inquiry | confirmed | cancelled
  contact_id INT REFERENCES contacts(id) ON DELETE SET NULL,
  -- denormalized contact for quick display
  contact_name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  company TEXT,
  -- event
  title TEXT,                                       -- calendar event title
  event_date DATE,
  start_time TEXT,                                  -- "5:30 PM" (matches events.time style)
  end_time TEXT,
  setup_time TEXT,
  guest_count INT,
  space_name TEXT,
  -- details (drive the recap email)
  food_service_type TEXT,
  food_notes TEXT,
  drink_notes TEXT,
  special_requests TEXT,
  internal_notes TEXT,
  -- follow-up
  follow_up_notes TEXT,
  last_contacted_at TIMESTAMPTZ,
  follow_up_date DATE,
  -- invoice
  room_rate NUMERIC(10,2) DEFAULT 200,
  room_hours NUMERIC(10,2) DEFAULT 0,
  food_total NUMERIC(10,2) DEFAULT 0,
  drink_total NUMERIC(10,2) DEFAULT 0,
  gratuity_rate NUMERIC(5,4) DEFAULT 0.18,
  -- lifecycle stamps
  google_calendar_event_id TEXT,
  confirmation_sent_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS parties_status_idx ON parties (status);
CREATE INDEX IF NOT EXISTS parties_event_date_idx ON parties (event_date);

-- ─────────────────────────────────────────────────────────────
-- packages — editable catalog of party offerings
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS packages (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'addon',           -- food | drink | room | addon | other
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'flat',                -- flat | per_person | per_hour
  active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0
);

-- ─────────────────────────────────────────────────────────────
-- party_packages — many-to-many join (with price snapshot)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS party_packages (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  party_id INT NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  package_id INT REFERENCES packages(id) ON DELETE SET NULL,
  -- snapshots so catalog edits never rewrite past selections
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'addon',
  unit TEXT NOT NULL DEFAULT 'flat',
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS party_packages_party_idx ON party_packages (party_id);

-- ─────────────────────────────────────────────────────────────
-- todos — owner ↔ manager shared task board
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS todos (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  title TEXT NOT NULL,
  details TEXT,
  done BOOLEAN DEFAULT false,
  priority TEXT NOT NULL DEFAULT 'normal',          -- low | normal | high
  due_date DATE,
  created_by TEXT,
  completed_at TIMESTAMPTZ
);

-- ─────────────────────────────────────────────────────────────
-- message_templates — prewritten responses (supports {{placeholders}})
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_templates (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',          -- follow_up | confirmation | cancellation | general
  subject TEXT,
  body TEXT NOT NULL
);

-- ─────────────────────────────────────────────────────────────
-- RLS — authenticated-only for everything
-- ─────────────────────────────────────────────────────────────
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['contacts','parties','packages','party_packages','todos','message_templates']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Auth read" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Auth insert" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Auth update" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Auth delete" ON %I', t);
    EXECUTE format('CREATE POLICY "Auth read" ON %I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "Auth insert" ON %I FOR INSERT TO authenticated WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY "Auth update" ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY "Auth delete" ON %I FOR DELETE TO authenticated USING (true)', t);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────
-- Realtime — parties + todos drive live UI updates
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['parties','party_packages','todos']
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    EXCEPTION WHEN duplicate_object THEN
      NULL; -- already in the publication
    END;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────
-- Seed a starter package catalog (skip if already seeded)
-- ─────────────────────────────────────────────────────────────
INSERT INTO packages (name, description, category, price, unit, sort_order)
SELECT * FROM (VALUES
  ('Upstairs Room Rental', 'Private satellite-bar space upstairs', 'room', 200.00, 'per_hour', 1),
  ('Appetizers on Arrival', 'Assorted appetizers set out as guests arrive', 'food', 8.00, 'per_person', 2),
  ('Order-As-You-Go Service', 'Guests order food throughout the evening', 'food', 0.00, 'flat', 3),
  ('Limited Printed Menu', 'Custom printed limited menu for the event', 'addon', 0.00, 'flat', 4),
  ('Beer Keg Cooler (4 taps)', 'IPA, Lager, Hef + rotating tap upstairs', 'drink', 0.00, 'flat', 5),
  ('Wine Service (Red / White / Rosé)', 'House wines available upstairs', 'drink', 0.00, 'flat', 6),
  ('Signature Cocktails (pick 1-2)', 'Pick 1-2 cocktails prepped upstairs', 'drink', 0.00, 'flat', 7),
  ('Non-Alcoholic Package', 'N/A beer & wine, soda, water', 'drink', 0.00, 'flat', 8)
) AS seed(name, description, category, price, unit, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM packages);
