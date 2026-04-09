-- Inventory Management Tables for Iggy's Manager App
-- Run in Supabase SQL Editor

CREATE TABLE inventory_categories (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  name TEXT NOT NULL UNIQUE,
  sort_order INT DEFAULT 0
);

INSERT INTO inventory_categories (name, sort_order) VALUES
  ('Liquor', 1), ('Beer', 2), ('Wine', 3),
  ('Mixers', 4), ('Food', 5), ('Supplies', 6);

CREATE TABLE inventory_items (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  name TEXT NOT NULL,
  category_id INT REFERENCES inventory_categories(id) ON DELETE SET NULL,
  current_quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'units',
  par_level NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost_per_unit NUMERIC(10,2),
  supplier TEXT,
  notes TEXT,
  active BOOLEAN DEFAULT true
);

CREATE TABLE inventory_logs (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  item_id INT REFERENCES inventory_items(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  previous_quantity NUMERIC(10,2) NOT NULL,
  new_quantity NUMERIC(10,2) NOT NULL,
  change_amount NUMERIC(10,2) NOT NULL,
  reason TEXT
);

-- RLS
ALTER TABLE inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read categories" ON inventory_categories FOR SELECT USING (true);
CREATE POLICY "Auth manage categories" ON inventory_categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update categories" ON inventory_categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete categories" ON inventory_categories FOR DELETE TO authenticated USING (true);

CREATE POLICY "Public read items" ON inventory_items FOR SELECT USING (true);
CREATE POLICY "Auth manage items" ON inventory_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update items" ON inventory_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete items" ON inventory_items FOR DELETE TO authenticated USING (true);

CREATE POLICY "Public read logs" ON inventory_logs FOR SELECT USING (true);
CREATE POLICY "Auth manage logs" ON inventory_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update logs" ON inventory_logs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete logs" ON inventory_logs FOR DELETE TO authenticated USING (true);
