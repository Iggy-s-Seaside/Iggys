// useWeatherReach — turns the weather cross-signal's ACTION flags into Luna's
// unprompted reach, honoring the bounds she set (owner-ping only, max 1/hour,
// dismissed = silent 2h per concern). The decision logic is pure (lib/weatherWatch
// pickWeatherReach); this hook owns the persisted state + side effects.
//
// No DB writes: the reach is surfaced client-side through the existing reach banner,
// so it can never spam luna_insights. (The phone-push last mile is a separate layer.)

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWeatherWatch } from './useWeatherWatch';
import {
  pickWeatherReach,
  reachConcernKey,
  REACH_DISMISS_MS,
  type WeatherFlag,
  type WeatherReachState,
} from '../lib/weatherWatch';

const STORAGE_KEY = 'iggys.weatherReach.v1';
const EMPTY: WeatherReachState = { lastConcern: null, lastShownAt: null, dismissedUntil: {} };

function loadState(): WeatherReachState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const s = JSON.parse(raw) as Partial<WeatherReachState>;
    return {
      lastConcern: s.lastConcern ?? null,
      lastShownAt: typeof s.lastShownAt === 'number' ? s.lastShownAt : null,
      dismissedUntil: s.dismissedUntil && typeof s.dismissedUntil === 'object' ? s.dismissedUntil : {},
    };
  } catch {
    return EMPTY;
  }
}

function persist(state: WeatherReachState): WeatherReachState {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* quota / private mode */ }
  return state;
}

export function useWeatherReach(): { weatherReach: WeatherFlag | null; dismissWeatherReach: () => void } {
  const { flags } = useWeatherWatch();
  const [state, setState] = useState<WeatherReachState>(loadState);

  // Date.now() is read once per render only to compare against the bounds; the memo
  // intentionally excludes it (we don't want a recompute every millisecond — flags
  // or state changing is what can change the answer).
  const weatherReach = useMemo(
    () => pickWeatherReach(flags, state, Date.now()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flags, state]
  );

  // Stamp the rate-limit clock the first time a NEW concern is surfaced.
  useEffect(() => {
    if (!weatherReach) return;
    const key = reachConcernKey(weatherReach);
    if (key !== state.lastConcern) {
      setState((s) => persist({ ...s, lastConcern: key, lastShownAt: Date.now() }));
    }
  }, [weatherReach, state.lastConcern]);

  const dismissWeatherReach = useCallback(() => {
    if (!weatherReach) return;
    const key = reachConcernKey(weatherReach);
    // Dismissing is active engagement, not "I'm flooded": silence THIS concern for 2h,
    // but reset the rate clock so a different, genuinely new concern isn't starved by
    // the just-dismissed one's leftover hour.
    setState((s) => persist({
      ...s,
      lastConcern: null,
      lastShownAt: null,
      dismissedUntil: { ...s.dismissedUntil, [key]: Date.now() + REACH_DISMISS_MS },
    }));
  }, [weatherReach]);

  return { weatherReach, dismissWeatherReach };
}
