import { AlertTriangle, Users, PartyPopper, CalendarDays } from 'lucide-react';
import { Sheet } from '../ui/Sheet';
import { EmptyState } from '../ui/EmptyState';
import { spaceLabel } from '../../lib/timeWindows';
import { safeFmtDate } from '../../utils/format';
import { findDayIssues, type CalendarItem, type DayIssue } from '../../lib/calendarItems';
import { CalendarItemRow } from './CalendarItemRow';

interface DayDetailSheetProps {
  /** yyyy-MM-dd of the open day; null = closed. */
  dayKey: string | null;
  items: CalendarItem[];
  onClose: () => void;
  onSelectItem: (item: CalendarItem) => void;
  onAddParty: (dayKey: string) => void;
  onAddEvent: (dayKey: string) => void;
}

function IssueBanner({ issue }: { issue: DayIssue }) {
  // A row with no space set is UNKNOWN, not the whole building — saying
  // "Whole building" here would invent a fact about a legacy row.
  const known = issue.a.space !== null && issue.b.space !== null;
  const uniqueSpaces = Array.from(
    new Set([spaceLabel(issue.a.space), spaceLabel(issue.b.space)].filter(Boolean))
  ).join(' + ');

  if (issue.kind === 'staffing') {
    // Overlapping, but not competing for the same room — informational, NEVER a warning.
    return (
      <div className="flex items-start gap-2 rounded-lg bg-surface-hover p-3 text-xs text-text-secondary">
        <Users size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p>
          {known ? (
            <>
              <span className="font-medium">Two spaces busy</span> — {uniqueSpaces} at the same time
              ({issue.a.title} · {issue.b.title}). Not a conflict; plan staffing for both.
            </>
          ) : (
            <>
              <span className="font-medium">Two bookings overlap</span> — {issue.a.title} ·{' '}
              {issue.b.title}. Check which space each one needs.
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={`flex items-start gap-2 rounded-lg p-3 text-xs ${
        issue.whole ? 'bg-danger-light text-danger' : 'bg-warning-light text-accent-hover'
      }`}
    >
      <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      <p>
        <span className="font-semibold">
          {issue.whole ? 'Whole-building conflict: ' : 'Scheduling conflict: '}
        </span>
        {issue.a.title} and {issue.b.title} overlap
        {issue.whole ? ' — a whole-building booking blocks everything else.' : ` in ${uniqueSpaces}.`}
      </p>
    </div>
  );
}

/**
 * Day Detail Sheet — the surface that was missing: tapping ANY day (grid cell,
 * dot cluster, or count) lists everything happening that day, nothing hidden.
 * Rows tap through to their real destinations; the create actions are demoted
 * to a secondary footer.
 */
export function DayDetailSheet({ dayKey, items, onClose, onSelectItem, onAddParty, onAddEvent }: DayDetailSheetProps) {
  const issues = findDayIssues(items);
  const title = safeFmtDate(dayKey, 'EEEE, MMMM d') || 'Day';

  return (
    <Sheet
      open={dayKey !== null}
      onClose={onClose}
      title={title}
      footer={
        dayKey ? (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onAddParty(dayKey)} className="btn-secondary text-sm">
              <PartyPopper size={15} /> Add party
            </button>
            <button type="button" onClick={() => onAddEvent(dayKey)} className="btn-secondary text-sm">
              <CalendarDays size={15} /> Add event
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-3 pt-1">
        {issues.length > 0 && (
          <div className="space-y-2">
            {issues.map((issue, i) => (
              <IssueBanner key={`${issue.a.id}-${issue.b.id}-${i}`} issue={issue} />
            ))}
          </div>
        )}

        {items.length === 0 ? (
          <EmptyState
            className="p-8"
            icon={CalendarDays}
            title="Nothing on this day"
            description="Wide open — add a party or event below."
          />
        ) : (
          <div className="card overflow-hidden divide-y divide-border -mx-1">
            {items.map((item) => (
              <CalendarItemRow key={item.id} item={item} onSelect={onSelectItem} />
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}

export default DayDetailSheet;
