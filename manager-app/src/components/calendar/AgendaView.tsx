import { isSameDay, parseISO, addDays } from 'date-fns';
import { CalendarDays, CalendarOff } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { Skeleton } from '../ui/Skeleton';
import { safeFmtDate } from '../../utils/format';
import type { CalendarItem, DayGroup } from '../../lib/calendarItems';
import { CalendarItemRow } from './CalendarItemRow';

interface AgendaViewProps {
  /** Today + next 2 days, always present (may have zero items). */
  headline: DayGroup[];
  /** Days 3–30 that have items. */
  upcoming: DayGroup[];
  /** Anything beyond 30 days, one bucket. */
  later: DayGroup[];
  loading: boolean;
  /** Google Calendar failure — shown as a warning strip; parties/events still render. */
  calError: string | null;
  onRetry: () => void;
  onSelectItem: (item: CalendarItem) => void;
}

/** "Today" / "Tomorrow" / "Sat, Aug 22" */
function dayLabel(key: string): string {
  const date = parseISO(key);
  const now = new Date();
  if (isSameDay(date, now)) return 'Today';
  if (isSameDay(date, addDays(now, 1))) return 'Tomorrow';
  return safeFmtDate(date, 'EEE, MMM d');
}

function DaySection({
  group,
  sticky,
  onSelectItem,
}: {
  group: DayGroup;
  sticky?: boolean;
  onSelectItem: (item: CalendarItem) => void;
}) {
  const label = dayLabel(group.key);
  const today = label === 'Today';
  const relative = label === 'Today' || label === 'Tomorrow';
  return (
    <section aria-label={safeFmtDate(group.key, 'EEEE, MMMM d')}>
      <h3
        className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b border-border ${
          today ? 'text-primary' : 'text-text-muted'
        } ${sticky ? 'sticky top-0 z-10 bg-surface/95 backdrop-blur-sm' : 'bg-surface-hover/50'}`}
      >
        {relative ? `${label} · ${safeFmtDate(group.key, 'EEE, MMM d')}` : label}
      </h3>
      {group.items.length === 0 ? (
        <div className="flex items-center gap-2.5 px-4 py-4 text-sm font-medium text-success">
          <CalendarOff size={16} aria-hidden="true" />
          Nothing on — wide open.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {group.items.map((item) => (
            <CalendarItemRow key={item.id} item={item} onSelect={onSelectItem} />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * AgendaView — the phone-default calendar: one merged chronological list from
 * parties + app events + Google Calendar. The next 3 days render unconditionally
 * (the "is tonight handled?" question) with a loud empty state; days 3–30 list
 * what exists; everything further out lands in a single "Later" bucket.
 */
export function AgendaView({ headline, upcoming, later, loading, calError, onRetry, onSelectItem }: AgendaViewProps) {
  if (loading) {
    return (
      <div className="card p-4 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  const isEmpty = [...headline, ...upcoming, ...later].every((g) => g.items.length === 0);

  return (
    <div className="space-y-4">
      {calError && (
        <ErrorState
          className="p-4 text-left"
          title="Google Calendar not connected"
          description={`Parties and events still show below. ${calError}`}
          onRetry={onRetry}
        />
      )}

      {isEmpty && !calError ? (
        <EmptyState
          icon={CalendarDays}
          title="Nothing on the calendar"
          description="No parties, events, or Google Calendar items coming up. Tap a day in Month view to add one."
        />
      ) : (
        <>
          {/* The next 72 hours — always visible, answered without a tap. */}
          <div className="card overflow-hidden divide-y divide-border">
            {headline.map((g) => (
              <DaySection key={g.key} group={g} sticky onSelectItem={onSelectItem} />
            ))}
          </div>

          {upcoming.length > 0 && (
            <div className="card overflow-hidden divide-y divide-border">
              {upcoming.map((g) => (
                <DaySection key={g.key} group={g} sticky onSelectItem={onSelectItem} />
              ))}
            </div>
          )}

          {later.length > 0 && (
            <div className="card overflow-hidden">
              <h3 className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted border-b border-border bg-surface-hover/50">
                Later
              </h3>
              <div className="divide-y divide-border">
                {later.map((g) => (
                  <DaySection key={g.key} group={g} onSelectItem={onSelectItem} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default AgendaView;
