import { describe, it, expect } from 'vitest';
import { computeVideoSeekTime, qualityToMaxColors } from './exportToGif';

describe('computeVideoSeekTime — looping vs non-looping video seek', () => {
  it('REGRESSION: a looping video shorter than the shared timeline wraps instead of freezing on its last frame', () => {
    // 4s shared time, 3s video that loops — should wrap to 1s, not clamp to 3s.
    expect(computeVideoSeekTime(4, 3, true)).toBeCloseTo(1);
  });

  it('wraps a second time around when the timeline outruns multiple loop cycles', () => {
    expect(computeVideoSeekTime(7, 3, true)).toBeCloseTo(1);
  });

  it('a non-looping video keeps the current clamp behavior (time passed through unchanged)', () => {
    expect(computeVideoSeekTime(4, 3, false)).toBe(4);
  });

  it('passes time through unchanged while still within the video duration', () => {
    expect(computeVideoSeekTime(1.5, 3, true)).toBe(1.5);
  });

  it('does not divide by an unusable duration (0 or non-finite)', () => {
    expect(computeVideoSeekTime(4, 0, true)).toBe(4);
    expect(computeVideoSeekTime(4, NaN, true)).toBe(4);
    expect(computeVideoSeekTime(4, Infinity, true)).toBe(4);
  });
});

describe('qualityToMaxColors — gifenc quality knob wiring', () => {
  it('maps the documented default quality (10) to the full 256-color palette', () => {
    expect(qualityToMaxColors(10)).toBe(256);
  });

  it('lower quality numbers (better quality, per docs) map to a larger palette, clamped to 256', () => {
    expect(qualityToMaxColors(1)).toBe(256);
  });

  it('higher quality numbers (worse quality) map to a smaller palette, clamped to a 64 floor', () => {
    expect(qualityToMaxColors(30)).toBe(85);
    expect(qualityToMaxColors(100)).toBe(64);
  });
});
