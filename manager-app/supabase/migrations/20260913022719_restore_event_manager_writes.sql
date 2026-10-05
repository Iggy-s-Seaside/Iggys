-- Events had public SELECT policies but no manager writes. UPDATE and DELETE
-- therefore affected zero rows while the optimistic UI appeared to succeed.
-- Use the same allowlist role check as the manager app's Ops routes.
alter table public.events enable row level security;

create policy "Managers insert events" on public.events
  for insert to authenticated
  with check ((select public.has_role(array['owner', 'manager'])));

create policy "Managers update events" on public.events
  for update to authenticated
  using ((select public.has_role(array['owner', 'manager'])))
  with check ((select public.has_role(array['owner', 'manager'])));

create policy "Managers delete events" on public.events
  for delete to authenticated
  using ((select public.has_role(array['owner', 'manager'])));
