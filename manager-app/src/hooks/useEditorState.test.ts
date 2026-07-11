import { describe, it, expect } from 'vitest';
import { editorReducer, MAX_HISTORY } from './useEditorState';
import type { HistoryState } from './useEditorState';
import type { EditorState, TextLayer } from '../types';
import { DEFAULT_IMAGE_FILTERS } from '../types';

// Minimal fixtures — only the fields the reducer branches under test read.
const layer = (over: Partial<TextLayer>): TextLayer =>
  ({
    id: 'l1',
    text: 'Hi',
    x: 0,
    y: 0,
    width: 300,
    fontFamily: 'Inter',
    fontSize: 48,
    fontWeight: 400,
    fill: '#fff',
    fontStyle: 'normal',
    textDecoration: '',
    textTransform: 'none',
    align: 'center',
    letterSpacing: 0,
    lineHeight: 1.3,
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

const editorState = (over: Partial<EditorState> = {}): EditorState => ({
  backgroundImage: null,
  backgroundColor: '#1a1a2e',
  imageFilters: { ...DEFAULT_IMAGE_FILTERS },
  layers: [],
  selectedLayerId: null,
  canvasWidth: 1080,
  canvasHeight: 1080,
  ...over,
});

const historyState = (over: Partial<HistoryState> = {}): HistoryState => ({
  past: [],
  present: editorState(),
  future: [],
  pendingPast: null,
  ...over,
});

describe('editorReducer — SET_CANVAS_SIZE clamps stranded layers', () => {
  it('clamps a layer that falls outside the new (narrower) canvas', () => {
    // 1:1 (1080x1080) → 9:16 (608x1080): a layer sitting near the old right edge
    // is now off-canvas on x.
    const state = historyState({
      present: editorState({
        canvasWidth: 1080,
        canvasHeight: 1080,
        layers: [layer({ x: 800, y: 100, width: 300 })],
      }),
    });
    const next = editorReducer(state, { type: 'SET_CANVAS_SIZE', width: 608, height: 1080 });
    expect(next.present.layers[0].x).toBeLessThanOrEqual(608 - 300);
    expect(next.present.layers[0].x).toBeGreaterThanOrEqual(0);
  });

  it('clamps a layer whose y falls outside a shorter new canvas', () => {
    const state = historyState({
      present: editorState({
        canvasWidth: 1080,
        canvasHeight: 1920,
        layers: [layer({ x: 0, y: 1800, width: 300, fontSize: 48, text: 'Hi' })],
      }),
    });
    const next = editorReducer(state, { type: 'SET_CANVAS_SIZE', width: 1080, height: 400 });
    const l = next.present.layers[0];
    expect(l.y).toBeLessThanOrEqual(400);
    expect(l.y).toBeGreaterThanOrEqual(0);
  });

  it('leaves a layer untouched when it already fits the new canvas', () => {
    const state = historyState({
      present: editorState({
        canvasWidth: 1080,
        canvasHeight: 1080,
        layers: [layer({ x: 10, y: 10, width: 300 })],
      }),
    });
    const next = editorReducer(state, { type: 'SET_CANVAS_SIZE', width: 1920, height: 1080 });
    expect(next.present.layers[0].x).toBe(10);
    expect(next.present.layers[0].y).toBe(10);
  });
});

describe('editorReducer — UNDO/REDO fold an in-flight pendingPast', () => {
  it('UNDO folds pendingPast into past before stepping back, instead of discarding it', () => {
    const original = editorState({ layers: [layer({ fill: '#fff' })] });
    const dragged = editorState({ layers: [layer({ fill: '#f00' })] });
    const state = historyState({
      past: [],
      present: dragged,
      pendingPast: original,
    });
    const next = editorReducer(state, { type: 'UNDO' });
    // The only history entry was the pending drag baseline — undo must land back on it.
    expect(next.present).toBe(original);
    expect(next.past).toEqual([]);
    expect(next.future).toEqual([dragged]);
    expect(next.pendingPast).toBeNull();
  });

  it('REDO folds pendingPast into past before stepping forward', () => {
    const original = editorState({ layers: [layer({ fill: '#fff' })] });
    const dragged = editorState({ layers: [layer({ fill: '#f00' })] });
    const futureState = editorState({ layers: [layer({ fill: '#00f' })] });
    const state = historyState({
      past: [],
      present: dragged,
      future: [futureState],
      pendingPast: original,
    });
    const next = editorReducer(state, { type: 'REDO' });
    expect(next.present).toBe(futureState);
    expect(next.past).toEqual([original, dragged]);
    expect(next.pendingPast).toBeNull();
  });
});

describe('editorReducer — past array steady-state length', () => {
  it('never exceeds MAX_HISTORY entries once at steady state', () => {
    let state = historyState({
      past: Array.from({ length: MAX_HISTORY }, (_, i) => editorState({ backgroundColor: `#${i}` })),
      present: editorState({ backgroundColor: '#present' }),
    });
    state = editorReducer(state, { type: 'SET_BACKGROUND_COLOR', color: '#new' });
    expect(state.past.length).toBe(MAX_HISTORY);
  });

  it('COMMIT_HISTORY also respects the MAX_HISTORY cap at steady state', () => {
    let state = historyState({
      past: Array.from({ length: MAX_HISTORY }, (_, i) => editorState({ backgroundColor: `#${i}` })),
      present: editorState({ backgroundColor: '#present' }),
      pendingPast: editorState({ backgroundColor: '#pending' }),
    });
    state = editorReducer(state, { type: 'COMMIT_HISTORY' });
    expect(state.past.length).toBe(MAX_HISTORY);
  });
});

describe('editorReducer — REORDER_LAYERS validates against stale/foreign arrays', () => {
  it('rejects a reorder array with a different length', () => {
    const state = historyState({
      present: editorState({ layers: [layer({ id: 'a' }), layer({ id: 'b' })] }),
    });
    const next = editorReducer(state, { type: 'REORDER_LAYERS', layers: [layer({ id: 'a' })] });
    expect(next.present.layers.map((l) => l.id)).toEqual(['a', 'b']);
  });

  it('rejects a reorder array containing an id not in the current layers', () => {
    const state = historyState({
      present: editorState({ layers: [layer({ id: 'a' }), layer({ id: 'b' })] }),
    });
    const next = editorReducer(state, {
      type: 'REORDER_LAYERS',
      layers: [layer({ id: 'a' }), layer({ id: 'zzz' })],
    });
    expect(next.present.layers.map((l) => l.id)).toEqual(['a', 'b']);
  });

  it('accepts a valid reorder (same ids, different order)', () => {
    const state = historyState({
      present: editorState({ layers: [layer({ id: 'a' }), layer({ id: 'b' })] }),
    });
    const next = editorReducer(state, {
      type: 'REORDER_LAYERS',
      layers: [layer({ id: 'b' }), layer({ id: 'a' })],
    });
    expect(next.present.layers.map((l) => l.id)).toEqual(['b', 'a']);
  });
});
