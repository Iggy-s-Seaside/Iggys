import { CheckCircle2 } from 'lucide-react';
import type { Band, DemandRow } from '../../hooks/useDemandLog';

const BANDS: { band: Band; label: string; active: string }[] = [
  { band: 'SLOW', label: 'Dead', active: 'bg-slate-600 text-white border-slate-600' },
  { band: 'STEADY', label: 'Steady', active: 'bg-emerald-600 text-white border-emerald-600' },
  { band: 'BUSY', label: 'Busy', active: 'bg-amber-500 text-white border-amber-500' },
  { band: 'PACKED', label: 'Packed', active: 'bg-red-600 text-white border-red-600' },
];

/**
 * The nightly close-out: one tap to tell Luna how busy it actually was. This is
 * the ground truth that powers her forecast-vs-actual accuracy over time.
 */
export function CloseOutCard({
  todayRow,
  saving,
  onLog,
}: {
  todayRow: DemandRow | null;
  saving: boolean;
  onLog: (band: Band) => void;
}) {
  const logged = todayRow?.actual_band ?? null;

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
            onClick={() => onLog(b.band)}
            className={`min-h-[44px] rounded-lg border text-sm font-medium transition active:scale-[0.97] disabled:opacity-50 ${
              logged === b.band ? b.active : 'border-border text-text-secondary hover:bg-surface-hover'
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>
      {logged && (
        <p className="text-xs text-text-muted mt-2">
          Logged tonight as <span className="font-medium">{logged}</span>
          {todayRow?.predicted_band ? ` · Luna predicted ${todayRow.predicted_band}` : ''}. Tap to change.
        </p>
      )}
    </div>
  );
}
