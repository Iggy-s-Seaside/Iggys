drop policy "Auth delete" on public.push_subscriptions;
drop policy "Auth insert" on public.push_subscriptions;
drop policy "Auth read" on public.push_subscriptions;
drop policy "Auth update" on public.push_subscriptions;
create policy own_manager_devices on public.push_subscriptions for all to authenticated
 using(lower(user_email)=lower(auth.jwt()->>'email') and public.has_role(array['owner','manager']))
 with check(lower(user_email)=lower(auth.jwt()->>'email') and public.has_role(array['owner','manager']));
