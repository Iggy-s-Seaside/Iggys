export interface ScheduledSource {
  id: number; title?: string | null; contact_name?: string; date?: string;
  event_date?: string | null; active?: boolean; status?: string;
  is_recurring?: boolean; recurring_day?: string | null; recurring_until?: string | null; start_min?: number | null;
  end_min?: number | null; all_day?: boolean; space?: string | null;
}
export interface EventReminder {
  id: string; source: 'party' | 'event'; source_id: number; event_date: string;
  lead_days: number; title: string; body: string; url: string;
}
export function pacificDay(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function addDateDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
}
export function occursOn(row: ScheduledSource, source: 'party' | 'event', day: string): boolean {
  if (source === 'party') return row.status === 'confirmed' && row.event_date === day;
  if (!row.active || !row.date || row.date > day) return false;
  if (row.recurring_until && day > row.recurring_until) return false;
  if (!row.is_recurring) return row.date === day;
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' }).format(new Date(`${day}T12:00:00Z`));
  return weekday.toLowerCase() === row.recurring_day?.trim().toLowerCase();
}
function timeLabel(min: number | null | undefined): string {
  if (min == null) return 'Time to confirm';
  const hours = Math.floor(min / 60) % 24;
  return `${hours % 12 || 12}:${String(min % 60).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
}
/** Shared by the hourly worker and tests. No invented dates or reminders for cancelled events. */
export function buildEventReminders(parties: ScheduledSource[], events: ScheduledSource[], now = new Date()): EventReminder[] {
  const today = pacificDay(now);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const minute = Number(parts.find((p) => p.type === 'hour')?.value) * 60 + Number(parts.find((p) => p.type === 'minute')?.value);
  const out: EventReminder[] = [];
  for (const lead of [7, 1, 0]) {
    const day = addDateDays(today, lead);
    for (const source of ['party', 'event'] as const) {
      for (const row of source === 'party' ? parties : events) {
        if (!occursOn(row, source, day)) continue;
        const dueMinute = lead === 0 && !row.all_day && row.start_min != null ? Math.min(540, Math.max(0, row.start_min - 60)) : 540;
        if (minute < dueMinute) continue;
        if (lead === 0 && !row.all_day && row.start_min != null && minute >= row.start_min) continue;
        const label = row.title?.trim() || row.contact_name || (source === 'party' ? 'Private booking' : 'Public event');
        const when = lead === 7 ? 'In one week' : lead === 1 ? 'Tomorrow' : 'Today';
        const time = row.all_day ? 'All day' : timeLabel(row.start_min);
        out.push({ id: `${source}:${row.id}:${day}:${lead}`, source, source_id: row.id, event_date: day, lead_days: lead,
          title: `${when}: ${label}`, body: `${day} · ${time}${row.space ? ` · ${row.space}` : ''}. Review the event details.`,
          url: source === 'party' ? `/parties/${row.id}` : `/events/${row.id}/edit` });
      }
    }
  }
  return out;
}
