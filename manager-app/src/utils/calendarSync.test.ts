import { describe, it, expect } from 'vitest';
import { parseEventDateTime, generateGoogleCalendarUrl, generateIcsContent } from './calendarSync';
import type { IggyEvent } from '../types';

const ev = (o: Partial<IggyEvent>): IggyEvent =>
  ({
    id: 1,
    title: 'Trivia Night',
    date: '2026-03-20',
    time: '8:00 PM',
    description: '',
    category: '',
    is_recurring: false,
    recurring_day: null,
    ...o,
  }) as unknown as IggyEvent;

describe('parseEventDateTime', () => {
  it('parses a date + 12h time into the right local Y/M/D/H/M', () => {
    const d = parseEventDateTime('2026-03-20', '8:00 PM');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 2, 20, 20, 0]);
  });
  it('handles the 12 AM / 12 PM edge cases', () => {
    expect(parseEventDateTime('2026-03-20', '12:00 AM').getHours()).toBe(0); // midnight
    expect(parseEventDateTime('2026-03-20', '12:00 PM').getHours()).toBe(12); // noon
  });
  it('parses AM minutes', () => {
    const d = parseEventDateTime('2026-03-20', '9:30 AM');
    expect([d.getHours(), d.getMinutes()]).toEqual([9, 30]);
  });
  it('falls back to noon on an unparseable time', () => {
    expect(parseEventDateTime('2026-03-20', 'whenever').getHours()).toBe(12);
  });
});

describe('generateGoogleCalendarUrl', () => {
  it('builds a TEMPLATE url with title + a 2h start/end window', () => {
    const url = generateGoogleCalendarUrl(ev({}));
    expect(url).toContain('calendar.google.com/calendar/render');
    expect(url).toContain('action=TEMPLATE');
    expect(url).toContain('text=Trivia+Night');
    expect(url).toContain('dates=20260320T200000%2F20260320T220000'); // 8pm -> 10pm
  });
  it('adds a weekly RRULE for a recurring event', () => {
    const url = generateGoogleCalendarUrl(ev({ is_recurring: true, recurring_day: 'Friday' }));
    expect(url).toContain('BYDAY%3DFR');
  });
});

describe('generateIcsContent', () => {
  it('emits a well-formed VEVENT with CRLF lines, UID, DTSTART/DTEND, SUMMARY', () => {
    const ics = generateIcsContent(ev({ id: 7 }));
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('UID:iggy-event-7@iggysseaside.com');
    expect(ics).toContain('DTSTART:20260320T200000');
    expect(ics).toContain('DTEND:20260320T220000');
    expect(ics).toContain('SUMMARY:Trivia Night');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('\r\n');
  });
  it('escapes description newlines to \\n and appends the category', () => {
    const ics = generateIcsContent(ev({ description: 'Fun night', category: 'Trivia' }));
    expect(ics).toContain('DESCRIPTION:Fun night\\n\\nCategory: Trivia');
  });
  it('includes the weekly RRULE for a recurring event', () => {
    const ics = generateIcsContent(ev({ is_recurring: true, recurring_day: 'friday' }));
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=FR');
  });
});
