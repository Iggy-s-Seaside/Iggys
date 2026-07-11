import { describe, it, expect } from 'vitest';
import { clampResizeWidth } from './useElementInteraction';

describe('clampResizeWidth — anchored-corner resize clamp', () => {
  it('right-handle resize (anchor = left edge) clamps to room right of startLayerX', () => {
    // canvasWidth=1080, startLayerX=900 → only 180px of room to the right.
    expect(clampResizeWidth(true, 400, 900, 200, 1080)).toBe(180);
  });

  it('right-handle resize within bounds is untouched', () => {
    expect(clampResizeWidth(true, 300, 100, 200, 1080)).toBe(300);
  });

  it('REGRESSION: left-handle resize (anchor = right edge) clamps to room left of the right edge, not the absolute canvas width', () => {
    // Old bug: clamped against absolute canvasWidth (1080), then clamped the derived
    // x to 0 afterward — which silently dragged the anchored right edge inward.
    // Correct: anchor = startLayerX + startWidth = 50 + 100 = 150, so max width is 150
    // regardless of the 1080 canvas width.
    expect(clampResizeWidth(false, 900, 50, 100, 1080)).toBe(150);
  });

  it('left-handle resize within bounds is untouched', () => {
    expect(clampResizeWidth(false, 120, 300, 200, 1080)).toBe(120);
  });

  it('never clamps below the 50px minimum width', () => {
    expect(clampResizeWidth(true, 10, 1075, 20, 1080)).toBe(50);
    expect(clampResizeWidth(false, 10, 2, 20, 1080)).toBe(50);
  });
});
