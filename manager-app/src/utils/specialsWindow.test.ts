import { describe, it, expect } from 'vitest';
import { isSpecialLive, getSpecialLifecycle, specialStatusLabel } from './specialsWindow';

const NOW = new Date('2026-06-15T12:00:00Z');
const PAST = '2026-06-10T00:00:00Z';
const FUTURE = '2026-06-20T00:00:00Z';
const sp = (over: { active?: boolean; starts_at?: string | null; expires_at?: string | null }) => ({
  active: true,
  starts_at: null,
  expires_at: null,
  ...over,
});

describe('isSpecialLive — public visibility gate', () => {
  it('is false when inactive, regardless of window', () => {
    expect(isSpecialLive(sp({ active: false }), NOW)).toBe(false);
    expect(isSpecialLive(sp({ active: false, starts_at: PAST, expires_at: FUTURE }), NOW)).toBe(false);
  });
  it('is true when active with no bounds', () => {
    expect(isSpecialLive(sp({}), NOW)).toBe(true);
  });
  it('respects a future start (not yet live) and a past start (live)', () => {
    expect(isSpecialLive(sp({ starts_at: FUTURE }), NOW)).toBe(false);
    expect(isSpecialLive(sp({ starts_at: PAST }), NOW)).toBe(true);
  });
  it('treats the end bound as EXCLUSIVE (expired at/after expires_at)', () => {
    expect(isSpecialLive(sp({ expires_at: PAST }), NOW)).toBe(false);
    expect(isSpecialLive(sp({ expires_at: '2026-06-15T12:00:00Z' }), NOW)).toBe(false); // exactly now
    expect(isSpecialLive(sp({ expires_at: FUTURE }), NOW)).toBe(true);
  });
  it('is live inside a full [start, end] window', () => {
    expect(isSpecialLive(sp({ starts_at: PAST, expires_at: FUTURE }), NOW)).toBe(true);
  });
  it('treats an unparseable bound as no bound (never hides on a bad value)', () => {
    expect(isSpecialLive(sp({ starts_at: 'not-a-date' }), NOW)).toBe(true);
  });
});

describe('getSpecialLifecycle — display state', () => {
  it('inactive takes priority over the window', () => {
    expect(getSpecialLifecycle(sp({ active: false, starts_at: FUTURE }), NOW)).toBe('inactive');
  });
  it('scheduled / expired / live', () => {
    expect(getSpecialLifecycle(sp({ starts_at: FUTURE }), NOW)).toBe('scheduled');
    expect(getSpecialLifecycle(sp({ expires_at: PAST }), NOW)).toBe('expired');
    expect(getSpecialLifecycle(sp({ starts_at: PAST, expires_at: FUTURE }), NOW)).toBe('live');
    expect(getSpecialLifecycle(sp({}), NOW)).toBe('live');
  });
  it('maps to a human label', () => {
    expect(specialStatusLabel(sp({ starts_at: FUTURE }), NOW)).toBe('Scheduled');
    expect(specialStatusLabel(sp({ active: false }), NOW)).toBe('Inactive');
  });
});
