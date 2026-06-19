import type { ReactNode } from 'react';
import { Loader2, Package, Check, Plus, X, AlertTriangle, Tag, ArrowRight } from 'lucide-react';
import { Modal } from '../ui/Modal';
import type { MerchScanLine, MerchScanState, MerchScanStatus } from '../../hooks/useMerchScanner';

interface MerchScanReviewModalProps {
  open: boolean;
  onClose: () => void;
  state: MerchScanState;
  supplier: string | null;
  orderNumber: string | null;
  items: MerchScanLine[];
  imageUrl?: string;
  error: string | null;
  onUpdateItem: (index: number, changes: Partial<MerchScanLine>) => void;
  onUpdateSupplier: (supplier: string) => void;
  onConfirm: () => void;
  onRetry?: () => void;
}

const STATUS_META: Record<
  MerchScanStatus,
  { color: string; icon: ReactNode; label: string }
> = {
  matched: {
    color: 'border-green-500/30 bg-green-500/5',
    icon: <Check size={16} className="text-green-400" />,
    label: 'Restock',
  },
  new_variant: {
    color: 'border-sky-500/30 bg-sky-500/5',
    icon: <Tag size={16} className="text-sky-400" />,
    label: 'New size',
  },
  new_product: {
    color: 'border-amber-500/30 bg-amber-500/5',
    icon: <Plus size={16} className="text-amber-400" />,
    label: 'New product',
  },
  skipped: {
    color: 'border-gray-500/30 bg-gray-500/5 opacity-50',
    icon: <X size={16} className="text-gray-400" />,
    label: 'Skipped',
  },
  unreadable: {
    color: 'border-red-500/30 bg-red-500/5',
    icon: <AlertTriangle size={16} className="text-red-400" />,
    label: 'Unreadable',
  },
};

function ReviewRow({
  item,
  index,
  onUpdate,
}: {
  item: MerchScanLine;
  index: number;
  onUpdate: (index: number, changes: Partial<MerchScanLine>) => void;
}) {
  const meta = STATUS_META[item.status];
  const skipped = item.status === 'skipped';

  return (
    <div className={`border rounded-xl p-3 ${meta.color} transition-all`}>
      <div className="flex items-start gap-3">
        <div className="mt-1 flex-shrink-0">{meta.icon}</div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{item.description}</p>

          {item.status === 'matched' && item.proposed_label && (
            <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1">
              <ArrowRight size={12} />
              <span className="text-green-400 truncate">{item.proposed_label}</span>
              {item.match_confidence ? (
                <span className="text-text-muted/50">({Math.round(item.match_confidence * 100)}%)</span>
              ) : null}
            </p>
          )}

          {item.status === 'new_variant' && item.proposed_label && (
            <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1">
              <ArrowRight size={12} />
              <span className="text-sky-400 truncate">
                {item.proposed_label} · new {item.new_size ?? item.new_label ?? item.size}
              </span>
            </p>
          )}

          {item.status === 'new_product' && (
            <p className="text-xs text-amber-400 mt-0.5">Will create a new merch product</p>
          )}

          {item.size && item.status !== 'matched' && (
            <p className="text-xs text-text-muted mt-0.5">{item.size}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {!skipped && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onUpdate(index, { quantity: Math.max(0, item.quantity - 1) })}
                className="w-8 h-8 rounded-lg bg-surface-hover flex items-center justify-center text-text-muted hover:text-text-primary"
                aria-label="Decrease"
              >
                -
              </button>
              <input
                type="number"
                value={item.quantity}
                onChange={(e) =>
                  onUpdate(index, { quantity: Math.max(0, parseInt(e.target.value) || 0) })
                }
                className="w-12 h-8 text-center text-sm bg-surface border border-border rounded-lg text-text-primary"
                aria-label={`${item.description} quantity`}
              />
              <button
                onClick={() => onUpdate(index, { quantity: item.quantity + 1 })}
                className="w-8 h-8 rounded-lg bg-surface-hover flex items-center justify-center text-text-muted hover:text-text-primary"
                aria-label="Increase"
              >
                +
              </button>
            </div>
          )}

          <button
            onClick={() =>
              onUpdate(index, {
                status: skipped
                  ? item.matched_variant_id
                    ? 'matched'
                    : item.matched_product_id
                      ? 'new_variant'
                      : 'new_product'
                  : 'skipped',
              })
            }
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface-hover text-text-muted hover:text-red-400 transition-colors"
            title={skipped ? 'Include' : 'Skip'}
            aria-label={skipped ? 'Include' : 'Skip'}
          >
            {skipped ? <Plus size={14} /> : <X size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MerchScanReviewModal({
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
}: MerchScanReviewModalProps) {
  const isLoading = state === 'uploading' || state === 'scanning' || state === 'confirming';

  const order: MerchScanStatus[] = ['matched', 'new_variant', 'new_product', 'unreadable', 'skipped'];
  const sorted = [...items].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));

  const count = (s: MerchScanStatus) => items.filter((i) => i.status === s).length;
  const actionable = items.filter((i) => i.status !== 'skipped' && i.status !== 'unreadable').length;

  const loadingMessage =
    { uploading: 'Uploading photo...', scanning: 'Reading invoice...', confirming: 'Updating stock...' }[
      state as string
    ] || 'Processing...';

  return (
    <Modal
      open={open}
      onClose={isLoading ? () => {} : onClose}
      title={state === 'reviewing' ? 'Review merch intake' : 'Scan merch invoice'}
      maxWidth="max-w-2xl"
    >
      <div className="overflow-y-auto px-0 py-1 space-y-4">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 size={32} className="animate-spin text-primary" />
            <p className="text-text-muted">{loadingMessage}</p>
          </div>
        )}

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

        {state === 'reviewing' && (
          <>
            <div className="flex items-center gap-3">
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="Scanned invoice"
                  loading="lazy"
                  className="w-16 h-16 object-cover rounded-lg border border-border flex-shrink-0"
                />
              )}
              <div className="flex-1 space-y-1">
                <input
                  value={supplier || ''}
                  onChange={(e) => onUpdateSupplier(e.target.value)}
                  placeholder="Supplier / vendor"
                  className="input-field text-sm py-1.5"
                />
                {orderNumber && <p className="text-xs text-text-muted">Invoice #{orderNumber}</p>}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {count('matched') > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                  <Check size={12} /> {count('matched')} restock
                </span>
              )}
              {count('new_variant') > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <Tag size={12} /> {count('new_variant')} new size
                </span>
              )}
              {count('new_product') > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Plus size={12} /> {count('new_product')} new
                </span>
              )}
              {count('unreadable') > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                  <AlertTriangle size={12} /> {count('unreadable')} unreadable
                </span>
              )}
              {count('skipped') > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">
                  <X size={12} /> {count('skipped')} skipped
                </span>
              )}
            </div>

            {items.length === 0 ? (
              <div className="text-center py-8 text-text-muted">
                <Package size={32} className="mx-auto mb-2 opacity-40" />
                <p>No lines detected in the scan.</p>
                <p className="text-xs mt-1">Try a clearer photo with better lighting.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sorted.map((item) => {
                  const originalIndex = items.indexOf(item);
                  return (
                    <ReviewRow
                      key={originalIndex}
                      item={item}
                      index={originalIndex}
                      onUpdate={onUpdateItem}
                    />
                  );
                })}
              </div>
            )}

            {items.length > 0 && (
              <div className="sticky bottom-0 bg-surface pt-3 pb-1 border-t border-border">
                <button onClick={onConfirm} className="btn-primary w-full" disabled={actionable === 0}>
                  <Check size={16} />
                  Apply intake ({actionable} {actionable === 1 ? 'line' : 'lines'})
                </button>
              </div>
            )}
          </>
        )}

        {state === 'done' && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <Check size={24} className="text-green-400" />
            </div>
            <p className="text-text-primary font-medium">Stock updated.</p>
            <button onClick={onClose} className="btn-primary">
              Done
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
