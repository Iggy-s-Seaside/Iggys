-- ============================================================
-- Iggy's — NEW TABLE TEMPLATE (Data API grants)
-- Run in: Supabase Dashboard > SQL Editor (test on a Supabase branch first)
--
-- WHY THIS EXISTS:
-- As of Oct 30, 2026, tables newly created in the `public` schema are
-- NOT automatically exposed to the Data API. Without the GRANTs in
-- step 2, supabase-js / PostgREST / GraphQL cannot see the table at all
-- (the query fails before RLS is even evaluated).
-- Existing tables are unaffected — this only matters for NEW tables.
-- Ref: https://github.com/orgs/supabase/discussions/45329
--
-- Copy this whole block for each new table and keep all 3 steps together.
-- ============================================================

-- ---- 1. Create the table -----------------------------------------------
create table if not exists public.your_table (
  id          bigint generated always as identity primary key,
  created_at  timestamptz default now(),
  -- your columns here
  active      boolean default true
);

-- ---- 2. GRANTS (required — without these the table is invisible) -------
grant select                         on public.your_table to anon;          -- customer site: read-only
grant select, insert, update, delete on public.your_table to authenticated; -- manager dashboard: full CRUD
-- NOTE: if you ever use `serial` instead of identity, also grant the sequence:
--   grant usage, select on sequence public.your_table_id_seq to authenticated;

-- ---- 3. Row Level Security + policies ----------------------------------
alter table public.your_table enable row level security;

-- NOTE: Postgres has no `CREATE POLICY IF NOT EXISTS`, so drop-then-create
-- to stay idempotent (re-runnable without errors).
drop policy if exists "Public read" on public.your_table;
create policy "Public read" on public.your_table
  for select using (true);

drop policy if exists "Auth insert" on public.your_table;
create policy "Auth insert" on public.your_table
  for insert to authenticated with check (true);

drop policy if exists "Auth update" on public.your_table;
create policy "Auth update" on public.your_table
  for update to authenticated using (true) with check (true);

drop policy if exists "Auth delete" on public.your_table;
create policy "Auth delete" on public.your_table
  for delete to authenticated using (true);


-- ========================================================================
-- EXAMPLE: "group packages" (website feature — listing party/event packages)
-- Uncomment, adjust columns, and run.
-- ========================================================================
-- create table if not exists public.group_packages (
--   id          bigint generated always as identity primary key,
--   created_at  timestamptz default now(),
--   title       text not null,
--   description text,
--   price       text,                 -- text to match how `specials.price` is stored
--   sort_order  int     default 0,
--   active      boolean default true
-- );
--
-- grant select                         on public.group_packages to anon;
-- grant select, insert, update, delete on public.group_packages to authenticated;
--
-- alter table public.group_packages enable row level security;
--
-- drop policy if exists "Public read" on public.group_packages;
-- create policy "Public read" on public.group_packages for select using (true);
-- drop policy if exists "Auth insert" on public.group_packages;
-- create policy "Auth insert" on public.group_packages for insert to authenticated with check (true);
-- drop policy if exists "Auth update" on public.group_packages;
-- create policy "Auth update" on public.group_packages for update to authenticated using (true) with check (true);
-- drop policy if exists "Auth delete" on public.group_packages;
-- create policy "Auth delete" on public.group_packages for delete to authenticated using (true);
