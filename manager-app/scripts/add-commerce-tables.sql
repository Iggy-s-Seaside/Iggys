-- ============================================================
-- Iggy's — COMMERCE / STRIPE CHECKOUT RAIL
-- Tables: merch_products, customer_orders, order_items,
--         gift_cards, gift_card_transactions
--         + payment columns on `parties` (deposits)
--
-- Backs three owner asks through one Stripe Checkout rail:
--   • merch storefront      → customer_orders / order_items
--   • private-party deposits → parties.payment_* columns
--   • gift cards            → gift_cards / gift_card_transactions
--
-- Run in: Supabase Dashboard > SQL Editor (test on a branch first).
-- CREATE-only & idempotent (re-runnable). Follows new-table-template.sql:
-- post-Oct-2026 Supabase no longer auto-exposes new public tables, so the
-- explicit GRANTs below are REQUIRED or supabase-js can't see the table.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- merch_products — catalog the website storefront sells.
-- Price is the TRUSTED source: the create-checkout function looks prices
-- up here by id and never trusts a client-sent amount.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.merch_products (
  id          TEXT PRIMARY KEY,                       -- stable slug ("iggys-tee"); matches MerchProduct.id (string)
  created_at  TIMESTAMPTZ DEFAULT now(),
  name        TEXT NOT NULL,
  description TEXT,
  price       NUMERIC(10,2) NOT NULL DEFAULT 0,       -- USD; multiply by 100 for Stripe unit_amount
  image       TEXT,                                   -- product image URL
  sizes       TEXT[] DEFAULT '{}',                    -- optional size options ("S","M","L")
  sku         TEXT,
  inventory   INT,                                    -- null = unlimited / not tracked
  active      BOOLEAN NOT NULL DEFAULT true,
  sort_order  INT DEFAULT 0
);

-- ─────────────────────────────────────────────────────────────
-- customer_orders — one row per completed Stripe Checkout for merch.
-- Written by the stripe-webhook function (service role) on
-- checkout.session.completed. Idempotent on stripe_event_id.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customer_orders (
  id                  SERIAL PRIMARY KEY,
  created_at          TIMESTAMPTZ DEFAULT now(),
  stripe_session_id   TEXT UNIQUE,                    -- Checkout Session id
  stripe_event_id     TEXT UNIQUE,                    -- webhook event id → idempotency key
  payment_intent_id   TEXT,                           -- for refunds
  customer_email      TEXT,
  customer_name       TEXT,
  amount_total        NUMERIC(10,2) NOT NULL DEFAULT 0, -- grand total in USD (from Stripe, authoritative)
  currency            TEXT NOT NULL DEFAULT 'usd',
  status              TEXT NOT NULL DEFAULT 'paid',   -- paid | refunded | partially_refunded
  amount_refunded     NUMERIC(10,2) NOT NULL DEFAULT 0,
  shipping            JSONB,                          -- Stripe shipping_details snapshot
  metadata            JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS customer_orders_email_idx ON public.customer_orders (lower(customer_email));
CREATE INDEX IF NOT EXISTS customer_orders_created_idx ON public.customer_orders (created_at DESC);
CREATE INDEX IF NOT EXISTS customer_orders_intent_idx ON public.customer_orders (payment_intent_id);

-- ─────────────────────────────────────────────────────────────
-- order_items — line items for a customer_order (price snapshots).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_items (
  id          SERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT now(),
  order_id    INT NOT NULL REFERENCES public.customer_orders(id) ON DELETE CASCADE,
  product_id  TEXT REFERENCES public.merch_products(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,                          -- snapshot of product name at purchase
  size        TEXT,
  quantity    INT NOT NULL DEFAULT 1,
  unit_price  NUMERIC(10,2) NOT NULL DEFAULT 0        -- snapshot (trusted DB price), USD
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON public.order_items (order_id);

-- ─────────────────────────────────────────────────────────────
-- gift_cards — a sold gift card, activated on payment.
-- code is generated at checkout time and emailed; balance decremented
-- via gift_card_transactions.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gift_cards (
  id                  SERIAL PRIMARY KEY,
  created_at          TIMESTAMPTZ DEFAULT now(),
  code                TEXT NOT NULL UNIQUE,           -- redemption code (printed/emailed)
  initial_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  balance             NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency            TEXT NOT NULL DEFAULT 'usd',
  status              TEXT NOT NULL DEFAULT 'pending', -- pending | active | redeemed | void
  purchaser_email     TEXT,
  recipient_email     TEXT,
  recipient_name      TEXT,
  message             TEXT,
  stripe_session_id   TEXT UNIQUE,
  payment_intent_id   TEXT,
  activated_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS gift_cards_code_idx ON public.gift_cards (upper(code));
CREATE INDEX IF NOT EXISTS gift_cards_status_idx ON public.gift_cards (status);

-- ─────────────────────────────────────────────────────────────
-- gift_card_transactions — ledger of activations/redemptions.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gift_card_transactions (
  id              SERIAL PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now(),
  gift_card_id    INT NOT NULL REFERENCES public.gift_cards(id) ON DELETE CASCADE,
  type            TEXT NOT NULL DEFAULT 'redeem',     -- activate | redeem | adjust | refund
  amount          NUMERIC(10,2) NOT NULL DEFAULT 0,   -- positive adds, negative spends
  balance_after   NUMERIC(10,2) NOT NULL DEFAULT 0,
  note            TEXT,
  performed_by    TEXT                                -- manager email when redeemed in-app
);
CREATE INDEX IF NOT EXISTS gift_card_tx_card_idx ON public.gift_card_transactions (gift_card_id);

-- ─────────────────────────────────────────────────────────────
-- parties — payment columns for private-party DEPOSITS.
-- Added in-place so the existing parties pipeline gains payment tracking.
-- deposit_amount is the TRUSTED deposit the create-checkout function reads.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.parties ADD COLUMN IF NOT EXISTS deposit_amount    NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.parties ADD COLUMN IF NOT EXISTS amount_paid       NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.parties ADD COLUMN IF NOT EXISTS balance_due       NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.parties ADD COLUMN IF NOT EXISTS payment_status    TEXT DEFAULT 'unpaid'; -- unpaid | deposit_paid | paid | refunded
ALTER TABLE public.parties ADD COLUMN IF NOT EXISTS paid_at           TIMESTAMPTZ;
ALTER TABLE public.parties ADD COLUMN IF NOT EXISTS deposit_due_date  DATE;
ALTER TABLE public.parties ADD COLUMN IF NOT EXISTS payment_intent_id TEXT;

-- ─────────────────────────────────────────────────────────────
-- GRANTS (required — without these the tables are invisible to the Data API)
-- Customer site (anon) reads the merch catalog only. Everything order/
-- payment/gift-card is manager-only (authenticated); the website never
-- reads or writes orders — the service-role webhook does that.
-- ─────────────────────────────────────────────────────────────
GRANT SELECT                         ON public.merch_products          TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merch_products          TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_orders         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gift_cards              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gift_card_transactions  TO authenticated;

-- SERIAL primary keys need sequence usage for authenticated inserts.
GRANT USAGE, SELECT ON SEQUENCE public.customer_orders_id_seq        TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.order_items_id_seq            TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.gift_cards_id_seq             TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.gift_card_transactions_id_seq TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- Row Level Security + policies
-- (Postgres has no CREATE POLICY IF NOT EXISTS → drop-then-create for idempotency.)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.merch_products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_cards             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_card_transactions ENABLE ROW LEVEL SECURITY;

-- merch_products: public read (active catalog), manager full CRUD.
DROP POLICY IF EXISTS "Public read" ON public.merch_products;
CREATE POLICY "Public read" ON public.merch_products
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth insert" ON public.merch_products;
CREATE POLICY "Auth insert" ON public.merch_products
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update" ON public.merch_products;
CREATE POLICY "Auth update" ON public.merch_products
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Auth delete" ON public.merch_products;
CREATE POLICY "Auth delete" ON public.merch_products
  FOR DELETE TO authenticated USING (true);

-- orders / gift cards: manager-only for ALL operations (no public read).
-- The Stripe webhook writes these with the SERVICE ROLE, which bypasses RLS,
-- so no anon/public policy is needed for inserts from the rail.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['customer_orders','order_items','gift_cards','gift_card_transactions']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Auth read" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Auth insert" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Auth update" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Auth delete" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Auth read" ON public.%I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "Auth insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY "Auth update" ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY "Auth delete" ON public.%I FOR DELETE TO authenticated USING (true)', t);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────
-- Realtime — orders + gift cards drive live manager UI updates.
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['customer_orders','gift_cards']
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN
      NULL; -- already in the publication
    END;
  END LOOP;
END $$;
