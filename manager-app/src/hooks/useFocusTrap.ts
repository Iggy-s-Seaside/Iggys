import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter(
    (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement
  );
}

interface FocusTrapOptions {
  /** Called when Escape is pressed (unless closeOnEscape is false). */
  onEscape?: () => void;
  /** Restore focus to the previously-focused element on deactivate. Default true. */
  restoreFocus?: boolean;
  /** Handle Escape -> onEscape. Default true. */
  closeOnEscape?: boolean;
}

/**
 * useFocusTrap — trap keyboard focus inside an overlay while `active`.
 *
 * On activate: remembers the focused element, then moves focus to the first
 * focusable inside `containerRef` (or the container itself). While active:
 * Tab / Shift+Tab cycle within the container and Escape calls `onEscape`. On
 * deactivate (or unmount): restores focus to the opener. Give the container
 * tabIndex={-1} so it can hold focus when it has no focusable children.
 *
 * Extracted from Modal so BottomSheet, the mobile nav drawer, and any other
 * role="dialog" overlay get the same correct, accessible behavior.
 */
export function useFocusTrap(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
  { onEscape, restoreFocus = true, closeOnEscape = true }: FocusTrapOptions = {}
) {
  // Hold onEscape in a ref, synced after each render, so a caller passing an inline
  // arrow (every one of the 11 callers does) doesn't churn the trap effect's deps and
  // tear it down / re-arm it on each parent re-render — which would re-snap focus to
  // the first child mid-session and restore focus to a node inside the dialog, not the
  // opener. Synced in an effect (not during render) to keep the hook render-pure.
  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  });

  useEffect(() => {
    if (!active) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const container = containerRef.current;
    if (container) {
      const focusable = getFocusable(container);
      (focusable[0] ?? container).focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        e.preventDefault();
        onEscapeRef.current?.();
        return;
      }
      if (e.key !== 'Tab' || !containerRef.current) return;

      const focusable = getFocusable(containerRef.current);
      if (focusable.length === 0) {
        e.preventDefault();
        containerRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeEl = document.activeElement;

      if (e.shiftKey) {
        if (activeEl === first || !containerRef.current.contains(activeEl)) {
          e.preventDefault();
          last.focus();
        }
      } else if (activeEl === last || !containerRef.current.contains(activeEl)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      if (restoreFocus) previouslyFocused?.focus?.();
    };
    // onEscape intentionally excluded — read via onEscapeRef so callback identity
    // churn never re-runs the trap. The effect re-arms only on genuine state changes.
  }, [active, containerRef, restoreFocus, closeOnEscape]);
}
