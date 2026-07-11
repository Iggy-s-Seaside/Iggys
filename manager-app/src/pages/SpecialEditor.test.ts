import { describe, it, expect } from 'vitest';
import { findUnresolvedMediaLayers, applyResolvedMediaUrls, isAnyEditorOverlayOpen } from './SpecialEditor';
import type { EditorOverlayFlags } from './SpecialEditor';
import type { TextLayer } from '../types';

// Minimal fixture — only the fields the functions under test read.
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

describe('findUnresolvedMediaLayers', () => {
  it('finds image layers still pointing at an idb:// ref', () => {
    const layers = [
      layer({ id: 'a', elementType: 'image', imageSrc: 'idb://media-1' }),
      layer({ id: 'b', elementType: 'image', imageSrc: 'https://cdn.example.com/x.jpg' }),
    ];
    expect(findUnresolvedMediaLayers(layers).map((l) => l.id)).toEqual(['a']);
  });

  it('finds video layers still pointing at an idb:// ref', () => {
    const layers = [
      layer({ id: 'a', elementType: 'video', videoSrc: 'idb://media-2' }),
      layer({ id: 'b', elementType: 'video', videoSrc: 'https://cdn.example.com/x.mp4' }),
    ];
    expect(findUnresolvedMediaLayers(layers).map((l) => l.id)).toEqual(['a']);
  });

  it('ignores text layers with no image/video source', () => {
    const layers = [layer({ id: 'a', elementType: 'text' })];
    expect(findUnresolvedMediaLayers(layers)).toEqual([]);
  });
});

describe('applyResolvedMediaUrls', () => {
  it('swaps imageSrc for the resolved URL, keyed by layer id', () => {
    const layers = [layer({ id: 'a', elementType: 'image', imageSrc: 'idb://media-1' })];
    const result = applyResolvedMediaUrls(layers, [{ id: 'a', url: 'https://cdn.example.com/a.jpg' }]);
    expect(result[0].imageSrc).toBe('https://cdn.example.com/a.jpg');
  });

  it('swaps videoSrc (not imageSrc) for video-element layers', () => {
    const layers = [layer({ id: 'a', elementType: 'video', videoSrc: 'idb://media-1' })];
    const result = applyResolvedMediaUrls(layers, [{ id: 'a', url: 'https://cdn.example.com/a.mp4' }]);
    expect(result[0].videoSrc).toBe('https://cdn.example.com/a.mp4');
    expect(result[0].imageSrc).toBeUndefined();
  });

  it('leaves a layer unchanged when its resolution failed (null url)', () => {
    const layers = [layer({ id: 'a', elementType: 'image', imageSrc: 'idb://media-1' })];
    const result = applyResolvedMediaUrls(layers, [{ id: 'a', url: null }]);
    expect(result[0].imageSrc).toBe('idb://media-1');
  });

  it('leaves a layer unchanged when it has no matching resolution entry', () => {
    const layers = [layer({ id: 'a', elementType: 'image', imageSrc: 'idb://media-1' })];
    expect(applyResolvedMediaUrls(layers, [])[0].imageSrc).toBe('idb://media-1');
  });
});

describe('isAnyEditorOverlayOpen', () => {
  const noneOpen: EditorOverlayFlags = {
    mobileFontPickerOpen: false,
    mobileBlendPickerOpen: false,
    libraryOpen: false,
    mobileFiltersOpen: false,
    mobileSheet: null,
    templatePickerOpen: false,
    presetsOpen: false,
    customSizeOpen: false,
    exportModalOpen: false,
    saveModalOpen: false,
  };

  it('is false when every overlay flag is closed', () => {
    expect(isAnyEditorOverlayOpen(noneOpen)).toBe(false);
  });

  it('is true when a boolean overlay flag is open', () => {
    expect(isAnyEditorOverlayOpen({ ...noneOpen, mobileBlendPickerOpen: true })).toBe(true);
  });

  it('is true when mobileSheet is any non-null sheet (not a boolean flag)', () => {
    expect(isAnyEditorOverlayOpen({ ...noneOpen, mobileSheet: 'layers' })).toBe(true);
  });
});
