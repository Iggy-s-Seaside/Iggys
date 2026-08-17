import { useEffect, useState } from 'react';

/**
 * iOS does not resize the layout viewport when the software keyboard opens —
 * it only shrinks window.visualViewport. Anything anchored to the bottom of
 * the page (or below the fold) ends up underneath the keyboard. This hook is
 * the single source of truth for detecting that (extracted from BottomSheet,
 * where the pattern proved out) so any surface can lift itself clear.
 */

/** Keyboard heuristic: the visual viewport only shrinks this much when the
 * software keyboard is up (toolbars / pinch-zoom never take 25%). */
export const KEYBOARD_HEIGHT_RATIO = 0.75;

export interface KeyboardViewportState {
  /** True while the software keyboard is judged to be on screen. */
  keyboardVisible: boolean;
  /** Pixels of layout viewport covered by the keyboard (0 when closed). */
  keyboardInset: number;
}

/** Pure threshold/inset calculation, exported for unit tests. */
export function computeKeyboardState(visualHeight: number, layoutHeight: number): KeyboardViewportState {
  const keyboardVisible = visualHeight < layoutHeight * KEYBOARD_HEIGHT_RATIO;
  return {
    keyboardVisible,
    keyboardInset: keyboardVisible ? Math.max(0, Math.round(layoutHeight - visualHeight)) : 0,
  };
}

/**
 * Track the on-screen keyboard via window.visualViewport.
 *
 * @param enabled Gate the listener (e.g. only while a sheet is open). When
 * false, no listener is attached and the last state is kept — matching the
 * original BottomSheet behaviour.
 *
 * Safe on browsers without window.visualViewport (older Safari, some desktop
 * browsers): returns the closed state forever.
 */
export function useVisualViewport(enabled = true): KeyboardViewportState {
  const [state, setState] = useState<KeyboardViewportState>({ keyboardVisible: false, keyboardInset: 0 });

  useEffect(() => {
    if (!enabled) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const handleResize = () => setState(computeKeyboardState(vv.height, window.innerHeight));
    vv.addEventListener('resize', handleResize);
    return () => vv.removeEventListener('resize', handleResize);
  }, [enabled]);

  return state;
}
