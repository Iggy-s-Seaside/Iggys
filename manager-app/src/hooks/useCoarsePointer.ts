import { useSyncExternalStore } from 'react';

// True on touch-first devices (phones/tablets) where the OS draws a far better
// long-list picker than any custom panel. We branch on the POINTER CAPABILITY,
// not screen width — a phone in landscape is still coarse; a touch laptop is
// ambiguous but defaults safely to the native control.
const QUERY = '(pointer: coarse)';

function subscribe(cb: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', cb);
  return () => mql.removeEventListener('change', cb);
}

function getSnapshot() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(QUERY).matches;
}

// First-paint / SSR default = touch (safest: never flash a custom panel on a phone).
function getServerSnapshot() {
  return true;
}

export function useCoarsePointer(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
