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

/** A single chip rendered inside a day cell. */
export interface DayChip {
  /** Stable key within its day (e.g. event id / party id). */
  key: string;
  /** Short label shown on the chip. */
  label: string;
  /** Visual tone — maps to a semantic accent. */
  tone: 'primary' | 'success' | 'accent' | 'muted';
  /** Click handler for the chip (e.g. promote event, open party). */
  onClick?: () => void;
}

interface MonthGridProps {
  /** The month currently displayed (any day within it). */
  month: Date;
  /** Chips keyed by `yyyy-MM-dd`. */
  chipsByDay: Record<string, DayChip[]>;
  /** Days (yyyy-MM-dd) that have more than one booking — flagged with a warning dot. */
  conflictDays: Set<string>;
  /** Tapping an empty area of a day cell (passes the `yyyy-MM-dd` for that day). */
  onSelectDay: (dayKey: string) => void;
  /** How many chips to render before collapsing to a "+N more" line. */
  maxChips?: number;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CHIP_TONE: Record<DayChip['tone'], string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success-light text-success',
  accent: 'bg-warning-light text-accent',
  muted: 'bg-surface-hover text-text-secondary',
};

/**
 * MonthGrid — a 7-column calendar month laid out on full weeks.
 *
 * The visible range runs from the Sunday on/before the 1st to the Saturday
 * on/after the last day, so every week row is complete. Days outside the
 * displayed month are dimmed. Each cell renders its chips (truncated to
 * `maxChips`, with a "+N more" affordance), highlights today, and flags
 * same-day conflicts with a warning dot. Tapping the empty area of a cell
 * fires `onSelectDay` so the parent can open a create chooser.
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
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-border bg-surface-hover/50">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-text-muted"
          >
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{label.charAt(0)}</span>
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

          return (
            <div
              key={key}
              className={`relative min-h-[5.5rem] sm:min-h-[7rem] border-b border-r border-border last:border-r-0 [&:nth-child(7n)]:border-r-0 flex flex-col ${
                inMonth ? 'bg-surface' : 'bg-surface-hover/30'
              }`}
            >
              {/* Tap target covering the cell — opens the create chooser for this day. */}
              <button
                type="button"
                onClick={() => onSelectDay(key)}
                aria-label={`Add for ${format(day, 'EEEE, MMMM d')}`}
                className="absolute inset-0 z-0 hover:bg-surface-hover/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset transition-colors"
              />

              {/* Date number + conflict dot */}
              <div className="relative z-10 flex items-center justify-between px-1.5 pt-1.5 pointer-events-none">
                <span
                  className={`inline-flex items-center justify-center text-xs font-medium tabular-nums ${
                    today
                      ? 'h-5 w-5 rounded-full bg-primary text-white'
                      : inMonth
                        ? 'text-text-primary'
                        : 'text-text-muted'
                  }`}
                >
                  {format(day, 'd')}
                </span>
                {hasConflict && (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-accent"
                    title="More than one booking on this day"
                    aria-label="Scheduling conflict"
                  />
                )}
              </div>

              {/* Chips */}
              <div className="relative z-10 mt-1 flex-1 space-y-0.5 px-1 pb-1">
                {visible.map((chip) =>
                  chip.onClick ? (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={chip.onClick}
                      title={chip.label}
                      className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium leading-tight transition-opacity hover:opacity-80 ${CHIP_TONE[chip.tone]}`}
                    >
                      {chip.label}
                    </button>
                  ) : (
                    <div
                      key={chip.key}
                      title={chip.label}
                      className={`truncate rounded px-1.5 py-0.5 text-[11px] font-medium leading-tight pointer-events-none ${CHIP_TONE[chip.tone]}`}
                    >
                      {chip.label}
                    </div>
                  )
                )}
                {overflow > 0 && (
                  <button
                    type="button"
                    onClick={() => onSelectDay(key)}
                    className="block w-full px-1.5 text-left text-[10px] font-medium text-text-muted hover:text-text-secondary"
                  >
                    +{overflow} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MonthGrid;
