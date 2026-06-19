-- ============================================================
-- Iggy's — MERCH PER-VARIANT STOCK
-- Tables: merch_variants, merch_inventory_logs
--
-- merch_products.inventory is ONE integer for a whole product — it cannot
-- represent "Classic Tee size L: 4 left, size M: 0". This adds a per-variant
-- stock table so the manager app can count merch by size/label.
--
--   apparel → STYLE is the merch_products row, SIZE is the variant
--             (variant_type='size', size='L', variant_label=null)
--   hats    → product with variant_label rows and size null
--             (variant_type='style', size=null, variant_label='Black')
--
-- MANAGER-APP ONLY this wave. Does NOT touch merch_products prices, the public
-- store, create-checkout or stripe-webhook. The public/commerce loop that reads
-- variant stock is a separate later decision.
--
-- Run in: Supabase Dashboard > SQL Editor (test on a branch first).
-- CREATE-only & idempotent (re-runnable). Follows new-table-template.sql:
-- post-Oct-2026 Supabase no longer auto-exposes new public tables, so the
-- explicit GRANTs below are REQUIRED or supabase-js can't see the table.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- merch_variants — one row per countable SKU of a merch product.
-- stock is the manager-counted on-hand for THIS size/label.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.merch_variants (
  id            BIGSERIAL PRIMARY KEY,
  product_id    TEXT NOT NULL REFERENCES public.merch_products(id) ON DELETE CASCADE,
  variant_type  TEXT NOT NULL DEFAULT 'size',   -- 'size' (apparel) | 'style' (hats/colorways)
  size          TEXT,                            -- 'S','M','L','XL','XXL' for apparel; null for hats
  variant_label TEXT,                            -- free label for hats/colorways; null for apparel
  sku           TEXT UNIQUE,
  stock         INT NOT NULL DEFAULT 0,          -- manager-counted on-hand for this variant
  par_level     INT NOT NULL DEFAULT 0,          -- low-stock threshold (stock <= par_level highlights)
  cost          NUMERIC(10,2),                   -- optional per-unit cost
  image         TEXT,                            -- optional per-variant image (e.g. colorway photo)
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  -- A product can have each (size, label) once. COALESCE keeps the constraint
  -- meaningful when one of the two is null (apparel uses size, hats use label).
  UNIQUE (product_id, size, variant_label)
);
CREATE INDEX IF NOT EXISTS merch_variants_product_idx ON public.merch_variants (product_id);
CREATE INDEX IF NOT EXISTS merch_variants_active_idx  ON public.merch_variants (active);

-- ─────────────────────────────────────────────────────────────
-- merch_inventory_logs — audit trail of every variant stock change.
-- reason: 'count' | 'manual' | 'scan_intake' | 'wizard_create'
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.merch_inventory_logs (
  id             BIGSERIAL PRIMARY KEY,
  variant_id     BIGINT REFERENCES public.merch_variants(id) ON DELETE CASCADE,
  user_email     TEXT,
  previous_stock INT,
  new_stock      INT,
  change_amount  INT,
  reason         TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS merch_inventory_logs_variant_idx ON public.merch_inventory_logs (variant_id);
CREATE INDEX IF NOT EXISTS merch_inventory_logs_created_idx ON public.merch_inventory_logs (created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- GRANTS (required — without these the tables are invisible to the Data API).
-- Manager app is authenticated; no anon access (public store is off this wave).
-- ─────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merch_variants        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merch_inventory_logs  TO authenticated;

-- BIGSERIAL primary keys need sequence usage for authenticated inserts.
GRANT USAGE, SELECT ON SEQUENCE public.merch_variants_id_seq        TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.merch_inventory_logs_id_seq  TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- Row Level Security — authenticated full access (matches the inventory_logs /
-- merch_products manager convention). Drop-then-create for idempotency.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.merch_variants        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merch_inventory_logs  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read variants"   ON public.merch_variants;
CREATE POLICY "Auth read variants"   ON public.merch_variants
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert variants" ON public.merch_variants;
CREATE POLICY "Auth insert variants" ON public.merch_variants
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update variants" ON public.merch_variants;
CREATE POLICY "Auth update variants" ON public.merch_variants
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Auth delete variants" ON public.merch_variants;
CREATE POLICY "Auth delete variants" ON public.merch_variants
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth read merch logs"   ON public.merch_inventory_logs;
CREATE POLICY "Auth read merch logs"   ON public.merch_inventory_logs
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert merch logs" ON public.merch_inventory_logs;
CREATE POLICY "Auth insert merch logs" ON public.merch_inventory_logs
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update merch logs" ON public.merch_inventory_logs;
CREATE POLICY "Auth update merch logs" ON public.merch_inventory_logs
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Auth delete merch logs" ON public.merch_inventory_logs;
CREATE POLICY "Auth delete merch logs" ON public.merch_inventory_logs
  FOR DELETE TO authenticated USING (true);
