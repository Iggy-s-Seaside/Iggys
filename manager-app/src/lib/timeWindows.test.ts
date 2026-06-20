import { describe, it, expect } from 'vitest';
import {
  spacesConflict, windowsOverlap, minToLabel, formatRange,
  spaceLabel, timeText, timeOptions, timeSelectOptions, type TimeSlotOption,
} from './timeWindows';

const byVal = (arr: TimeSlotOption[], v: number) => arr.find((o) => o.value === v)!;

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

describe('spaceLabel / timeText / timeOptions', () => {
  it('spaceLabel maps a space, "" for null', () => {
    expect(spaceLabel('upstairs')).toBe('Upstairs');
    expect(spaceLabel('whole')).toBe('Entire building');
    expect(spaceLabel(null)).toBe('');
  });
  it('timeText is a 12h label, "" for null', () => {
    expect(timeText(540)).toBe('9:00 AM');
    expect(timeText(null)).toBe('');
  });
  it('timeOptions spans 8:00 AM..next-day in 30-min steps with a "next day" suffix past midnight', () => {
    const opts = timeOptions();
    expect(opts).toHaveLength(37); // 480..1560 step 30 inclusive
    expect(opts[0]).toEqual({ value: 480, label: '8:00 AM' });
    expect(opts.find((o) => o.value === 1440)!.label).toBe('12:00 AM (next day)');
  });
});

describe('timeSelectOptions — time-picker slots + inline disabling', () => {
  it('with no constraints, nothing is disabled and groups/next-day hints are set', () => {
    const opts = timeSelectOptions();
    expect(opts.every((o) => !o.disabled)).toBe(true);
    expect(byVal(opts, 660).group).toBe('Morning'); // 11:00 AM (< 720 = Morning)
    expect(byVal(opts, 780).group).toBe('Afternoon'); // 1:00 PM (720..1019 = Afternoon)
    expect(byVal(opts, 1080).group).toBe('Evening'); // 6:00 PM (1020..1439 = Evening)
    expect(byVal(opts, 1440).group).toBe('Late night'); // 12:00 AM next day (>= 1440)
    expect(byVal(opts, 1440).hint).toBe('next day');
  });

  it('END picker (minValue) disables slots at or before the start', () => {
    const opts = timeSelectOptions({ minValue: 600 });
    expect(byVal(opts, 600).disabled).toBe(true);
    expect(byVal(opts, 630).disabled).toBe(false);
  });

  it('START picker disables slots inside a busy window (end-exclusive)', () => {
    const opts = timeSelectOptions({ busyWindows: [{ start_min: 600, end_min: 720, all_day: false }] });
    expect(byVal(opts, 600).disabled).toBe(true);
    expect(byVal(opts, 690).disabled).toBe(true);
    expect(byVal(opts, 690).hint).toBe('booked');
    expect(byVal(opts, 720).disabled).toBe(false); // end is exclusive
  });

  it('END picker disables slots whose [start, slot] window overlaps a busy window', () => {
    const opts = timeSelectOptions({ minValue: 540, busyWindows: [{ start_min: 600, end_min: 720, all_day: false }] });
    expect(byVal(opts, 660).disabled).toBe(true);
    expect(byVal(opts, 660).hint).toBe('overlaps');
  });

  it('an all-day busy window disables every slot', () => {
    const opts = timeSelectOptions({ busyWindows: [{ start_min: null, end_min: null, all_day: true }] });
    expect(opts.every((o) => o.disabled)).toBe(true);
  });

  it('a non-conflicting space (upstairs busy vs downstairs query) does NOT disable', () => {
    const opts = timeSelectOptions({
      space: 'downstairs',
      busyWindows: [{ start_min: 600, end_min: 720, all_day: false, space: 'upstairs' }],
    });
    expect(byVal(opts, 660).disabled).toBe(false);
  });
});
