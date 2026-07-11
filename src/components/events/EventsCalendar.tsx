import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  Clock,
  Repeat,
  MapPin,
  CalendarPlus,
} from 'lucide-react';
import type { IggyEvent } from '../../types/menu';
import {
  type BusyWindow,
  type DateKey,
  addMonths,
  formatRange,
  keyOf,
  monthCells,
  spaceLabel,
  todayKey,
  WEEKDAYS,
} from '../../lib/calendarDates';

interface EventsCalendarProps {
  eventsByDay: Map<DateKey, IggyEvent[]>;
  reservedByDay: Map<DateKey, BusyWindow[]>;
  loading?: boolean;
}

function readableDate(key: DateKey): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function EventsCalendar({
  eventsByDay,
  reservedByDay,
  loading,
}: EventsCalendarProps) {
  const now = new Date();
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selected, setSelected] = useState<DateKey | null>(null);

  const today = todayKey();
  const first = new Date(view.y, view.m, 1);
  const monthLabel = first.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  // Don't allow navigating to months before the current one.
  const atCurrentMonth = view.y === now.getFullYear() && view.m === now.getMonth();
  const prev = () => setView((v) => (atCurrentMonth ? v : addMonths(v.y, v.m, -1)));
  const next = () => setView((v) => addMonths(v.y, v.m, 1));

  const cells = monthCells(view.y, view.m);

  // Esc to close the detail modal.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const selectedEvents = selected ? eventsByDay.get(selected) ?? [] : [];
  const selectedReserved = selected ? reservedByDay.get(selected) ?? [] : [];

  return (
    <div className="glass-card p-4">
      {/* Month header */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={prev}
          disabled={atCurrentMonth}
          className="w-11 h-11 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/5 disabled:opacity-25 disabled:pointer-events-none transition"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 font-heading text-lg text-white">
          {monthLabel}
          {loading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
        </div>
        <button
          type="button"
          onClick={next}
          className="w-11 h-11 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition"
          aria-label="Next month"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d, i) => (
          <div
            key={i}
            className="text-center text-[11px] font-semibold text-text-muted py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} />;
          const k = keyOf(view.y, view.m, day);
          const isPast = k < today;
          const isToday = k === today;
          const dayEvents = eventsByDay.get(k) ?? [];
          const dayReserved = reservedByDay.get(k) ?? [];
          const hasEvent = dayEvents.length > 0;
          const hasReserved = dayReserved.length > 0;

          // A day with an Iggy event is the clickable target (teal).
          if (hasEvent) {
            return (
              <button
                key={k}
                type="button"
                onClick={() => setSelected(k)}
                aria-label={`${k} — ${dayEvents.length} event${
                  dayEvents.length > 1 ? 's' : ''
                }${hasReserved ? ', also reserved' : ''}`}
                className={`relative h-11 rounded-lg text-sm font-medium transition bg-primary/15 text-primary border border-primary/25 hover:bg-primary/25 hover:border-primary/40 ${
                  isToday ? 'ring-1 ring-primary/50' : ''
                }`}
              >
                {day}
                {/* Event marker — show count when >1 */}
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-0.5">
                  {dayEvents.length > 1 ? (
                    <span className="text-[9px] font-bold leading-none text-primary">
                      {dayEvents.length}
                    </span>
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                </span>
                {/* Small muted Reserved dot when the day is also reserved */}
                {hasReserved && (
                  <span className="absolute top-1 right-1 w-1 h-1 rounded-full bg-white/30" />
                )}
              </button>
            );
          }

          // Reserved (but no Iggy event) -> muted, non-clickable marker.
          if (hasReserved) {
            return (
              <div
                key={k}
                aria-label={`${k} — reserved`}
                className={`relative h-11 rounded-lg text-sm font-medium flex items-center justify-center text-white/30 ${
                  isPast ? 'opacity-60' : ''
                }`}
              >
                {day}
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/25" />
              </div>
            );
          }

          // Plain day.
          return (
            <div
              key={k}
              className={`h-11 rounded-lg text-sm font-medium flex items-center justify-center ${
                isPast
                  ? 'text-white/15'
                  : isToday
                    ? 'text-white ring-1 ring-white/15'
                    : 'text-white/70'
              }`}
            >
              {day}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/5 text-[11px] text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-primary" /> Event at Iggy's
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-white/25" /> Reserved
        </span>
      </div>

      {/* Detail modal — portaled to <body>: ancestor scroll-animations use
          transforms, which trap a fixed overlay's z-index and containing block
          in their stacking context (page headings painted over the modal). */}
      {selected && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Events on ${readableDate(selected)}`}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          />

          {/* Panel */}
          <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto glass-card p-6 animate-fade-in-up">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-0.5">
                  Events
                </p>
                <h2 className="font-heading text-xl font-bold text-white">
                  {readableDate(selected)}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="shrink-0 text-text-muted hover:text-white transition-colors"
                aria-label="Close"
              >
                <X size={24} />
              </button>
            </div>

            {/* Events for the day */}
            <div className="space-y-5">
              {selectedEvents.map((event) => (
                <div
                  key={event.id}
                  className="rounded-xl bg-white/5 border border-white/10 overflow-hidden"
                >
                  {event.image_url && (
                    <img
                      src={event.image_url}
                      alt={event.title}
                      className="w-full h-44 object-cover"
                      loading="lazy"
                    />
                  )}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="font-heading text-lg font-bold text-white">
                        {event.title}
                      </h3>
                      {event.is_recurring && event.recurring_day && (
                        <span className="inline-flex items-center gap-1 bg-accent/10 text-accent text-xs font-semibold px-2.5 py-0.5 rounded-full border border-accent/20">
                          <Repeat className="w-3 h-3" />
                          Every {event.recurring_day}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-text-muted mb-3 flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-primary/60" />
                        {event.start_min !== null || event.all_day
                          ? formatRange(
                              event.start_min,
                              event.end_min,
                              event.all_day
                            )
                          : event.time}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-primary/60" />
                        Iggy's Seaside
                      </span>
                    </div>

                    {event.description && (
                      <p className="text-text-muted text-sm leading-relaxed">
                        {event.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {/* Reserved windows for the day — muted, never names/details */}
              {selectedReserved.length > 0 && (
                <div className="space-y-1.5">
                  {selectedReserved.map((w, i) => {
                    const label = spaceLabel(w.space);
                    return (
                      <div
                        key={`r${i}`}
                        className="flex items-center gap-2 text-sm text-text-dim"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-white/25 shrink-0" />
                        Reserved{label ? ` · ${label}` : ''} ·{' '}
                        {formatRange(w.start_min, w.end_min, w.all_day)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* CTA */}
            <div className="mt-6 pt-5 border-t border-white/10">
              <Link
                to="/book"
                onClick={() => setSelected(null)}
                className="btn-primary w-full"
              >
                <CalendarPlus className="w-4 h-4" />
                Book your own event
              </Link>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
