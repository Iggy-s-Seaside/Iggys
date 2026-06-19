// useFirstRun — drives the dismissible "Get set up" onboarding checklist on the
// Dashboard. Tracks first-run + per-step completion in localStorage (key
// `iggys.onboarding`) and AUTO-completes steps from cheap existing signals so the
// list quietly empties itself as the bar gets real data — no manual ticking for
// the data-backed steps.
//
// Signals (one-shot HEAD count queries, the app's established cheap-existence
// pattern — see useMessages / useLuna): any event, any party, any staff row, any
// special. "Connect payments" has no cheap client signal, so it's manual-only:
// the user marks it done and that flag persists in localStorage.
//
// Resilience: every localStorage touch is wrapped in try/catch (private-mode /
// quota / disabled storage all degrade gracefully to in-memory state), and the
// count queries fail soft (an error just leaves a step incomplete, never throws).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

/** localStorage key for the onboarding state blob. */
const STORAGE_KEY = 'iggys.onboarding';

/** Stable ids for each onboarding step (also used as the manual-completion keys). */
export type OnboardingStepId =
  | 'event'
  | 'party'
  | 'team'
  | 'special'
  | 'payments';

export interface OnboardingStep {
  id: OnboardingStepId;
  /** Short, action-first label (e.g. "Add your first event"). */
  label: string;
  /** One-line context shown under the label. */
  hint: string;
  /** react-router target the row deep-links to. */
  to: string;
  /** Whether this step is satisfied (auto-derived signal OR manual flag). */
  done: boolean;
  /** True when this step can only be completed by the user marking it done
   *  (no cheap auto-signal exists — currently just "Connect payments"). */
  manual: boolean;
}

interface StoredState {
  /** User dismissed the whole checklist. */
  dismissed: boolean;
  /** Per-step manual completion flags (for steps with no auto-signal, and as a
   *  sticky override so an auto-completed step never visually "un-checks"). */
  manual: Partial<Record<OnboardingStepId, boolean>>;
}

const EMPTY_STATE: StoredState = { dismissed: false, manual: {} };

function readState(): StoredState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    return {
      dismissed: Boolean(parsed?.dismissed),
      manual: (parsed?.manual && typeof parsed.manual === 'object' ? parsed.manual : {}) as StoredState['manual'],
    };
  } catch {
    // Private mode / disabled storage / malformed JSON — degrade to in-memory.
    return EMPTY_STATE;
  }
}

function writeState(state: StoredState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota / disabled storage — keep going with in-memory state only.
  }
}

/** True if `table` has at least one row (HEAD count, no rows transferred). */
async function tableHasRows(table: string): Promise<boolean> {
  try {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    if (error) return false;
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}

/** Static definition of each step (label/hint/route/manual). Completion is
 *  layered on at runtime from the auto-signals + manual flags. */
const STEP_DEFS: ReadonlyArray<Omit<OnboardingStep, 'done'>> = [
  { id: 'event', label: 'Add your first event', hint: 'Put a show or theme night on the calendar.', to: '/events/new', manual: false },
  { id: 'party', label: 'Log a party inquiry', hint: 'Track a booking lead through the pipeline.', to: '/parties', manual: false },
  { id: 'team', label: 'Invite a teammate', hint: 'Add staff so the schedule and shifts fill in.', to: '/team', manual: false },
  { id: 'special', label: 'Customize a special', hint: "Design today's drink or dish special.", to: '/specials/editor', manual: false },
  { id: 'payments', label: 'Connect payments', hint: 'Take deposits and balances on parties.', to: '/team', manual: true },
];

export interface UseFirstRunResult {
  /** Every step, with live completion state. */
  steps: OnboardingStep[];
  /** User has dismissed the checklist entirely. */
  dismissed: boolean;
  /** Permanently hide the checklist. */
  dismiss: () => void;
  /** Mark a manual step (e.g. payments) as done. */
  markDone: (id: OnboardingStepId) => void;
  /** True once every step is complete. */
  isComplete: boolean;
  /** Auto-signals still resolving on first paint. */
  loading: boolean;
}

/**
 * Hook backing <OnboardingChecklist/>. Self-contained: it runs its own cheap
 * existence checks so callers just render. Auto-signals are sampled once on mount
 * (cheap, and onboarding doesn't need realtime); manual flags + dismissal live in
 * localStorage and persist across reloads.
 */
export function useFirstRun(): UseFirstRunResult {
  const [stored, setStored] = useState<StoredState>(() => readState());
  /** Auto-derived completion per step id (from table-has-rows signals). */
  const [auto, setAuto] = useState<Partial<Record<OnboardingStepId, boolean>>>({});
  const [loading, setLoading] = useState(true);

  // Sample the cheap existence signals once on mount. Errors fail soft (handled
  // inside tableHasRows), so a step just stays incomplete rather than throwing.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [event, party, team, special] = await Promise.all([
        tableHasRows('events'),
        tableHasRows('parties'),
        tableHasRows('staff'),
        tableHasRows('specials'),
      ]);
      if (cancelled) return;
      setAuto({ event, party, team, special });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback(() => {
    setStored((prev) => {
      const next = { ...prev, dismissed: true };
      writeState(next);
      return next;
    });
  }, []);

  const markDone = useCallback((id: OnboardingStepId) => {
    setStored((prev) => {
      const next: StoredState = { ...prev, manual: { ...prev.manual, [id]: true } };
      writeState(next);
      return next;
    });
  }, []);

  const steps = useMemo<OnboardingStep[]>(
    () =>
      STEP_DEFS.map((def) => ({
        ...def,
        // Done if the user manually marked it OR a live signal satisfies it.
        done: Boolean(stored.manual[def.id]) || Boolean(auto[def.id]),
      })),
    [stored.manual, auto],
  );

  const isComplete = useMemo(() => steps.every((s) => s.done), [steps]);

  return {
    steps,
    dismissed: stored.dismissed,
    dismiss,
    markDone,
    isComplete,
    loading,
  };
}
