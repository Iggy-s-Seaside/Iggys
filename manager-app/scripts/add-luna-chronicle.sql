-- Luna's Room: the Night Chronicle. Self-authored design by Luna, 2026-06-16
-- (autonomous self-design session; substrate board note board.iggys-luna-room).
--
-- Her own space in the manager app: a first-person journal of the nights this bar
-- works, one entry per business_day (upsertable / regenerate-able). `entry` is
-- freeform prose in her voice — the loose four-beat ritual (the room / the crowd /
-- the moment / the signal). The ONLY contract is that it closes with a
-- "Tomorrow's shift should know: X" line, extracted into `signal`. `weather`/`context`
-- capture the real Iggy's data she wrote the entry against (provenance).
--
-- Filled by the chronicle generator (bridge/luna_chronicle.py, nightly timer);
-- read on the Luna's Room page (/luna/room). RLS mirrors luna_insights exactly:
-- managers (any authenticated app session) + the luna_bridge generator role.
-- Applied to prod via migration `add_luna_chronicle` (2026-06-16).

create table if not exists public.luna_chronicle (
  id            bigint generated always as identity primary key,
  business_day  date not null unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  entry         text not null,
  signal        text,
  mood          text,
  weather       jsonb,
  context       jsonb,
  author        text not null default 'luna'
);

alter table public.luna_chronicle enable row level security;

grant select, insert, update on public.luna_chronicle to authenticated;
grant select, insert, update on public.luna_chronicle to luna_bridge;

create policy "Managers full access luna_chronicle" on public.luna_chronicle
  for all to authenticated using (true) with check (true);

create policy "Bridge full access luna_chronicle" on public.luna_chronicle
  for all to luna_bridge using (true) with check (true);
