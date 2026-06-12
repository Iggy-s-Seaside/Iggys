import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar as CalIcon, Loader2, AlertTriangle, MapPin, PartyPopper, RefreshCw, Globe } from 'lucide-react';
import { format, parseISO, isSameDay } from 'date-fns';
import { listCalendarEvents, type CalendarEvent } from '../lib/partyActions';
import { useParties } from '../hooks/useParties';
import { PromoteEventModal } from '../components/calendar/PromoteEventModal';
import { PARTY_STATUS_LABELS, type PartyStatus } from '../types';

const STATUS_BADGE: Record<PartyStatus, string> = {
  inquiry: 'badge-accent',
  confirmed: 'badge-success',
  cancelled: 'badge-danger',
};

function eventTime(ev: CalendarEvent): string {
  if (ev.allDay) return 'All day';
  try {
    const s = format(parseISO(ev.start), 'h:mm a');
    const e = ev.end ? format(parseISO(ev.end), 'h:mm a') : '';
    return e ? `${s} – ${e}` : s;
  } catch {
    return '';
  }
}

function dayKey(iso: string): string {
  try { return format(parseISO(iso), 'yyyy-MM-dd'); } catch { return iso.slice(0, 10); }
}

export function Calendar() {
  const { parties } = useParties();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [calLoading, setCalLoading] = useState(true);
  const [calError, setCalError] = useState<string | null>(null);
  const [promoting, setPromoting] = useState<CalendarEvent | null>(null);

  const loadEvents = async () => {
    setCalLoading(true);
    setCalError(null);
    try {
      const now = new Date();
      const in60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
      const result = await listCalendarEvents(now.toISOString(), in60.toISOString());
      setEvents(result);
    } catch (err) {
      setCalError(err instanceof Error ? err.message : 'Could not load the calendar');
    }
    setCalLoading(false);
  };

  useEffect(() => {
    loadEvents();
  }, []);

  // Group Google events by day
  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      if (!ev.start) continue;
      const key = dayKey(ev.start);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [events]);

  const upcomingParties = useMemo(() => {
    const todayKey = format(new Date(), 'yyyy-MM-dd');
    return parties
      .filter((p) => p.status !== 'cancelled' && p.event_date && p.event_date >= todayKey)
      .sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''))
      .slice(0, 12);
  }, [parties]);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Calendar</h1>
          <p className="text-sm text-text-muted mt-1">Live from the Iggy's events Google Calendar</p>
        </div>
        <button onClick={loadEvents} disabled={calLoading} className="btn-secondary text-sm">
          {calLoading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Refresh
        </button>
      </div>

      {/* Google Calendar agenda */}
      <div className="card overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <CalIcon size={16} className="text-primary" />
          <h2 className="font-semibold text-text-primary">Next 60 days</h2>
        </div>

        {calLoading ? (
          <div className="p-8 flex justify-center"><Loader2 size={24} className="animate-spin text-primary" /></div>
        ) : calError ? (
          <div className="p-6">
            <div className="flex items-start gap-2 rounded-lg bg-warning-light p-3 text-xs text-accent-hover">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Calendar not connected yet.</p>
                <p className="mt-1 text-text-secondary">{calError}</p>
              </div>
            </div>
          </div>
        ) : grouped.length === 0 ? (
          <div className="p-8 text-center text-text-muted text-sm">No events in the next 60 days.</div>
        ) : (
          <div className="divide-y divide-border">
            {grouped.map(([key, dayEvents]) => {
              const date = parseISO(key);
              const today = isSameDay(date, new Date());
              return (
                <div key={key} className="px-5 py-3">
                  <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${today ? 'text-primary' : 'text-text-muted'}`}>
                    {format(date, 'EEE, MMM d')}{today ? ' · Today' : ''}
                  </p>
                  <div className="space-y-2">
                    {dayEvents.map((ev) => (
                      <div key={ev.id} className="flex items-start gap-3 group">
                        <div className="w-1 self-stretch rounded-full bg-primary/40 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-text-primary">{ev.summary}</p>
                          <p className="text-xs text-text-muted">{eventTime(ev)}</p>
                          {ev.location && (
                            <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                              <MapPin size={10} /> {ev.location}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => setPromoting(ev)}
                          title="Add to the public events page"
                          className="shrink-0 self-center flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover px-2 py-1 rounded-lg hover:bg-primary/5 transition-colors sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          <Globe size={13} /> <span className="hidden sm:inline">Add to public</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upcoming parties (from the app) */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PartyPopper size={16} className="text-primary" />
            <h2 className="font-semibold text-text-primary">Upcoming parties</h2>
          </div>
          <Link to="/parties" className="text-sm text-primary hover:text-primary-hover">View all</Link>
        </div>
        {upcomingParties.length === 0 ? (
          <div className="p-8 text-center text-text-muted text-sm">No upcoming parties.</div>
        ) : (
          <div className="divide-y divide-border">
            {upcomingParties.map((p) => (
              <Link key={p.id} to={`/parties/${p.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-hover transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-text-primary truncate">{p.title?.trim() || p.contact_name}</p>
                    <span className={STATUS_BADGE[p.status]}>{PARTY_STATUS_LABELS[p.status]}</span>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">
                    {p.event_date ? format(parseISO(p.event_date), 'EEE, MMM d, yyyy') : ''}
                    {p.start_time ? ` · ${p.start_time}` : ''}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {promoting && (
        <PromoteEventModal
          event={promoting}
          onClose={() => setPromoting(null)}
          onPromoted={() => { /* public events page reads from Supabase on next load */ }}
        />
      )}
    </div>
  );
}
