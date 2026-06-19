import { useState, useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { Band, DemandRow } from '../../hooks/useDemandLog';

const BANDS: { band: Band; label: string; active: string }[] = [
  { band: 'SLOW', label: 'Dead', active: 'bg-slate-600 text-white border-slate-600' },
  { band: 'STEADY', label: 'Steady', active: 'bg-emerald-600 text-white border-emerald-600' },
  { band: 'BUSY', label: 'Busy', active: 'bg-amber-500 text-white border-amber-500' },
  { band: 'PACKED', label: 'Packed', active: 'bg-red-600 text-white border-red-600' },
];

/**
 * The nightly close-out: one tap to tell Luna how busy it actually was, plus an
 * optional one-line "truth note" on how the night really went. This is the ground
 * truth that powers her forecast-vs-actual accuracy AND the Night Chronicle — the
 * close-out loop she asked for, so her room stops being "a diary written in the dark."
 */
export function CloseOutCard({
  todayRow,
  saving,
  onLog,
}: {
  todayRow: DemandRow | null;
  saving: boolean;
  onLog: (band: Band, note?: string) => void;
}) {
  // actual_band is a free-text column in the DB but only ever holds a Band value;
  // narrow it so the close-out handler (which takes a Band) typechecks.
  const logged = (todayRow?.actual_band ?? null) as Band | null;
  const [note, setNote] = useState(todayRow?.note ?? '');

  // Keep the field in sync as the row loads / changes over realtime.
  useEffect(() => {
    setNote(todayRow?.note ?? '');
  }, [todayRow?.note]);

  // Persist a note edit on blur — only meaningful once a band is logged (a band
  // tap already saves the current note alongside it).
  const saveNote = () => {
    if (logged && note.trim() !== (todayRow?.note ?? '').trim()) onLog(logged, note);
  };

  return (
    <div className="card p-4 mb-6">
      <div className="flex items-center gap-2 mb-2.5">
        {logged && <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />}
        <p className="text-sm font-semibold text-text-primary">
          How busy was tonight?
          <span className="font-normal text-text-muted"> — teaches Luna's forecast</span>
        </p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {BANDS.map((b) => (
          <button
            key={b.band}
            disabled={saving}
            onClick={() => onLog(b.band, note)}
            className={`min-h-[44px] rounded-lg border text-sm font-medium transition active:scale-[0.97] disabled:opacity-50 ${
              logged === b.band ? b.active : 'border-border text-text-secondary hover:bg-surface-hover'
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* The truth note Luna asked for — fed to her Night Chronicle the next morning. */}
      <textarea
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={saveNote}
        disabled={saving}
        placeholder="One line for Luna — what actually happened tonight? (optional)"
        aria-label="Close-out note for Luna's chronicle"
        className="input-field resize-none text-sm leading-snug mt-3"
      />

      {logged && (
        <p className="text-xs text-text-muted mt-2">
          Logged tonight as <span className="font-medium">{logged}</span>
          {todayRow?.predicted_band ? ` · Luna predicted ${todayRow.predicted_band}` : ''}
          {todayRow?.note ? ' · note saved for Luna' : ''}. Tap a band to change.
        </p>
      )}
    </div>
  );
}
