import { describe, it, expect } from 'vitest';
import { computeShiftPatterns, weekdayOf, MIN_SAMPLE, type DemandNight } from './shiftPatterns';

// Helper: a logged night. 2026-07-06 was a Monday, so day offsets are stable.
const MONDAY = new Date(2026, 6, 6); // local-time construction, no UTC shift
function night(
  daysFromMonday: number,
  actual: string | null,
  predicted: string | null = null,
  drivers: { name: string; sign: string; detail: string }[] | null = null
): DemandNight {
  const d = new Date(MONDAY);
  d.setDate(d.getDate() + daysFromMonday);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
  return { business_day: iso, actual_band: actual, predicted_band: predicted, drivers };
}

describe('weekdayOf — Monday-first, no UTC drift', () => {
  it('reads 2026-07-06 as Monday (0) and 2026-07-12 as Sunday (6)', () => {
    expect(weekdayOf('2026-07-06')).toBe(0);
    expect(weekdayOf('2026-07-12')).toBe(6);
  });

  it('rejects malformed dates instead of guessing', () => {
    expect(weekdayOf('garbage')).toBeNull();
    expect(weekdayOf('2026-13-45')).toBeNull();
  });
});

describe('computeShiftPatterns — honesty gates', () => {
  it('claims nothing from an empty log', () => {
    const read = computeShiftPatterns([]);
    expect(read.nightsLogged).toBe(0);
    expect(read.patterns).toEqual([]);
    expect(read.since).toBeNull();
    expect(read.rhythm).toHaveLength(7);
    expect(read.rhythm.every((r) => r.band === null)).toBe(true);
  });

  it('ignores forecast-only nights — no actual band, no claim', () => {
    const rows = [0, 7, 14].map((d) => night(d, null, 'PACKED'));
    const read = computeShiftPatterns(rows);
    expect(read.nightsLogged).toBe(0);
    expect(read.patterns).toEqual([]);
  });

  it('ignores rows with unknown band strings instead of crashing', () => {
    const read = computeShiftPatterns([night(0, 'MOBBED'), night(1, 'BUSY')]);
    expect(read.nightsLogged).toBe(1);
  });

  it(`stays silent on a weekday under ${MIN_SAMPLE} sightings`, () => {
    const rows = [0, 7].map((d) => night(d, 'BUSY')); // two Mondays only
    const read = computeShiftPatterns(rows);
    expect(read.rhythm[0].band).toBeNull();
    expect(read.rhythm[0].n).toBe(2);
  });
});

describe('computeShiftPatterns — weekday rhythm', () => {
  it('calls the modal band once a weekday clears the sample floor', () => {
    const rows = [0, 7, 14, 21].map((d) => night(d, 'BUSY')); // four Mondays
    const read = computeShiftPatterns(rows);
    expect(read.rhythm[0]).toMatchObject({ label: 'Mon', band: 'BUSY', bandCount: 4, n: 4 });
  });

  it('breaks a modal tie toward the busier band (staff for coverage)', () => {
    const rows = [
      night(4, 'PACKED'),
      night(11, 'BUSY'),
      night(18, 'PACKED'),
      night(25, 'BUSY'),
    ];
    const read = computeShiftPatterns(rows);
    expect(read.rhythm[4]).toMatchObject({ label: 'Fri', band: 'PACKED', bandCount: 2, n: 4 });
  });
});

describe('computeShiftPatterns — call-vs-room bias', () => {
  it('flags a hot streak: misses that consistently played smaller than the call', () => {
    const rows = [
      night(4, 'BUSY', 'PACKED'),
      night(5, 'BUSY', 'PACKED'),
      night(11, 'BUSY', 'PACKED'),
      night(12, 'PACKED', 'PACKED'),
    ];
    const read = computeShiftPatterns(rows);
    const hot = read.patterns.find((p) => p.id === 'bias-weekends-hot');
    expect(hot).toBeDefined();
    expect(hot!.evidence).toContain('3 of my 3');
  });

  it('credits a class she keeps reading right', () => {
    const rows = [0, 1, 2, 3, 7].map((d) => night(d, 'BUSY', 'BUSY'));
    const read = computeShiftPatterns(rows);
    const trust = read.patterns.find((p) => p.id === 'bias-weeknights-trust');
    expect(trust).toBeDefined();
    expect(trust!.evidence).toBe("I've read 5 of the last 5 right");
  });

  it('stays silent when misses point both ways', () => {
    const rows = [
      night(0, 'BUSY', 'PACKED'), // over
      night(1, 'PACKED', 'BUSY'), // under
      night(2, 'BUSY', 'BUSY'),
      night(3, 'STEADY', 'BUSY'), // over — 2/3 = 0.66 < consensus
    ];
    const read = computeShiftPatterns(rows);
    expect(read.patterns.filter((p) => p.id.startsWith('bias-weeknights'))).toEqual([]);
  });
});

describe('computeShiftPatterns — driver patterns', () => {
  const convention = [{ name: 'convention', sign: '+', detail: 'in town' }];

  it('calls a condition that keeps filling the room', () => {
    const rows = [0, 1, 7, 8].map((d) => night(d, 'BUSY', null, convention));
    const read = computeShiftPatterns(rows);
    const p = read.patterns.find((x) => x.id === 'driver-convention-fills');
    expect(p).toBeDefined();
    expect(p!.evidence).toBe('4 of 4 such nights ran BUSY+');
  });

  it('never patterns on her own learning nudge or always-on season', () => {
    const noisy = [
      { name: 'learning', sign: '+', detail: 'nudged +3' },
      { name: 'peak season', sign: '+', detail: 'summer' },
    ];
    const rows = [0, 1, 2, 7, 8].map((d) => night(d, 'BUSY', null, noisy));
    const read = computeShiftPatterns(rows);
    expect(read.patterns.filter((p) => p.id.startsWith('driver-'))).toEqual([]);
  });

  it('stays silent on a mixed-verdict condition', () => {
    const windy = [{ name: 'windy', sign: '-', detail: 'gusts' }];
    const rows = [
      night(0, 'BUSY', null, windy),
      night(1, 'STEADY', null, windy),
      night(2, 'BUSY', null, windy),
      night(3, 'SLOW', null, windy),
    ];
    const read = computeShiftPatterns(rows); // 2/4 BUSY+ — no claim either way
    expect(read.patterns.filter((p) => p.id.startsWith('driver-windy'))).toEqual([]);
  });
});

describe('computeShiftPatterns — bookkeeping', () => {
  it('reports the oldest logged night feeding the read', () => {
    const rows = [night(14, 'BUSY'), night(0, 'BUSY'), night(7, 'BUSY')];
    const read = computeShiftPatterns(rows);
    expect(read.since).toBe('2026-07-06');
    expect(read.nightsLogged).toBe(3);
  });
});
