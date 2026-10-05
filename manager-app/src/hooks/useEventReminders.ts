import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { pacificDay } from '../../supabase/functions/event-reminders/schedule';
import type { EventReminder } from '../../supabase/functions/event-reminders/schedule';
import { uniqueTopic } from '../lib/realtimeTopic';
export type SavedReminder = EventReminder & { created_at: string; push_sent_at: string | null };

export function useEventReminders() {
  const [reminders, setReminders] = useState<SavedReminder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from('event_reminders').select('*')
      .gte('event_date', pacificDay()).order('event_date').order('created_at', { ascending: false }).limit(100);
    setError(error?.message || null);
    if (!error) {
      const unique = new Map<string, SavedReminder>();
      for (const row of data || []) {
        const key = `${row.source}:${row.source_id}:${row.event_date}`;
        if (!unique.has(key)) unique.set(key, { ...row, title: `${row.event_date === pacificDay() ? 'Today' : row.event_date}: ${row.title.replace(/^(In one week|Tomorrow|Today): /, '')}` });
      }
      setReminders([...unique.values()]);
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(refresh, 60_000);
    const channel = supabase.channel(uniqueTopic('event-reminders')).on('postgres_changes', { event: '*', schema: 'public', table: 'event_reminders' }, refresh).subscribe();
    return () => { clearInterval(timer); void supabase.removeChannel(channel); };
  }, [refresh]);
  return { reminders, loading, error, refresh };
}
