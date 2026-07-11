import { describe, it, expect } from 'vitest';
import { clampPanAxis, pinchOverlapDelta } from './useCanvasGestures';

describe('clampPanAxis — post-pan clamp per axis', () => {
  it('REGRESSION: canvas fitting inside the viewport keeps its centered pan (old math slammed it to viewport − 0.75·scaled — the bottom-corner jump)', () => {
    // vw=1400, canvas scaled to 600, centered pan = 400.
    expect(clampPanAxis(400, 1400, 600)).toBe(400);
    // Old inverted-range result would have been 1400 - 450 = 950.
    expect(clampPanAxis(400, 1400, 600)).not.toBe(950);
  });

  it('fitting canvas is kept fully inside the viewport', () => {
    expect(clampPanAxis(-50, 1400, 600)).toBe(0); // dragged past left edge
    expect(clampPanAxis(1200, 1400, 600)).toBe(800); // past right edge → vw − scaled
    expect(clampPanAxis(0, 1400, 600)).toBe(0);
    expect(clampPanAxis(800, 1400, 600)).toBe(800);
  });

  it('zoomed-in canvas keeps at least 25% on screen', () => {
    // vw=1400, scaled=2000 → range [1400 − 1500, 500] = [−100, 500]
    expect(clampPanAxis(-500, 1400, 2000)).toBe(-100);
    expect(clampPanAxis(900, 1400, 2000)).toBe(500);
    expect(clampPanAxis(200, 1400, 2000)).toBe(200);
  });

  it('exact-fit boundary (scaled === viewport) pins to 0', () => {
    expect(clampPanAxis(123, 1400, 1400)).toBe(0);
    expect(clampPanAxis(-123, 1400, 1400)).toBe(0);
  });
});

describe('pinchOverlapDelta — ground-truth post-pinch clamp per axis', () => {
  it('sufficient overlap (≥25% of content size) needs no correction', () => {
    // content [0, 400], viewport [100, 500] → overlap 300 ≥ 100 (25% of 400)
    expect(pinchOverlapDelta(0, 400, 100, 400)).toBe(0);
  });

  it('REGRESSION: a hard fling past the left/top edge is pulled back to 25% overlap', () => {
    // content [-500, -100] (width 400), viewport [0, 800] → overlap 0, needs 100.
    // delta = (viewportStart + minOverlap) - contentEnd = (0 + 100) - (-100) = 200
    expect(pinchOverlapDelta(-500, 400, 0, 800)).toBe(200);
  });

  it('REGRESSION: a hard fling past the right/bottom edge is pulled back to 25% overlap', () => {
    // content [900, 1300] (width 400), viewport [0, 800] → overlap 0, needs 100.
    // delta = (viewportEnd - minOverlap) - contentStart = (800 - 100) - 900 = -200
    expect(pinchOverlapDelta(900, 400, 0, 800)).toBe(-200);
  });

  it('exactly 25% overlap is left untouched (boundary, not off-by-one)', () => {
    // content [700, 1100] (width 400), viewport [0, 800] → overlap = 800-700 = 100 = 25%
    expect(pinchOverlapDelta(700, 400, 0, 800)).toBe(0);
  });

  it('degenerate zero/negative content size is a no-op', () => {
    expect(pinchOverlapDelta(100, 0, 0, 800)).toBe(0);
  });
});
