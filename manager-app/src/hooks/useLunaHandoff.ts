import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { LunaActionState } from '../types';

/** What a target page reads off a Luna one-tap handoff. */
export interface LunaHandoff {
  /** Luna's ready-to-use text (email body, caption, reply) — never auto-sent. */
  draft?: string;
  /** Structured fields to pre-fill the target flow. */
  payload?: Record<string, unknown>;
  /** The insight id this handoff came from, if any. */
  fromInsight?: number;
}

/**
 * Reads Luna's one-tap action payload off the router `location.state` when a page
 * is reached from an InsightCard (see Luna.tsx), then clears it from history so it
 * never re-fires on re-render, refresh, or back/forward navigation.
 *
 * The handoff is captured once on mount: the page can pre-fill its compose form
 * and open the relevant modal, and the manager always reviews before sending.
 */
export function useLunaHandoff(): LunaHandoff {
  const location = useLocation();
  // Snapshot the state once on mount — the clear below mutates history, so a
  // later read of location.state would come back empty. The lazy initializer
  // keeps `handoff` referentially stable across renders (pages depend on it).
  const [handoff] = useState<LunaHandoff>(() => {
    const state = location.state as LunaActionState | null;
    return state
      ? { draft: state.lunaDraft, payload: state.lunaPayload, fromInsight: state.fromInsight }
      : {};
  });

  // Strip the Luna payload from history.state once consumed so a refresh or a
  // back/forward to this entry doesn't replay the prefill. React Router stores
  // location.state under history.state.usr; we drop only the Luna keys and keep
  // the router's own bookkeeping (idx/key) and any unrelated state intact.
  useEffect(() => {
    if (!location.state) return;
    const hist = window.history.state ?? {};
    const usr = (hist.usr ?? {}) as Record<string, unknown>;
    const rest: Record<string, unknown> = { ...usr };
    delete rest.lunaDraft;
    delete rest.lunaPayload;
    delete rest.fromInsight;
    const nextUsr = Object.keys(rest).length > 0 ? rest : null;
    window.history.replaceState({ ...hist, usr: nextUsr }, '');
    // Captured once on mount — the dependency is intentionally empty.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return handoff;
}
