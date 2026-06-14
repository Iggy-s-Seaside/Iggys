import { useEffect, useState, useCallback } from 'react';

/**
 * Global command-palette controller.
 *
 * The palette is mounted once (in DashboardLayout) and driven entirely through
 * a window-level custom event, so any component anywhere can open it without
 * prop-drilling or context. The CommandPalette component owns the listener; this
 * hook just exposes a clean imperative API plus the Cmd/Ctrl+K shortcut.
 */

const OPEN_EVENT = 'iggys:command-palette:open';

/** Imperatively open the global command palette from anywhere. */
export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

/**
 * Used internally by <CommandPalette/>. Wires the Cmd/Ctrl+K shortcut and the
 * imperative open event, and returns open/close state + setters.
 */
export function useCommandPaletteController() {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Cmd+K (mac) / Ctrl+K (win/linux) toggles the palette globally.
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return { open, setOpen, close };
}

/**
 * Optional convenience hook for non-palette components that only need to *open*
 * the palette (e.g. a mobile search pill in a header). Mirrors the naming of the
 * other ui hooks in this codebase.
 */
export function useCommandPalette() {
  return { open: openCommandPalette };
}
