-- ============================================================================
-- ANTON-migrate-all.sql  —  Iggy's "Anton mode" consolidated migration
-- Every new table/column from build waves 1-4, in dependency order.
-- IDEMPOTENT (IF NOT EXISTS / ON CONFLICT DO NOTHING) — safe to re-run.
-- HOW TO RUN: Supabase Dashboard > SQL Editor (paste + Run), or via MCP/CLI.
-- Additive only; never drops or alters existing data.
-- ============================================================================

-- Owner ask #1: make packages publicly listable (public estimator).
ALTER TABLE packages ADD COLUMN IF NOT EXISTS public_description text;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false;



-- ===== add-specials-window.sql =========================================

-- ============================================================
-- Iggy's — SPECIALS AUTO-EXPIRE (scheduling window)
-- Run in: Supabase Dashboard > SQL Editor (test on a Supabase branch first)
--
-- WHY THIS EXISTS:
-- A special should only show publicly inside its window. These two
-- nullable columns add an optional start/end bound on top of the
-- existing `active` flag:
--   starts_at  — special is hidden publicly BEFORE this instant.
--                NULL = no lower bound (live as soon as `active`).
--   expires_at — special is hidden publicly AT/AFTER this instant.
--                NULL = no upper bound (never auto-expires).
-- Both NULL  => behaves exactly like today (purely `active`-driven).
-- The window is advisory metadata only; `active` is still the master
-- on/off switch. Public visibility = active AND now within window.
-- The filtering happens in app code (utils/specialsWindow.ts:isSpecialLive),
-- NOT in a DB policy, so the manager keeps seeing scheduled/expired rows.
--
-- `specials` is an EXISTING table, so no new GRANTs/RLS are needed here
-- (the Oct-2026 auto-exposure rule only applies to newly created tables).
-- This migration is idempotent — safe to re-run.
-- ============================================================

alter table public.specials
  add column if not exists starts_at  timestamptz,
  add column if not exists expires_at timestamptz;

comment on column public.specials.starts_at is
  'Optional start of the public visibility window (timestamptz). NULL = no lower bound. Special is hidden publicly before this instant; combined with `active` and `expires_at`.';

comment on column public.specials.expires_at is
  'Optional end of the public visibility window (timestamptz). NULL = no upper bound (never auto-expires). Special is hidden publicly at/after this instant; combined with `active` and `starts_at`.';


-- ===== add-commerce-tables.sql =========================================

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


-- ===== add-proposals.sql ===============================================

-- ============================================================
-- Iggy's — ONE-LINK PROPOSAL + E-SIGN + DEPOSIT PORTAL
-- Table: proposals
--
-- Backs the tokenized, NO-LOGIN public proposal page (/p/:token) where a
-- client views their private-event quote, e-signs, and pays the deposit.
--
-- The manager creates a proposals row and shares the public URL. The public
-- site reads the single proposal by its token (anon SELECT). All WRITES that
-- stamp viewed_at / signed_at / signer_name / signer_ip go through the
-- `proposal-sign` edge function (SERVICE ROLE) — anon never writes directly,
-- so a stranger with a token can read their proposal but cannot forge a
-- signature or tamper with status.
--
-- Run in: Supabase Dashboard > SQL Editor (test on a branch first).
-- CREATE-only & idempotent (re-runnable). Follows new-table-template.sql:
-- post-Oct-2026 Supabase no longer auto-exposes new public tables, so the
-- explicit GRANTs below are REQUIRED or supabase-js can't see the table.
-- ============================================================

-- ---- 1. Create the table -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.proposals (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now(),
  token           TEXT NOT NULL UNIQUE,                     -- crypto.randomUUID() — the only public handle
  party_id        BIGINT NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'draft',            -- draft | sent | viewed | signed | deposit_paid
  sent_at         TIMESTAMPTZ,                              -- stamped when the manager shares the link
  viewed_at       TIMESTAMPTZ,                              -- first public view (set by proposal-sign)
  signed_at       TIMESTAMPTZ,                              -- e-signature timestamp (set by proposal-sign)
  signer_name     TEXT,                                     -- typed-name signature (set by proposal-sign)
  signer_ip       TEXT,                                     -- captured at sign time (set by proposal-sign)
  deposit_paid_at TIMESTAMPTZ                               -- stamped by stripe-webhook on deposit payment
);
CREATE INDEX IF NOT EXISTS proposals_token_idx  ON public.proposals (token);
CREATE INDEX IF NOT EXISTS proposals_party_idx  ON public.proposals (party_id);
CREATE INDEX IF NOT EXISTS proposals_status_idx ON public.proposals (status);

-- ---- 2. GRANTS (required — without these the table is invisible) -------
-- anon: read-only (the public proposal page fetches one row by token).
--   No anon INSERT/UPDATE/DELETE — every public write goes through the
--   service-role proposal-sign function, which bypasses RLS.
GRANT SELECT                         ON public.proposals TO anon;          -- public site: read one proposal by token
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposals TO authenticated; -- manager dashboard: full CRUD

-- ---- 3. Row Level Security + policies ----------------------------------
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

-- NOTE: Postgres has no `CREATE POLICY IF NOT EXISTS`, so drop-then-create
-- to stay idempotent (re-runnable without errors).

-- Public (anon) read. The token is an unguessable UUID, so SELECT is open;
-- the row exposes only this proposal's own quote/signature state, nothing else.
DROP POLICY IF EXISTS "Public read by token" ON public.proposals;
CREATE POLICY "Public read by token" ON public.proposals
  FOR SELECT USING (true);

-- Manager (authenticated) full CRUD — creates/sends/lists proposals.
DROP POLICY IF EXISTS "Auth insert" ON public.proposals;
CREATE POLICY "Auth insert" ON public.proposals
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Auth update" ON public.proposals;
CREATE POLICY "Auth update" ON public.proposals
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth delete" ON public.proposals;
CREATE POLICY "Auth delete" ON public.proposals
  FOR DELETE TO authenticated USING (true);

-- NOTE: anon has NO insert/update/delete policy on purpose. Public writes
-- (viewed_at / signed_at / signer_name / signer_ip) are performed by the
-- proposal-sign edge function under the SERVICE ROLE, which bypasses RLS.

-- ---- 4. Realtime — status chips update live on the manager side --------
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.proposals';
  EXCEPTION WHEN duplicate_object THEN
    NULL; -- already in the publication
  END;
END $$;


-- ===== add-party-timeline.sql ==========================================

-- ============================================================
-- add-party-timeline.sql — add the run-of-show timeline to parties
-- Run in: Supabase Dashboard > SQL Editor (or via the Supabase MCP apply_migration).
-- Idempotent: safe to re-run (ADD COLUMN IF NOT EXISTS).
-- ============================================================
--
-- RUN-OF-SHOW SHAPE
-- -----------------
-- run_of_show is a JSONB array of ordered timeline rows the team works off
-- on the day of the event (5:00 setup, 6:00 doors, 7:00 toast, …):
--
--   [
--     { "time": "5:00 PM", "label": "Setup — tables + bar" },
--     { "time": "6:00 PM", "label": "Doors open" },
--     { "time": "7:00 PM", "label": "Toast" }
--   ]
--
-- Each row is { time: text, label: text }. Stored as JSONB (not a free-text
-- column) so the BEO / day-of view can render and re-order rows structurally
-- without a separate table. NULL = no timeline set yet.
-- ============================================================

ALTER TABLE parties ADD COLUMN IF NOT EXISTS run_of_show JSONB;

COMMENT ON COLUMN parties.run_of_show IS
  'Run-of-show timeline for the BEO / day-of view: JSONB array of [{ time text, label text }] rows in event order.';


-- ===== add-social-posts.sql ============================================

-- ============================================================
-- Iggy's — SOCIAL DRAFT-QUEUE (approval-gated)
-- Table: social_posts
--
-- The Specials studio + events feed a QUEUE of posts a human approves.
-- LIVE auto-posting (Instagram/Facebook/Google Business Profile) is a
-- later, token-gated step — see supabase/functions/social-publish.
-- This table is the SAFE layer: drafts → human approval → scheduled,
-- and only once Meta App Review + tokens land does the publisher post.
--
-- Run in: Supabase Dashboard > SQL Editor (test on a branch first).
-- CREATE-only & idempotent (re-runnable). Follows new-table-template.sql:
-- post-Oct-2026 Supabase no longer auto-exposes new public tables, so the
-- explicit GRANTs below are REQUIRED or supabase-js can't see the table.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- social_posts — one queued post (draft → approved → scheduled → posted).
--   source           where this draft came from ('special' | 'event' | 'manual')
--   ref_id           id of the source special/event row (null for manual)
--   image_url        the creative to attach (from the special/event/media)
--   caption          the default caption used for every platform…
--   per_platform_caption  …unless overridden here, keyed by platform
--   target_platforms text[] of 'instagram' | 'facebook' | 'google'
--   scheduled_at     when the publisher should post it (null = post asap once approved)
--   status           draft | scheduled | approved | posted | failed | cancelled
--   external_post_ids  {platform: remote_id} written by the publisher on success
--   error            last failure reason (publisher only)
--   approved_by      manager email who approved it (audit trail)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.social_posts (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at            TIMESTAMPTZ DEFAULT now(),
  source                TEXT NOT NULL DEFAULT 'manual',   -- 'special' | 'event' | 'manual'
  ref_id                BIGINT,                            -- source row id (specials.id / events.id)
  image_url             TEXT,
  caption               TEXT NOT NULL DEFAULT '',
  target_platforms      TEXT[] NOT NULL DEFAULT '{}',      -- 'instagram' | 'facebook' | 'google'
  scheduled_at          TIMESTAMPTZ,
  status                TEXT NOT NULL DEFAULT 'draft',     -- draft|scheduled|approved|posted|failed|cancelled
  per_platform_caption  JSONB DEFAULT '{}'::jsonb,         -- { instagram: "...", facebook: "..." }
  external_post_ids     JSONB DEFAULT '{}'::jsonb,         -- { instagram: "1784...", facebook: "..." } (publisher)
  error                 TEXT,
  approved_by           TEXT
);

CREATE INDEX IF NOT EXISTS social_posts_status_idx    ON public.social_posts (status);
CREATE INDEX IF NOT EXISTS social_posts_scheduled_idx ON public.social_posts (scheduled_at);
CREATE INDEX IF NOT EXISTS social_posts_created_idx   ON public.social_posts (created_at DESC);

-- ---- GRANTS (required — without these the table is invisible to the Data API) ----
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_posts TO authenticated; -- manager dashboard: full CRUD
-- No anon grant: the draft queue is manager-only (never read by the public site).
-- Identity PK needs no sequence grant; the service-role publisher bypasses RLS.

-- ---- Row Level Security + policies ----
-- Manager-only for ALL operations (no public read). The social-publish function
-- writes status/external_post_ids/error with the SERVICE ROLE, which bypasses RLS.
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read" ON public.social_posts;
CREATE POLICY "Auth read" ON public.social_posts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth insert" ON public.social_posts;
CREATE POLICY "Auth insert" ON public.social_posts
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Auth update" ON public.social_posts;
CREATE POLICY "Auth update" ON public.social_posts
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth delete" ON public.social_posts;
CREATE POLICY "Auth delete" ON public.social_posts
  FOR DELETE TO authenticated USING (true);

-- ---- Realtime — the queue drives live manager UI updates ----
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.social_posts;
  EXCEPTION WHEN duplicate_object THEN
    NULL; -- already in the publication
  END;
END $$;


-- ===== add-shift-sessions.sql ==========================================

-- ============================================================
-- Iggy's — SHIFT SESSIONS spine
-- Table: shift_sessions
--
-- A shift_sessions row represents ONE open->close bar shift. It is the
-- spine every other shift reading hangs off: line checks, the shift log,
-- and the cash / end-of-night close each carry a nullable integer
-- shift_id (a LOGICAL reference to shift_sessions.id — intentionally NOT a
-- hard FK, so those migrations stay independently runnable).
--
-- Lifecycle: a manager "opens the bar" (status='open', opened_by stamped
-- from their auth email) and later "closes the bar" (status='closed',
-- closed_at + closed_by stamped). At most one open shift at a time, by
-- convention — the app/useShift hook picks the latest open row.
--
-- Run in: Supabase Dashboard > SQL Editor (test on a branch first).
-- CREATE-only & idempotent (re-runnable). Follows new-table-template.sql:
-- post-Oct-2026 Supabase no longer auto-exposes new public tables, so the
-- explicit GRANTs below are REQUIRED or supabase-js can't see the table.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- shift_sessions — one open->close bar shift.
--   opened_at   server-stamped open time (the shift "started" clock)
--   opened_by   manager email who opened the bar (audit trail)
--   closed_at   server-stamped close time (null while open)
--   closed_by   manager email who closed the bar (null while open)
--   status      'open' | 'closed'
--   notes       free-form shift notes (handoff, anything notable)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shift_sessions (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  opened_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  opened_by   TEXT,
  closed_at   TIMESTAMPTZ,
  closed_by   TEXT,
  status      TEXT NOT NULL DEFAULT 'open',   -- 'open' | 'closed'
  notes       TEXT
);

CREATE INDEX IF NOT EXISTS shift_sessions_status_idx    ON public.shift_sessions (status);
CREATE INDEX IF NOT EXISTS shift_sessions_opened_at_idx ON public.shift_sessions (opened_at DESC);

-- ---- GRANTS (required — without these the table is invisible to the Data API) ----
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_sessions TO authenticated; -- manager: open/close/edit shifts
-- No anon grant: shift state is manager-only (never read by the public site).
-- Identity PK needs no sequence grant; the service-role bypasses RLS.

-- ---- Row Level Security + policies ----
-- Manager-only for ALL operations (no public read).
ALTER TABLE public.shift_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read" ON public.shift_sessions;
CREATE POLICY "Auth read" ON public.shift_sessions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth insert" ON public.shift_sessions;
CREATE POLICY "Auth insert" ON public.shift_sessions
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Auth update" ON public.shift_sessions;
CREATE POLICY "Auth update" ON public.shift_sessions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth delete" ON public.shift_sessions;
CREATE POLICY "Auth delete" ON public.shift_sessions
  FOR DELETE TO authenticated USING (true);

-- ---- Realtime — the open/closed state drives live manager UI updates ----
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_sessions;
  EXCEPTION WHEN duplicate_object THEN
    NULL; -- already in the publication
  END;
END $$;


-- ===== add-checklists.sql ==============================================

-- ============================================================
-- Iggy's — CHECKLISTS + LINE CHECK (shift spine)
-- Run in: Supabase Dashboard > SQL Editor (test on a branch first)
--
-- Opening / closing / safety checklists (photo-proof items) + a
-- numeric line check (cooler temps, CO2 PSI, keg lines) attributed to
-- a bar shift. Every run table carries a NULLABLE integer shift_id — a
-- LOGICAL reference to shift_sessions.id (NOT a hard FK, so this file
-- stays independently runnable regardless of migration order).
--
-- Compliance/log tables are append-only in spirit: timestamps default
-- server-side and rows are never expected to be mutated after the fact.
-- Idempotent (IF NOT EXISTS + drop-then-create policies + ON CONFLICT
-- DO NOTHING seeds) so it is safe to re-run. CREATE-only — do not edit
-- runtime data here.
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- CHECKLISTS
-- ════════════════════════════════════════════════════════════

-- ---- checklist_templates -----------------------------------------------
create table if not exists public.checklist_templates (
  id          bigint generated always as identity primary key,
  created_at  timestamptz default now(),
  name        text    not null,
  kind        text    not null default 'opening' check (kind in ('opening','closing','safety')),
  sort_order  int     default 0,
  active      boolean default true
);

grant select                         on public.checklist_templates to anon;
grant select, insert, update, delete on public.checklist_templates to authenticated;

alter table public.checklist_templates enable row level security;

drop policy if exists "Public read" on public.checklist_templates;
create policy "Public read" on public.checklist_templates for select using (true);
drop policy if exists "Auth insert" on public.checklist_templates;
create policy "Auth insert" on public.checklist_templates for insert to authenticated with check (true);
drop policy if exists "Auth update" on public.checklist_templates;
create policy "Auth update" on public.checklist_templates for update to authenticated using (true) with check (true);
drop policy if exists "Auth delete" on public.checklist_templates;
create policy "Auth delete" on public.checklist_templates for delete to authenticated using (true);

-- ---- checklist_template_items ------------------------------------------
create table if not exists public.checklist_template_items (
  id             bigint generated always as identity primary key,
  created_at     timestamptz default now(),
  template_id    bigint  not null,
  label          text    not null,
  requires_photo boolean default false,
  sort_order     int     default 0
);

grant select                         on public.checklist_template_items to anon;
grant select, insert, update, delete on public.checklist_template_items to authenticated;

alter table public.checklist_template_items enable row level security;

drop policy if exists "Public read" on public.checklist_template_items;
create policy "Public read" on public.checklist_template_items for select using (true);
drop policy if exists "Auth insert" on public.checklist_template_items;
create policy "Auth insert" on public.checklist_template_items for insert to authenticated with check (true);
drop policy if exists "Auth update" on public.checklist_template_items;
create policy "Auth update" on public.checklist_template_items for update to authenticated using (true) with check (true);
drop policy if exists "Auth delete" on public.checklist_template_items;
create policy "Auth delete" on public.checklist_template_items for delete to authenticated using (true);

-- ---- checklist_runs ----------------------------------------------------
-- One run = one walk-through of a template during a shift.
create table if not exists public.checklist_runs (
  id            bigint generated always as identity primary key,
  created_at    timestamptz default now(),
  shift_id      int,                  -- logical ref to shift_sessions.id (nullable, no FK)
  template_id   bigint not null,
  completed_by  text,
  completed_at  timestamptz
);

grant select                         on public.checklist_runs to anon;
grant select, insert, update, delete on public.checklist_runs to authenticated;

alter table public.checklist_runs enable row level security;

drop policy if exists "Public read" on public.checklist_runs;
create policy "Public read" on public.checklist_runs for select using (true);
drop policy if exists "Auth insert" on public.checklist_runs;
create policy "Auth insert" on public.checklist_runs for insert to authenticated with check (true);
drop policy if exists "Auth update" on public.checklist_runs;
create policy "Auth update" on public.checklist_runs for update to authenticated using (true) with check (true);
drop policy if exists "Auth delete" on public.checklist_runs;
create policy "Auth delete" on public.checklist_runs for delete to authenticated using (true);

-- ---- checklist_run_items -----------------------------------------------
create table if not exists public.checklist_run_items (
  id          bigint generated always as identity primary key,
  created_at  timestamptz default now(),
  run_id      bigint  not null,
  item_id     bigint  not null,
  checked     boolean default false,
  photo_url   text,
  note        text,
  checked_at  timestamptz
);

grant select                         on public.checklist_run_items to anon;
grant select, insert, update, delete on public.checklist_run_items to authenticated;

alter table public.checklist_run_items enable row level security;

drop policy if exists "Public read" on public.checklist_run_items;
create policy "Public read" on public.checklist_run_items for select using (true);
drop policy if exists "Auth insert" on public.checklist_run_items;
create policy "Auth insert" on public.checklist_run_items for insert to authenticated with check (true);
drop policy if exists "Auth update" on public.checklist_run_items;
create policy "Auth update" on public.checklist_run_items for update to authenticated using (true) with check (true);
drop policy if exists "Auth delete" on public.checklist_run_items;
create policy "Auth delete" on public.checklist_run_items for delete to authenticated using (true);

-- ════════════════════════════════════════════════════════════
-- LINE CHECK
-- ════════════════════════════════════════════════════════════

-- ---- line_check_templates ----------------------------------------------
create table if not exists public.line_check_templates (
  id          bigint generated always as identity primary key,
  created_at  timestamptz default now(),
  name        text    not null,
  sort_order  int     default 0,
  active      boolean default true
);

grant select                         on public.line_check_templates to anon;
grant select, insert, update, delete on public.line_check_templates to authenticated;

alter table public.line_check_templates enable row level security;

drop policy if exists "Public read" on public.line_check_templates;
create policy "Public read" on public.line_check_templates for select using (true);
drop policy if exists "Auth insert" on public.line_check_templates;
create policy "Auth insert" on public.line_check_templates for insert to authenticated with check (true);
drop policy if exists "Auth update" on public.line_check_templates;
create policy "Auth update" on public.line_check_templates for update to authenticated using (true) with check (true);
drop policy if exists "Auth delete" on public.line_check_templates;
create policy "Auth delete" on public.line_check_templates for delete to authenticated using (true);

-- ---- line_check_template_items -----------------------------------------
-- A reading point with a safe range [min_value, max_value].
create table if not exists public.line_check_template_items (
  id           bigint generated always as identity primary key,
  created_at   timestamptz default now(),
  template_id  bigint  not null,
  label        text    not null,
  unit         text,
  min_value    numeric,
  max_value    numeric,
  sort_order   int     default 0
);

grant select                         on public.line_check_template_items to anon;
grant select, insert, update, delete on public.line_check_template_items to authenticated;

alter table public.line_check_template_items enable row level security;

drop policy if exists "Public read" on public.line_check_template_items;
create policy "Public read" on public.line_check_template_items for select using (true);
drop policy if exists "Auth insert" on public.line_check_template_items;
create policy "Auth insert" on public.line_check_template_items for insert to authenticated with check (true);
drop policy if exists "Auth update" on public.line_check_template_items;
create policy "Auth update" on public.line_check_template_items for update to authenticated using (true) with check (true);
drop policy if exists "Auth delete" on public.line_check_template_items;
create policy "Auth delete" on public.line_check_template_items for delete to authenticated using (true);

-- ---- line_check_runs ---------------------------------------------------
create table if not exists public.line_check_runs (
  id            bigint generated always as identity primary key,
  created_at    timestamptz default now(),
  shift_id      int,                  -- logical ref to shift_sessions.id (nullable, no FK)
  completed_by  text
);

grant select                         on public.line_check_runs to anon;
grant select, insert, update, delete on public.line_check_runs to authenticated;

alter table public.line_check_runs enable row level security;

drop policy if exists "Public read" on public.line_check_runs;
create policy "Public read" on public.line_check_runs for select using (true);
drop policy if exists "Auth insert" on public.line_check_runs;
create policy "Auth insert" on public.line_check_runs for insert to authenticated with check (true);
drop policy if exists "Auth update" on public.line_check_runs;
create policy "Auth update" on public.line_check_runs for update to authenticated using (true) with check (true);
drop policy if exists "Auth delete" on public.line_check_runs;
create policy "Auth delete" on public.line_check_runs for delete to authenticated using (true);

-- ---- line_check_readings -----------------------------------------------
create table if not exists public.line_check_readings (
  id          bigint generated always as identity primary key,
  created_at  timestamptz default now(),
  run_id      bigint  not null,
  item_id     bigint  not null,
  value       numeric,
  in_range    boolean,
  note        text
);

grant select                         on public.line_check_readings to anon;
grant select, insert, update, delete on public.line_check_readings to authenticated;

alter table public.line_check_readings enable row level security;

drop policy if exists "Public read" on public.line_check_readings;
create policy "Public read" on public.line_check_readings for select using (true);
drop policy if exists "Auth insert" on public.line_check_readings;
create policy "Auth insert" on public.line_check_readings for insert to authenticated with check (true);
drop policy if exists "Auth update" on public.line_check_readings;
create policy "Auth update" on public.line_check_readings for update to authenticated using (true) with check (true);
drop policy if exists "Auth delete" on public.line_check_readings;
create policy "Auth delete" on public.line_check_readings for delete to authenticated using (true);

-- ════════════════════════════════════════════════════════════
-- SEED — default templates + items (idempotent via natural-key conflicts)
-- ════════════════════════════════════════════════════════════
-- Unique indexes give ON CONFLICT a target so re-running never duplicates.

create unique index if not exists checklist_templates_name_kind_key
  on public.checklist_templates (name, kind);
create unique index if not exists checklist_template_items_tpl_label_key
  on public.checklist_template_items (template_id, label);
create unique index if not exists line_check_templates_name_key
  on public.line_check_templates (name);
create unique index if not exists line_check_template_items_tpl_label_key
  on public.line_check_template_items (template_id, label);

-- ---- Checklist templates ----
insert into public.checklist_templates (name, kind, sort_order) values
  ('Opening Checklist', 'opening', 0),
  ('Closing Checklist', 'closing', 1),
  ('Safety Check',      'safety',  2)
on conflict (name, kind) do nothing;

-- ---- Opening items ----
insert into public.checklist_template_items (template_id, label, requires_photo, sort_order)
select t.id, v.label, v.requires_photo, v.sort_order
from public.checklist_templates t
join (values
  ('Turn on all lights & signage',        false, 0),
  ('Boot up POS & card readers',          false, 1),
  ('Sweep & mop floors',                  false, 2),
  ('Fill ice wells',                      false, 3),
  ('Prep & stock garnish station',        true,  4)
) as v(label, requires_photo, sort_order) on true
where t.name = 'Opening Checklist' and t.kind = 'opening'
on conflict (template_id, label) do nothing;

-- ---- Closing items ----
insert into public.checklist_template_items (template_id, label, requires_photo, sort_order)
select t.id, v.label, v.requires_photo, v.sort_order
from public.checklist_templates t
join (values
  ('Cash drop & reconcile drawer',        true,  0),
  ('Lock coolers & walk-in',              false, 1),
  ('Clean & flush taps',                  false, 2),
  ('Wipe down bar & stools',              false, 3),
  ('Take out trash & recycling',          false, 4)
) as v(label, requires_photo, sort_order) on true
where t.name = 'Closing Checklist' and t.kind = 'closing'
on conflict (template_id, label) do nothing;

-- ---- Safety items ----
insert into public.checklist_template_items (template_id, label, requires_photo, sort_order)
select t.id, v.label, v.requires_photo, v.sort_order
from public.checklist_templates t
join (values
  ('Exits clear & unlocked',              false, 0),
  ('Fire extinguisher in place & charged', true, 1),
  ('First-aid kit stocked',               false, 2),
  ('No wet-floor / trip hazards',         false, 3)
) as v(label, requires_photo, sort_order) on true
where t.name = 'Safety Check' and t.kind = 'safety'
on conflict (template_id, label) do nothing;

-- ---- Line check template ----
insert into public.line_check_templates (name, sort_order) values
  ('Bar Line Check', 0)
on conflict (name) do nothing;

-- ---- Line check items (safe ranges) ----
insert into public.line_check_template_items (template_id, label, unit, min_value, max_value, sort_order)
select t.id, v.label, v.unit, v.min_value, v.max_value, v.sort_order
from public.line_check_templates t
join (values
  ('Walk-in cooler', '°F',  33, 40, 0),
  ('Beer cooler',    '°F',  34, 38, 1),
  ('CO2 PSI',        'psi', 800, 1200, 2),
  ('Keg line',       '°F',  36, 40, 3)
) as v(label, unit, min_value, max_value, sort_order) on true
where t.name = 'Bar Line Check'
on conflict (template_id, label) do nothing;


-- ===== add-shift-log.sql ===============================================

-- ============================================================
-- Iggy's — SHIFT LOG / MOD JOURNAL  (Luna's eyes on the floor)
-- Table: shift_log
--
-- The tagged, searchable record of what happened on a shift: 86'd items,
-- incidents, VIPs, maintenance, and free-form notes. Each entry can be
-- attributed to a shift via a NULLABLE shift_id (a LOGICAL reference to
-- shift_sessions.id — intentionally NOT a hard FK so this migration stays
-- independently runnable from the rest of the shift-spine wave).
--
-- Append-only in spirit: rows are created on the floor and (at most) marked
-- resolved. created_at is a server default so the timeline can't be faked.
--
-- Run in: Supabase Dashboard > SQL Editor (test on a branch first).
-- CREATE-only & idempotent (re-runnable). Follows new-table-template.sql:
-- post-Oct-2026 Supabase no longer auto-exposes new public tables, so the
-- explicit GRANTs below are REQUIRED or supabase-js can't see the table.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- shift_log — one journal entry on a shift.
--   shift_id    nullable LOGICAL ref to shift_sessions.id (no hard FK)
--   author      manager email who wrote it (audit trail)
--   tag         '86' | 'incident' | 'vip' | 'maintenance' | 'note'
--   body        the entry text
--   item_ref    free-text name of the menu item / thing referenced (e.g. an 86)
--   photo_url   optional photo (broken tap, incident, etc.)
--   resolved    has this been handled? (incidents/maintenance close out)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shift_log (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  shift_id    INTEGER,                                   -- logical ref to shift_sessions.id (no FK)
  author      TEXT,
  tag         TEXT NOT NULL DEFAULT 'note',              -- '86'|'incident'|'vip'|'maintenance'|'note'
  body        TEXT NOT NULL DEFAULT '',
  item_ref    TEXT,
  photo_url   TEXT,
  resolved    BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS shift_log_created_idx  ON public.shift_log (created_at DESC);
CREATE INDEX IF NOT EXISTS shift_log_shift_idx    ON public.shift_log (shift_id);
CREATE INDEX IF NOT EXISTS shift_log_tag_idx      ON public.shift_log (tag);

-- ---- GRANTS (required — without these the table is invisible to the Data API) ----
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_log TO authenticated; -- manager dashboard: full CRUD
-- No anon grant: the floor journal is manager-only (never read by the public site).
-- Identity PK needs no sequence grant.

-- ---- Row Level Security + policies ----
ALTER TABLE public.shift_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read" ON public.shift_log;
CREATE POLICY "Auth read" ON public.shift_log
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth insert" ON public.shift_log;
CREATE POLICY "Auth insert" ON public.shift_log
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Auth update" ON public.shift_log;
CREATE POLICY "Auth update" ON public.shift_log
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth delete" ON public.shift_log;
CREATE POLICY "Auth delete" ON public.shift_log
  FOR DELETE TO authenticated USING (true);

-- ---- Realtime — the journal drives the live floor feed across devices ----
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_log;
  EXCEPTION WHEN duplicate_object THEN
    NULL; -- already in the publication
  END;
END $$;

-- ============================================================
-- 86 FLAG on the public menu.
-- When a manager 86's an item, we both write a '86' shift_log entry AND
-- flip menu_items.is_86d=true so the PUBLIC menu can hide / grey it out.
-- "Un-86" clears the flag. Idempotent add — safe to re-run.
-- (The public site is NOT edited here; it should later filter is_86d items.)
-- ============================================================
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS is_86d BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS menu_items_is_86d_idx ON public.menu_items (is_86d);


-- ===== add-closeout.sql ================================================

-- ============================================================
-- Iggy's — CLOSE-OUT (cash reconciliation + End-of-Night report)
-- Tables: cash_counts, eon_reports
--
-- The /shift/close screen is the second great owner-demo: at the end of a
-- shift the manager counts the till (denomination grid -> over/short) and
-- taps one button to compose + email the owner the whole night's report.
--
-- SHIFT SPINE: both tables carry a NULLABLE INTEGER shift_id that LOGICALLY
-- references shift_sessions.id (NO hard FK — kept soft so this migration runs
-- independently of the rest of the shift wave). A reading still works standalone
-- when no shift is open (shift_id stays NULL).
--
-- APPEND-ONLY IN SPIRIT: these are compliance/log rows. created_at is a
-- server default; nothing here mutates a prior count. eon_reports.emailed_at
-- is the one field patched after the fact (when the owner email goes out).
--
-- Run in: Supabase Dashboard > SQL Editor (test on a branch first).
-- CREATE-only & idempotent (re-runnable). Follows new-table-template.sql:
-- post-Oct-2026 Supabase no longer auto-exposes new public tables, so the
-- explicit GRANTs below are REQUIRED or supabase-js can't see the table.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- cash_counts — one till count at close (or any point in a shift).
--   shift_id          logical shift_sessions.id this count belongs to (nullable)
--   counted_by        manager email who counted the drawer (audit trail)
--   expected_cents    what the system/float says SHOULD be in the till
--   counted_cents     what the manager actually counted (sum of the grid)
--   over_short_cents  counted - expected: positive = over, negative = short
--   denominations     { "10000": 3, "2000": 5, ... } cents-per-bill/coin -> count
--   note              free-text ("pulled $200 to safe", "rolled coin", ...)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cash_counts (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  shift_id          INTEGER,                              -- logical -> shift_sessions.id (no hard FK)
  counted_by        TEXT,
  expected_cents    INTEGER NOT NULL DEFAULT 0,
  counted_cents     INTEGER NOT NULL DEFAULT 0,
  over_short_cents  INTEGER NOT NULL DEFAULT 0,           -- counted - expected
  denominations     JSONB DEFAULT '{}'::jsonb,            -- { cents_denom: count }
  note              TEXT
);

CREATE INDEX IF NOT EXISTS cash_counts_shift_idx   ON public.cash_counts (shift_id);
CREATE INDEX IF NOT EXISTS cash_counts_created_idx ON public.cash_counts (created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- eon_reports — one composed End-of-Night report per close.
--   shift_id          logical shift_sessions.id this report covers (nullable)
--   generated_by      manager email who generated it (audit trail)
--   summary           the plain-text report body (server-composed, emailed)
--   metrics           structured snapshot { events, checklist, lineChecks,
--                       logHighlights, lowStock, cash } so it can be re-rendered
--   emailed_at        set when the owner email actually went out (patched later)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.eon_reports (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  shift_id      INTEGER,                                  -- logical -> shift_sessions.id (no hard FK)
  generated_by  TEXT,
  summary       TEXT NOT NULL DEFAULT '',
  metrics       JSONB DEFAULT '{}'::jsonb,
  emailed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS eon_reports_shift_idx   ON public.eon_reports (shift_id);
CREATE INDEX IF NOT EXISTS eon_reports_created_idx ON public.eon_reports (created_at DESC);

-- ---- GRANTS (required — without these the tables are invisible to the Data API) ----
-- Manager-only: the public site never reads close-out data, so no anon grant.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_counts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eon_reports TO authenticated;
-- Identity PKs need no sequence grant; the generate-eon service role bypasses RLS.

-- ---- Row Level Security + policies ----
-- Manager-only for ALL operations (no public read). The generate-eon function
-- writes/patches eon_reports with the SERVICE ROLE, which bypasses RLS.
ALTER TABLE public.cash_counts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read" ON public.cash_counts;
CREATE POLICY "Auth read" ON public.cash_counts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth insert" ON public.cash_counts;
CREATE POLICY "Auth insert" ON public.cash_counts
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Auth update" ON public.cash_counts;
CREATE POLICY "Auth update" ON public.cash_counts
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth delete" ON public.cash_counts;
CREATE POLICY "Auth delete" ON public.cash_counts
  FOR DELETE TO authenticated USING (true);

ALTER TABLE public.eon_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read" ON public.eon_reports;
CREATE POLICY "Auth read" ON public.eon_reports
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth insert" ON public.eon_reports;
CREATE POLICY "Auth insert" ON public.eon_reports
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Auth update" ON public.eon_reports;
CREATE POLICY "Auth update" ON public.eon_reports
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth delete" ON public.eon_reports;
CREATE POLICY "Auth delete" ON public.eon_reports
  FOR DELETE TO authenticated USING (true);


-- ===== add-reviews.sql =================================================

-- ============================================================
-- Iggy's — REPUTATION (reviews inbox) + table-side FEEDBACK QR
-- Tables: review_sources, reviews, feedback
--
-- Two complementary surfaces:
--  1. reviews        — public reviews ingested from external platforms
--                      (Google Business Profile / Yelp / Facebook). Surfaced
--                      in the manager Reputation page as a stream the owner
--                      can reply to and mark-replied. Ingest is handled by the
--                      reviews-sync edge function (a SAFE STUB until GBP creds
--                      land — see supabase/functions/reviews-sync/index.ts).
--  2. feedback       — PRIVATE table-side feedback. A QR at each table opens
--                      the public /feedback page; the FTC-safe form always
--                      shows BOTH "leave a public review" AND a private box.
--                      Posts land here via the submit-feedback edge function.
--  review_sources    — small lookup of where reviews can come from + the
--                      public review URL the /feedback page links out to.
--
-- Run in: Supabase Dashboard > SQL Editor (test on a branch first).
-- CREATE-only & idempotent (re-runnable). Follows new-table-template.sql:
-- post-Oct-2026 Supabase no longer auto-exposes new public tables, so the
-- explicit GRANTs below are REQUIRED or supabase-js can't see the table.
--
-- COMPLIANCE NOTE: `reviews` and `feedback` are append-only in spirit — they
-- are an audit record of what guests said. Replies are recorded on the review
-- row (reply_text/replied) rather than mutating the original body.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- review_sources — lookup: a platform we ingest reviews from / link out to.
--   key             stable slug ('google' | 'yelp' | 'facebook' | 'manual')
--   label           human label for the badge ('Google', 'Yelp', …)
--   review_url      the public "leave a review" deep link (the /feedback CTA
--                   links to the Google one). null = no outbound link.
--   active          whether this source is shown / ingested
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.review_sources (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT now(),
  key         TEXT NOT NULL UNIQUE,          -- 'google' | 'yelp' | 'facebook' | 'manual'
  label       TEXT NOT NULL,
  review_url  TEXT,                          -- public "write a review" link (anon reads this)
  active      BOOLEAN NOT NULL DEFAULT true
);

-- ─────────────────────────────────────────────────────────────
-- reviews — one public review from an external platform.
--   source          which platform (matches review_sources.key)
--   author          reviewer display name (may be null/anonymous)
--   rating          1–5 stars
--   body            the review text
--   url             deep link back to the review on the platform
--   replied         has the owner responded?
--   reply_text      the owner's drafted/sent response (recorded here)
--   sentiment       'positive' | 'neutral' | 'negative' — derived from rating
--                   at ingest; lets the inbox flag low scores fast.
--   external_id     platform's review id — dedupe key for re-syncs
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at   TIMESTAMPTZ DEFAULT now(),
  source       TEXT NOT NULL DEFAULT 'manual',  -- review_sources.key
  author       TEXT,
  rating       INT NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  body         TEXT,
  url          TEXT,
  replied      BOOLEAN NOT NULL DEFAULT false,
  reply_text   TEXT,
  sentiment    TEXT,                            -- 'positive' | 'neutral' | 'negative'
  external_id  TEXT                             -- platform review id (dedupe)
);

-- Dedupe across re-syncs: at most one row per (source, external_id) when set.
CREATE UNIQUE INDEX IF NOT EXISTS reviews_source_external_idx
  ON public.reviews (source, external_id)
  WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS reviews_created_idx ON public.reviews (created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_rating_idx  ON public.reviews (rating);

-- ─────────────────────────────────────────────────────────────
-- feedback — private table-side feedback from the /feedback QR page.
--   area                  which part of the visit ('food' | 'drinks' |
--                         'service' | 'atmosphere' | 'other')
--   rating                1–5 stars
--   comment               the guest's free-text note
--   contact_email         optional — so the owner can follow up
--   public_review_clicked whether the guest also tapped "leave a public review"
--                         (FTC-safe: we never gate the public link on sentiment —
--                         this is just analytics on the funnel)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feedback (
  id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at             TIMESTAMPTZ DEFAULT now(),
  area                   TEXT,
  rating                 INT CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  comment                TEXT,
  contact_email          TEXT,
  public_review_clicked  BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS feedback_created_idx ON public.feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_rating_idx  ON public.feedback (rating);

-- ============================================================
-- GRANTS (required — without these the tables are invisible to the Data API)
-- ============================================================
-- review_sources: the public /feedback page reads the outbound review_url (anon).
GRANT SELECT                         ON public.review_sources TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_sources TO authenticated;

-- reviews: manager-only inbox. No anon grant (public never reads competitors' words).
-- Ingest writes happen with the SERVICE ROLE (reviews-sync), which bypasses RLS.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;

-- feedback: manager reads it; the public WRITER is the submit-feedback edge
-- function (service role), so anon needs NO direct grant — keeps the table
-- unreadable to the public while still accepting their submissions server-side.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback TO authenticated;

-- ============================================================
-- Row Level Security + policies
-- ============================================================

-- ---- review_sources ----
ALTER TABLE public.review_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read" ON public.review_sources;
CREATE POLICY "Public read" ON public.review_sources
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth insert" ON public.review_sources;
CREATE POLICY "Auth insert" ON public.review_sources
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Auth update" ON public.review_sources;
CREATE POLICY "Auth update" ON public.review_sources
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth delete" ON public.review_sources;
CREATE POLICY "Auth delete" ON public.review_sources
  FOR DELETE TO authenticated USING (true);

-- ---- reviews (manager-only; service role ingests, bypassing RLS) ----
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read" ON public.reviews;
CREATE POLICY "Auth read" ON public.reviews
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth insert" ON public.reviews;
CREATE POLICY "Auth insert" ON public.reviews
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Auth update" ON public.reviews;
CREATE POLICY "Auth update" ON public.reviews
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth delete" ON public.reviews;
CREATE POLICY "Auth delete" ON public.reviews
  FOR DELETE TO authenticated USING (true);

-- ---- feedback (manager reads; public writes ONLY via the service-role fn) ----
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read" ON public.feedback;
CREATE POLICY "Auth read" ON public.feedback
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth update" ON public.feedback;
CREATE POLICY "Auth update" ON public.feedback
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth delete" ON public.feedback;
CREATE POLICY "Auth delete" ON public.feedback
  FOR DELETE TO authenticated USING (true);
-- NOTE: deliberately NO anon/authenticated INSERT policy — the public form
-- writes through submit-feedback (service role) which bypasses RLS. This keeps
-- the table tamper-resistant while still capturing every guest submission.

-- ============================================================
-- Realtime — the Reputation inbox updates live as reviews/feedback land.
-- ============================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reviews;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ============================================================
-- Seed the sources lookup (idempotent). Replace the Google review_url with the
-- bar's real Google "write a review" link once the Place ID is known:
--   https://search.google.com/local/writereview?placeid=<PLACE_ID>
-- ============================================================
INSERT INTO public.review_sources (key, label, review_url, active) VALUES
  ('google',   'Google',   'https://search.google.com/local/writereview?placeid=REPLACE_WITH_PLACE_ID', true),
  ('yelp',     'Yelp',     NULL, true),
  ('facebook', 'Facebook', NULL, true),
  ('manual',   'Manual',   NULL, true)
ON CONFLICT (key) DO NOTHING;


-- ===== add-marketing.sql ===============================================

-- ============================================================
-- Iggy's — MARKETING / CRM + CAMPAIGNS + SMS RAIL
-- Extends:  contacts (CRM enrichment + per-channel consent)
-- Tables:   consent_events, segments, campaigns, sms_log
--
-- The "front door" to the customer list: dedupe-by-phone/email, simple
-- segments, and an email/SMS campaign composer with a NON-BYPASSABLE
-- consent gate (a send is blocked for any contact lacking the matching
-- opt-in). The SMS rail (send-sms / sms-webhook functions) is gated behind
-- SMS_ENABLED + TWILIO_* secrets — ALL intentionally absent until A2P 10DLC
-- registration lands, so nothing is ever texted for real before then.
--
-- consent_events + sms_log are APPEND-ONLY in spirit (audit / compliance
-- trail): never UPDATE/DELETE rows — write a new event instead.
--
-- Run in: Supabase Dashboard > SQL Editor (test on a branch first).
-- CREATE-only & idempotent (re-runnable). Follows new-table-template.sql:
-- post-Oct-2026 Supabase no longer auto-exposes new public tables, so the
-- explicit GRANTs below are REQUIRED or supabase-js can't see the table.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. contacts — CRM enrichment + per-channel consent.
-- The existing `contacts` table (setup-events-suite.sql) already has
-- name/email/phone/company/tags/marketing_opt_in/notes/last_event_date.
-- These columns add visit/spend history, explicit per-channel opt-in (the
-- consent gate reads sms_opt_in / email_opt_in — NOT the legacy
-- marketing_opt_in), a birthday-month segment key, and a normalized E.164
-- phone used as the SMS dedupe key.
-- ADD COLUMN IF NOT EXISTS keeps this re-runnable.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS first_seen       TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS last_visit       TIMESTAMPTZ;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS visit_count      INT DEFAULT 0;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS total_spend      NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS email_opt_in     BOOLEAN DEFAULT false;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS sms_opt_in       BOOLEAN DEFAULT false;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS birthday_month   INT;   -- 1-12 (NULL = unknown)
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS normalized_phone TEXT;  -- E.164 ("+15035550123"), SMS dedupe key

-- Dedupe / segment helpers.
CREATE INDEX IF NOT EXISTS contacts_normalized_phone_idx ON public.contacts (normalized_phone);
CREATE INDEX IF NOT EXISTS contacts_birthday_month_idx   ON public.contacts (birthday_month);
CREATE INDEX IF NOT EXISTS contacts_last_visit_idx       ON public.contacts (last_visit);

-- ─────────────────────────────────────────────────────────────
-- 2. consent_events — APPEND-ONLY opt-in/opt-out audit log.
-- One row per consent change. The current opt-in state lives on
-- contacts.{email,sms}_opt_in; this table is the immutable WHY/WHEN trail
-- (TCPA / CAN-SPAM defensibility). Inbound "STOP" from the SMS webhook and
-- manager toggles both append here.
--   channel  'sms' | 'email'
--   action   'opt_in' | 'opt_out'
--   source   'manager' | 'website' | 'sms_keyword' | 'import' | 'webhook'
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consent_events (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT now(),
  contact_id  BIGINT REFERENCES public.contacts(id) ON DELETE CASCADE,
  channel     TEXT NOT NULL,                       -- 'sms' | 'email'
  action      TEXT NOT NULL,                       -- 'opt_in' | 'opt_out'
  source      TEXT NOT NULL DEFAULT 'manager'      -- 'manager' | 'website' | 'sms_keyword' | 'import' | 'webhook'
);
CREATE INDEX IF NOT EXISTS consent_events_contact_idx ON public.consent_events (contact_id);
CREATE INDEX IF NOT EXISTS consent_events_created_idx ON public.consent_events (created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 3. segments — saved audience definitions.
-- `rule` is a small JSON predicate the UI evaluates client-side against the
-- contact list (kept deliberately simple: no server-side query builder).
-- Examples: {"type":"sms_opted_in"}  {"type":"birthday_this_month"}
--           {"type":"lapsed","days":90}  {"type":"all"}
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.segments (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT now(),
  name        TEXT NOT NULL,
  rule        JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- ─────────────────────────────────────────────────────────────
-- 4. campaigns — one email/SMS blast (draft → scheduled → sending → sent).
-- The composer enforces the consent gate BEFORE a campaign can be marked
-- sent: recipients are the matching segment ∩ contacts holding the
-- channel-appropriate opt-in. `sent_count` is the number actually delivered.
--   channel  'email' | 'sms'
--   status   'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled'
--   subject  email subject (NULL for SMS)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campaigns (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at    TIMESTAMPTZ DEFAULT now(),
  name          TEXT NOT NULL,
  channel       TEXT NOT NULL DEFAULT 'email',      -- 'email' | 'sms'
  subject       TEXT,                               -- email only
  body          TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'draft',      -- draft|scheduled|sending|sent|cancelled
  scheduled_at  TIMESTAMPTZ,
  sent_count    INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS campaigns_status_idx  ON public.campaigns (status);
CREATE INDEX IF NOT EXISTS campaigns_created_idx ON public.campaigns (created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 5. sms_log — APPEND-ONLY record of every SMS the system sends/receives.
-- Written by send-sms (outbound) and sms-webhook (inbound). While the rail
-- is gated OFF, outbound rows are written with status 'blocked' and NO real
-- Twilio call is made — so this doubles as the dry-run audit trail.
--   direction 'outbound' | 'inbound'
--   status    'queued' | 'sent' | 'delivered' | 'received' | 'blocked' | 'failed'
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sms_log (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT now(),
  to_number   TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  direction   TEXT NOT NULL DEFAULT 'outbound',     -- 'outbound' | 'inbound'
  status      TEXT NOT NULL DEFAULT 'queued',       -- queued|sent|delivered|received|blocked|failed
  error       TEXT
);
CREATE INDEX IF NOT EXISTS sms_log_to_idx      ON public.sms_log (to_number);
CREATE INDEX IF NOT EXISTS sms_log_created_idx ON public.sms_log (created_at DESC);

-- ============================================================
-- GRANTS (required — without these the tables are invisible to the Data API).
-- These are manager-only marketing tables: no anon grant. The send-sms /
-- sms-webhook functions write with the SERVICE ROLE, which bypasses RLS.
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consent_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.segments       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_log        TO authenticated;
-- Identity PKs need no sequence grant.

-- ============================================================
-- Row Level Security + policies (manager-only; no public read).
-- consent_events + sms_log are append-only in spirit: we still grant
-- UPDATE/DELETE to authenticated for operational fixes, but the app never
-- mutates them — it only inserts. The service role bypasses RLS for the
-- function writes.
-- ============================================================

-- consent_events
ALTER TABLE public.consent_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read"   ON public.consent_events;
CREATE POLICY "Auth read"   ON public.consent_events FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert" ON public.consent_events;
CREATE POLICY "Auth insert" ON public.consent_events FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update" ON public.consent_events;
CREATE POLICY "Auth update" ON public.consent_events FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Auth delete" ON public.consent_events;
CREATE POLICY "Auth delete" ON public.consent_events FOR DELETE TO authenticated USING (true);

-- segments
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read"   ON public.segments;
CREATE POLICY "Auth read"   ON public.segments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert" ON public.segments;
CREATE POLICY "Auth insert" ON public.segments FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update" ON public.segments;
CREATE POLICY "Auth update" ON public.segments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Auth delete" ON public.segments;
CREATE POLICY "Auth delete" ON public.segments FOR DELETE TO authenticated USING (true);

-- campaigns
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read"   ON public.campaigns;
CREATE POLICY "Auth read"   ON public.campaigns FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert" ON public.campaigns;
CREATE POLICY "Auth insert" ON public.campaigns FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update" ON public.campaigns;
CREATE POLICY "Auth update" ON public.campaigns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Auth delete" ON public.campaigns;
CREATE POLICY "Auth delete" ON public.campaigns FOR DELETE TO authenticated USING (true);

-- sms_log
ALTER TABLE public.sms_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read"   ON public.sms_log;
CREATE POLICY "Auth read"   ON public.sms_log FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert" ON public.sms_log;
CREATE POLICY "Auth insert" ON public.sms_log FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update" ON public.sms_log;
CREATE POLICY "Auth update" ON public.sms_log FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Auth delete" ON public.sms_log;
CREATE POLICY "Auth delete" ON public.sms_log FOR DELETE TO authenticated USING (true);

-- ---- Realtime — campaigns + sms_log drive live manager UI updates ----
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.campaigns; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.sms_log;   EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;


-- ===== add-reservations.sql ============================================

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


-- ===== add-cogs.sql ====================================================

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


-- ===== add-labor.sql ===================================================

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


-- ===== add-compliance.sql ==============================================

-- ============================================================
-- Iggy's — COMPLIANCE VAULT  (the "show the inspector" trust layer)
--
-- The legally-defensible record of how the bar runs: alcohol refusals / cut-offs,
-- incident reports, walk-in & cooler temperature logs, and license/cert expiries.
-- Plus push_subscriptions for the web-push trust pings.
--
-- APPEND-ONLY IN SPIRIT: refusal_logs, incidents, and temperature_logs are records
-- of things that HAPPENED — they get created on the floor and are never edited or
-- deleted by staff (no UPDATE/DELETE grant to `authenticated`). created_at is a
-- server default so the timeline can't be back-dated. temp_units & credentials are
-- managed reference/registry data and DO allow edit (a unit gets renamed, a renewed
-- license gets a new expiry), but their child *log* rows stay immutable.
--
-- shift_id is a NULLABLE LOGICAL reference to shift_sessions.id (intentionally NOT a
-- hard FK) so this migration stays independently runnable from the shift-spine wave.
--
-- Run in: Supabase Dashboard > SQL Editor (test on a branch first).
-- CREATE-only & idempotent (re-runnable). Follows new-table-template.sql:
-- post-Oct-2026 Supabase no longer auto-exposes new public tables, so the explicit
-- GRANTs below are REQUIRED or supabase-js can't see the table.
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- refusal_logs — every alcohol refusal / cut-off, the dram-shop defense.
--   shift_id  nullable logical ref to shift_sessions.id (no FK)
--   server    staff member who made the call (free text — name/initials)
--   reason    'intoxicated' | 'no_id' | 'underage' | 'fake_id' | 'other' (free text)
--   notes     what happened, descriptions, witnesses
-- IMMUTABLE: no UPDATE/DELETE grant — a refusal record can never be altered.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.refusal_logs (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  shift_id    INTEGER,
  server      TEXT,
  reason      TEXT NOT NULL DEFAULT 'other',
  notes       TEXT
);

CREATE INDEX IF NOT EXISTS refusal_logs_created_idx ON public.refusal_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS refusal_logs_shift_idx   ON public.refusal_logs (shift_id);

GRANT SELECT, INSERT ON public.refusal_logs TO authenticated; -- append-only: read + create, never edit/delete

ALTER TABLE public.refusal_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read" ON public.refusal_logs;
CREATE POLICY "Auth read" ON public.refusal_logs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth insert" ON public.refusal_logs;
CREATE POLICY "Auth insert" ON public.refusal_logs
  FOR INSERT TO authenticated WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────
-- incidents — incident reports (slip, fight, injury, theft, ejection, etc.).
--   type          'injury' | 'altercation' | 'ejection' | 'property' | 'medical' | 'other'
--   description   what happened
--   action_taken  what staff did (911, first aid, trespass, refund, …)
--   photo_url     optional evidence photo
-- IMMUTABLE: no UPDATE/DELETE grant — an incident report is a permanent record.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.incidents (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  shift_id      INTEGER,
  type          TEXT NOT NULL DEFAULT 'other',
  description   TEXT NOT NULL DEFAULT '',
  action_taken  TEXT,
  photo_url     TEXT
);

CREATE INDEX IF NOT EXISTS incidents_created_idx ON public.incidents (created_at DESC);
CREATE INDEX IF NOT EXISTS incidents_shift_idx   ON public.incidents (shift_id);
CREATE INDEX IF NOT EXISTS incidents_type_idx    ON public.incidents (type);

GRANT SELECT, INSERT ON public.incidents TO authenticated; -- append-only

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read" ON public.incidents;
CREATE POLICY "Auth read" ON public.incidents
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth insert" ON public.incidents;
CREATE POLICY "Auth insert" ON public.incidents
  FOR INSERT TO authenticated WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────
-- temp_units — the registry of monitored cold/hot units (walk-in, beer cooler,
--   raw bar, hot well, …) with their safe range. REFERENCE data: editable.
--   min_f / max_f  inclusive safe range in °F. A reading outside is out-of-range.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.temp_units (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  name        TEXT NOT NULL,
  min_f       NUMERIC NOT NULL DEFAULT 33,
  max_f       NUMERIC NOT NULL DEFAULT 40,
  active      BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS temp_units_active_idx ON public.temp_units (active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.temp_units TO authenticated; -- registry: full CRUD

ALTER TABLE public.temp_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read" ON public.temp_units;
CREATE POLICY "Auth read" ON public.temp_units
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth insert" ON public.temp_units;
CREATE POLICY "Auth insert" ON public.temp_units
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Auth update" ON public.temp_units;
CREATE POLICY "Auth update" ON public.temp_units
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth delete" ON public.temp_units;
CREATE POLICY "Auth delete" ON public.temp_units
  FOR DELETE TO authenticated USING (true);


-- ─────────────────────────────────────────────────────────────
-- temperature_logs — a single timestamped reading for a unit.
--   unit_id    logical ref to temp_units.id (no hard FK — units may be soft-removed)
--   value_f    the reading in °F
--   in_range   computed by the app at log time vs the unit's min/max (audit snapshot
--              of compliance AT THE MOMENT logged — kept even if the range later changes)
-- IMMUTABLE: no UPDATE/DELETE grant — a reading is a record of a measurement.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.temperature_logs (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  unit_id     INTEGER,
  value_f     NUMERIC NOT NULL,
  in_range    BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS temperature_logs_created_idx ON public.temperature_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS temperature_logs_unit_idx    ON public.temperature_logs (unit_id);

GRANT SELECT, INSERT ON public.temperature_logs TO authenticated; -- append-only

ALTER TABLE public.temperature_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read" ON public.temperature_logs;
CREATE POLICY "Auth read" ON public.temperature_logs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth insert" ON public.temperature_logs;
CREATE POLICY "Auth insert" ON public.temperature_logs
  FOR INSERT TO authenticated WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────
-- credentials — the license / cert / permit tracker (liquor license, food-handler,
--   TIPS/ServSafe, health permit, fire inspection, COI, …) with expiry chips.
--   type        'liquor' | 'food_handler' | 'serving' | 'health' | 'fire' | 'insurance' | 'other'
--   holder      who/what it belongs to (the venue, or a staff member's name)
--   expires_on  the date it lapses → drives 90/60/30/7-day expiry chips in the UI
-- REGISTRY data: editable (a renewed license gets a new expires_on).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.credentials (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'other',
  holder      TEXT,
  expires_on  DATE
);

CREATE INDEX IF NOT EXISTS credentials_expires_idx ON public.credentials (expires_on);
CREATE INDEX IF NOT EXISTS credentials_type_idx    ON public.credentials (type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.credentials TO authenticated; -- registry: full CRUD

ALTER TABLE public.credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read" ON public.credentials;
CREATE POLICY "Auth read" ON public.credentials
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth insert" ON public.credentials;
CREATE POLICY "Auth insert" ON public.credentials
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Auth update" ON public.credentials;
CREATE POLICY "Auth update" ON public.credentials
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth delete" ON public.credentials;
CREATE POLICY "Auth delete" ON public.credentials
  FOR DELETE TO authenticated USING (true);


-- ─────────────────────────────────────────────────────────────
-- push_subscriptions — Web Push (VAPID) endpoints for the manager PWA.
-- One row per browser/device that has granted notification permission. The
-- web-push edge function reads these to send. Each subscription is keyed by its
-- unique `endpoint`; keys/p256dh/auth come from the PushSubscription JSON.
--   endpoint    the push service URL (UNIQUE — re-subscribing upserts)
--   p256dh      client public key (base64url)
--   auth        client auth secret (base64url)
--   user_email  who subscribed (audit / targeting)
--   user_agent  device hint for the UI
-- Subscriptions ARE deletable: a browser can revoke / a stale endpoint must be
-- prunable when the push service returns 404/410.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  user_email  TEXT,
  user_agent  TEXT
);

CREATE INDEX IF NOT EXISTS push_subscriptions_email_idx ON public.push_subscriptions (user_email);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read" ON public.push_subscriptions;
CREATE POLICY "Auth read" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth insert" ON public.push_subscriptions;
CREATE POLICY "Auth insert" ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Auth update" ON public.push_subscriptions;
CREATE POLICY "Auth update" ON public.push_subscriptions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth delete" ON public.push_subscriptions;
CREATE POLICY "Auth delete" ON public.push_subscriptions
  FOR DELETE TO authenticated USING (true);


-- ─────────────────────────────────────────────────────────────
-- Seed a couple of common temp units so the Temperature Wall isn't empty on day 1.
-- Idempotent: only inserts when the table is still empty.
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.temp_units (name, min_f, max_f)
SELECT * FROM (VALUES
  ('Walk-in Cooler', 33, 40),
  ('Beer Cooler',    33, 40),
  ('Raw Bar / Seafood', 30, 38),
  ('Reach-in Freezer', -10, 10)
) AS seed(name, min_f, max_f)
WHERE NOT EXISTS (SELECT 1 FROM public.temp_units);
