import { Check, Plus, X, AlertTriangle, ArrowRight } from 'lucide-react';
import type { ScannedLineItem } from '../../types';

interface ScanReviewItemProps {
  item: ScannedLineItem;
  index: number;
  onUpdate: (index: number, changes: Partial<ScannedLineItem>) => void;
}

export function ScanReviewItem({ item, index, onUpdate }: ScanReviewItemProps) {
  const statusConfig = {
    matched: { color: 'border-green-500/30 bg-green-500/5', icon: <Check size={16} className="text-green-400" />, label: 'Matched' },
    new: { color: 'border-amber-500/30 bg-amber-500/5', icon: <Plus size={16} className="text-amber-400" />, label: 'New Item' },
    skipped: { color: 'border-gray-500/30 bg-gray-500/5 opacity-50', icon: <X size={16} className="text-gray-400" />, label: 'Skipped' },
    unreadable: { color: 'border-red-500/30 bg-red-500/5', icon: <AlertTriangle size={16} className="text-red-400" />, label: 'Unreadable' },
  };

  const config = statusConfig[item.status];

  return (
    <div className={`border rounded-xl p-3 ${config.color} transition-all`}>
      <div className="flex items-start gap-3">
        {/* Status icon */}
        <div className="mt-1 flex-shrink-0">{config.icon}</div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Description */}
          <p className="text-sm font-medium text-text-primary truncate">
            {item.description}
          </p>

          {/* Match info */}
          {item.status === 'matched' && item.proposed_name && (
            <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1">
              <ArrowRight size={12} />
              <span className="text-green-400">{item.proposed_name}</span>
              {item.match_confidence && (
                <span className="text-text-muted/50">
                  ({Math.round(item.match_confidence * 100)}%)
                </span>
              )}
            </p>
          )}

          {/* Size */}
          {item.size && (
            <p className="text-xs text-text-muted mt-0.5">{item.size}</p>
          )}
        </div>

        {/* Quantity control */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {item.status !== 'skipped' && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onUpdate(index, { quantity: Math.max(0, item.quantity - 1) })}
                className="w-7 h-7 rounded-lg bg-surface-hover flex items-center justify-center text-text-muted hover:text-text-primary"
              >
                -
              </button>
              <input
                type="number"
                value={item.quantity}
                onChange={(e) => onUpdate(index, { quantity: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-12 h-7 text-center text-sm bg-surface border border-border rounded-lg text-text-primary"
              />
              <button
                onClick={() => onUpdate(index, { quantity: item.quantity + 1 })}
                className="w-7 h-7 rounded-lg bg-surface-hover flex items-center justify-center text-text-muted hover:text-text-primary"
              >
                +
              </button>
            </div>
          )}

          {/* Skip/include toggle */}
          <button
            onClick={() =>
              onUpdate(index, {
                status: item.status === 'skipped'
                  ? (item.matched_item_id ? 'matched' : 'new')
                  : 'skipped',
              })
            }
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              item.status === 'skipped'
                ? 'bg-surface-hover text-text-muted hover:text-primary'
                : 'bg-surface-hover text-text-muted hover:text-red-400'
            }`}
            title={item.status === 'skipped' ? 'Include' : 'Skip'}
          >
            {item.status === 'skipped' ? <Plus size={14} /> : <X size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}
