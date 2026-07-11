/**
 * buzz — a short, guarded haptic tap.
 *
 * Centralizes the navigator.vibrate calls that were copy-pasted across the editor,
 * pipeline drag, and element-interaction hooks. It is:
 *   - feature-detected: a no-op where the Vibration API is unsupported (e.g. iOS
 *     Safari, desktop) — so callers never need their own `'vibrate' in navigator` guard;
 *   - SSR-safe;
 *   - reduced-motion-aware: skipped when the user asks for reduced motion;
 *   - throw-proof: vibrate() can reject in some sandboxed/permission contexts, and a
 *     haptic must never break the tap it accompanies.
 *
 * @param pattern ms, or an on/off pattern array (default a single 10ms tap).
 */
export function buzz(pattern: number | number[] = 10): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    navigator.vibrate(pattern);
  } catch {
    /* never let a haptic break a tap */
  }
}
