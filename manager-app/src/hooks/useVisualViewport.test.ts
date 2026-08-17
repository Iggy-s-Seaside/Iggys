import { describe, it, expect } from 'vitest';
import { computeKeyboardState, KEYBOARD_HEIGHT_RATIO } from './useVisualViewport';

// Pure threshold/inset logic — visualViewport itself is mocked by feeding
// heights directly, so no browser or jsdom is required.
describe('computeKeyboardState', () => {
  const LAYOUT = 844; // iPhone layout viewport height

  it('reports the keyboard closed at full height', () => {
    expect(computeKeyboardState(LAYOUT, LAYOUT)).toEqual({
      keyboardVisible: false,
      keyboardInset: 0,
    });
  });

  it('reports the keyboard open (with inset) once the visual viewport drops below the threshold', () => {
    // Typical iOS keyboard: visual viewport ~55-65% of layout height.
    const visual = 500;
    const state = computeKeyboardState(visual, LAYOUT);
    expect(state.keyboardVisible).toBe(true);
    expect(state.keyboardInset).toBe(LAYOUT - visual);
  });

  it('stays closed for small shrinks above the threshold (toolbars, pinch-zoom)', () => {
    // 80% of layout — above the 0.75 ratio, must NOT count as keyboard.
    const visual = Math.ceil(LAYOUT * 0.8);
    expect(computeKeyboardState(visual, LAYOUT)).toEqual({
      keyboardVisible: false,
      keyboardInset: 0,
    });
  });

  it('flips exactly at the 0.75 ratio boundary', () => {
    const justAbove = LAYOUT * KEYBOARD_HEIGHT_RATIO + 1;
    const justBelow = LAYOUT * KEYBOARD_HEIGHT_RATIO - 1;
    expect(computeKeyboardState(justAbove, LAYOUT).keyboardVisible).toBe(false);
    expect(computeKeyboardState(justBelow, LAYOUT).keyboardVisible).toBe(true);
  });

  it('never returns a negative inset', () => {
    // Defensive: a visual viewport taller than layout must clamp to 0.
    expect(computeKeyboardState(LAYOUT + 100, LAYOUT).keyboardInset).toBe(0);
  });

  it('rounds fractional inset to whole pixels', () => {
    const state = computeKeyboardState(400.4, LAYOUT);
    expect(state.keyboardInset).toBe(Math.round(LAYOUT - 400.4));
  });
});
