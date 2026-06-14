import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar as CalIcon,
  Loader2,
  AlertTriangle,
  MapPin,
  PartyPopper,
  RefreshCw,
  Globe,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from 'lucide-react';
import {
  format,
  parseISO,
  isSameDay,
  startOfMonth,
  addMonths,
  subMonths,
} from 'date-fns';
import { listCalendarEvents, type CalendarEvent } from '../lib/partyActions';
import { useParties } from '../hooks/useParties';
import { PromoteEventModal } from '../components/calendar/PromoteEventModal';
import { MonthGrid, type DayChip } from '../components/calendar/MonthGrid';
import { Sheet } from '../components/ui/Sheet';
import { PARTY_STATUS_LABELS, type Party, type PartyStatus } from '../types';

const STATUS_BADGE: Record<PartyStatus, string> = {
  inquiry: 'badge-accent',
  confirmed: 'badge-success',
  cancelled: 'badge-danger',
};

// Party status → grid chip tone.
const PARTY_TONE: Record<PartyStatus, DayChip['tone']> = {
  inquiry: 'accent',
  confirmed: 'success',
  cancelled: 'muted',
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

type View = 'month' | 'list';

export function Calendar() {
  const { parties } = useParties();
  const navigate = useNavigate();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [calLoading, setCalLoading] = useState(true);
  const [calError, setCalError] = useState<string | null>(null);
  const [promoting, setPromoting] = useState<CalendarEvent | null>(null);
  const [view, setView] = useState<View>('month');
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  // The day picked in the grid that drives the create chooser sheet.
  const [chooserDay, setChooserDay] = useState<string | null>(null);

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

  // Group Google events by day (used by the agenda list).
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

  // Confirmed/inquiry parties with a date, for the month grid.
  const gridParties = useMemo(
    () => parties.filter((p): p is Party & { event_date: string } =>
      p.status !== 'cancelled' && !!p.event_date),
    [parties]
  );

  // Chips per day = Google events + app parties, keyed by yyyy-MM-dd.
  const chipsByDay = useMemo(() => {
    const map: Record<string, DayChip[]> = {};
    const push = (key: string, chip: DayChip) => {
      (map[key] ??= []).push(chip);
    };
    for (const ev of events) {
      if (!ev.start) continue;
      push(dayKey(ev.start), {
        key: `ev-${ev.id}`,
        label: ev.summary || 'Event',
        tone: 'primary',
        onClick: () => setPromoting(ev),
      });
    }
    for (const p of gridParties) {
      push(p.event_date, {
        key: `party-${p.id}`,
        label: p.title?.trim() || p.contact_name || 'Party',
        tone: PARTY_TONE[p.status],
        onClick: () => navigate(`/parties/${p.id}`),
      });
    }
    return map;
  }, [events, gridParties, navigate]);

  // A day is a "conflict" when more than one booking shares it. Mirrors the
  // same-date flag the Parties list uses, but spans events + parties together.
  const conflictDays = useMemo(() => {
    const set = new Set<string>();
    for (const [key, chips] of Object.entries(chipsByDay)) {
      if (chips.length > 1) set.add(key);
    }
    return set;
  }, [chipsByDay]);

  // Tapping a day → create chooser. We pass the date along to both create flows
  // via `?date=`; the forms accept it forward-compatibly (see integration note).
  const goNewParty = () => {
    if (!chooserDay) return;
    setChooserDay(null);
    navigate(`/parties?new=1&date=${chooserDay}`);
  };
  const goNewEvent = () => {
    if (!chooserDay) return;
    setChooserDay(null);
    navigate(`/events/new?date=${chooserDay}`);
  };

  const chooserLabel = chooserDay
    ? format(parseISO(chooserDay), 'EEEE, MMMM d')
    : '';

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Calendar</h1>
          <p className="text-sm text-text-muted mt-1">Events, parties &amp; the Iggy's Google Calendar</p>
        </div>
        <button onClick={loadEvents} disabled={calLoading} className="btn-secondary text-sm">
          {calLoading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Refresh
        </button>
      </div>

      {/* View toggle */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="inline-flex gap-1" role="tablist" aria-label="Calendar view">
          {(['month', 'list'] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
                view === v ? 'bg-primary text-white' : 'bg-surface-hover text-text-secondary hover:bg-surface-active'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {view === 'month' && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMonth((m) => subMonths(m, 1))}
              aria-label="Previous month"
              className="p-2 rounded-lg text-text-muted hover:bg-surface-hover transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="min-w-[8.5rem] text-center text-sm font-semibold text-text-primary tabular-nums">
              {format(month, 'MMMM yyyy')}
            </span>
            <button
              onClick={() => setMonth((m) => addMonths(m, 1))}
              aria-label="Next month"
              className="p-2 rounded-lg text-text-muted hover:bg-surface-hover transition-colors"
            >
              <ChevronRight size={18} />
            </button>
            <button
              onClick={() => setMonth(startOfMonth(new Date()))}
              className="btn-ghost text-sm ml-1"
            >
              Today
            </button>
          </div>
        )}
      </div>

      {view === 'month' ? (
        <>
          {calLoading ? (
            <div className="card p-12 flex justify-center">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          ) : (
            <MonthGrid
              month={month}
              chipsByDay={chipsByDay}
              conflictDays={conflictDays}
              onSelectDay={setChooserDay}
            />
          )}

          {calError && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-warning-light p-3 text-xs text-accent-hover">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Google Calendar not connected.</p>
                <p className="mt-1 text-text-secondary">Parties still show below. {calError}</p>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-muted">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-primary/40" /> Calendar event</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-success" /> Confirmed party</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-accent" /> Inquiry</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-accent" /> Shared date</span>
          </div>
          <p className="mt-2 text-xs text-text-muted">Tap any day to add a party or event.</p>
        </>
      ) : (
        <>
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
        </>
      )}

      {/* Create chooser — opened by tapping a day in the month grid. */}
      <Sheet
        open={chooserDay !== null}
        onClose={() => setChooserDay(null)}
        title={chooserLabel ? `Add for ${chooserLabel}` : 'Add'}
        maxWidth="max-w-sm"
      >
        <div className="grid grid-cols-1 gap-2.5 pt-1">
          <button
            onClick={goNewParty}
            className="card-hover flex items-center gap-3 p-3.5 text-left active:scale-[0.98] transition-transform min-h-[60px]"
          >
            <span className="flex items-center justify-center w-11 h-11 rounded-xl shrink-0 bg-primary/10 text-primary">
              <PartyPopper size={22} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-text-primary">New Party</span>
              <span className="block text-xs text-text-muted">Booking inquiry for this date</span>
            </span>
          </button>
          <button
            onClick={goNewEvent}
            className="card-hover flex items-center gap-3 p-3.5 text-left active:scale-[0.98] transition-transform min-h-[60px]"
          >
            <span className="flex items-center justify-center w-11 h-11 rounded-xl shrink-0 bg-primary/10 text-primary">
              <CalendarDays size={22} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-text-primary">New Event</span>
              <span className="block text-xs text-text-muted">Add to the events calendar</span>
            </span>
          </button>
        </div>
      </Sheet>

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
