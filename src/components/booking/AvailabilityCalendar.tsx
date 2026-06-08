import { useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface AvailabilityCalendarProps {
  /** Set of 'YYYY-MM-DD' dates that are already taken (confirmed events). */
  taken: Set<string>;
  /** Set of 'YYYY-MM-DD' dates that are busy but still bookable (sharing OK). Informational only. */
  busyDays?: Set<string>;
  /** Currently selected 'YYYY-MM-DD' or null. */
  value: string | null;
  onChange: (date: string) => void;
  loading?: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function AvailabilityCalendar({ taken, busyDays, value, onChange, loading }: AvailabilityCalendarProps) {
  const now = new Date();
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });

  const todayKey = keyOf(now.getFullYear(), now.getMonth(), now.getDate());
  const first = new Date(view.y, view.m, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const monthLabel = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Don't allow navigating to months before the current one.
  const atCurrentMonth = view.y === now.getFullYear() && view.m === now.getMonth();
  const prev = () => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }));
  const next = () => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }));

  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="glass-card p-4">
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

      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="text-center text-[11px] font-semibold text-text-muted py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} />;
          const k = keyOf(view.y, view.m, day);
          const isPast = k < todayKey;
          const isTaken = taken.has(k);
          const isBusy = !isTaken && (busyDays?.has(k) ?? false);
          const disabled = isPast || isTaken;
          const selected = value === k;
          return (
            <button
              key={k}
              type="button"
              disabled={disabled}
              onClick={() => onChange(k)}
              aria-label={`${k}${isTaken ? ' (unavailable)' : isBusy ? ' (busy, sharing OK)' : ''}`}
              className={`relative h-11 rounded-lg text-sm font-medium transition ${
                selected
                  ? 'bg-primary text-background font-bold'
                  : isTaken
                    ? 'text-white/25 line-through cursor-not-allowed'
                    : isPast
                      ? 'text-white/15 cursor-not-allowed'
                      : 'text-white hover:bg-primary/15 hover:text-primary'
              }`}
            >
              {day}
              {(isTaken || isBusy) && !selected && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent/70" />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/5 text-[11px] text-text-muted">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary" /> Selected</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-white/15" /> Available</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-accent/70" /> Taken</span>
        {busyDays && busyDays.size > 0 && (
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-accent/40" /> Busy (sharing OK)</span>
        )}
      </div>
    </div>
  );
}
