-- ============================================================
-- Iggy's Manager Dashboard — Supabase RLS Setup
-- Run this in: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Create events table (if not exists)
CREATE TABLE IF NOT EXISTS events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  title text NOT NULL,
  description text NOT NULL,
  date date NOT NULL,
  time text NOT NULL,
  image_url text,
  is_recurring boolean DEFAULT false,
  recurring_day text,
  category text,
  active boolean DEFAULT true
);

-- 2. Create specials table (if not exists)
CREATE TABLE IF NOT EXISTS specials (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  title text NOT NULL,
  description text NOT NULL,
  type text NOT NULL,
  price text,
  image_url text,
  active boolean DEFAULT true
);

-- 3. Add category column to events if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'category'
  ) THEN
    ALTER TABLE events ADD COLUMN category text;
  END IF;
END $$;

-- 4. Enable RLS on all tables
ALTER TABLE appetizers ENABLE ROW LEVEL SECURITY;
ALTER TABLE on_tap ENABLE ROW LEVEL SECURITY;
ALTER TABLE off_tap ENABLE ROW LEVEL SECURITY;
ALTER TABLE cocktails ENABLE ROW LEVEL SECURITY;
ALTER TABLE shots ENABLE ROW LEVEL SECURITY;
ALTER TABLE happy_hour ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE specials ENABLE ROW LEVEL SECURITY;

-- 5. Public read access (so the customer website still works)
CREATE POLICY IF NOT EXISTS "Public read" ON appetizers FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Public read" ON on_tap FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Public read" ON off_tap FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Public read" ON cocktails FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Public read" ON shots FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Public read" ON happy_hour FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Public read" ON events FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Public read" ON specials FOR SELECT USING (true);

-- 6. Authenticated users can INSERT
CREATE POLICY IF NOT EXISTS "Auth insert" ON appetizers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Auth insert" ON on_tap FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Auth insert" ON off_tap FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Auth insert" ON cocktails FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Auth insert" ON shots FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Auth insert" ON happy_hour FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Auth insert" ON events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Auth insert" ON specials FOR INSERT TO authenticated WITH CHECK (true);

-- 7. Authenticated users can UPDATE
CREATE POLICY IF NOT EXISTS "Auth update" ON appetizers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Auth update" ON on_tap FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Auth update" ON off_tap FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Auth update" ON cocktails FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Auth update" ON shots FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Auth update" ON happy_hour FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Auth update" ON events FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Auth update" ON specials FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 8. Authenticated users can DELETE
CREATE POLICY IF NOT EXISTS "Auth delete" ON appetizers FOR DELETE TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "Auth delete" ON on_tap FOR DELETE TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "Auth delete" ON off_tap FOR DELETE TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "Auth delete" ON cocktails FOR DELETE TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "Auth delete" ON shots FOR DELETE TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "Auth delete" ON happy_hour FOR DELETE TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "Auth delete" ON events FOR DELETE TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "Auth delete" ON specials FOR DELETE TO authenticated USING (true);

-- 9. Storage: allow authenticated users to upload images
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY IF NOT EXISTS "Auth upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'images');

CREATE POLICY IF NOT EXISTS "Auth update storage" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'images');

CREATE POLICY IF NOT EXISTS "Auth delete storage" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'images');

CREATE POLICY IF NOT EXISTS "Public read storage" ON storage.objects
  FOR SELECT USING (bucket_id = 'images');
