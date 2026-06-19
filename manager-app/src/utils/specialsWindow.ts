// Specials auto-expire: decide whether a special should show publicly *right now*.
//
// Public visibility = `active` AND the current instant falls inside the optional
// [starts_at, expires_at] window. Either bound may be null (no bound on that side),
// and a special with both bounds null is purely `active`-driven, exactly like before
// this feature shipped. See scripts/add-specials-window.sql for column semantics.

import type { Special } from '../types';

/** The visibility-relevant fields of a special. Accepts the full `Special`. */
export type SpecialWindow = Pick<Special, 'active' | 'starts_at' | 'expires_at'>;

/** Lifecycle of a special relative to `now`, independent of the public-visibility gate. */
export type SpecialLifecycle = 'live' | 'scheduled' | 'expired' | 'inactive';

/** Human-readable chip label for each lifecycle state. */
export const SPECIAL_LIFECYCLE_LABELS: Record<SpecialLifecycle, string> = {
  live: 'Live',
  scheduled: 'Scheduled',
  expired: 'Expired',
  inactive: 'Inactive',
};

/**
 * Parse a nullable timestamptz string into epoch ms, or null if absent/invalid.
 * An unparseable bound is treated as "no bound" so a bad value never hides a special.
 */
function boundMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * True when the special is active AND `now` is within its [starts_at, expires_at]
 * window (each bound optional). This is the gate the public site filters on.
 */
export function isSpecialLive(special: SpecialWindow, now: Date = new Date()): boolean {
  if (!special.active) return false;

  const t = now.getTime();
  const start = boundMs(special.starts_at);
  const end = boundMs(special.expires_at);

  if (start !== null && t < start) return false;   // not started yet
  if (end !== null && t >= end) return false;       // window closed (end is exclusive)
  return true;
}

/**
 * Classify a special for display. Distinguishes *why* it isn't live so the manager
 * UI can show a meaningful chip (Scheduled vs Expired vs Inactive), unlike the plain
 * boolean `isSpecialLive`.
 *
 * - `inactive`  — the `active` switch is off (takes priority; the window is moot).
 * - `scheduled` — active, but `starts_at` is still in the future.
 * - `expired`   — active, but `expires_at` is at/in the past.
 * - `live`      — active and currently inside the window.
 */
export function getSpecialLifecycle(special: SpecialWindow, now: Date = new Date()): SpecialLifecycle {
  if (!special.active) return 'inactive';

  const t = now.getTime();
  const start = boundMs(special.starts_at);
  const end = boundMs(special.expires_at);

  if (start !== null && t < start) return 'scheduled';
  if (end !== null && t >= end) return 'expired';
  return 'live';
}

/** Convenience: the chip label for a special's current lifecycle. */
export function specialStatusLabel(special: SpecialWindow, now: Date = new Date()): string {
  return SPECIAL_LIFECYCLE_LABELS[getSpecialLifecycle(special, now)];
}
