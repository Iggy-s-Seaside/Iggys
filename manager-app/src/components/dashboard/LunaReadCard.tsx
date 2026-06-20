import { useState } from 'react';
import { Gauge, CheckCircle2, ChevronDown } from 'lucide-react';
import type { Band, DemandRow } from '../../hooks/useDemandLog';

const BANDS: { band: Band; label: string }[] = [
  { band: 'SLOW', label: 'Dead' },
  { band: 'STEADY', label: 'Steady' },
  { band: 'BUSY', label: 'Busy' },
  { band: 'PACKED', label: 'Packed' },
];
const LABEL: Record<string, string> = { SLOW: 'Dead', STEADY: 'Steady', BUSY: 'Busy', PACKED: 'Packed' };
const TONE: Record<string, string> = {
  SLOW: 'text-slate-400',
  STEADY: 'text-emerald-400',
  BUSY: 'text-amber-400',
  PACKED: 'text-red-400',
};

/**
 * Luna's busyness read — her own call for the night, now read off the cameras (the nightly
 * footage review writes demand_log.actual_band) plus her track record. Replaces the old manual
 * "How busy was tonight?" widget: this is the check-in on what SHE found. You can still nudge
 * the band if you disagree.
 */
export function LunaReadCard({
  todayRow,
  accuracy,
  saving,
  onLog,
}: {
  todayRow: DemandRow | null;
  accuracy: { pct: number; n: number } | null;
  saving: boolean;
  onLog: (band: Band, note?: string) => void;
}) {
  const [adjustOpen, setAdjustOpen] = useState(false);
  const predicted = todayRow?.predicted_band ?? null;
  const actual = todayRow?.actual_band ?? null;

  if (!predicted && !actual) {
    return (
      <div className="card p-4 mb-6">
        <div className="flex items-center gap-2">
          <Gauge size={18} className="text-accent shrink-0" />
          <p className="text-sm font-semibold text-text-primary">Tonight — Luna's read</p>
        </div>
        <p className="text-sm text-text-muted mt-2">
          She hasn't called it yet — check back after her morning pulse.
        </p>
      </div>
    );
  }

  const headline = actual ?? predicted!;
  const verdict =
    actual && predicted
      ? actual === predicted
        ? 'she nailed her call'
        : `she'd predicted ${LABEL[predicted] ?? predicted}`
      : null;

  return (
    <div className="card p-4 mb-6">
      <div className="flex items-center gap-2 mb-1.5">
        <Gauge size={18} className="text-accent shrink-0" />
        <p className="text-sm font-semibold text-text-primary">Tonight — Luna's read</p>
      </div>

      <div className="flex items-baseline gap-2">
        <span className={`font-heading text-3xl font-bold ${TONE[headline] ?? 'text-text-primary'}`}>
          {LABEL[headline] ?? headline}
        </span>
        <span className="text-xs text-text-muted">
          {actual ? 'read from the cameras' : 'her call for tonight'}
        </span>
      </div>

      {verdict && (
        <p className="text-xs text-text-muted mt-1 flex items-center gap-1">
          <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
          {verdict}
        </p>
      )}

      {accuracy && accuracy.n > 0 && (
        <p className="text-xs text-text-muted mt-2">
          Right on <span className="font-medium text-text-secondary">{accuracy.pct}%</span> of her last{' '}
          {accuracy.n} {accuracy.n === 1 ? 'call' : 'calls'}.
        </p>
      )}

      <button
        onClick={() => setAdjustOpen((v) => !v)}
        className="text-xs text-text-muted mt-3 inline-flex items-center gap-1 hover:text-text-secondary transition-colors"
      >
        <ChevronDown size={12} className={adjustOpen ? 'rotate-180 transition' : 'transition'} />
        {actual ? 'Disagree? adjust it' : 'Set it yourself'}
      </button>

      {adjustOpen && (
        <div className="grid grid-cols-4 gap-2 mt-2">
          {BANDS.map((b) => (
            <button
              key={b.band}
              disabled={saving}
              onClick={() => onLog(b.band)}
              className={`min-h-[40px] rounded-lg border text-xs font-medium transition active:scale-[0.97] disabled:opacity-50 ${
                actual === b.band
                  ? 'bg-accent text-white border-accent'
                  : 'border-border text-text-secondary hover:bg-surface-hover'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
