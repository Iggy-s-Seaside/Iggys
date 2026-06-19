-- ============================================================
-- Iggy's — PERIODIC INVENTORY COUNT + variance reconciliation
-- (Agent B — Inventory fast-track wave)
--
-- A "count session" is a slow-time exact recount of stock. We snapshot the
-- system's expected_qty (current_quantity) per item when the count starts,
-- the manager walks the list entering counted_qty, and CLOSING the count
-- reconciles the fiction: each counted_qty is written back to
-- inventory_items.current_quantity, last_counted_at is stamped, and a
-- count_adjustment row is logged in inventory_logs (handled app-side).
--
-- Idempotent: re-runnable without error (IF NOT EXISTS / drop-then-create).
-- Apply via Supabase MCP. Tables are NEW so the Data API GRANTs are required.
-- ============================================================

-- ---- 1. inventory_items: support columns for counting --------------------
-- These columns are additive and idempotent. `stock_state` may also be added
-- by the mark-low (Agent A) work; ADD COLUMN IF NOT EXISTS is a no-op if it
-- already exists, and we intentionally use a permissive text default ('ok')
-- with no CHECK constraint so it cannot collide with Agent A's definition.
alter table public.inventory_items
  add column if not exists last_counted_at timestamptz;
alter table public.inventory_items
  add column if not exists stock_state text default 'ok';

-- ---- 2. inventory_counts (the count session header) ----------------------
create table if not exists public.inventory_counts (
  id          bigint generated always as identity primary key,
  started_at  timestamptz default now(),
  finished_at timestamptz,
  counted_by  text,
  status      text not null default 'open' check (status in ('open', 'closed')),
  note        text
);

-- ---- 3. inventory_count_items (one line per item in the count) -----------
create table if not exists public.inventory_count_items (
  id                    bigint generated always as identity primary key,
  count_id              bigint not null references public.inventory_counts(id) on delete cascade,
  item_id               bigint references public.inventory_items(id) on delete set null,
  expected_qty          numeric,
  counted_qty           numeric,
  cost_per_unit_at_count numeric,
  created_at            timestamptz default now()
);

-- ---- 4. Indexes ----------------------------------------------------------
create index if not exists idx_inventory_counts_status
  on public.inventory_counts(status);
create index if not exists idx_inventory_counts_started_at
  on public.inventory_counts(started_at desc);
create index if not exists idx_inventory_count_items_count_id
  on public.inventory_count_items(count_id);
create index if not exists idx_inventory_count_items_item_id
  on public.inventory_count_items(item_id);

-- ---- 5. GRANTs (required — without these the tables are invisible) -------
grant select, insert, update, delete on public.inventory_counts      to authenticated;
grant select, insert, update, delete on public.inventory_count_items to authenticated;

-- ---- 6. Row Level Security + policies ------------------------------------
alter table public.inventory_counts      enable row level security;
alter table public.inventory_count_items enable row level security;

-- Postgres has no CREATE POLICY IF NOT EXISTS — drop-then-create to stay
-- idempotent. App convention: authenticated has full access.
drop policy if exists "Auth read counts" on public.inventory_counts;
create policy "Auth read counts" on public.inventory_counts
  for select to authenticated using (true);
drop policy if exists "Auth insert counts" on public.inventory_counts;
create policy "Auth insert counts" on public.inventory_counts
  for insert to authenticated with check (true);
drop policy if exists "Auth update counts" on public.inventory_counts;
create policy "Auth update counts" on public.inventory_counts
  for update to authenticated using (true) with check (true);
drop policy if exists "Auth delete counts" on public.inventory_counts;
create policy "Auth delete counts" on public.inventory_counts
  for delete to authenticated using (true);

drop policy if exists "Auth read count items" on public.inventory_count_items;
create policy "Auth read count items" on public.inventory_count_items
  for select to authenticated using (true);
drop policy if exists "Auth insert count items" on public.inventory_count_items;
create policy "Auth insert count items" on public.inventory_count_items
  for insert to authenticated with check (true);
drop policy if exists "Auth update count items" on public.inventory_count_items;
create policy "Auth update count items" on public.inventory_count_items
  for update to authenticated using (true) with check (true);
drop policy if exists "Auth delete count items" on public.inventory_count_items;
create policy "Auth delete count items" on public.inventory_count_items
  for delete to authenticated using (true);
