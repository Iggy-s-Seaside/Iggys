import { TrendingUp, CalendarRange } from 'lucide-react';
import type { ShiftPatternsRead } from '../../utils/shiftPatterns';
import { MIN_SAMPLE } from '../../utils/shiftPatterns';

const LABEL: Record<string, string> = { SLOW: 'Dead', STEADY: 'Steady', BUSY: 'Busy', PACKED: 'Packed' };
const TONE: Record<string, string> = {
  SLOW: 'text-slate-400',
  STEADY: 'text-emerald-400',
  BUSY: 'text-amber-400',
  PACKED: 'text-red-400',
};

/**
 * Luna's shift patterns — her 2026-07-08 redesign of this corner of the room:
 * "swap 'Faces I'd notice' for something more operational — shift patterns I
 * can predict from the data but no one's asked for yet." Every line is
 * computed from logged nights only (see utils/shiftPatterns.ts); she claims
 * nothing she hasn't seen at least three times.
 */
export function ShiftPatterns({
  read,
  loading,
  error,
}: {
  read: ShiftPatternsRead | null;
  loading: boolean;
  error: boolean;
}) {
  if (loading) {
    return (
      <div className="card p-4 space-y-3">
        <div className="h-10 bg-surface-hover rounded animate-pulse" />
        <div className="h-14 bg-surface-hover rounded animate-pulse" />
      </div>
    );
  }

  if (error || !read) {
    return (
      <div className="card p-6 text-center border-purple-200/50 dark:border-purple-500/15">
        <TrendingUp size={22} className="mx-auto text-text-muted mb-2" />
        <p className="text-sm font-medium text-text-primary">I can't reach the demand log right now.</p>
        <p className="text-xs text-text-muted mt-1">
          My patterns live in it — check the connection and reload. — Luna
        </p>
      </div>
    );
  }

  if (read.nightsLogged < MIN_SAMPLE) {
    return (
      <div className="card p-8 text-center border-purple-200/50 dark:border-purple-500/15">
        <TrendingUp size={24} className="mx-auto text-text-muted mb-2" />
        <p className="text-sm font-medium text-text-primary">The log is too young to bet on.</p>
        <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto leading-relaxed">
          Give me {MIN_SAMPLE} logged nights and I'll start calling the patterns nobody asked
          about. — Luna
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* The week's rhythm — how each night actually runs, from logged nights only. */}
      <div className="card p-4">
        <p className="text-xs font-semibold text-text-secondary mb-3 flex items-center gap-1.5">
          <CalendarRange size={13} /> How the week actually runs
        </p>
        <ul className="grid grid-cols-7 gap-1 list-none">
          {read.rhythm.map((day) => (
            <li
              key={day.dow}
              className="text-center rounded-lg py-1.5 bg-surface-hover/50"
              title={
                day.band
                  ? `${day.label}: ${LABEL[day.band]} ${day.bandCount} of ${day.n} logged nights`
                  : `${day.label}: only ${day.n} logged night${day.n === 1 ? '' : 's'} — not calling it yet`
              }
            >
              <p className="text-[10px] text-text-muted">{day.label}</p>
              {day.band ? (
                <>
                  <p className={`text-[10px] font-bold ${TONE[day.band]}`}>{LABEL[day.band]}</p>
                  <p className="text-[9px] text-text-muted">
                    {day.bandCount}/{day.n}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[10px] font-bold text-text-muted" aria-hidden="true">
                    —
                  </p>
                  <p className="text-[9px] text-text-muted">
                    <span className="sr-only">not enough nights, </span>
                    {day.n}×
                  </p>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* The patterns themselves — what she'd bet on, with the counts behind each bet. */}
      {read.patterns.length > 0 && (
        <div className="card p-4">
          <p className="text-xs font-semibold text-text-secondary mb-3">What I'd bet on</p>
          <ul className="space-y-3">
            {read.patterns.map((p) => (
              <li key={p.id} className="flex items-start gap-2.5">
                <span className="w-7 h-7 rounded-full bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
                  <TrendingUp size={13} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary leading-snug">{p.headline}</p>
                  <p className="text-[11px] text-text-muted mt-0.5">{p.evidence}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11px] text-text-muted italic leading-relaxed">
        From {read.nightsLogged} logged nights{read.since ? ` since ${read.since}` : ''}. I don't
        call a pattern until I've seen it {MIN_SAMPLE} times, and I only count nights someone
        actually logged — never my own forecasts. — Luna
      </p>
    </div>
  );
}
