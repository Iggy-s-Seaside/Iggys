import { Link } from 'react-router-dom';
import { AlertTriangle, Clock } from 'lucide-react';
import type { InventoryItem } from '../../types';
import {
  stockStateOf,
  isMarkedLow,
  isStale,
  isBelowReorderPoint,
  type StockState,
  type InventoryItemState,
} from '../../hooks/useInventory';

interface LowStockWidgetProps {
  /** Already filtered to attention items by getLowStockItems (the OR'd triggers). */
  items: InventoryItem[];
}

// Color by qualitative signal: Out = red, one_left/low = amber, else neutral.
const STATE_DOT: Record<StockState, string> = {
  out: 'bg-danger',
  one_left: 'bg-accent',
  low: 'bg-accent',
  half: 'bg-text-muted',
  ok: 'bg-emerald-500',
};

const STATE_LABEL: Record<StockState, string> = {
  out: 'Out',
  one_left: '1 left',
  low: 'Low',
  half: '~Half',
  ok: 'OK',
};

/** Why is this item flagged? Marked state wins; then count; then staleness. */
function reasonFor(item: InventoryItemState): { dot: string; label: string; stale: boolean } {
  if (isMarkedLow(item)) {
    const st = stockStateOf(item);
    return { dot: STATE_DOT[st], label: STATE_LABEL[st], stale: false };
  }
  if (isBelowReorderPoint(item)) {
    return { dot: 'bg-accent', label: 'At reorder point', stale: false };
  }
  if (isStale(item)) {
    return { dot: 'bg-text-muted/50', label: 'No recent check', stale: true };
  }
  return { dot: STATE_DOT.ok, label: STATE_LABEL.ok, stale: false };
}

export function LowStockWidget({ items }: LowStockWidgetProps) {
  const list = items as InventoryItemState[];
  const top5 = list.slice(0, 5);

  return (
    <div className="card">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-danger" />
          <h2 className="font-semibold text-text-primary">Low Stock Alert</h2>
        </div>
        {list.length > 0 && (
          <span className="badge-danger">{list.length}</span>
        )}
      </div>

      {list.length === 0 ? (
        <div className="p-8 text-center text-text-muted text-sm">
          Nothing flagged — all items marked OK and recently checked
        </div>
      ) : (
        <div className="divide-y divide-border">
          {top5.map((item) => {
            const { dot, label, stale } = reasonFor(item);
            return (
              <div key={item.id} className="flex items-center gap-3 px-5 py-3">
                <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {item.name}
                  </p>
                  <p className="text-xs text-text-muted flex items-center gap-1">
                    {stale && <Clock size={11} className="shrink-0" />}
                    {label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="px-5 py-3 border-t border-border">
        <Link to="/inventory" className="text-sm text-primary hover:text-primary-hover">
          View inventory
        </Link>
      </div>
    </div>
  );
}
