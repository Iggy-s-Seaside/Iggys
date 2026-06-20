import { describe, it, expect } from 'vitest';
import { allocateTips } from './useSchedule';

const rows = (...hours: number[]) =>
  hours.map((h, i) => ({ staff_id: i + 1, name: `S${i + 1}`, hours: h }));
const sum = (a: { share_cents: number }[]) => a.reduce((s, r) => s + r.share_cents, 0);

describe('allocateTips — tip-pool split (integer cents)', () => {
  it('returns an empty result for an empty roster', () => {
    expect(allocateTips(10000, [], 'even')).toEqual([]);
  });

  it('gives everyone $0 when the pool is zero or negative', () => {
    expect(allocateTips(0, rows(3, 2), 'even').map((r) => r.share_cents)).toEqual([0, 0]);
    expect(allocateTips(-500, rows(3, 2), 'hours').map((r) => r.share_cents)).toEqual([0, 0]);
  });

  it('splits evenly when it divides cleanly', () => {
    expect(allocateTips(9000, rows(0, 0, 0), 'even').map((r) => r.share_cents)).toEqual([3000, 3000, 3000]);
  });

  it('weights by hours worked', () => {
    expect(allocateTips(10000, rows(3, 1), 'hours').map((r) => r.share_cents)).toEqual([7500, 2500]);
  });

  it('gives $0 to all when total weight is zero (hours mode, nobody worked)', () => {
    expect(allocateTips(10000, rows(0, 0), 'hours').map((r) => r.share_cents)).toEqual([0, 0]);
  });

  it('does not NaN-poison shares when a row has NaN hours (hours mode)', () => {
    const out = allocateTips(10000, rows(NaN, 4), 'hours');
    expect(out.map((r) => r.share_cents)).toEqual([0, 0]);
    expect(sum(out)).toBe(0); // every share finite; nothing NaN, nothing invented
  });

  it('NEVER loses or invents a penny — shares always sum to the pool exactly', () => {
    const cases: Array<[number, number[], 'even' | 'hours' | 'points']> = [
      [10000, [1, 1, 1], 'even'],
      [9999, [1, 2, 3, 4], 'hours'],
      [100003, [2.5, 1.25, 7], 'hours'],
      [333, [1, 1, 1], 'even'],
      [1, [1, 1, 1, 1], 'even'],
      [55555, [3, 3, 3, 2, 1], 'points'],
    ];
    for (const [total, hrs, method] of cases) {
      const out = allocateTips(total, rows(...hrs), method);
      expect(sum(out), `total=${total} method=${method}`).toBe(total);
      expect(out.every((r) => r.share_cents >= 0)).toBe(true);
    }
  });

  it('largest-remainder keeps every share within one cent of an equal split', () => {
    const out = allocateTips(10000, rows(0, 0, 0), 'even')
      .map((r) => r.share_cents)
      .sort((a, b) => a - b);
    expect(out).toEqual([3333, 3333, 3334]);
  });
});
