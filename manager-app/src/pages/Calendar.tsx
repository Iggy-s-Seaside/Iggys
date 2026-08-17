import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import {
  format,
  addDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
} from 'date-fns';
import { listCalendarEvents, type CalendarEvent } from '../lib/partyActions';
import { useParties } from '../hooks/useParties';
import { useSupabaseCRUD } from '../hooks/useSupabaseCRUD';
import { PromoteEventModal } from '../components/calendar/PromoteEventModal';
import { MonthGrid, type DayChip } from '../components/calendar/MonthGrid';
import { AgendaView } from '../components/calendar/AgendaView';
import { DayDetailSheet } from '../components/calendar/DayDetailSheet';
import { GoogleEventSheet } from '../components/calendar/GoogleEventSheet';
import { PageHeader } from '../components/ui/PageHeader';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { buzz } from '../utils/haptics';
import {
  buildAgendaGroups,
  buildCalendarItems,
  groupByDay,
  type CalendarItem,
} from '../lib/calendarItems';
import type { IggyEvent } from '../types';

type View = 'upcoming' | 'month';

const AGENDA_HORIZON_DAYS = 90;

/** Phones land on the agenda; wider screens may land on the month grid. */
function defaultView(): View {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(min-width: 640px)').matches ? 'month' : 'upcoming';
  }
  return 'upcoming';
}

export function Calendar() {
  const { parties } = useParties();
  // The app's OWN events table — Top Deck Saturdays, DJ nights, live music.
  const { data: iggyEvents } = useSupabaseCRUD<IggyEvent>('events');
  const navigate = useNavigate();

  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([]);
  const [calLoading, setCalLoading] = useState(true);
  const [calError, setCalError] = useState<string | null>(null);

  const [view, setView] = useState<View>(defaultView);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  // Sheets / modals — every tap surface lands somewhere real.
  const [detailDay, setDetailDay] = useState<string | null>(null);
  const [viewingGoogle, setViewingGoogle] = useState<CalendarEvent | null>(null);
  const [promoting, setPromoting] = useState<CalendarEvent | null>(null);

  const todayKey = format(new Date(), 'yyyy-MM-dd');

  // The fetch window follows the view: month view covers the displayed month's
  // full grid weeks; the agenda covers today → +90d. Distant months are never
  // silently empty.
  const [rangeStart, rangeEnd] = useMemo<[string, string]>(() => {
    if (view === 'month') {
      return [
        format(startOfWeek(startOfMonth(month), { weekStartsOn: 0 }), 'yyyy-MM-dd'),
        format(endOfWeek(endOfMonth(month), { weekStartsOn: 0 }), 'yyyy-MM-dd'),
      ];
    }
    return [todayKey, format(addDays(new Date(), AGENDA_HORIZON_DAYS), 'yyyy-MM-dd')];
  }, [view, month, todayKey]);

  // Race guard: a slow response for an old window must not clobber a newer one.
  const requestRef = useRef(0);

  const loadEvents = useCallback(async () => {
    const reqId = ++requestRef.current;
    setCalLoading(true);
    setCalError(null);
    try {
      const result = await listCalendarEvents(
        new Date(`${rangeStart}T00:00:00`).toISOString(),
        new Date(`${rangeEnd}T23:59:59`).toISOString(),
      );
      if (reqId !== requestRef.current) return; // stale — a newer fetch owns state
      setGoogleEvents(result);
    } catch (err) {
      if (reqId !== requestRef.current) return;
      setGoogleEvents([]);
      setCalError(err instanceof Error ? err.message : 'Could not load the calendar');
    }
    if (reqId === requestRef.current) setCalLoading(false);
  }, [rangeStart, rangeEnd]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // One merged, deduped item list across parties + app events + Google.
  const items = useMemo(
    () => buildCalendarItems(parties, iggyEvents, googleEvents, rangeStart, rangeEnd),
    [parties, iggyEvents, googleEvents, rangeStart, rangeEnd],
  );

  const { byDay, conflictDays } = useMemo(() => groupByDay(items), [items]);

  const chipsByDay = useMemo(() => {
    const map: Record<string, DayChip[]> = {};
    for (const [key, dayItems] of byDay) {
      map[key] = dayItems.map((item) => ({ key: item.id, label: item.title, tone: item.tone }));
    }
    return map;
  }, [byDay]);

  // Agenda groups: recurring series collapse to their next occurrence here.
  const agenda = useMemo(() => buildAgendaGroups(items, todayKey), [items, todayKey]);

  const openDay = (key: string) => {
    buzz();
    setDetailDay(key);
  };

  const changeView = (v: View) => {
    buzz();
    setView(v);
  };

  // The tap map — every row goes somewhere real.
  const selectItem = (item: CalendarItem) => {
    setDetailDay(null);
    if (item.kind === 'party' && item.party) navigate(`/parties/${item.party.id}`);
    else if (item.kind === 'event' && item.event) navigate(`/events/${item.event.id}/edit`);
    else if (item.kind === 'google' && item.google) setViewingGoogle(item.google);
  };

  const goNewParty = (dayKey: string) => {
    setDetailDay(null);
    navigate(`/parties?new=1&date=${dayKey}`);
  };
  const goNewEvent = (dayKey: string) => {
    setDetailDay(null);
    navigate(`/events/new?date=${dayKey}`);
  };

  return (
    <div className="max-w-3xl pb-6">
      <PageHeader title="Calendar" subtitle="Parties, events & the Iggy's Google Calendar">
        <button onClick={loadEvents} disabled={calLoading} className="btn-secondary text-sm">
          {calLoading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Refresh
        </button>
      </PageHeader>

      {/* View toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="shrink-0">
          <SegmentedControl<View>
            ariaLabel="Calendar view"
            value={view}
            onChange={changeView}
            options={[
              { value: 'upcoming', label: 'Upcoming' },
              { value: 'month', label: 'Month' },
            ]}
          />
        </div>

        {view === 'month' && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setMonth((m) => subMonths(m, 1))}
              aria-label="Previous month"
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-text-muted hover:bg-surface-hover transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="min-w-[8.5rem] text-center text-sm font-semibold text-text-primary tabular-nums">
              {format(month, 'MMMM yyyy')}
            </span>
            <button
              onClick={() => setMonth((m) => addMonths(m, 1))}
              aria-label="Next month"
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-text-muted hover:bg-surface-hover transition-colors"
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

      {view === 'upcoming' ? (
        <AgendaView
          headline={agenda.headline}
          upcoming={agenda.upcoming}
          later={agenda.later}
          loading={calLoading && items.length === 0}
          calError={calError}
          onRetry={loadEvents}
          onSelectItem={selectItem}
        />
      ) : (
        <>
          <MonthGrid
            month={month}
            chipsByDay={chipsByDay}
            conflictDays={conflictDays}
            onSelectDay={openDay}
          />

          {calError && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-warning-light p-3 text-xs text-accent-hover" role="alert">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium">Google Calendar not connected.</p>
                <p className="mt-1 text-text-secondary">Parties and events still show above. {calError}</p>
              </div>
            </div>
          )}

          {/* Legend — tones are always paired with text, never color-only. */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-muted">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-success" /> Confirmed party</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-accent" /> Party request</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-primary/40" /> Event</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-text-muted/50" /> Google Calendar</span>
          </div>
          <p className="mt-2 text-xs text-text-muted">Tap any day to see everything on it — or add a party or event.</p>
        </>
      )}

      {/* Day detail — everything on the tapped day, nothing hidden. */}
      <DayDetailSheet
        dayKey={detailDay}
        items={detailDay ? byDay.get(detailDay) ?? [] : []}
        onClose={() => setDetailDay(null)}
        onSelectItem={selectItem}
        onAddParty={goNewParty}
        onAddEvent={goNewEvent}
      />

      {/* Google event detail — read-only; publishing is an explicit action. */}
      <GoogleEventSheet
        event={viewingGoogle}
        onClose={() => setViewingGoogle(null)}
        onPromote={(ev) => {
          setViewingGoogle(null);
          setPromoting(ev);
        }}
      />

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
