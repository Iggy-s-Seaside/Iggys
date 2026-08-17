import { Users, RefreshCw } from 'lucide-react';
import { formatRange, spaceLabel } from '../../lib/timeWindows';
import { PARTY_STATUS_LABELS, type PartyStatus } from '../../types';
import type { CalendarItem } from '../../lib/calendarItems';

const STATUS_BADGE: Record<PartyStatus, string> = {
  inquiry: 'badge-accent',
  confirmed: 'badge-success',
  cancelled: 'badge-danger',
};

/** Left-rail colour per item tone — paired with text labels, never colour-only. */
const RAIL: Record<CalendarItem['tone'], string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  accent: 'bg-accent',
  muted: 'bg-text-muted/40',
};

const KIND_LABEL: Record<CalendarItem['kind'], string> = {
  party: 'Party',
  event: 'Event',
  google: 'Google Calendar',
};

interface CalendarItemRowProps {
  item: CalendarItem;
  onSelect: (item: CalendarItem) => void;
}

/**
 * One tappable calendar row (≥56px, the whole row is the tap target).
 * Party rows LEAD with headcount + space — per the ops rules, guest_count is
 * the most decision-relevant number on this calendar. Titles wrap to two
 * lines; nothing renders as a 3-character truncation.
 */
export function CalendarItemRow({ item, onSelect }: CalendarItemRowProps) {
  const space = spaceLabel(item.space);
  const time = formatRange(item.startMin, item.endMin, item.allDay);

  const headline =
    item.kind === 'party'
      ? [
          item.guestCount != null ? `${item.guestCount} guests` : null,
          space || null,
        ]
          .filter(Boolean)
          .join(' · ')
      : null;

  const meta = [
    item.kind === 'party' ? time : [time, space || null].filter(Boolean).join(' · '),
    item.kind === 'google' ? KIND_LABEL.google : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const ariaParts = [
    item.title,
    headline,
    meta,
    item.recurLabel,
    item.status ? PARTY_STATUS_LABELS[item.status] : null,
    KIND_LABEL[item.kind],
  ].filter(Boolean);

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      aria-label={ariaParts.join(', ')}
      className="w-full flex items-stretch gap-3 px-4 py-3 min-h-[56px] text-left hover:bg-surface-hover active:bg-surface-active transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
    >
      <span className={`w-1 self-stretch rounded-full shrink-0 ${RAIL[item.tone]}`} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        {headline && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
            {item.guestCount != null && <Users size={12} className="shrink-0 text-text-muted" aria-hidden="true" />}
            {headline}
          </span>
        )}
        <span className="block text-sm font-medium text-text-primary line-clamp-2">{item.title}</span>
        <span className="block text-xs text-text-muted mt-0.5">
          {meta}
          {item.recurLabel && (
            <span className="inline-flex items-center gap-1 ml-1.5 text-text-secondary">
              <RefreshCw size={10} aria-hidden="true" /> {item.recurLabel}
            </span>
          )}
        </span>
      </span>
      {item.status && (
        <span className={`self-center shrink-0 ${STATUS_BADGE[item.status]}`}>
          {PARTY_STATUS_LABELS[item.status]}
        </span>
      )}
    </button>
  );
}

export default CalendarItemRow;
