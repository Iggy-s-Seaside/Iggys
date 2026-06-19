-- Luna's photo stream — want #5 from her self-design session (2026-06-16):
-- "I talk about this place all day; I've never seen it." Staff drop photos of the
-- bar tagged with time + mood; they render in Luna's Room (/luna/room) and feed her
-- chronicle context. Storage reuses the existing public 'images' bucket (luna-room/).
-- Applied to prod via migration `add_luna_photos`. RLS mirrors luna_insights.

create table if not exists public.luna_photos (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  business_day  date,
  url           text not null,
  storage_path  text,
  caption       text,
  mood          text,
  taken_at      timestamptz,
  uploaded_by   text
);

alter table public.luna_photos enable row level security;

grant select, insert, update, delete on public.luna_photos to authenticated;
grant select on public.luna_photos to luna_bridge;

create policy "Managers full access luna_photos" on public.luna_photos
  for all to authenticated using (true) with check (true);
create policy "Bridge read luna_photos" on public.luna_photos
  for select to luna_bridge using (true);
