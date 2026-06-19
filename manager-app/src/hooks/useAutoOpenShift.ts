import { useEffect, useRef } from 'react';
import { useShift } from './useShift';
import { useAuth } from '../context/AuthContext';

// The bar's posted hours: Open Daily 12pm–12am (noon to midnight). The window is
// [OPEN_HOUR, CLOSE_HOUR) in local time — change these if the hours ever change.
const OPEN_HOUR = 12; // noon
const CLOSE_HOUR = 24; // midnight

/**
 * Auto-opens the bar during business hours so nobody has to remember to tap
 * "Open the Bar." When a logged-in staff member has the app open and there's no
 * open shift for today's service day, this silently starts the shift once.
 *
 * Relies on two guards to stay idempotent: a per-mount useRef (fires at most
 * once, never loops) plus openShift itself, which is keyed on today's
 * business_day and no-ops/returns the existing row if a session is already open.
 * Never opens before noon or after close, and never if a shift is already open.
 *
 * Mount this once (Dashboard). It renders nothing.
 */
export function useAutoOpenShift() {
  const { isOpen, loading, openShift } = useShift();
  const { user } = useAuth();
  const triedRef = useRef(false);

  useEffect(() => {
    // Wait until shift state has loaded so we don't race a still-resolving
    // session and double-open.
    if (loading) return;
    if (triedRef.current) return;
    if (isOpen) return;
    if (!user) return;

    // Local hour must be within the bar's open window: noon (>= 12) up to but
    // not including midnight (<= 23). Outside that, leave the bar closed.
    const hour = new Date().getHours();
    if (hour < OPEN_HOUR || hour > CLOSE_HOUR - 1) return;

    // One attempt per mount, no matter what — guards against any re-run loop.
    // openShift shows its own "Bar opened" toast, so the auto-open stays quiet.
    triedRef.current = true;
    void openShift(user.email ?? null);
  }, [loading, isOpen, user, openShift]);
}
