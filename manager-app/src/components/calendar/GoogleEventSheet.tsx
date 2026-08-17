import { ExternalLink, Globe, MapPin, Clock } from 'lucide-react';
import { Sheet } from '../ui/Sheet';
import { safeFmtDate } from '../../utils/format';
import type { CalendarEvent } from '../../lib/partyActions';

interface GoogleEventSheetProps {
  /** The Google event being viewed; null = closed. */
  event: CalendarEvent | null;
  onClose: () => void;
  /** Opens the existing PromoteEventModal — an explicit secondary action, never
   * the default gesture (tapping an event must never publish it). */
  onPromote: (event: CalendarEvent) => void;
}

function eventTimeLabel(ev: CalendarEvent): string {
  if (ev.allDay) return `${safeFmtDate(ev.start, 'EEEE, MMMM d')} · All day`;
  const day = safeFmtDate(ev.start, 'EEEE, MMMM d');
  const start = safeFmtDate(ev.start, 'h:mm a');
  const end = ev.end ? safeFmtDate(ev.end, 'h:mm a') : '';
  return [day, end ? `${start} – ${end}` : start].filter(Boolean).join(' · ');
}

/**
 * Google event detail — tapping a Google-sourced row opens READ-ONLY details.
 * "Add to public calendar" (publishing) lives here as an explicit secondary
 * action, fixing the old tap-to-see = tap-to-publish trap.
 */
export function GoogleEventSheet({ event, onClose, onPromote }: GoogleEventSheetProps) {
  return (
    <Sheet
      open={event !== null}
      onClose={onClose}
      title={event?.summary || 'Calendar event'}
      footer={
        event ? (
          <div className="grid grid-cols-1 gap-2">
            {event.htmlLink && (
              <a
                href={event.htmlLink}
                target="_blank"
                rel="noreferrer"
                className="btn-primary text-sm"
              >
                <ExternalLink size={15} /> Open in Google Calendar
              </a>
            )}
            <button type="button" onClick={() => onPromote(event)} className="btn-secondary text-sm">
              <Globe size={15} /> Add to public calendar
            </button>
          </div>
        ) : undefined
      }
    >
      {event && (
        <div className="space-y-3 pt-1 text-sm">
          <p className="flex items-start gap-2 text-text-primary">
            <Clock size={15} className="mt-0.5 shrink-0 text-text-muted" aria-hidden="true" />
            {eventTimeLabel(event)}
          </p>
          {event.location && (
            <p className="flex items-start gap-2 text-text-secondary">
              <MapPin size={15} className="mt-0.5 shrink-0 text-text-muted" aria-hidden="true" />
              {event.location}
            </p>
          )}
          {event.description && (
            <p className="whitespace-pre-wrap rounded-lg bg-surface-hover p-3 text-xs text-text-secondary">
              {event.description}
            </p>
          )}
          <p className="text-xs text-text-muted">
            From the Iggy's Google Calendar. “Add to public calendar” publishes it to the
            customer-facing events page — nothing is published just by viewing.
          </p>
        </div>
      )}
    </Sheet>
  );
}

export default GoogleEventSheet;
