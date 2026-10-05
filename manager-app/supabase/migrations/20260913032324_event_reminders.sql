create table public.event_reminders (
 id text primary key, source text not null check(source in ('party','event')),
 source_id bigint not null, event_date date not null, lead_days integer not null check(lead_days in (0,1,7)),
 title text not null, body text not null, url text not null,
 created_at timestamptz not null default now(), push_sent_at timestamptz, push_claimed_at timestamptz
);
alter table public.event_reminders enable row level security;
create policy managers_read_reminders on public.event_reminders for select to authenticated using(public.has_role(array['owner','manager']));
grant select on public.event_reminders to authenticated;
create table public.event_reminder_config (id boolean primary key default true check(id), scheduler_token text not null default encode(extensions.gen_random_bytes(32),'hex'));
alter table public.event_reminder_config enable row level security;
revoke all on public.event_reminder_config from anon, authenticated;
insert into public.event_reminder_config(id) values(true);
alter publication supabase_realtime add table public.event_reminders;
select cron.schedule('event-reminders', '*/15 * * * *', $job$
 select net.http_post(
 url := 'https://nouxyrqpulkbjusriugx.supabase.co/functions/v1/event-reminders',
 headers := jsonb_build_object('Content-Type','application/json','x-reminder-key',(select scheduler_token from public.event_reminder_config where id)),
 body := '{}'::jsonb
 );
$job$);
