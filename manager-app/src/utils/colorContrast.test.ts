import { describe, it, expect } from 'vitest';
import { getContrastRatio, getBestTextColor, getGradientColorAtY } from './colorContrast';

describe('getContrastRatio (WCAG 2.2)', () => {
  it('black vs white is the maximum 21:1', () => {
    expect(getContrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 4);
  });
  it('identical colors are 1:1', () => {
    expect(getContrastRatio('#3a3a3a', '#3a3a3a')).toBeCloseTo(1, 5);
  });
  it('is symmetric in its arguments', () => {
    expect(getContrastRatio('#123456', '#abcdef')).toBeCloseTo(getContrastRatio('#abcdef', '#123456'), 5);
  });
});

describe('getBestTextColor', () => {
  it('picks white on a dark background', () => {
    expect(getBestTextColor('#000000')).toBe('#ffffff');
  });
  it('avoids near-invisible white on a white background (picks teal)', () => {
    expect(getBestTextColor('#ffffff')).toBe('#2dd4bf');
  });
});

describe('getGradientColorAtY', () => {
  const grad = 'linear-gradient(180deg, #000000 0%, #ffffff 100%)';
  it('returns the first stop at the top and the last at the bottom', () => {
    expect(getGradientColorAtY(grad, 0, 100)).toBe('#000000');
    expect(getGradientColorAtY(grad, 100, 100)).toBe('#ffffff');
  });
  it('interpolates a mid-gradient color', () => {
    expect(getGradientColorAtY(grad, 50, 100)).toBe('#808080');
  });
  it('falls back to black when no stops parse', () => {
    expect(getGradientColorAtY('none', 10, 100)).toBe('#000000');
  });
});
