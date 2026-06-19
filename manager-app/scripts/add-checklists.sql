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
