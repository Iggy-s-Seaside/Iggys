import { useId, useRef, useState } from 'react';
import { X, Globe, Loader2, Calendar as CalIcon } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { EVENT_CATEGORIES } from '../../types';
import { SPACES, type Space } from '../../lib/timeWindows';
import type { CalendarEvent } from '../../lib/partyActions';

/** Initial public-facing values derived from a Google Calendar event.
 * Title + date + time are prefilled; description is intentionally BLANK so the
 * private Google Calendar notes (contact info, internal details) never leak to
 * the public site — the manager writes only what should be customer-facing. */
function deriveDate(ev: CalendarEvent): string {
  try { return format(parseISO(ev.start), 'yyyy-MM-dd'); } catch { return ev.start.slice(0, 10); }
}
function deriveTime(ev: CalendarEvent): string {
  if (ev.allDay) return 'All day';
  try {
    const s = format(parseISO(ev.start), 'h:mm a');
    const e = ev.end ? format(parseISO(ev.end), 'h:mm a') : '';
    return e ? `${s} – ${e}` : s;
  } catch { return ''; }
}
/** Minutes-from-midnight for an event ISO timestamp (local clock). */
function minsFromISO(iso: string): number | null {
  try { const d = parseISO(iso); return d.getHours() * 60 + d.getMinutes(); } catch { return null; }
}
/** Derive {start_min, end_min} for the events row; end after-midnight uses >1440. */
function deriveWindow(ev: CalendarEvent): { start_min: number | null; end_min: number | null } {
  if (ev.allDay) return { start_min: null, end_min: null };
  const start_min = minsFromISO(ev.start);
  let end_min = ev.end ? minsFromISO(ev.end) : null;
  if (start_min !== null && end_min !== null && end_min < start_min) end_min += 1440;
  return { start_min, end_min };
}

export function PromoteEventModal({
  event, onClose, onPromoted,
}: {
  event: CalendarEvent;
  onClose: () => void;
  onPromoted: () => void;
}) {
  const [title, setTitle] = useState(event.summary || '');
  const [date, setDate] = useState(deriveDate(event));
  const [time, setTime] = useState(deriveTime(event));
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [space, setSpace] = useState<Space>('whole');
  const [saving, setSaving] = useState(false);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(true, panelRef, { onEscape: onClose });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) {
      toast.error('A title and date are required.');
      return;
    }
    setSaving(true);
    // Carry the real time window + space so this public event blocks private-party
    // availability correctly (a null start_min would mis-read as an all-day,
    // whole-building hold and take the entire day off the booking calendar).
    const allDay = event.allDay === true;
    const { start_min, end_min } = deriveWindow(event);
    const { error } = await supabase.from('events').insert({
      title: title.trim(),
      description: description.trim(),
      date,
      time: time.trim() || 'All day',
      category: category || null,
      active: true,
      is_recurring: false,
      all_day: allDay,
      start_min: allDay ? null : start_min,
      end_min: allDay ? null : end_min,
      space,
    });
    setSaving(false);
    if (error) {
      toast.error('Could not add to the public calendar');
      console.error(error);
      return;
    }
    toast.success('Added to the public events page');
    onPromoted();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="bg-surface w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-card max-h-[92dvh] overflow-y-auto focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-surface">
          <div className="flex items-center gap-2">
            <Globe size={18} className="text-primary" />
            <h2 id={titleId} className="font-semibold text-text-primary">Add to public calendar</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg hover:bg-surface-hover transition-colors text-text-muted">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-text-muted flex items-start gap-1.5">
            <CalIcon size={13} className="mt-0.5 shrink-0 text-primary" />
            Only what you enter below goes on the public site. The private Google
            Calendar details are never shown to customers.
          </p>

          <div>
            <label className="text-sm font-medium text-text-primary mb-1 block">Title</label>
            <input className="input-field w-full" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-text-primary mb-1 block">Date</label>
              <input type="date" className="input-field w-full" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary mb-1 block">Time</label>
              <input className="input-field w-full" value={time} onChange={(e) => setTime(e.target.value)} placeholder="e.g. 6:00 PM" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-text-primary mb-1 block">Category (optional)</label>
              <select className="input-field w-full" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Uncategorized</option>
                {EVENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary mb-1 block">Space used</label>
              <select className="input-field w-full" value={space} onChange={(e) => setSpace(e.target.value as Space)}>
                {SPACES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-text-primary mb-1 block">
              Public description
            </label>
            <textarea
              className="input-field w-full min-h-[90px] resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What should customers see about this event? (left blank by default for privacy)"
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-xs text-text-muted">You can add a poster image later in Events.</p>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-secondary text-sm">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary text-sm">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
                Publish
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
