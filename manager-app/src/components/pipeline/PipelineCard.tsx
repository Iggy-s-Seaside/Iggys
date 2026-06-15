import {
  CalendarClock,
  Users,
  MapPin,
  Clock,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  GripVertical,
} from 'lucide-react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { money } from '../../utils/format';
import type { PipelineCard as PipelineCardData } from '../../hooks/usePipeline';

function fmtDate(d: string | null) {
  if (!d) return null;
  try {
    return format(parseISO(d), 'MMM d');
  } catch {
    return d;
  }
}

/** Compact "how long this card has been around" since created_at — "3d", "2w". */
function ageLabel(days: number) {
  if (days < 1) return 'today';
  if (days < 7) return `${days}d`;
  if (days < 70) return `${Math.round(days / 7)}w`;
  return `${Math.round(days / 30)}mo`;
}

export interface PipelineCardProps {
  card: PipelineCardData;
  onOpen: () => void;
  /** Advance one stage forward, or null when already in the final stage. */
  onAdvance: (() => void) | null;
  /** Step one stage back, or null when already in the first stage. */
  onBack: (() => void) | null;
  /** Label of the next stage (for the affordance tooltip/aria). */
  nextLabel: string | null;
  /** Label of the previous stage (for the affordance tooltip/aria). */
  prevLabel: string | null;
  /** Pointer-drag handlers wired by the board; spread onto the drag handle. */
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  /** True while this card is the one being dragged (dim + lift). */
  dragging?: boolean;
  /** Plays the celebratory pop when the card has just reached the won stage. */
  celebrate?: boolean;
}

/**
 * A single pipeline card. The body opens the party; a footer row carries the
 * touch-friendly stage controls (Back / Advance) plus a grab handle that the
 * board uses for optional pointer-drag.
 */
export function PipelineCard({
  card,
  onOpen,
  onAdvance,
  onBack,
  nextLabel,
  prevLabel,
  dragHandleProps,
  dragging,
  celebrate,
}: PipelineCardProps) {
  const { party: p, estValue, followUpDue, depositOwed } = card;
  const space = p.space_name || p.space;

  // Age since the card entered the pipeline. Subtle by default; escalates only
  // while the deal is still unresolved (inquiry), so a long-settled "Paid" card
  // doesn't shout for attention.
  const ageDays = differenceInCalendarDays(new Date(), parseISO(p.created_at));
  const unresolved = p.status === 'inquiry';
  const ageTone =
    unresolved && ageDays >= 14
      ? 'text-danger'
      : unresolved && ageDays >= 7
        ? 'text-accent'
        : 'text-text-muted';

  return (
    <div
      className={`p-3.5 space-y-2 ${
        dragging ? 'card opacity-60 shadow-card-hover ring-2 ring-primary' : 'card-hover'
      }`}
      style={celebrate ? { animation: 'popUp 360ms cubic-bezier(0.32, 0.72, 0, 1)' } : undefined}
    >
      <button onClick={onOpen} className="w-full text-left space-y-2" aria-label={`Open ${p.title?.trim() || p.contact_name}`}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-text-primary truncate">
            {p.title?.trim() || p.contact_name}
          </p>
          {estValue > 0 && (
            <span className="shrink-0 text-sm font-bold text-primary tabular-nums">{money(estValue)}</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
          {p.event_date ? (
            <span className="flex items-center gap-1">
              <CalendarClock size={11} /> {fmtDate(p.event_date)}
            </span>
          ) : (
            <span className="text-text-muted/70">No date</span>
          )}
          {p.guest_count != null && (
            <span className="flex items-center gap-1">
              <Users size={11} /> {p.guest_count}
            </span>
          )}
          {space && (
            <span className="flex items-center gap-1 truncate">
              <MapPin size={11} /> {space}
            </span>
          )}
          <span
            className={`flex items-center gap-1 ml-auto shrink-0 tabular-nums ${ageTone}`}
            title={`In pipeline ${ageLabel(ageDays)} (since ${fmtDate(p.created_at)})`}
          >
            <Clock size={11} /> {ageLabel(ageDays)}
          </span>
        </div>

        {(followUpDue || depositOwed) && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {followUpDue && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-warning-light text-accent-hover">
                <Clock size={11} /> Follow-up due
              </span>
            )}
            {depositOwed && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full badge-danger">
                <DollarSign size={11} /> Deposit owed
              </span>
            )}
          </div>
        )}
      </button>

      {/* Stage controls — touch-first, with a grab handle for optional pointer-drag. */}
      <div className="flex items-center gap-1 pt-1.5 border-t border-border -mx-0.5">
        <button
          type="button"
          onClick={onBack ?? undefined}
          disabled={!onBack}
          aria-label={prevLabel ? `Move back to ${prevLabel}` : 'Already at first stage'}
          title={prevLabel ? `Back to ${prevLabel}` : undefined}
          className="min-h-[44px] w-11 inline-flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={18} />
        </button>

        <button
          type="button"
          aria-label="Drag to move between stages"
          title="Drag to move"
          className="min-h-[44px] px-1.5 inline-flex items-center justify-center rounded-lg text-text-muted/60 hover:text-text-secondary hover:bg-surface-hover cursor-grab active:cursor-grabbing touch-none select-none transition-colors"
          {...dragHandleProps}
        >
          <GripVertical size={16} />
        </button>

        <button
          type="button"
          onClick={onAdvance ?? undefined}
          disabled={!onAdvance}
          aria-label={nextLabel ? `Advance to ${nextLabel}` : 'Already at final stage'}
          title={nextLabel ? `Advance to ${nextLabel}` : undefined}
          className="ml-auto min-h-[44px] inline-flex items-center gap-1 px-3 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
        >
          {nextLabel ? <>Advance <ChevronRight size={15} /></> : <>Done <ChevronRight size={15} className="opacity-40" /></>}
        </button>
      </div>
    </div>
  );
}
