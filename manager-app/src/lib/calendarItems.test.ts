import { describe, it, expect } from 'vitest';
import {
  buildAgendaGroups,
  buildCalendarItems,
  expandRecurringDates,
  findDayIssues,
  isPartyMirror,
} from './calendarItems';
import type { CalendarEvent } from './partyActions';
import type { IggyEvent, Party } from '../types';

const party = (o: Partial<Party> = {}): Party =>
  ({
    id: 1,
    status: 'confirmed',
    contact_name: 'Sam',
    title: "Sam's Birthday",
    event_date: '2026-08-22',
    start_min: 1080, // 6:00 PM
    end_min: 1320, // 10:00 PM
    all_day: false,
    guest_count: 30,
    space: 'upstairs',
    google_calendar_event_id: null,
    ...o,
  }) as unknown as Party;

const iggyEvent = (o: Partial<IggyEvent>): IggyEvent =>
  ({
    id: 1,
    title: 'Top Deck Saturdays',
    date: '2026-08-01',
    time: '9:00 PM',
    is_recurring: false,
    recurring_day: null,
    active: true,
    start_min: 1260, // 9:00 PM
    end_min: 1500, // 1:00 AM (next day)
    all_day: false,
    space: 'upstairs',
    ...o,
  }) as unknown as IggyEvent;

const google = (o: Partial<CalendarEvent>): CalendarEvent => ({
  id: 'g1',
  summary: 'DJ Night',
  start: '2026-08-22T21:00:00-07:00',
  end: '2026-08-23T01:00:00-07:00',
  allDay: false,
  ...o,
});

const RANGE: [string, string] = ['2026-08-17', '2026-09-30'];

describe('party mirror dedupe', () => {
  it('suppresses the Google copy via the stored google_calendar_event_id', () => {
    const p = party({ google_calendar_event_id: 'g1' });
    const ev = google({ id: 'g1', summary: "Sam's Birthday" });
    expect(isPartyMirror(ev, [p])).toBe(true);
    const items = buildCalendarItems([p], [], [ev], ...RANGE);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('party');
  });

  it('falls back to same date + same synced summary when no id is stored', () => {
    const p = party({ title: null });
    const ev = google({ summary: 'Private Party — Sam', start: '2026-08-22T18:00:00-07:00' });
    expect(isPartyMirror(ev, [p])).toBe(true);
  });

  it('keeps an unrelated Google event on the same day', () => {
    const p = party();
    const ev = google({ summary: 'DJ Night' });
    expect(isPartyMirror(ev, [p])).toBe(false);
    expect(buildCalendarItems([p], [], [ev], ...RANGE)).toHaveLength(2);
  });
});

describe('recurring events', () => {
  const weekly = iggyEvent({ is_recurring: true, recurring_day: 'Saturday' });

  it('expands weekly across the visible range (every Saturday lights up the grid)', () => {
    const dates = expandRecurringDates(weekly, '2026-08-17', '2026-09-05');
    expect(dates).toEqual(['2026-08-22', '2026-08-29', '2026-09-05']);
  });

  it('collapses to ONE row at the next occurrence in the agenda', () => {
    const items = buildCalendarItems([], [weekly], [], ...RANGE);
    expect(items.length).toBeGreaterThan(3); // grid sees every occurrence
    const { upcoming, later } = buildAgendaGroups(items, '2026-08-17');
    const agendaRows = [...upcoming, ...later].flatMap((g) => g.items);
    expect(agendaRows).toHaveLength(1);
    expect(agendaRows[0].date).toBe('2026-08-22');
    expect(agendaRows[0].recurLabel).toBe('every Saturday');
  });
});

describe('agenda never looks backwards', () => {
  // The month view's range starts on the Sunday before the 1st, so `items` can
  // legitimately contain past dates. The agenda must still open on the NEXT
  // occurrence, not the first one in range.
  it('collapses a weekly series to its next FUTURE occurrence, not the earliest in range', () => {
    const series = iggyEvent({ id: 10, date: '2026-08-01', is_recurring: true, recurring_day: 'Saturday' });
    const items = buildCalendarItems([], [series], [], '2026-08-01', '2026-09-30');
    const { headline, upcoming, later } = buildAgendaGroups(items, '2026-08-17');
    const rows = [...headline, ...upcoming, ...later].flatMap((g) => g.items);
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe('2026-08-22'); // the Saturday after Mon Aug 17
  });

  it('drops days earlier than today entirely', () => {
    const past = party({ id: 1, event_date: '2026-08-03' });
    const soon = party({ id: 2, event_date: '2026-08-22' });
    const items = buildCalendarItems([past, soon], [], [], '2026-08-01', '2026-09-30');
    const { headline, upcoming, later } = buildAgendaGroups(items, '2026-08-17');
    const dates = [...headline, ...upcoming, ...later].flatMap((g) => g.items.map((i) => i.date));
    expect(dates).toEqual(['2026-08-22']);
  });
});

describe('conflicts vs staffing notes', () => {
  it('same space + time overlap = real conflict', () => {
    const a = party({ id: 1, space: 'upstairs', start_min: 1080, end_min: 1320 });
    const b = party({ id: 2, space: 'upstairs', start_min: 1200, end_min: 1440 });
    const issues = findDayIssues(
      buildCalendarItems([a, b], [], [], ...RANGE).filter((i) => i.date === '2026-08-22'),
    );
    expect(issues).toEqual([expect.objectContaining({ kind: 'conflict', whole: false })]);
  });

  it('different spaces overlapping = staffing note, NOT a conflict', () => {
    const a = party({ id: 1, space: 'upstairs' });
    const b = party({ id: 2, space: 'downstairs' });
    const [issue] = findDayIssues(
      buildCalendarItems([a, b], [], [], ...RANGE).filter((i) => i.date === '2026-08-22'),
    );
    expect(issue.kind).toBe('staffing');
  });

  it('whole-building overlapping anything = loudest conflict', () => {
    const a = party({ id: 1, space: 'whole' });
    const b = party({ id: 2, space: 'downstairs' });
    const [issue] = findDayIssues(
      buildCalendarItems([a, b], [], [], ...RANGE).filter((i) => i.date === '2026-08-22'),
    );
    expect(issue).toMatchObject({ kind: 'conflict', whole: true });
  });

  // Regression: a Google entry is not a room booking. Before this, an all-day
  // Google row ("Staff meeting") carried space:null, which spacesConflict
  // coerces to 'whole', so it fired a LOUD whole-building conflict against
  // every booking that day — exactly the false alarm this page exists to kill.
  it('an all-day Google entry never conflicts with a booking', () => {
    const p = party({ id: 1, space: 'upstairs' });
    const g: CalendarEvent = {
      id: 'g1',
      summary: 'Staff meeting',
      start: '2026-08-22',
      end: '2026-08-23',
      allDay: true,
    };
    const issues = findDayIssues(
      buildCalendarItems([p], [], [g], ...RANGE).filter((i) => i.date === '2026-08-22'),
    );
    expect(issues).toHaveLength(0);
  });

  // Regression: `space` was added to parties after launch, so legacy rows have
  // null. Unknown space must read as unknown, not as a whole-building claim.
  it('two bookings with no space set = staffing note, not a conflict', () => {
    const a = party({ id: 1, space: null });
    const b = party({ id: 2, space: null });
    const [issue] = findDayIssues(
      buildCalendarItems([a, b], [], [], ...RANGE).filter((i) => i.date === '2026-08-22'),
    );
    expect(issue).toMatchObject({ kind: 'staffing', whole: false });
  });

  it('same space, sequential times = no issue at all', () => {
    const a = party({ id: 1, space: 'upstairs', start_min: 780, end_min: 900 }); // 1–3 PM
    const b = party({ id: 2, space: 'upstairs', start_min: 1260, end_min: 1560 }); // 9 PM–2 AM
    const issues = findDayIssues(
      buildCalendarItems([a, b], [], [], ...RANGE).filter((i) => i.date === '2026-08-22'),
    );
    expect(issues).toHaveLength(0);
  });
});

describe('filtering', () => {
  it('drops cancelled parties and inactive events', () => {
    const items = buildCalendarItems(
      [party({ status: 'cancelled' })],
      [iggyEvent({ active: false })],
      [],
      ...RANGE,
    );
    expect(items).toHaveLength(0);
  });

  it('drops items outside the fetch window', () => {
    const items = buildCalendarItems([party({ event_date: '2026-12-25' })], [], [], ...RANGE);
    expect(items).toHaveLength(0);
  });
});
