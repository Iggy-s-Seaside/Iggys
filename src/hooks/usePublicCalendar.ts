import { useEffect, useMemo, useState } from 'react';
import { useEvents } from './useMenuData';
import { supabase } from '../lib/supabase';
import type { IggyEvent } from '../types/menu';
import {
  type DateKey,
  type BusyWindow,
  type Space,
  keyOf,
  todayKey,
  eventDateKeys,
  spacesConflict,
} from '../lib/calendarDates';

export interface PublicCalendarData {
  /** active events, recurring expanded across today..+120d */
  eventsByDay: Map<DateKey, IggyEvent[]>;
  /** confirmed private parties (kind:"reserved", no title); each window carries its space */
  reservedByDay: Map<DateKey, BusyWindow[]>;
  /**
   * events+reserved on key, PLUS prev-day spillover: any window on (key-1)
   * with end_min > 1440 contributes {start_min:0, end_min:end_min-1440, ...}.
   * Each window carries a space (events coerce ev.space to the Space union; reserved use the window space).
   */
  busyWindowsForDate: (key: DateKey) => BusyWindow[];
  /** dates with an all-day window that spacesConflict(space, window.space) */
  fullyBlockedDaysFor: (space: Space) => Set<DateKey>;
  /** dates with ANY window that spacesConflict(space, window.space) */
  busyDaysFor: (space: Space) => Set<DateKey>;
  loading: boolean;
}

interface AvailabilityWindow {
  date: string;
  start_min: number | null;
  end_min: number | null;
  all_day: boolean;
  space?: Space | null;
}

interface AvailabilityResponse {
  windows: AvailabilityWindow[];
  taken: string[];
  from: string;
  to: string;
}

/** key for `key` shifted by `deltaDays` using local date arithmetic (no toISOString). */
function shiftKey(key: DateKey, deltaDays: number): DateKey {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d + deltaDays);
  return keyOf(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

const isAllDay = (w: { all_day: boolean; start_min: number | null }): boolean =>
  w.all_day === true || w.start_min === null;

/** Coerce a raw DB string to the Space union, else null (legacy/whole). */
const toSpace = (s: string | null | undefined): Space | null =>
  s === 'upstairs' || s === 'downstairs' || s === 'whole' ? s : null;

export function usePublicCalendar(): PublicCalendarData {
  const { data: events, loading: eventsLoading } = useEvents();

  const [windows, setWindows] = useState<AvailabilityWindow[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadAvailability() {
      setAvailabilityLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke<AvailabilityResponse>(
          'availability',
          { body: {} }
        );
        if (cancelled) return;
        if (error || !data) {
          setWindows([]);
        } else {
          setWindows(data.windows ?? []);
        }
      } catch {
        if (!cancelled) setWindows([]);
      } finally {
        if (!cancelled) setAvailabilityLoading(false);
      }
    }

    loadAvailability();
    return () => {
      cancelled = true;
    };
  }, []);

  const { eventsByDay, reservedByDay } = useMemo(() => {
    const fromKey = todayKey();
    const toKey = shiftKey(fromKey, 120);

    const eventsByDay = new Map<DateKey, IggyEvent[]>();
    const reservedByDay = new Map<DateKey, BusyWindow[]>();

    // Active events, recurring expanded across today..+120d.
    for (const ev of events) {
      if (!ev.active) continue;
      const keys = eventDateKeys(
        {
          date: ev.date,
          is_recurring: ev.is_recurring,
          recurring_day: ev.recurring_day,
          recurring_until: ev.recurring_until,
        },
        fromKey,
        toKey
      );
      for (const key of keys) {
        const arr = eventsByDay.get(key) ?? [];
        arr.push(ev);
        eventsByDay.set(key, arr);
      }
    }

    // Confirmed private parties from availability windows; carry the window's space.
    for (const w of windows) {
      const key = w.date;
      const window: BusyWindow = {
        date: key,
        start_min: w.start_min,
        end_min: w.end_min,
        all_day: w.all_day,
        kind: 'reserved',
        space: w.space ?? null,
      };
      const arr = reservedByDay.get(key) ?? [];
      arr.push(window);
      reservedByDay.set(key, arr);
    }

    return { eventsByDay, reservedByDay };
  }, [events, windows]);

  const busyWindowsForDate = useMemo(() => {
    return (key: DateKey): BusyWindow[] => {
      const result: BusyWindow[] = [];

      // Events on this key.
      for (const ev of eventsByDay.get(key) ?? []) {
        result.push({
          date: key,
          start_min: ev.start_min,
          end_min: ev.end_min,
          all_day: ev.all_day,
          kind: 'event',
          title: ev.title,
          space: toSpace(ev.space),
        });
      }

      // Reserved windows on this key (already carry their space).
      for (const w of reservedByDay.get(key) ?? []) {
        result.push(w);
      }

      // Prev-day spillover: any window on (key-1) with end_min > 1440
      // contributes {start_min:0, end_min:end_min-1440, ...}.
      const prevKey = shiftKey(key, -1);

      for (const ev of eventsByDay.get(prevKey) ?? []) {
        if (ev.end_min !== null && ev.end_min > 1440) {
          result.push({
            date: key,
            start_min: 0,
            end_min: ev.end_min - 1440,
            all_day: false,
            kind: 'event',
            title: ev.title,
            space: toSpace(ev.space),
          });
        }
      }

      for (const w of reservedByDay.get(prevKey) ?? []) {
        if (w.end_min !== null && w.end_min > 1440) {
          result.push({
            date: key,
            start_min: 0,
            end_min: w.end_min - 1440,
            all_day: false,
            kind: 'reserved',
            space: w.space ?? null,
          });
        }
      }

      return result;
    };
  }, [eventsByDay, reservedByDay]);

  // Per-day window index: every busy window keyed by date, each carrying its space.
  // The *For(space) helpers derive from this.
  const windowsByDay = useMemo(() => {
    const map = new Map<DateKey, BusyWindow[]>();

    const push = (key: DateKey, w: BusyWindow) => {
      const arr = map.get(key) ?? [];
      arr.push(w);
      map.set(key, arr);
    };

    for (const [key, evs] of eventsByDay) {
      for (const ev of evs) {
        push(key, {
          date: key,
          start_min: ev.start_min,
          end_min: ev.end_min,
          all_day: ev.all_day,
          kind: 'event',
          title: ev.title,
          space: toSpace(ev.space),
        });
      }
    }

    for (const [key, ws] of reservedByDay) {
      for (const w of ws) push(key, w);
    }

    return map;
  }, [eventsByDay, reservedByDay]);

  const fullyBlockedDaysFor = useMemo(() => {
    return (space: Space): Set<DateKey> => {
      const set = new Set<DateKey>();
      for (const [key, ws] of windowsByDay) {
        for (const w of ws) {
          if (isAllDay(w) && spacesConflict(space, w.space)) {
            set.add(key);
            break;
          }
        }
      }
      return set;
    };
  }, [windowsByDay]);

  const busyDaysFor = useMemo(() => {
    return (space: Space): Set<DateKey> => {
      const set = new Set<DateKey>();
      for (const [key, ws] of windowsByDay) {
        for (const w of ws) {
          if (spacesConflict(space, w.space)) {
            set.add(key);
            break;
          }
        }
      }
      return set;
    };
  }, [windowsByDay]);

  const loading = eventsLoading || availabilityLoading;

  return {
    eventsByDay,
    reservedByDay,
    busyWindowsForDate,
    fullyBlockedDaysFor,
    busyDaysFor,
    loading,
  };
}
