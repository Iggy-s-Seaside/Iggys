import { useMemo } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  format,
} from 'date-fns';
import { AlertTriangle } from 'lucide-react';

/** A single item rendered inside a day cell (dot on phones, chip on sm:+). */
export interface DayChip {
  /** Stable key within its day (e.g. event id / party id). */
  key: string;
  /** Short label shown on the chip. */
  label: string;
  /** Visual tone — maps to a semantic accent. */
  tone: 'primary' | 'success' | 'accent' | 'muted';
}

interface MonthGridProps {
  /** The month currently displayed (any day within it). */
  month: Date;
  /** Items keyed by `yyyy-MM-dd`. */
  chipsByDay: Record<string, DayChip[]>;
  /** Days (yyyy-MM-dd) with a REAL space+time conflict — flagged with a warning icon. */
  conflictDays: Set<string>;
  /** Tapping anywhere on a day cell (passes the `yyyy-MM-dd` for that day). */
  onSelectDay: (dayKey: string) => void;
  /** How many text chips to render before collapsing to a "+N more" line (sm:+ only). */
  maxChips?: number;
}

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const WEEKDAY_LABELS_LONG = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CHIP_TONE: Record<DayChip['tone'], string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success-light text-success',
  accent: 'bg-warning-light text-accent',
  muted: 'bg-surface-hover text-text-secondary',
};

// Full opacity on every tone: a dot IS the only signal a day carries on a
// phone, so a half-transparent one reads as "nothing on" in a dim bar and the
// density map silently under-reports the day.
const DOT_TONE: Record<DayChip['tone'], string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  accent: 'bg-accent',
  muted: 'bg-text-muted',
};

/**
 * MonthGrid — a 7-column calendar month laid out on full weeks.
 *
 * Phones (<640px) get a DENSITY MAP: no unreadable 3-character text chips,
 * just the date number, up to 3 colored dots, and a count when there's more.
 * Wider screens keep text chips. Either way the CELL ITSELF is one ≥44px
 * button — there is no overlay/child z-index fight, so every tap on a day
 * lands, and every day announces its date AND contents to screen readers.
 */
export function MonthGrid({
  month,
  chipsByDay,
  conflictDays,
  onSelectDay,
  maxChips = 3,
}: MonthGridProps) {
  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [month]);

  return (
    <div className="card overflow-hidden">
      {/* Weekday header — two letters on phones so S/T days are unambiguous. */}
      <div className="grid grid-cols-7 border-b border-border bg-surface-hover/50">
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={label}
            className="px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-text-muted"
          >
            <span className="hidden sm:inline">{WEEKDAY_LABELS_LONG[i]}</span>
            <span className="sm:hidden">{label}</span>
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const inMonth = isSameMonth(day, month);
          const today = isToday(day);
          const chips = chipsByDay[key] ?? [];
          const visible = chips.slice(0, maxChips);
          const overflow = chips.length - visible.length;
          const hasConflict = conflictDays.has(key);

          const ariaLabel = [
            format(day, 'EEEE, MMMM d'),
            chips.length === 0
              ? 'nothing scheduled'
              : `${chips.length} item${chips.length === 1 ? '' : 's'}: ${chips.map((c) => c.label).join(', ')}`,
            hasConflict ? 'scheduling conflict' : null,
          ]
            .filter(Boolean)
            .join(', ');

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDay(key)}
              aria-label={ariaLabel}
              className={`relative min-h-[3.5rem] sm:min-h-[7rem] border-b border-r border-border last:border-r-0 [&:nth-child(7n)]:border-r-0 flex flex-col items-stretch text-left transition-colors hover:bg-surface-hover/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset ${
                inMonth ? 'bg-surface' : 'bg-surface-hover/30'
              }`}
            >
              {/* Date number + conflict flag (icon + sr text, never color-only) */}
              <span className="flex items-center justify-between px-1.5 pt-1.5">
                <span
                  className={`inline-flex items-center justify-center text-xs font-medium tabular-nums ${
                    today
                      ? 'h-5 w-5 rounded-full bg-primary text-[#03201c]'
                      : inMonth
                        ? 'text-text-primary'
                        : 'text-text-muted'
                  }`}
                >
                  {format(day, 'd')}
                </span>
                {hasConflict && (
                  <>
                    <AlertTriangle size={11} className="text-danger" aria-hidden="true" />
                    <span className="sr-only">Scheduling conflict</span>
                  </>
                )}
              </span>

              {/* Phones: dot density map. */}
              <span className="sm:hidden flex flex-1 flex-col items-center justify-center gap-0.5 pb-1.5" aria-hidden="true">
                {chips.length > 0 && (
                  <span className="flex items-center justify-center gap-1">
                    {visible.map((chip) => (
                      <span key={chip.key} className={`h-2 w-2 rounded-full ${DOT_TONE[chip.tone]}`} />
                    ))}
                  </span>
                )}
                {chips.length > maxChips && (
                  <span className="text-[10px] font-medium text-text-muted leading-none">
                    {chips.length}
                  </span>
                )}
              </span>

              {/* sm:+: real text chips (display-only — the cell carries the tap). */}
              <span className="hidden sm:block mt-1 flex-1 space-y-0.5 px-1 pb-1" aria-hidden="true">
                {visible.map((chip) => (
                  <span
                    key={chip.key}
                    className={`block truncate rounded px-1.5 py-0.5 text-[11px] font-medium leading-tight ${CHIP_TONE[chip.tone]}`}
                  >
                    {chip.label}
                  </span>
                ))}
                {overflow > 0 && (
                  <span className="block px-1.5 text-[10px] font-medium text-text-muted">
                    +{overflow} more
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default MonthGrid;
