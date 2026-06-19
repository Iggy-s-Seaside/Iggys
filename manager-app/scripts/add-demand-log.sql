-- ============================================================
-- Iggy's — demand_log (the pulse forecast-vs-actual trust loop)
-- Applied to prod 2026-06-15 (migration add_special_kind_and_demand_log).
-- Captured here for reproducibility. Idempotent.
--
-- The Luna bridge upserts predicted_band/score/drivers when it posts the daily
-- pulse; the manager logs actual_band via the dashboard close-out card. One row
-- per business day. Also extends luna_insights.kind to allow 'pulse' + 'special'.
-- ============================================================

-- luna_insights kinds: pulse (daily demand read) + special (creative special-of-the-day)
alter table public.luna_insights drop constraint if exists luna_insights_kind_check;
alter table public.luna_insights add constraint luna_insights_kind_check
  check (kind = any (array['briefing','alert','suggestion','note','pulse','special']::text[]));

create table if not exists public.demand_log (
  id serial primary key,
  business_day date not null unique,
  predicted_band text,
  predicted_score integer,
  drivers jsonb,
  actual_band text,
  hotels_full boolean,
  noted_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.demand_log enable row level security;

drop policy if exists "Auth read demand_log" on public.demand_log;
create policy "Auth read demand_log" on public.demand_log for select to authenticated using (true);
drop policy if exists "Auth insert demand_log" on public.demand_log;
create policy "Auth insert demand_log" on public.demand_log for insert to authenticated with check (true);
drop policy if exists "Auth update demand_log" on public.demand_log;
create policy "Auth update demand_log" on public.demand_log for update to authenticated using (true) with check (true);

grant select, insert, update on public.demand_log to authenticated;
grant usage, select on sequence public.demand_log_id_seq to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'luna_bridge') then
    grant select, insert, update on public.demand_log to luna_bridge;
    grant usage, select on sequence public.demand_log_id_seq to luna_bridge;
    drop policy if exists "Bridge demand_log" on public.demand_log;
    create policy "Bridge demand_log" on public.demand_log for all to luna_bridge using (true) with check (true);
  end if;
end $$;
