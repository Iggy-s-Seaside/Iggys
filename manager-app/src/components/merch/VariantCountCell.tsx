import { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { MerchVariant } from '../../hooks/useMerch';
import { variantLabel } from '../../hooks/useMerch';

interface VariantCountCellProps {
  variant: MerchVariant;
  /** Set absolute stock (logs reason 'count'). */
  onSet: (variantId: number, newStock: number) => Promise<boolean | void> | void;
  /** Adjust by delta (logs reason 'manual'). */
  onAdjust: (variantId: number, delta: number) => Promise<boolean | void> | void;
}

/**
 * One fast count-entry cell for a variant — a tappable "set count" field flanked
 * by glove-friendly +/- buttons. Reuses the QuickAdjust feel: the number itself
 * is an editable input (type to set an absolute count, blur/Enter to commit),
 * and the steppers nudge by 1. Low-stock (stock <= par_level) tints the count.
 */
export function VariantCountCell({ variant, onSet, onAdjust }: VariantCountCellProps) {
  const [draft, setDraft] = useState(String(variant.stock));
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the field in sync with optimistic/server updates unless mid-edit.
  useEffect(() => {
    if (!editing) setDraft(String(variant.stock));
  }, [variant.stock, editing]);

  const low = variant.active && variant.stock <= variant.par_level;
  const countColor = !variant.active
    ? 'text-text-muted'
    : variant.stock <= variant.par_level * 0.5
      ? 'text-danger'
      : low
        ? 'text-accent'
        : 'text-text-primary';

  const commit = () => {
    setEditing(false);
    const n = parseInt(draft, 10);
    if (!Number.isNaN(n) && n !== variant.stock) {
      onSet(variant.id, Math.max(0, n));
    } else {
      setDraft(String(variant.stock));
    }
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
        {variantLabel(variant)}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onAdjust(variant.id, -1)}
          disabled={!variant.active || variant.stock <= 0}
          aria-label={`Decrease ${variantLabel(variant)}`}
          className="w-11 h-11 flex items-center justify-center rounded-lg bg-surface-hover hover:bg-red-500/10 hover:text-danger active:scale-95 transition-colors disabled:opacity-40 disabled:hover:bg-surface-hover disabled:hover:text-current"
        >
          <Minus size={14} />
        </button>
        <input
          ref={inputRef}
          inputMode="numeric"
          pattern="[0-9]*"
          value={draft}
          disabled={!variant.active}
          onFocus={(e) => {
            setEditing(true);
            e.currentTarget.select();
          }}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              inputRef.current?.blur();
            }
            if (e.key === 'Escape') {
              setDraft(String(variant.stock));
              setEditing(false);
              inputRef.current?.blur();
            }
          }}
          aria-label={`${variantLabel(variant)} count`}
          className={`w-12 h-11 text-center font-semibold tabular-nums bg-surface border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
            low ? 'border-accent/40' : 'border-border'
          } ${countColor} disabled:opacity-40`}
        />
        <button
          type="button"
          onClick={() => onAdjust(variant.id, 1)}
          disabled={!variant.active}
          aria-label={`Increase ${variantLabel(variant)}`}
          className="w-11 h-11 flex items-center justify-center rounded-lg bg-surface-hover hover:bg-emerald-500/10 hover:text-emerald-500 active:scale-95 transition-colors disabled:opacity-40"
        >
          <Plus size={14} />
        </button>
      </div>
      {variant.par_level > 0 && (
        <span className="text-[10px] text-text-muted">par {variant.par_level}</span>
      )}
    </div>
  );
}
