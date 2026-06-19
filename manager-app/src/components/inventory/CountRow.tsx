import { useEffect, useState } from 'react';
import { money } from '../../utils/format';
import type { CountLine } from '../../hooks/useInventoryCount';

interface CountRowProps {
  line: CountLine;
  /** Persist the counted_qty for this line (null clears it). */
  onCount: (lineId: number, value: number | null) => void;
}

/**
 * A single periodic-count line: item name + expected (system) qty on the left,
 * the ONLY required input — counted_qty — on the right, with a live variance
 * + $variance readout. Glove-friendly: large numeric keypad, big tap target,
 * mobile-first. The counted input is a local string so the manager can clear
 * it / type freely; we commit the parsed number on blur and on change.
 */
export function CountRow({ line, onCount }: CountRowProps) {
  const [raw, setRaw] = useState(line.counted_qty != null ? String(line.counted_qty) : '');

  // Keep the field in sync if the row is re-hydrated from a reload.
  useEffect(() => {
    setRaw(line.counted_qty != null ? String(line.counted_qty) : '');
  }, [line.counted_qty]);

  const commit = (text: string) => {
    const trimmed = text.trim();
    if (trimmed === '') {
      onCount(line.id, null);
      return;
    }
    const n = Number(trimmed);
    if (Number.isFinite(n)) onCount(line.id, n);
  };

  const expected = line.expected_qty ?? 0;
  const varianceColor =
    !line.counted || line.variance === 0
      ? 'text-text-muted'
      : line.variance < 0
        ? 'text-danger'
        : 'text-emerald-500';

  return (
    <div className="card p-4 flex items-center gap-4">
      {/* Item + expected */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text-primary truncate">{line.name}</p>
        <p className="text-xs text-text-muted mt-0.5">
          Expected <span className="tabular-nums text-text-secondary">{expected}</span> {line.unit}
        </p>
      </div>

      {/* Variance readout — only meaningful once counted */}
      <div className={`text-right shrink-0 w-20 ${varianceColor}`}>
        {line.counted ? (
          <>
            <p className="text-sm font-semibold tabular-nums">
              {line.variance > 0 ? '+' : ''}
              {line.variance}
            </p>
            <p className="text-xs tabular-nums">
              {line.varianceCost === 0
                ? '—'
                : `${line.varianceCost < 0 ? '-' : '+'}${money(Math.abs(line.varianceCost))}`}
            </p>
          </>
        ) : (
          <p className="text-xs text-text-muted">not counted</p>
        )}
      </div>

      {/* Counted input — the one required field */}
      <div className="shrink-0">
        <label className="sr-only" htmlFor={`count-${line.id}`}>
          Counted quantity for {line.name}
        </label>
        <input
          id={`count-${line.id}`}
          type="number"
          inputMode="decimal"
          step="any"
          min="0"
          placeholder="—"
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            commit(e.target.value);
          }}
          onFocus={(e) => e.currentTarget.select()}
          className={`input-field h-12 w-24 text-center text-lg font-semibold tabular-nums ${
            line.counted ? 'border-primary' : ''
          }`}
        />
      </div>
    </div>
  );
}
