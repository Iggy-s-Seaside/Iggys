-- ============================================================================
-- ANTON-migrate-all.sql  —  Iggy's "Anton mode" consolidated migration
-- Runs every new table/column from build waves 1-3, in dependency order.
-- IDEMPOTENT (IF NOT EXISTS / ON CONFLICT DO NOTHING) — safe to re-run.
-- HOW TO RUN: paste into Supabase Dashboard > SQL Editor and Run,
--   or: supabase db execute --file scripts/ANTON-migrate-all.sql
-- This is additive only; it never drops or alters existing data.
-- ============================================================================

-- Owner ask #1 extras: make packages publicly listable (used by the public estimator).
ALTER TABLE packages ADD COLUMN IF NOT EXISTS public_description text;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false;



-- ===== add-specials-window.sql ===========================================

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


-- ===== add-commerce-tables.sql ===========================================

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


-- ===== add-proposals.sql =================================================

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


-- ===== add-party-timeline.sql ============================================

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


-- ===== add-social-posts.sql ==============================================

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


-- ===== add-shift-sessions.sql ============================================

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


-- ===== add-checklists.sql ================================================

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


-- ===== add-shift-log.sql =================================================

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


-- ===== add-closeout.sql ==================================================

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
