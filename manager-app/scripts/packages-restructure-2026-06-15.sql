-- Packages restructure per Carn (2026-06-15): drop curated menus → room tier +
-- à la carte food priced off the regular DINNER menu. Manager sees the detail;
-- customers see only two summary food options (Appetizers / Full Dinners).
-- Applied to prod via Supabase migration `packages_add_public_visible` + the data below.

-- Manager/public split: detailed à la carte food is manager-only; the public
-- booking estimator (usePublicPackages) filters on public_visible = true.
ALTER TABLE packages ADD COLUMN IF NOT EXISTS public_visible boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN packages.public_visible IS
  'Show on the public booking estimator. Detailed à la carte food is manager-only (false); customers see summary options (Appetizers / Full Dinners).';

-- Room: $300/hr single rate (Carn raises/lowers as he likes; no Saturday line — weekend-dependent).
UPDATE packages SET price = 300, unit = 'per_hour' WHERE name = 'Upstairs Room Rental';

-- Retire the curated-menu approach.
UPDATE packages SET active = false
  WHERE name IN ('Appetizers on Arrival', 'Order-As-You-Go Service', 'Limited Printed Menu');

-- Manager-only à la carte dinner food (public_visible = false). Prices off the
-- regular DINNER menu (not lunch). Prawns: app rate 5 = $21 ($4.20 ea) × 100.
-- Halibut bites: 25× 2oz cut into 4 (~50 oz) — market price, confirm with Carn.
INSERT INTO packages (name, description, category, price, unit, active, public_visible, sort_order) VALUES
  ('Chicken Linguini Alfredo', 'Dinner pasta (menu dinner price). Per plate.',                          'food',  27, 'per_person', true, false, 50),
  ('Plain Linguini Alfredo',   'Dinner pasta (menu dinner price). Per plate.',                          'food',  21, 'per_person', true, false, 51),
  ('Prawns (per 100)',         'Sauteed / Cajun prawns, 100 per order. App rate: 5 = $21 ($4.20 ea).',  'food', 420, 'flat',       true, false, 52),
  ('Pot of Chowder',           'Full pot of clam chowder.',                                             'food', 150, 'flat',       true, false, 53),
  ('Halibut Bites',            '25x 2oz halibut, each cut into 4 (~100 bites, 50 oz). Market price.',   'food',   0, 'flat',       true, false, 54),
  ('Event Salad',              'Salad - negotiable / quote per event.',                                 'food',   0, 'flat',       true, false, 55);

-- The ONLY two food options the customer sees (public_visible = true).
INSERT INTO packages (name, description, public_description, category, price, unit, active, public_visible, sort_order) VALUES
  ('Appetizers',   'Public summary option - app spread, manager quotes the detail.',
     'Passed & table appetizers off our menu - we''ll tailor a spread and quote it for your group.', 'food', 0, 'flat', true, true, 20),
  ('Full Dinners', 'Public summary option - full dinner, manager quotes the detail.',
     'A full dinner from our regular menu - plated or family-style, priced per head for your party.', 'food', 0, 'flat', true, true, 21);
