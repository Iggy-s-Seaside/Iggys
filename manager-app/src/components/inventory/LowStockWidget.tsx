import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import type { InventoryItem } from '../../types';

interface LowStockWidgetProps {
  items: InventoryItem[];
}

export function LowStockWidget({ items }: LowStockWidgetProps) {
  const top5 = items.slice(0, 5);

  return (
    <div className="card">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-danger" />
          <h2 className="font-semibold text-text-primary">Low Stock Alert</h2>
        </div>
        {items.length > 0 && (
          <span className="badge-danger">{items.length}</span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="p-8 text-center text-text-muted text-sm">
          All items are above par level
        </div>
      ) : (
        <div className="divide-y divide-border">
          {top5.map((item) => {
            const pct = item.par_level > 0
              ? Math.round((item.current_quantity / item.par_level) * 100)
              : 0;
            const isCritical = item.current_quantity < item.par_level * 0.5;

            return (
              <div key={item.id} className="flex items-center gap-3 px-5 py-3">
                <div
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    isCritical ? 'bg-danger' : 'bg-accent'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {item.name}
                  </p>
                  <p className="text-xs text-text-muted">
                    {item.current_quantity} / {item.par_level} {item.unit} ({pct}%)
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
