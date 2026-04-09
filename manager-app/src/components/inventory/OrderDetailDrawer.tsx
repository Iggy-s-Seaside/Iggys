import { X, Check, Plus, AlertTriangle, Package } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { Order } from '../../types';

interface OrderDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  order: Order | null;
}

export function OrderDetailDrawer({ open, onClose, order }: OrderDetailDrawerProps) {
  return (
    <>
      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      )}

      {/* Drawer panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-md bg-surface border-l border-border shadow-lg transform transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-text-primary">Order Details</h2>
            {order && (
              <p className="text-xs text-text-muted mt-0.5">
                {format(parseISO(order.created_at), 'MMM d, yyyy h:mm a')}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {order && (
          <div className="overflow-y-auto h-[calc(100%-60px)] px-5 py-4 space-y-4">
            {/* Order image */}
            <img
              src={order.image_url}
              alt="Order sheet"
              className="w-full rounded-xl border border-border"
            />

            {/* Supplier + order info */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {order.supplier || 'Unknown Supplier'}
                </p>
                {order.order_number && (
                  <p className="text-xs text-text-muted">Order #{order.order_number}</p>
                )}
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                order.status === 'confirmed'
                  ? 'bg-green-500/10 text-green-400'
                  : order.status === 'cancelled'
                  ? 'bg-red-500/10 text-red-400'
                  : 'bg-amber-500/10 text-amber-400'
              }`}>
                {order.status}
              </span>
            </div>

            {/* Scanned by */}
            <p className="text-xs text-text-muted">
              Scanned by {order.scanned_by}
            </p>

            {/* Items list */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-text-muted uppercase tracking-wide">
                Items ({order.items.length})
              </p>
              {order.items.length === 0 ? (
                <div className="text-center py-6 text-text-muted">
                  <Package size={24} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No items in this order</p>
                </div>
              ) : (
                order.items.map((item, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border ${
                      item.status === 'matched'
                        ? 'border-green-500/20 bg-green-500/5'
                        : item.status === 'new'
                        ? 'border-amber-500/20 bg-amber-500/5'
                        : item.status === 'skipped'
                        ? 'border-gray-500/20 bg-gray-500/5 opacity-50'
                        : 'border-red-500/20 bg-red-500/5'
                    }`}
                  >
                    {item.status === 'matched' && <Check size={14} className="text-green-400 flex-shrink-0" />}
                    {item.status === 'new' && <Plus size={14} className="text-amber-400 flex-shrink-0" />}
                    {item.status === 'skipped' && <X size={14} className="text-gray-400 flex-shrink-0" />}
                    {item.status === 'unreadable' && <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />}

                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary truncate">
                        {item.proposed_name || item.description}
                      </p>
                      {item.size && (
                        <p className="text-xs text-text-muted">{item.size}</p>
                      )}
                    </div>

                    <span className="text-sm font-medium text-text-primary flex-shrink-0">
                      x{item.quantity}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
