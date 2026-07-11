import { describe, it, expect } from 'vitest';
import { shiftHours } from './useSchedule';

describe('shiftHours — shift length in hours', () => {
  it('computes a normal same-day shift', () => {
    expect(shiftHours(1020, 1200)).toBe(3); // 5:00pm -> 8:00pm
  });

  it('handles a shift that runs past midnight', () => {
    expect(shiftHours(1320, 120)).toBe(4); // 10:00pm -> 2:00am
  });

  it('treats a zero-length shift (start == end) as 0 hours, not 24', () => {
    // Regression: the past-midnight branch (endMin + 1440 - startMin) used to fire
    // on equality, reporting a same-start/end shift as a full 24h day — which would
    // inflate labor totals and tip-pool weights.
    expect(shiftHours(600, 600)).toBe(0);
    expect(shiftHours(0, 0)).toBe(0);
  });

  it('handles fractional hours', () => {
    expect(shiftHours(600, 630)).toBe(0.5); // 30 minutes
  });
});
