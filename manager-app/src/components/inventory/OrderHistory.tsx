import { useState } from 'react';
import { ClipboardList, Loader2, ChevronRight, Package, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useOrders } from '../../hooks/useOrders';
import { OrderDetailDrawer } from './OrderDetailDrawer';
import type { Order } from '../../types';

interface OrderHistoryProps {
  open: boolean;
  onClose: () => void;
}

export function OrderHistory({ open, onClose }: OrderHistoryProps) {
  const { orders, loading } = useOrders(open);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Don't render anything when closed, but hooks are always called above
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-0 right-0 z-50 h-full w-full max-w-md bg-surface border-l border-border shadow-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <ClipboardList size={18} className="text-primary" />
            <h2 className="font-semibold text-text-primary">Order History</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-hover transition-colors text-text-muted"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto h-[calc(100%-60px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-text-muted">
              <Package size={32} className="mb-2 opacity-40" />
              <p className="text-sm">No orders scanned yet</p>
              <p className="text-xs mt-1">Use &quot;Scan Order&quot; to import your first order sheet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {orders.map((order) => {
                const matchedCount = order.items.filter((i) => i.status === 'matched').length;
                const newCount = order.items.filter((i) => i.status === 'new').length;
                const totalItems = order.items.length;

                return (
                  <button
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-surface-hover transition-colors text-left"
                  >
                    <img
                      src={order.image_url}
                      alt=""
                      className="w-12 h-12 object-cover rounded-lg border border-border flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {order.supplier || 'Unknown Supplier'}
                      </p>
                      <p className="text-xs text-text-muted">
                        {format(parseISO(order.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {totalItems} items
                        {matchedCount > 0 && ` · ${matchedCount} restocked`}
                        {newCount > 0 && ` · ${newCount} new`}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-text-muted flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <OrderDetailDrawer
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        order={selectedOrder}
      />
    </>
  );
}
