import { describe, it, expect } from 'vitest';
import { measureLineWidth, drawLayerToCtx, drawImageLayerToCtx, drawVideoLayerToCtx } from './exportToCanvas';
import type { TextLayer } from '../../types';
import { DEFAULT_IMAGE_FILTERS } from '../../types';

// Minimal fixture — only the fields the functions under test read.
const layer = (over: Partial<TextLayer>): TextLayer =>
  ({
    id: 'l1',
    text: 'Hi',
    x: 0,
    y: 0,
    width: 300,
    fontFamily: 'Inter',
    fontSize: 40,
    fontWeight: 400,
    fill: '#fff',
    fontStyle: 'normal',
    textDecoration: '',
    textTransform: 'none',
    align: 'left',
    letterSpacing: 0,
    lineHeight: 1.5,
    rotation: 0,
    shadowColor: 'rgba(0,0,0,0.5)',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    stroke: '',
    strokeWidth: 0,
    opacity: 1,
    locked: false,
    visible: true,
    ...over,
  } as TextLayer);

// Fake ctx matching just the CanvasRenderingContext2D surface drawLayerToCtx touches.
// measureText returns a fixed 10px/char so widths are easy to predict.
function createMockTextCtx() {
  const strokes: { x1: number; y1: number; x2: number; y2: number }[] = [];
  let pending: { x1: number; y1: number } | null = null;
  const ctx = {
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    measureText: (t: string) => ({ width: t.length * 10 }) as TextMetrics,
    fillText: () => {},
    strokeText: () => {},
    beginPath: () => { pending = null; },
    moveTo: (x: number, y: number) => { pending = { x1: x, y1: y }; },
    lineTo: (x: number, y: number) => {
      if (pending) strokes.push({ ...pending, x2: x, y2: y });
    },
    stroke: () => {},
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'top' as CanvasTextBaseline,
    globalAlpha: 1,
    fillStyle: '#fff',
    strokeStyle: '#fff',
    lineWidth: 1,
    lineJoin: 'round' as CanvasLineJoin,
    shadowColor: 'transparent',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  } as unknown as CanvasRenderingContext2D;
  return { ctx, strokes };
}

describe('measureLineWidth', () => {
  it('matches plain measureText when there is no letter-spacing', () => {
    const { ctx } = createMockTextCtx();
    expect(measureLineWidth(ctx, 'Hi', 0)).toBe(20); // 2 chars * 10
  });

  it('REGRESSION: includes letter-spacing gaps between glyphs (old underline code measured only the first line and ignored letter-spacing)', () => {
    const { ctx } = createMockTextCtx();
    // 2 chars, one gap of 5 between them (not after the last glyph): 10 + 5 + 10
    expect(measureLineWidth(ctx, 'Hi', 5)).toBe(25);
  });

  it('returns 0 for an empty line regardless of spacing', () => {
    const { ctx } = createMockTextCtx();
    expect(measureLineWidth(ctx, '', 5)).toBe(0);
  });
});

describe('drawLayerToCtx — underline', () => {
  it("REGRESSION: draws one underline per line at that line's own y-offset (old code only underlined the first line)", () => {
    const { ctx, strokes } = createMockTextCtx();
    const l = layer({ text: 'Hi\nThere', textDecoration: 'underline', fontSize: 40, lineHeight: 1.5 });
    drawLayerToCtx(ctx, l);

    expect(strokes).toHaveLength(2);
    // lineHeight = fontSize * lineHeightMultiplier = 60
    expect(strokes[0].y1).toBe(l.y + 40 + 2);        // line 0: y + fontSize + 2
    expect(strokes[1].y1).toBe(l.y + 60 + 40 + 2);   // line 1: y + lineHeight + fontSize + 2
    // 'Hi' = 2 chars * 10, 'There' = 5 chars * 10 — each underline tracks its own line's width
    expect(strokes[0].x2 - strokes[0].x1).toBe(20);
    expect(strokes[1].x2 - strokes[1].x1).toBe(50);
  });
});

// Fake ctx matching just the CanvasRenderingContext2D surface drawImageLayerToCtx /
// drawVideoLayerToCtx touch, tracking globalCompositeOperation at each fillRect call.
function createMockMediaCtx() {
  let compositeOp = 'source-over';
  const fillRectCompositeOps: string[] = [];
  const ctx = {
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    beginPath: () => {},
    rect: () => {},
    clip: () => {},
    drawImage: () => {},
    fillRect: () => { fillRectCompositeOps.push(compositeOp); },
    globalAlpha: 1,
    fillStyle: '#000',
    filter: 'none',
    get globalCompositeOperation() { return compositeOp; },
    set globalCompositeOperation(v: string) { compositeOp = v; },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, fillRectCompositeOps };
}

describe('drawImageLayerToCtx — blend mode reset', () => {
  it('REGRESSION: resets compositeOperation to source-over before the overlay fill (old code left the blend mode leaking into the overlay color)', () => {
    const { ctx, fillRectCompositeOps } = createMockMediaCtx();
    const fakeImg = { complete: true, naturalWidth: 100, naturalHeight: 100 } as unknown as HTMLImageElement;
    const l = layer({
      elementType: 'image',
      imageSrc: 'https://example.com/a.jpg',
      imageHeight: 100,
      width: 100,
      blendMode: 'multiply',
      imageFilters: { ...DEFAULT_IMAGE_FILTERS, overlayOpacity: 0.5, overlayColor: '#123456' },
    });

    drawImageLayerToCtx(ctx, l, fakeImg);

    expect(fillRectCompositeOps).toEqual(['source-over']);
  });
});

describe('drawVideoLayerToCtx — blend mode reset', () => {
  it('REGRESSION: resets compositeOperation to source-over before the overlay fill (old code left the blend mode leaking into the overlay color)', () => {
    const { ctx, fillRectCompositeOps } = createMockMediaCtx();
    const fakeVideo = {
      readyState: 2,
      videoWidth: 100,
      videoHeight: 100,
    } as unknown as HTMLVideoElement;
    const l = layer({
      elementType: 'video',
      imageHeight: 100,
      width: 100,
      blendMode: 'screen',
      imageFilters: { ...DEFAULT_IMAGE_FILTERS, overlayOpacity: 0.5, overlayColor: '#123456' },
    });

    drawVideoLayerToCtx(ctx, l, fakeVideo);

    expect(fillRectCompositeOps).toEqual(['source-over']);
  });
});
