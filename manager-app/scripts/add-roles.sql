-- ============================================================
-- Iggy's — RBAC: three-role model (owner | manager | employee)
-- Run in: Supabase Dashboard > SQL Editor (or via Supabase MCP apply_migration)
--
-- WHY THIS EXISTS:
-- Auth was binary — any allow-listed login was a full manager. This adds a
-- per-account `role` to public.manager_allowlist plus two SECURITY DEFINER
-- helpers (get_my_role / has_role) so both the client and future RLS policies
-- can ask "what may this caller do?" without trusting client-sent claims.
--
-- Roles:
--   owner    — Bradley / family. Full access.
--   manager  — operational. Everything except owner-only admin.
--   employee — waitlist + own schedule + checklists only. (DEFAULT, fail-closed)
--
-- Idempotent & re-runnable: ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE,
-- and a guarded constraint add.
-- ============================================================

-- ---- 1. role column on the allowlist ----------------------------------
alter table public.manager_allowlist
  add column if not exists role text not null default 'employee';

-- CHECK constraint — Postgres has no "ADD CONSTRAINT IF NOT EXISTS", so guard it.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.manager_allowlist'::regclass
      and conname = 'manager_allowlist_role_check'
  ) then
    alter table public.manager_allowlist
      add constraint manager_allowlist_role_check
      check (role in ('owner', 'manager', 'employee'));
  end if;
end $$;

-- ---- 2. backfill: the bar owner -> owner; existing crew -> manager -----
-- Bradley/family is the owner.
update public.manager_allowlist
   set role = 'owner'
 where lower(email) = lower('bradleyb1rd@icloud.com');

-- Everyone already on the allowlist before roles existed was a full manager;
-- preserve that (only touch the rows still sitting on the new default).
update public.manager_allowlist
   set role = 'manager'
 where role = 'employee'
   and lower(email) <> lower('bradleyb1rd@icloud.com');

-- ---- 3. get_my_role() — caller's role, fail-closed to employee --------
-- SECURITY DEFINER so it can read the allowlist regardless of RLS; STABLE
-- because it only reads. auth.email() is the verified JWT email.
create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role
       from public.manager_allowlist
      where lower(email) = lower(auth.email())
      limit 1),
    'employee'
  );
$$;

-- ---- 4. has_role(roles text[]) — is caller in this set? ---------------
-- Fail-closed: an unknown/absent caller is treated as 'employee'.
create or replace function public.has_role(roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role
       from public.manager_allowlist
      where lower(email) = lower(auth.email())
      limit 1),
    'employee'
  ) = any(roles);
$$;

-- ---- 5. grants --------------------------------------------------------
grant execute on function public.get_my_role()        to authenticated;
grant execute on function public.has_role(text[])     to authenticated;
