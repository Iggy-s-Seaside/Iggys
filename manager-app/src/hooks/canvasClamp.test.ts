import { describe, it, expect } from 'vitest';
import { clampPanAxis } from './useCanvasGestures';

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
