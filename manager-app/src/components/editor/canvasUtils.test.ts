import { describe, it, expect } from 'vitest';
import { renderGradient } from './canvasUtils';

// Minimal fake matching just the CanvasRenderingContext2D surface renderGradient touches.
function createMockCtx() {
  const colorStops: { offset: number; color: string }[] = [];
  const ctx = {
    createLinearGradient: () => ({
      addColorStop: (offset: number, color: string) => {
        colorStops.push({ offset, color });
      },
    }),
    fillStyle: undefined as unknown,
    fillRect: () => {},
  } as unknown as CanvasRenderingContext2D;
  return { ctx, colorStops };
}

describe('renderGradient — stop tokenization', () => {
  it('REGRESSION: an rgba(...) stop with internal commas is not dropped (old split(",") fragmented it before per-stop matching)', () => {
    const { ctx, colorStops } = createMockCtx();
    renderGradient(ctx, 'linear-gradient(90deg, #000000 0%, rgba(0,0,0,0.5) 50%, #ffffff 100%)', 100, 100);

    expect(colorStops).toHaveLength(3);
    expect(colorStops[0]).toEqual({ offset: 0, color: '#000000' });
    expect(colorStops[1]).toEqual({ offset: 0.5, color: 'rgba(0,0,0,0.5)' });
    expect(colorStops[2]).toEqual({ offset: 1, color: '#ffffff' });
  });

  it('parses plain hex stops without rgba unaffected', () => {
    const { ctx, colorStops } = createMockCtx();
    renderGradient(ctx, 'linear-gradient(45deg, #ff0000 0%, #00ff00 100%)', 200, 200);

    expect(colorStops).toHaveLength(2);
    expect(colorStops[0]).toEqual({ offset: 0, color: '#ff0000' });
    expect(colorStops[1]).toEqual({ offset: 1, color: '#00ff00' });
  });
});
