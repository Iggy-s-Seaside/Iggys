import { describe, expect, it } from 'vitest';
import { buildEventReminders, occursOn, pacificDay } from '../../supabase/functions/event-reminders/schedule';
describe('event reminders', () => {
 const now = new Date('2026-09-12T16:00:00Z');
 const event = { id: 6, title: 'DJ', date: '2026-06-01', active: true, is_recurring: true, recurring_day: 'Saturday', start_min: 1200 };
 it('uses Pacific dates across UTC midnight and daylight savings', () => {
  expect(pacificDay(new Date('2026-09-13T02:00:00Z'))).toBe('2026-09-12');
  expect(pacificDay(new Date('2026-11-02T07:30:00Z'))).toBe('2026-11-01');
 });
 it('reminds for today and next week with stable distinct IDs', () => {
  const reminders = buildEventReminders([], [event], now);
  expect(reminders.map(r => r.lead_days)).toEqual([7, 0]);
  expect(new Set(reminders.map(r => r.id)).size).toBe(2);
  expect(buildEventReminders([], [event], now)).toEqual(reminders);
 });
 it('does not remind for disabled or out-of-season recurring events', () => {
  expect(buildEventReminders([], [{ ...event, active: false }], now)).toEqual([]);
  expect(buildEventReminders([], [{ ...event, recurring_until: '2026-09-11' }], now)).toEqual([]);
  expect(occursOn({ ...event, date: '2026-10-01' }, 'event', '2026-09-12')).toBe(false);
 });
 it('only includes confirmed bookings, never inquiries or cancellations', () => {
  const parties = ['confirmed','inquiry','cancelled'].map((status,id) => ({id, status, event_date:'2026-09-13', contact_name:'Guest'}));
  expect(buildEventReminders(parties, [], now).map(r => r.source_id)).toEqual([0]);
 });
 it('waits until 9 AM and skips events already started', () => {
  expect(buildEventReminders([], [event], new Date('2026-09-12T15:59:00Z'))).toEqual([]);
  expect(buildEventReminders([], [event], new Date('2026-09-13T04:00:00Z')).map(r => r.lead_days)).toEqual([7]);
 });
 it('gives an earlier reminder for morning events', () => {
  expect(buildEventReminders([], [{...event,start_min:480}], new Date('2026-09-12T14:00:00Z')).map(r => r.lead_days)).toEqual([0]);
 });
});
