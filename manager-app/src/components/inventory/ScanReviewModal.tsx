import { Loader2, Package, Check, Plus, X, AlertTriangle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { ScanReviewItem } from './ScanReviewItem';
import type { ScanState } from '../../hooks/useOrderScanner';
import type { ScannedLineItem } from '../../types';

interface ScanReviewModalProps {
  open: boolean;
  onClose: () => void;
  state: ScanState;
  supplier: string | null;
  orderNumber: string | null;
  items: ScannedLineItem[];
  imageUrl?: string;
  error: string | null;
  onUpdateItem: (index: number, changes: Partial<ScannedLineItem>) => void;
  onUpdateSupplier: (supplier: string) => void;
  onConfirm: () => void;
  onRetry?: () => void;
}

export function ScanReviewModal({
  open,
  onClose,
  state,
  supplier,
  orderNumber,
  items,
  imageUrl,
  error,
  onUpdateItem,
  onUpdateSupplier,
  onConfirm,
  onRetry,
}: ScanReviewModalProps) {
  const isLoading = state === 'uploading' || state === 'scanning' || state === 'confirming';

  const matched = items.filter((i) => i.status === 'matched');
  const newItems = items.filter((i) => i.status === 'new');
  const skipped = items.filter((i) => i.status === 'skipped');
  const unreadable = items.filter((i) => i.status === 'unreadable');

  const loadingMessage = {
    uploading: 'Uploading image...',
    scanning: 'Scanning order sheet...',
    confirming: 'Processing order...',
  }[state as string] || 'Processing...';

  return (
    <Modal
      open={open}
      onClose={isLoading ? () => {} : onClose}
      title={state === 'reviewing' ? 'Review Order' : 'Scan Order'}
      maxWidth="max-w-2xl"
    >
      <div className="overflow-y-auto px-6 py-4 space-y-4">
        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 size={32} className="animate-spin text-primary" />
            <p className="text-text-muted">{loadingMessage}</p>
          </div>
        )}

        {/* Error state */}
        {state === 'error' && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <AlertTriangle size={32} className="text-red-400" />
            <p className="text-red-400 text-center">{error || 'Something went wrong'}</p>
            <div className="flex gap-3">
              {onRetry && (
                <button onClick={onRetry} className="btn-primary">
                  Try Again
                </button>
              )}
              <button onClick={onClose} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Review state */}
        {state === 'reviewing' && (
          <>
            {/* Header info */}
            <div className="flex items-center gap-3">
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="Scanned order"
                  className="w-16 h-16 object-cover rounded-lg border border-border flex-shrink-0"
                />
              )}
              <div className="flex-1 space-y-1">
                <input
                  value={supplier || ''}
                  onChange={(e) => onUpdateSupplier(e.target.value)}
                  placeholder="Supplier name"
                  className="input-field text-sm py-1.5"
                />
                {orderNumber && (
                  <p className="text-xs text-text-muted">Order #{orderNumber}</p>
                )}
              </div>
            </div>

            {/* Summary badges */}
            <div className="flex flex-wrap gap-2">
              {matched.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                  <Check size={12} /> {matched.length} matched
                </span>
              )}
              {newItems.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Plus size={12} /> {newItems.length} new
                </span>
              )}
              {unreadable.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                  <AlertTriangle size={12} /> {unreadable.length} unreadable
                </span>
              )}
              {skipped.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">
                  <X size={12} /> {skipped.length} skipped
                </span>
              )}
            </div>

            {/* Items list */}
            {items.length === 0 ? (
              <div className="text-center py-8 text-text-muted">
                <Package size={32} className="mx-auto mb-2 opacity-40" />
                <p>No items detected in the scan.</p>
                <p className="text-xs mt-1">Try a clearer photo with better lighting.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Matched items first, then new, then unreadable, then skipped */}
                {[...matched, ...newItems, ...unreadable, ...skipped].map((item) => {
                  const originalIndex = items.indexOf(item);
                  return (
                    <ScanReviewItem
                      key={originalIndex}
                      item={item}
                      index={originalIndex}
                      onUpdate={onUpdateItem}
                    />
                  );
                })}
              </div>
            )}

            {/* Confirm button */}
            {items.length > 0 && (
              <div className="sticky bottom-0 bg-surface pt-3 pb-1 border-t border-border">
                <button
                  onClick={onConfirm}
                  className="btn-primary w-full"
                  disabled={items.every((i) => i.status === 'skipped')}
                >
                  <Check size={16} />
                  Confirm Restock ({items.filter((i) => i.status !== 'skipped').length} items)
                </button>
              </div>
            )}
          </>
        )}

        {/* Done state */}
        {state === 'done' && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <Check size={24} className="text-green-400" />
            </div>
            <p className="text-text-primary font-medium">Order processed successfully!</p>
            <button onClick={onClose} className="btn-primary">
              Done
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
