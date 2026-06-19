import { describe, it, expect } from 'vitest';
import { spacesConflict, windowsOverlap, minToLabel, formatRange } from './timeWindows';

describe('spacesConflict — do two bookings share physical space?', () => {
  it('the whole building conflicts with any space', () => {
    expect(spacesConflict('whole', 'upstairs')).toBe(true);
    expect(spacesConflict('downstairs', 'whole')).toBe(true);
  });
  it('the same space conflicts with itself', () => {
    expect(spacesConflict('upstairs', 'upstairs')).toBe(true);
  });
  it('distinct sub-spaces do NOT conflict (upstairs vs downstairs)', () => {
    expect(spacesConflict('upstairs', 'downstairs')).toBe(false);
  });
  it('null/undefined are treated as the whole building (conservative)', () => {
    expect(spacesConflict(null, 'upstairs')).toBe(true);
    expect(spacesConflict(undefined, undefined)).toBe(true);
  });
});

describe('windowsOverlap — half-open [start,end) interval overlap', () => {
  it('detects a genuine overlap', () => {
    expect(windowsOverlap(600, 720, 660, 780)).toBe(true);
  });
  it('treats touching windows as NOT overlapping (one ends where the next starts)', () => {
    expect(windowsOverlap(600, 720, 720, 840)).toBe(false);
  });
  it('detects full containment', () => {
    expect(windowsOverlap(600, 840, 660, 720)).toBe(true);
  });
  it('returns false for disjoint windows', () => {
    expect(windowsOverlap(600, 720, 780, 900)).toBe(false);
  });
});

describe('minToLabel — minutes-from-midnight to a 12h clock', () => {
  it('matches the documented examples', () => {
    expect(minToLabel(540)).toBe('9:00 AM');
    expect(minToLabel(1290)).toBe('9:30 PM');
    expect(minToLabel(1500)).toBe('1:00 AM'); // wraps past midnight
  });
  it('handles the noon/midnight 12 edge cases', () => {
    expect(minToLabel(0)).toBe('12:00 AM');
    expect(minToLabel(720)).toBe('12:00 PM');
  });
});

describe('formatRange', () => {
  it('renders a start–end range', () => {
    expect(formatRange(540, 1290)).toBe('9:00 AM – 9:30 PM');
  });
  it('collapses to a single time when end is null or equals start', () => {
    expect(formatRange(540, null)).toBe('9:00 AM');
    expect(formatRange(540, 540)).toBe('9:00 AM');
  });
  it('says "All day" when all-day or start is null', () => {
    expect(formatRange(540, 1290, true)).toBe('All day');
    expect(formatRange(null, 1290)).toBe('All day');
  });
});
