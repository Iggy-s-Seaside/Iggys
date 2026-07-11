import { describe, it, expect } from 'vitest';
import { businessDay } from './businessDay';

// Dates are built from explicit UTC offsets so each instant is unambiguous,
// independent of the machine's local timezone. businessDay resolves them in
// America/Los_Angeles via Intl, so these assertions are deterministic anywhere.
// June = PDT (UTC-7), January/November(after fallback) = PST (UTC-8).
describe('businessDay — 9am Pacific service-day cutoff', () => {
  it('before 9am Pacific files under the previous calendar date', () => {
    expect(businessDay(new Date('2026-06-15T08:00:00-07:00'))).toBe('2026-06-14');
  });

  it('1:30am Pacific files under the previous date (post-midnight close)', () => {
    expect(businessDay(new Date('2026-06-15T01:30:00-07:00'))).toBe('2026-06-14');
  });

  it('8:59am Pacific is still the previous date', () => {
    expect(businessDay(new Date('2026-06-15T08:59:00-07:00'))).toBe('2026-06-14');
  });

  it('exactly 9:00am Pacific flips to today', () => {
    expect(businessDay(new Date('2026-06-15T09:00:00-07:00'))).toBe('2026-06-15');
  });

  it('midnight (00:00) Pacific files under the previous SERVICE night', () => {
    // Cross-language day-key contract: the bridge footage sampler
    // (bridge/bar_busyness.py _service_night_hours) samples the 00:00..08:59 hours
    // of day+1 INTO `day`'s band. This pins the TS side — midnight of the next
    // calendar date must still resolve to the prior service day, or the two
    // would disagree and a packed last-call peak would be mis-attributed.
    expect(businessDay(new Date('2026-06-16T00:00:00-07:00'))).toBe('2026-06-15');
  });

  it('mid-afternoon Pacific is today', () => {
    expect(businessDay(new Date('2026-06-15T15:00:00-07:00'))).toBe('2026-06-15');
  });

  it('rolls the month boundary (2am Pacific Jul 1 -> Jun 30)', () => {
    expect(businessDay(new Date('2026-07-01T02:00:00-07:00'))).toBe('2026-06-30');
  });

  it('rolls the year boundary (5am Pacific Jan 1 -> Dec 31 prior year)', () => {
    expect(businessDay(new Date('2026-01-01T05:00:00-08:00'))).toBe('2025-12-31');
  });

  it('resolves a raw UTC instant in the afternoon (23:00Z = 4pm PDT)', () => {
    expect(businessDay(new Date('2026-06-15T23:00:00Z'))).toBe('2026-06-15');
  });

  it('resolves a raw UTC instant after Pacific midnight (08:00Z = 1am PDT)', () => {
    expect(businessDay(new Date('2026-06-15T08:00:00Z'))).toBe('2026-06-14');
  });

  it('is correct on the DST spring-forward day (10am PDT is today)', () => {
    expect(businessDay(new Date('2026-03-08T10:00:00-07:00'))).toBe('2026-03-08');
  });

  it('is correct on the DST fall-back day (8am PST is the previous date)', () => {
    expect(businessDay(new Date('2026-11-01T08:00:00-08:00'))).toBe('2026-10-31');
  });

  it('respects a custom cutoff hour (noon cutoff: 10am Pacific -> previous date)', () => {
    expect(businessDay(new Date('2026-06-15T10:00:00-07:00'), 12)).toBe('2026-06-14');
  });
});
