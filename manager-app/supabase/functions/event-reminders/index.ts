import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildEventReminders, occursOn, pacificDay } from './schedule.ts';

Deno.serve(async (req) => {
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const key = req.headers.get('x-reminder-key');
  if (!key) return json({ error: 'Unauthorized' }, 401);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const { data: config, error: configError } = await admin.from('event_reminder_config').select('scheduler_token').eq('id', true).single();
    if (configError) throw configError;
    if (key !== config.scheduler_token) return json({ error: 'Unauthorized' }, 401);
    const now = new Date();
    const { error: seasonError } = await admin.from('events').update({ active: false }).eq('is_recurring', true).eq('active', true).lt('recurring_until', pacificDay(now));
    if (seasonError) throw seasonError;
    const [p, e] = await Promise.all([
      admin.from('parties').select('id,title,contact_name,event_date,status,start_min,space,all_day').eq('status', 'confirmed').gte('event_date', pacificDay(now)),
      admin.from('events').select('id,title,date,active,is_recurring,recurring_day,recurring_until,start_min,all_day').eq('active', true),
    ]);
    if (p.error || e.error) throw p.error || e.error;
    // Remove reminders whose source was cancelled, moved, deleted or switched off.
    const { data: saved, error: savedError } = await admin.from('event_reminders').select('id,source,source_id,event_date').gte('event_date', pacificDay(now));
    if (savedError) throw savedError;
    const stale = (saved || []).filter(r => !(r.source === 'party' ? p.data : e.data)?.some(s => s.id === r.source_id && occursOn(s, r.source, r.event_date))).map(r => r.id);
    if (stale.length) { const { error } = await admin.from('event_reminders').delete().in('id', stale); if (error) throw error; }
    const due = buildEventReminders(p.data || [], e.data || [], now);
    if (due.length) { const { error } = await admin.from('event_reminders').upsert(due, { onConflict: 'id', ignoreDuplicates: true }); if (error) throw error; }
    let sent = 0;
    for (const reminder of due) {
      const { data: claimed, error } = await admin.from('event_reminders').update({ push_claimed_at: now.toISOString(), title: reminder.title, body: reminder.body })
        .eq('id', reminder.id).is('push_sent_at', null)
        .or(`push_claimed_at.is.null,push_claimed_at.lt.${new Date(now.getTime() - 10 * 60_000).toISOString()}`).select('id');
      if (error) throw error;
      if (!claimed?.length) continue;
      const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/web-push`, {
        method: 'POST', headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: reminder.title, body: reminder.body, url: reminder.url, tag: reminder.id }),
      });
      if (!response.ok) throw new Error(`Push sender returned ${response.status}`);
      const result = await response.json();
      const { error: updateError } = await admin.from('event_reminders').update({ push_claimed_at: null, ...(result.sent > 0 ? { push_sent_at: now.toISOString() } : {}) }).eq('id', reminder.id);
      if (updateError) throw updateError;
      sent += result.sent || 0;
    }
    return json({ reminders: due.length, sent });
  } catch (error) { console.error('event-reminders:', error); return json({ error: 'Event reminders could not complete' }, 500); }
});
