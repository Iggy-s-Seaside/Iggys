import { X, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useMerchVariantLogs } from '../../hooks/useMerch';

interface MerchLogDrawerProps {
  open: boolean;
  onClose: () => void;
  variantId: number | null;
  label: string;
}

/** Right-side activity drawer for a single merch variant — mirrors InventoryLogDrawer. */
export function MerchLogDrawer({ open, onClose, variantId, label }: MerchLogDrawerProps) {
  const { logs, loading } = useMerchVariantLogs(open ? variantId : null);

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />}

      <div
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-md bg-surface border-l border-border shadow-lg transform transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Variant activity log"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="min-w-0">
            <h2 className="font-semibold text-text-primary">Activity Log</h2>
            <p className="text-xs text-text-muted mt-0.5 truncate">{label}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto h-[calc(100%-4.5rem)]">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-text-muted" />
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-sm">No activity logged yet</div>
          ) : (
            <div className="divide-y divide-border">
              {logs.map((log) => {
                const change = log.change_amount ?? 0;
                const isPositive = change > 0;
                let dateStr: string;
                try {
                  dateStr = format(parseISO(log.created_at), 'MMM d, yyyy h:mm a');
                } catch {
                  dateStr = log.created_at;
                }
                return (
                  <div key={log.id} className="px-5 py-3.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-sm font-semibold tabular-nums ${
                          isPositive ? 'text-emerald-500' : 'text-danger'
                        }`}
                      >
                        {isPositive ? '+' : ''}
                        {change}
                      </span>
                      {log.reason && (
                        <span className="badge-primary text-xs">{log.reason.replace(/_/g, ' ')}</span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted">
                      {log.previous_stock ?? 0} &rarr; {log.new_stock ?? 0}
                    </p>
                    <div className="flex items-center justify-between text-xs text-text-muted">
                      <span className="truncate">{log.user_email}</span>
                      <span className="shrink-0">{dateStr}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
