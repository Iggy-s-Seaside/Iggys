// Unified calendar items — merges the three event sources (parties, the app's
// own `events` table, and the bar's Google Calendar) into one list the Calendar
// page renders. Pure functions only; no React, no Supabase — unit-testable.

import { addDays, format, parseISO } from 'date-fns';
import {
  spacesConflict,
  windowsOverlap,
  type Space,
} from './timeWindows';
import type { CalendarEvent } from './partyActions';
import type { IggyEvent, Party, PartyStatus } from '../types';

export type CalendarItemKind = 'party' | 'event' | 'google';

export interface CalendarItem {
  /** Stable React key, unique per occurrence (series items get a date suffix). */
  id: string;
  kind: CalendarItemKind;
  /** `yyyy-MM-dd` this occurrence lands on. */
  date: string;
  title: string;
  startMin: number | null;
  endMin: number | null;
  allDay: boolean;
  space: Space | null;
  /** Visual tone — shared by agenda rails and month-grid dots. */
  tone: 'primary' | 'success' | 'accent' | 'muted';
  status?: PartyStatus;
  guestCount?: number | null;
  /** Set for recurring app events: which series this occurrence belongs to. */
  seriesId?: string;
  /** e.g. "every Saturday" — display only; the schema has no series end date. */
  recurLabel?: string;
  party?: Party;
  event?: IggyEvent;
  google?: CalendarEvent;
}

export interface DayGroup {
  key: string; // yyyy-MM-dd
  items: CalendarItem[];
}

export interface DayIssue {
  a: CalendarItem;
  b: CalendarItem;
  /** 'conflict' = same resource (or whole building) double-booked; 'staffing' =
   * two DIFFERENT spaces busy at once — informational only, never a warning. */
  kind: 'conflict' | 'staffing';
  /** True when a whole-building booking is involved (the loudest case). */
  whole: boolean;
}

export const PARTY_TONE: Record<PartyStatus, CalendarItem['tone']> = {
  inquiry: 'accent',
  confirmed: 'success',
  cancelled: 'muted',
};

export function dayKey(iso: string): string {
  try {
    return format(parseISO(iso), 'yyyy-MM-dd');
  } catch {
    return iso.slice(0, 10);
  }
}

/** Minutes-from-midnight for an ISO datetime (local clock); null when unparseable. */
export function minutesFromISO(iso: string): number | null {
  try {
    const d = parseISO(iso);
    return d.getHours() * 60 + d.getMinutes();
  } catch {
    return null;
  }
}

/** Coerce a free-form space column to the Space union; anything unknown → null. */
export function toSpace(s: string | null | undefined): Space | null {
  return s === 'upstairs' || s === 'downstairs' || s === 'whole' ? s : null;
}

function normTitle(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * A confirmed party pushed to Google comes back in the `list` payload as a
 * second copy of the same booking. Suppress the Google copy when it corresponds
 * to a party we already render, so a party appears EXACTLY once.
 *
 * Primary key is structural: the sync (supabase/functions/google-calendar)
 * stores the Google event id back on `parties.google_calendar_event_id`.
 * Fallback: the sync writes no party id into the event body, so for rows synced
 * before that column was populated we match on same date + same summary
 * (summary === party.title?.trim() || `Private Party — ${contact_name}`).
 */
export function isPartyMirror(ev: CalendarEvent, parties: Party[]): boolean {
  for (const p of parties) {
    if (p.google_calendar_event_id && p.google_calendar_event_id === ev.id) return true;
    if (!p.event_date || dayKey(ev.start) !== p.event_date) continue;
    const expected = p.title?.trim() || `Private Party — ${p.contact_name}`;
    if (normTitle(ev.summary) === normTitle(expected)) return true;
  }
  return false;
}

/** All dates (yyyy-MM-dd) a recurring weekly event lands on within [startKey, endKey].
 * Expansion starts at max(anchor date, range start); there is no series end
 * column, so occurrences run to the visible range end and no further. */
export function expandRecurringDates(ev: IggyEvent, startKey: string, endKey: string): string[] {
  const want = (ev.recurring_day ?? '').trim().toLowerCase();
  if (!want) return [];
  const out: string[] = [];
  let d = parseISO(ev.date > startKey ? ev.date : startKey);
  const end = parseISO(endKey);
  while (d <= end) {
    if (format(d, 'EEEE').toLowerCase() === want) out.push(format(d, 'yyyy-MM-dd'));
    d = addDays(d, 1);
  }
  return out;
}

/** "every Saturday" — never a fabricated end date (the schema has none). */
export function recurLabel(recurringDay: string | null): string {
  const day = (recurringDay ?? '').trim();
  return day ? `every ${day}` : 'recurring';
}

function partyToItem(p: Party): CalendarItem | null {
  if (!p.event_date) return null;
  return {
    id: `party-${p.id}`,
    kind: 'party',
    date: p.event_date,
    title: p.title?.trim() || p.contact_name || 'Party',
    startMin: p.start_min,
    endMin: p.end_min,
    allDay: p.all_day,
    space: toSpace(p.space),
    tone: PARTY_TONE[p.status],
    status: p.status,
    guestCount: p.guest_count,
    party: p,
  };
}

function eventToItem(ev: IggyEvent, date: string, occurrence: boolean): CalendarItem {
  return {
    id: occurrence ? `event-${ev.id}-${date}` : `event-${ev.id}`,
    kind: 'event',
    date,
    title: ev.title || 'Event',
    startMin: ev.start_min,
    endMin: ev.end_min,
    allDay: ev.all_day,
    space: toSpace(ev.space),
    tone: 'primary',
    seriesId: occurrence ? `event-${ev.id}` : undefined,
    recurLabel: occurrence ? recurLabel(ev.recurring_day) : undefined,
    event: ev,
  };
}

function googleToItem(ev: CalendarEvent): CalendarItem | null {
  if (!ev.start) return null;
  const allDay = ev.allDay === true;
  const startMin = allDay ? null : minutesFromISO(ev.start);
  let endMin = allDay || !ev.end ? null : minutesFromISO(ev.end);
  if (startMin !== null && endMin !== null && endMin <= startMin) endMin += 1440;
  return {
    id: `google-${ev.id}`,
    kind: 'google',
    date: dayKey(ev.start),
    title: ev.summary || 'Event',
    startMin,
    endMin,
    allDay,
    space: null, // Google events carry no space — spacesConflict treats null as whole.
    tone: 'muted',
    google: ev,
  };
}

function inRange(date: string, startKey: string, endKey: string): boolean {
  return date >= startKey && date <= endKey;
}

function byTimeThenTitle(a: CalendarItem, b: CalendarItem): number {
  const sa = a.allDay || a.startMin === null ? -1 : a.startMin;
  const sb = b.allDay || b.startMin === null ? -1 : b.startMin;
  if (sa !== sb) return sa - sb;
  return a.title.localeCompare(b.title);
}

/** Merge all three sources into one sorted list over [startKey, endKey].
 * - cancelled parties are dropped; Google copies of synced parties are dropped;
 * - recurring app events expand to one item per occurrence in range. */
export function buildCalendarItems(
  parties: Party[],
  events: IggyEvent[],
  googleEvents: CalendarEvent[],
  startKey: string,
  endKey: string,
): CalendarItem[] {
  const out: CalendarItem[] = [];

  const liveParties = parties.filter((p) => p.status !== 'cancelled' && !!p.event_date);
  for (const p of liveParties) {
    const item = partyToItem(p);
    if (item && inRange(item.date, startKey, endKey)) out.push(item);
  }

  for (const ev of events) {
    if (!ev.active) continue;
    if (ev.is_recurring && ev.recurring_day) {
      for (const date of expandRecurringDates(ev, startKey, endKey)) {
        out.push(eventToItem(ev, date, true));
      }
    } else if (ev.date && inRange(ev.date, startKey, endKey)) {
      out.push(eventToItem(ev, ev.date, false));
    }
  }

  for (const ev of googleEvents) {
    if (isPartyMirror(ev, liveParties)) continue;
    const item = googleToItem(ev);
    if (item && inRange(item.date, startKey, endKey)) out.push(item);
  }

  return out.sort(byTimeThenTitle);
}

/** The numeric window used for overlap math: all-day/untimed = the whole day. */
function windowOf(item: CalendarItem): [number, number] {
  if (item.allDay || item.startMin === null) return [0, 1440];
  const end = item.endMin ?? item.startMin + 120; // untimed end → 2h default, like the sync
  return [item.startMin, Math.max(end, item.startMin + 1)];
}

/** Pairwise issues on a single day. Real conflicts need spacesConflict AND a
 * time overlap; different-space overlaps are staffing notes, not warnings.
 *
 * Two deliberate departures from `spacesConflict`'s booking-time semantics —
 * both exist to stop this banner crying wolf, which is the whole point of it:
 *
 *  1. A Google entry is not a room booking. It is a free-form calendar row
 *     ("Staff meeting", "Owner away") carrying no space, so it can never
 *     double-book anything. Pairs involving one are skipped entirely — the
 *     items still both appear in the day list, just without a banner.
 *  2. A missing `space` is UNKNOWN, not "the whole building". `spacesConflict`
 *     coerces null → 'whole' because at BOOKING time the conservative answer is
 *     "assume it clashes". For a DISPLAY warning that inverts into a false
 *     alarm on every pair of legacy rows, so unknown spaces downgrade to a
 *     staffing note instead.
 */
function isBooking(item: CalendarItem): boolean {
  return item.kind !== 'google';
}

export function findDayIssues(items: CalendarItem[]): DayIssue[] {
  const issues: DayIssue[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (!isBooking(a) || !isBooking(b)) continue;
      const [as, ae] = windowOf(a);
      const [bs, be] = windowOf(b);
      if (!windowsOverlap(as, ae, bs, be)) continue;
      const known = a.space !== null && b.space !== null;
      const whole = known && (a.space === 'whole' || b.space === 'whole');
      issues.push({
        a,
        b,
        kind: known && spacesConflict(a.space, b.space) ? 'conflict' : 'staffing',
        whole,
      });
    }
  }
  return issues;
}

/** Day → items map plus the set of days with a REAL conflict (drives the grid dot). */
export function groupByDay(items: CalendarItem[]): { byDay: Map<string, CalendarItem[]>; conflictDays: Set<string> } {
  const byDay = new Map<string, CalendarItem[]>();
  const conflictDays = new Set<string>();
  for (const item of items) {
    const list = byDay.get(item.date);
    if (list) list.push(item);
    else byDay.set(item.date, [item]);
  }
  for (const [key, dayItems] of byDay) {
    if (findDayIssues(dayItems).some((i) => i.kind === 'conflict')) conflictDays.add(key);
  }
  return { byDay, conflictDays };
}

/**
 * Agenda grouping per the ops rules:
 * - `headline`: today + the next 2 days, ALWAYS present (even when empty) so
 *   "is tonight handled?" is answerable without a tap.
 * - `upcoming`: days 3–30 that have items.
 * - `later`: a single bucket for anything beyond 30 days (to the fetch horizon).
 * Recurring series collapse to ONE row — the next occurrence only — so a weekly
 * night never floods the list. The month grid uses the un-collapsed items.
 */
export function buildAgendaGroups(
  items: CalendarItem[],
  todayKey: string,
): { headline: DayGroup[]; upcoming: DayGroup[]; later: DayGroup[] } {
  // Drop anything already past BEFORE collapsing, so a weekly series collapses to
  // its NEXT occurrence rather than its first-in-range (which may be behind us
  // whenever the caller's range starts earlier than today — e.g. the month view's
  // range begins on the Sunday before the 1st).
  const future = items
    .filter((item) => item.date >= todayKey)
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));

  const seenSeries = new Set<string>();
  const collapsed = future.filter((item) => {
    if (!item.seriesId) return true;
    if (seenSeries.has(item.seriesId)) return false;
    seenSeries.add(item.seriesId);
    return true;
  });

  const byDay = new Map<string, CalendarItem[]>();
  for (const item of collapsed) {
    const list = byDay.get(item.date);
    if (list) list.push(item);
    else byDay.set(item.date, [item]);
  }

  const headline: DayGroup[] = [];
  for (let i = 0; i < 3; i++) {
    const key = format(addDays(parseISO(todayKey), i), 'yyyy-MM-dd');
    headline.push({ key, items: byDay.get(key) ?? [] });
    byDay.delete(key);
  }

  const upcomingLimit = format(addDays(parseISO(todayKey), 30), 'yyyy-MM-dd');
  const upcoming: DayGroup[] = [];
  const later: DayGroup[] = [];
  for (const [key, dayItems] of Array.from(byDay.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    (key <= upcomingLimit ? upcoming : later).push({ key, items: dayItems });
  }
  return { headline, upcoming, later };
}
