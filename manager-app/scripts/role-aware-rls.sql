-- ============================================================
-- Iggy's — Role-aware RLS for financial / PII tables
-- Applied to prod 2026-06-15 (Supabase migration role_aware_rls_financial_pii).
-- Captured here so a clean rebuild reproduces prod (the change only lived in the
-- live DB). Idempotent / re-runnable.
--
-- WHY: auth was effectively binary — any authenticated login (the anon key +
-- a real JWT) could hit PostgREST directly and read/alter every financial/PII
-- table, bypassing the client-side RequireRole gate. Before employee PINs are
-- issued, gate these tables to owner/manager via the has_role() helper.
-- Owner+manager keep full access; employees are denied. luna_bridge / anon /
-- service-role policies are untouched; service-role edge functions bypass RLS.
-- ============================================================

-- Role helpers (mirror add-roles.sql; CREATE OR REPLACE so policies can't
-- reference a missing function).
create or replace function public.get_my_role() returns text
  language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.manager_allowlist
    where lower(email) = lower(auth.email()) limit 1), 'employee');
$$;
create or replace function public.has_role(roles text[]) returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.manager_allowlist
    where lower(email) = lower(auth.email()) limit 1), 'employee') = any(roles);
$$;
grant execute on function public.get_my_role() to authenticated;
grant execute on function public.has_role(text[]) to authenticated;

-- Replace blanket authenticated policies with an owner/manager gate.
do $$
declare t text; pol record;
begin
  foreach t in array array[
    'cash_counts','tip_pools','gift_cards','gift_card_transactions',
    'eon_reports','price_history','credentials','staff'
  ] loop
    for pol in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t and 'authenticated' = any(roles)
    loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "ops_full_access" on public.%I for all to authenticated '
      'using (public.has_role(array[''owner'',''manager''])) '
      'with check (public.has_role(array[''owner'',''manager'']))', t);
  end loop;
end $$;

-- Close the user_templates public write/TRUNCATE hole: anon read-only,
-- authenticated full, no public writes.
drop policy if exists "Allow all" on public.user_templates;
revoke insert, update, delete, truncate on public.user_templates from anon;
drop policy if exists "Public read user_templates" on public.user_templates;
create policy "Public read user_templates" on public.user_templates for select to anon using (true);
drop policy if exists "Auth all user_templates" on public.user_templates;
create policy "Auth all user_templates" on public.user_templates for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.user_templates to authenticated;

-- NOTE (follow-up, not yet done): parties, contacts, shift_log, time_off_requests
-- are also OPS-oriented but are entangled with daily manager flows; gate them to
-- owner/manager (or owner/manager/employee where employees genuinely need them)
-- when the employee experience is mapped table-by-table.
