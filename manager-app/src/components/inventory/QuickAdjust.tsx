import { useState, useRef, useCallback } from 'react';
import { Minus, Plus, Check, SlidersHorizontal } from 'lucide-react';
import type { InventoryItem } from '../../types';
import { LOG_REASONS } from '../../types';
import {
  STOCK_STATES,
  stockStateOf,
  type StockState,
  type InventoryItemState,
} from '../../hooks/useInventory';
import { useClickOutside } from '../../hooks/useClickOutside';

interface QuickAdjustProps {
  item: InventoryItem;
  /**
   * One-tap qualitative mark — the PRIMARY control. Returns the optimistic
   * setState promise so the chip can show a brief pending state while it saves.
   */
  onMarkState: (state: StockState) => Promise<unknown> | void;
  /** Rare exact numeric entry, behind the "…/Count" affordance. */
  onAdjust: (newQty: number, reason: string) => Promise<void>;
}

// Per-state chip styling. Active chip is filled; inactive chips are quiet so the
// row reads as "tap the one that's true right now". Dark-mode safe via semantic
// tokens / *-500 with low-alpha fills.
const CHIP_STYLES: Record<
  StockState,
  { active: string; idle: string }
> = {
  out: {
    active: 'bg-danger text-white border-danger',
    idle: 'border-border text-text-secondary hover:border-danger hover:text-danger',
  },
  one_left: {
    active: 'bg-accent text-white border-accent',
    idle: 'border-border text-text-secondary hover:border-accent hover:text-accent',
  },
  low: {
    active: 'bg-accent text-white border-accent',
    idle: 'border-border text-text-secondary hover:border-accent hover:text-accent',
  },
  half: {
    active: 'bg-surface-active text-text-primary border-border',
    idle: 'border-border text-text-secondary hover:bg-surface-hover',
  },
  ok: {
    active: 'bg-emerald-500 text-white border-emerald-500',
    idle: 'border-border text-text-secondary hover:border-emerald-500 hover:text-emerald-500',
  },
};

export function QuickAdjust({ item, onMarkState, onAdjust }: QuickAdjustProps) {
  const current = stockStateOf(item as InventoryItemState);
  const [marking, setMarking] = useState<StockState | null>(null);

  // Exact-count popover (rare path)
  const [countOpen, setCountOpen] = useState(false);
  const [direction, setDirection] = useState<'+' | '-'>('+');
  const [amount, setAmount] = useState('1');
  const [reason, setReason] = useState<string>('restock');
  const [submitting, setSubmitting] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useClickOutside(popoverRef, useCallback(() => setCountOpen(false), []), countOpen);

  const handleMark = async (state: StockState) => {
    if (state === current) return;
    setMarking(state);
    try {
      await onMarkState(state);
    } finally {
      setMarking(null);
    }
  };

  const openCount = (dir: '+' | '-') => {
    setDirection(dir);
    setReason(dir === '+' ? 'restock' : 'usage');
    setAmount('1');
    setCountOpen(true);
  };

  const handleConfirm = async () => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return;
    const delta = direction === '+' ? num : -num;
    const newQty = Math.max(0, item.current_quantity + delta);
    setSubmitting(true);
    await onAdjust(newQty, reason);
    setSubmitting(false);
    setCountOpen(false);
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* PRIMARY: one-tap qualitative chip row */}
      <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Mark stock level">
        {STOCK_STATES.map(({ value, label }) => {
          const isActive = value === current;
          const styles = CHIP_STYLES[value];
          return (
            <button
              key={value}
              type="button"
              onClick={() => handleMark(value)}
              disabled={marking !== null}
              aria-pressed={isActive}
              className={`min-h-[2.5rem] px-3 rounded-lg border text-sm font-medium transition-colors disabled:opacity-60 ${
                isActive ? styles.active : styles.idle
              }`}
            >
              {marking === value ? '…' : label}
            </button>
          );
        })}

        {/* Rare exact-count affordance */}
        <button
          type="button"
          onClick={() => openCount('+')}
          className="min-h-[2.5rem] w-10 flex items-center justify-center rounded-lg border border-border text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
          aria-label="Enter exact count"
          title="Enter exact count"
        >
          <SlidersHorizontal size={16} />
        </button>
      </div>

      {countOpen && (
        <div className="absolute top-full left-0 mt-2 z-30 w-60 card p-3 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-text-muted">Exact count</p>
            <span className="text-xs text-text-muted tabular-nums">
              on hand: {item.current_quantity} {item.unit}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDirection('-')}
              className={`w-10 h-10 flex items-center justify-center rounded-lg border transition-colors ${
                direction === '-'
                  ? 'bg-danger/10 border-danger text-danger'
                  : 'border-border text-text-muted hover:bg-surface-hover'
              }`}
              aria-label="Remove from stock"
            >
              <Minus size={16} />
            </button>
            <input
              type="number"
              min="0.01"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input-field text-center flex-1"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setDirection('+')}
              className={`w-10 h-10 flex items-center justify-center rounded-lg border transition-colors ${
                direction === '+'
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500'
                  : 'border-border text-text-muted hover:bg-surface-hover'
              }`}
              aria-label="Add to stock"
            >
              <Plus size={16} />
            </button>
          </div>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="input-field"
          >
            {LOG_REASONS.map((r) => (
              <option key={r} value={r}>
                {r.replace('_', ' ')}
              </option>
            ))}
          </select>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <Check size={14} />
            {submitting ? 'Saving...' : `${direction === '+' ? 'Add' : 'Remove'} ${amount || '0'}`}
          </button>
        </div>
      )}
    </div>
  );
}
