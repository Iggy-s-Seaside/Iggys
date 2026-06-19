-- ============================================================
-- Iggy's — COGS / INVENTORY DEPTH (vendors, catalog, purchase orders,
--   recipes, recipe ingredients, price history)
--
-- WHAT THIS POWERS (/cogs screen):
--   - Pour / recipe costing (cost per drink, pour-cost %) from recipes +
--     recipe_ingredients joined to inventory_items.cost_per_unit.
--   - Menu Profitability matrix (Stars / Dogs) = existing menu price vs
--     recipe cost.
--   - A draft Purchase-Order builder: below-par inventory_items grouped by
--     vendor (via vendor_catalog), turned into a purchase_orders draft and
--     emailed to the vendor through the gated send-purchase-order function.
--   - A COGS% summary trend (price_history feeds the cost sparkline/bars).
--
-- LINKAGE: every *_item_id is a NULLABLE INTEGER that LOGICALLY references
-- public.inventory_items.id — kept SOFT (no hard FK) so this migration runs
-- independently and a recipe/PO line survives if an item is later removed.
-- vendor_id / po_id / recipe_id DO use hard FKs WITHIN this migration's own
-- tables (they all ship together here), with ON DELETE CASCADE for child rows.
--
-- price_history is APPEND-ONLY IN SPIRIT: a log of observed unit costs over
-- time (one row per observation). Nothing here mutates a prior observation.
--
-- Run in: Supabase Dashboard > SQL Editor (test on a branch first).
-- CREATE-only & idempotent (re-runnable). Follows new-table-template.sql:
-- post-Oct-2026 Supabase no longer auto-exposes new public tables, so the
-- explicit GRANTs below are REQUIRED or supabase-js can't see the table.
-- These are MANAGER-ONLY tables: the public website never reads COGS data,
-- so there is NO anon grant.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- vendors — the suppliers we order from (distinct from the free-text
--   inventory_items.supplier string; this is the structured CRM-for-vendors).
--   name   display name ("Columbia Distributing")
--   email  where a purchase order is emailed (gated send-purchase-order)
--   phone  rep / ordering line
--   rep    named sales rep, free text
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendors (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  name        TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  rep         TEXT,
  notes       TEXT,
  active      BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS vendors_name_idx ON public.vendors (name);

-- ─────────────────────────────────────────────────────────────
-- vendor_catalog — what a vendor sells us, and at what pack/case cost.
--   This is how a below-par inventory_item is mapped to "who do we buy it
--   from + how much does a case cost". One item may have multiple vendors.
--   vendor_id   hard FK -> vendors.id (cascades when a vendor is deleted)
--   item_id     logical -> inventory_items.id (nullable, no hard FK)
--   pack_size   how many base units in one ordering pack/case (e.g. 24)
--   case_cost   $ per pack/case from this vendor (drives PO unit_cost math)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_catalog (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  vendor_id   BIGINT NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  item_id     INTEGER,                               -- logical -> inventory_items.id (no hard FK)
  sku         TEXT,
  pack_size   NUMERIC NOT NULL DEFAULT 1,
  case_cost   NUMERIC NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS vendor_catalog_vendor_idx ON public.vendor_catalog (vendor_id);
CREATE INDEX IF NOT EXISTS vendor_catalog_item_idx   ON public.vendor_catalog (item_id);

-- ─────────────────────────────────────────────────────────────
-- purchase_orders — one draft / sent reorder to a single vendor.
--   status   'draft' (being built) -> 'sent' (emailed) -> 'received'/'cancelled'
--   total    cached sum of its purchase_order_items (qty * unit_cost)
--   sent_at  stamped by send-purchase-order when the email actually goes out
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  vendor_id   BIGINT REFERENCES public.vendors(id) ON DELETE SET NULL,
  status      TEXT NOT NULL DEFAULT 'draft',         -- draft | sent | received | cancelled
  total       NUMERIC NOT NULL DEFAULT 0,
  notes       TEXT,
  created_by  TEXT,
  sent_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS purchase_orders_vendor_idx  ON public.purchase_orders (vendor_id);
CREATE INDEX IF NOT EXISTS purchase_orders_status_idx  ON public.purchase_orders (status);
CREATE INDEX IF NOT EXISTS purchase_orders_created_idx ON public.purchase_orders (created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- purchase_order_items — line items on a purchase order.
--   po_id      hard FK -> purchase_orders.id (cascades with the PO)
--   item_id    logical -> inventory_items.id (nullable, no hard FK)
--   name       snapshot of the item name at draft time (survives renames)
--   qty        number of packs/cases ordered
--   unit_cost  $ per pack/case at draft time (snapshot of vendor case_cost)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  po_id       BIGINT NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  item_id     INTEGER,                               -- logical -> inventory_items.id (no hard FK)
  name        TEXT NOT NULL DEFAULT '',
  unit        TEXT,
  qty         NUMERIC NOT NULL DEFAULT 0,
  unit_cost   NUMERIC NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS purchase_order_items_po_idx   ON public.purchase_order_items (po_id);
CREATE INDEX IF NOT EXISTS purchase_order_items_item_idx ON public.purchase_order_items (item_id);

-- ─────────────────────────────────────────────────────────────
-- recipes — a costed drink / dish spec.
--   name      pour / recipe name ("Margarita", "Iggy Burger")
--   menu_ref  free-text pointer back to a menu row, formatted "table#id"
--             (e.g. "cocktails#7", "menu_items#42"). Soft on purpose: the menu
--             lives across several tables and prices are stored as text, so we
--             match by name/ref in the app rather than a hard FK.
--   menu_price  the listed price we sell it at, snapshotted as NUMERIC so the
--               profitability matrix has a clean number even though the menu
--               stores price as text. Editable in the /cogs UI.
--   yield     how many servings/pours one batch of this recipe makes (>=1)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.recipes (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  name        TEXT NOT NULL,
  menu_ref    TEXT,                                  -- "cocktails#7" etc. (soft link)
  menu_price  NUMERIC,                               -- listed sell price (snapshot)
  category    TEXT,                                  -- 'drink' | 'food' (matrix grouping)
  yield       NUMERIC NOT NULL DEFAULT 1,            -- servings per batch
  active      BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS recipes_name_idx ON public.recipes (name);

-- ─────────────────────────────────────────────────────────────
-- recipe_ingredients — the lines of a recipe.
--   recipe_id  hard FK -> recipes.id (cascades with the recipe)
--   item_id    logical -> inventory_items.id (nullable, no hard FK). The
--              ingredient cost is read live from inventory_items.cost_per_unit
--              in the app, so pour cost tracks the latest known unit cost.
--   qty        how much of the item one batch uses
--   unit       the unit the qty is measured in ("oz", "each", "lb")
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.recipe_ingredients (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  recipe_id   BIGINT NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  item_id     INTEGER,                               -- logical -> inventory_items.id (no hard FK)
  name        TEXT,                                  -- free-text fallback when no item match
  qty         NUMERIC NOT NULL DEFAULT 0,
  unit        TEXT
);

CREATE INDEX IF NOT EXISTS recipe_ingredients_recipe_idx ON public.recipe_ingredients (recipe_id);
CREATE INDEX IF NOT EXISTS recipe_ingredients_item_idx   ON public.recipe_ingredients (item_id);

-- ─────────────────────────────────────────────────────────────
-- price_history — APPEND-ONLY observed unit cost over time, per item.
--   One row each time a cost is observed (manual edit, PO receipt, scan).
--   Feeds the COGS% trend sparkline/bar chart on /cogs.
--   item_id        logical -> inventory_items.id (nullable, no hard FK)
--   cost_per_unit  the observed cost per base unit at observed_at
--   observed_at    when the cost was observed (defaults to now)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.price_history (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  item_id       INTEGER,                             -- logical -> inventory_items.id (no hard FK)
  cost_per_unit NUMERIC NOT NULL DEFAULT 0,
  source        TEXT,                                -- 'manual' | 'po' | 'scan'
  observed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS price_history_item_idx     ON public.price_history (item_id);
CREATE INDEX IF NOT EXISTS price_history_observed_idx ON public.price_history (observed_at DESC);

-- ════════════════════════════════════════════════════════════
-- GRANTS (required — without these the tables are invisible to the Data API)
-- Manager-only: the public site never reads COGS data, so NO anon grant.
-- The send-purchase-order function uses the SERVICE ROLE, which bypasses RLS.
-- ════════════════════════════════════════════════════════════
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_catalog       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipes              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipe_ingredients   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_history        TO authenticated;
-- Identity PKs need no sequence grant.

-- ════════════════════════════════════════════════════════════
-- Row Level Security + policies (manager-only for ALL operations).
-- Postgres has no CREATE POLICY IF NOT EXISTS, so drop-then-create to stay
-- idempotent. price_history is append-only in spirit — but we still grant
-- UPDATE/DELETE to authenticated managers for correction of a mistaken entry,
-- matching how the other log tables (cash_counts, eon_reports) are handled.
-- ════════════════════════════════════════════════════════════

-- ── vendors ──
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read"   ON public.vendors;
CREATE POLICY "Auth read"   ON public.vendors FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert" ON public.vendors;
CREATE POLICY "Auth insert" ON public.vendors FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update" ON public.vendors;
CREATE POLICY "Auth update" ON public.vendors FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Auth delete" ON public.vendors;
CREATE POLICY "Auth delete" ON public.vendors FOR DELETE TO authenticated USING (true);

-- ── vendor_catalog ──
ALTER TABLE public.vendor_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read"   ON public.vendor_catalog;
CREATE POLICY "Auth read"   ON public.vendor_catalog FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert" ON public.vendor_catalog;
CREATE POLICY "Auth insert" ON public.vendor_catalog FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update" ON public.vendor_catalog;
CREATE POLICY "Auth update" ON public.vendor_catalog FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Auth delete" ON public.vendor_catalog;
CREATE POLICY "Auth delete" ON public.vendor_catalog FOR DELETE TO authenticated USING (true);

-- ── purchase_orders ──
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read"   ON public.purchase_orders;
CREATE POLICY "Auth read"   ON public.purchase_orders FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert" ON public.purchase_orders;
CREATE POLICY "Auth insert" ON public.purchase_orders FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update" ON public.purchase_orders;
CREATE POLICY "Auth update" ON public.purchase_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Auth delete" ON public.purchase_orders;
CREATE POLICY "Auth delete" ON public.purchase_orders FOR DELETE TO authenticated USING (true);

-- ── purchase_order_items ──
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read"   ON public.purchase_order_items;
CREATE POLICY "Auth read"   ON public.purchase_order_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert" ON public.purchase_order_items;
CREATE POLICY "Auth insert" ON public.purchase_order_items FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update" ON public.purchase_order_items;
CREATE POLICY "Auth update" ON public.purchase_order_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Auth delete" ON public.purchase_order_items;
CREATE POLICY "Auth delete" ON public.purchase_order_items FOR DELETE TO authenticated USING (true);

-- ── recipes ──
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read"   ON public.recipes;
CREATE POLICY "Auth read"   ON public.recipes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert" ON public.recipes;
CREATE POLICY "Auth insert" ON public.recipes FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update" ON public.recipes;
CREATE POLICY "Auth update" ON public.recipes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Auth delete" ON public.recipes;
CREATE POLICY "Auth delete" ON public.recipes FOR DELETE TO authenticated USING (true);

-- ── recipe_ingredients ──
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read"   ON public.recipe_ingredients;
CREATE POLICY "Auth read"   ON public.recipe_ingredients FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert" ON public.recipe_ingredients;
CREATE POLICY "Auth insert" ON public.recipe_ingredients FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update" ON public.recipe_ingredients;
CREATE POLICY "Auth update" ON public.recipe_ingredients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Auth delete" ON public.recipe_ingredients;
CREATE POLICY "Auth delete" ON public.recipe_ingredients FOR DELETE TO authenticated USING (true);

-- ── price_history (append-only in spirit) ──
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read"   ON public.price_history;
CREATE POLICY "Auth read"   ON public.price_history FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert" ON public.price_history;
CREATE POLICY "Auth insert" ON public.price_history FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update" ON public.price_history;
CREATE POLICY "Auth update" ON public.price_history FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Auth delete" ON public.price_history;
CREATE POLICY "Auth delete" ON public.price_history FOR DELETE TO authenticated USING (true);
