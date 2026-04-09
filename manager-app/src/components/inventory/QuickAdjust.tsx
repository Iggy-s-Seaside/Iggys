import { useState, useRef, useCallback } from 'react';
import { Minus, Plus, Check } from 'lucide-react';
import type { InventoryItem } from '../../types';
import { LOG_REASONS } from '../../types';
import { useClickOutside } from '../../hooks/useClickOutside';

interface QuickAdjustProps {
  item: InventoryItem;
  onAdjust: (newQty: number, reason: string) => Promise<void>;
}

export function QuickAdjust({ item, onAdjust }: QuickAdjustProps) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<'+' | '-'>('+');
  const [amount, setAmount] = useState('1');
  const [reason, setReason] = useState<string>('restock');
  const [submitting, setSubmitting] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useClickOutside(popoverRef, useCallback(() => setOpen(false), []), open);

  const handleOpen = (dir: '+' | '-') => {
    setDirection(dir);
    setReason(dir === '+' ? 'restock' : 'usage');
    setAmount('1');
    setOpen(true);
  };

  const handleConfirm = async () => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return;
    const delta = direction === '+' ? num : -num;
    const newQty = Math.max(0, item.current_quantity + delta);
    setSubmitting(true);
    await onAdjust(newQty, reason);
    setSubmitting(false);
    setOpen(false);
  };

  // Quantity color
  const qtyColor =
    item.current_quantity < item.par_level * 0.5
      ? 'text-danger'
      : item.current_quantity < item.par_level
        ? 'text-accent'
        : 'text-emerald-500';

  return (
    <div className="relative" ref={popoverRef}>
      <div className="flex items-center gap-1">
        <button
          onClick={() => handleOpen('-')}
          className="w-11 h-11 flex items-center justify-center rounded-lg bg-surface-hover hover:bg-red-500/10 hover:text-danger transition-colors"
          aria-label="Decrease quantity"
        >
          <Minus size={16} />
        </button>
        <span className={`min-w-[3rem] text-center font-semibold tabular-nums ${qtyColor}`}>
          {item.current_quantity}
        </span>
        <button
          onClick={() => handleOpen('+')}
          className="w-11 h-11 flex items-center justify-center rounded-lg bg-surface-hover hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors"
          aria-label="Increase quantity"
        >
          <Plus size={16} />
        </button>
      </div>

      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-30 w-56 card p-3 shadow-lg space-y-3">
          <p className="text-xs font-medium text-text-muted">
            {direction === '+' ? 'Add to' : 'Remove from'} stock
          </p>
          <input
            type="number"
            min="0.01"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input-field text-center"
            autoFocus
          />
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
            {submitting ? 'Saving...' : 'Confirm'}
          </button>
        </div>
      )}
    </div>
  );
}
