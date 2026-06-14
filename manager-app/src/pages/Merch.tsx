import { useMemo, useState } from 'react';
import {
  Shirt,
  Plus,
  Search,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  History,
  Trash2,
  Boxes,
  Loader2,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { useConfirm } from '../hooks/useConfirm';
import { useMerch, variantLabel, type MerchProductWithVariants } from '../hooks/useMerch';
import { useMerchScanner } from '../hooks/useMerchScanner';
import { VariantCountCell } from '../components/merch/VariantCountCell';
import { AddMerchTypeModal } from '../components/merch/AddMerchTypeModal';
import { MerchScanReviewModal } from '../components/merch/MerchScanReviewModal';
import { MerchLogDrawer } from '../components/merch/MerchLogDrawer';
import { ScanOrderButton } from '../components/inventory/ScanOrderButton';
import { money } from '../utils/format';

// ── One expandable product row ──

function ProductRow({
  product,
  onSet,
  onAdjust,
  onLog,
  onDelete,
}: {
  product: MerchProductWithVariants;
  onSet: (variantId: number, newStock: number) => Promise<boolean | void> | void;
  onAdjust: (variantId: number, delta: number) => Promise<boolean | void> | void;
  onLog: (variantId: number, label: string) => void;
  onDelete: (product: MerchProductWithVariants) => void;
}) {
  const [open, setOpen] = useState(false);
  const variantCount = product.variants.length;

  return (
    <div className={`card overflow-hidden ${!product.active ? 'opacity-70' : ''}`}>
      {/* Summary header (tap to expand) */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-hover transition-colors min-h-[60px]"
      >
        <span className="text-text-muted shrink-0">
          {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </span>

        {product.image ? (
          <img
            src={product.image}
            alt=""
            className="w-11 h-11 rounded-lg object-cover border border-border shrink-0"
          />
        ) : (
          <span className="w-11 h-11 rounded-lg bg-surface-hover flex items-center justify-center text-text-muted shrink-0">
            <Shirt size={18} />
          </span>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-text-primary truncate">{product.name}</p>
            {product.lowStock && (
              <span className="badge-danger flex items-center gap-1 shrink-0">
                <AlertTriangle size={11} /> low
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted">
            {variantCount} {variantCount === 1 ? 'variant' : 'variants'}
            {product.price > 0 && <> · {money(product.price)}</>}
          </p>
        </div>

        <div className="text-right shrink-0">
          <p className="text-lg font-bold tabular-nums text-text-primary leading-none">
            {product.totalStock}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-text-muted mt-0.5">in stock</p>
        </div>
      </button>

      {/* Expanded — count-entry grid */}
      {open && (
        <div className="border-t border-border px-4 py-4 bg-surface/40">
          {variantCount === 0 ? (
            <p className="text-sm text-text-muted text-center py-3">No variants on this product yet.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {product.variants.map((v) => (
                <div
                  key={v.id}
                  className={`relative rounded-xl border p-2.5 ${
                    v.active && v.stock <= v.par_level
                      ? 'border-accent/40 bg-accent/5'
                      : 'border-border bg-surface'
                  }`}
                >
                  <VariantCountCell variant={v} onSet={onSet} onAdjust={onAdjust} />
                  <button
                    type="button"
                    onClick={() => onLog(v.id, `${product.name} · ${variantLabel(v)}`)}
                    aria-label={`History for ${variantLabel(v)}`}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-surface border border-border flex items-center justify-center text-text-muted hover:text-text-primary shadow-sm"
                  >
                    <History size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/60">
            <span className="text-xs text-text-muted">
              Total: <span className="font-semibold text-text-primary">{product.totalStock}</span> across{' '}
              {variantCount} {variantCount === 1 ? 'variant' : 'variants'}
            </span>
            <button
              type="button"
              onClick={() => onDelete(product)}
              className="text-xs text-text-muted hover:text-danger flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──

export function Merch() {
  const merch = useMerch();
  const scanner = useMerchScanner(merch);
  const confirm = useConfirm();

  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [logState, setLogState] = useState<{ open: boolean; variantId: number | null; label: string }>({
    open: false,
    variantId: null,
    label: '',
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return merch.products;
    return merch.products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.variants.some(
          (v) =>
            v.sku?.toLowerCase().includes(q) ||
            v.size?.toLowerCase().includes(q) ||
            v.variant_label?.toLowerCase().includes(q)
        )
    );
  }, [merch.products, search]);

  const totalUnits = useMemo(
    () => merch.products.reduce((s, p) => s + p.totalStock, 0),
    [merch.products]
  );

  const handleDelete = async (product: MerchProductWithVariants) => {
    const ok = await confirm({
      title: 'Delete merch',
      message: `Delete "${product.name}" and all its variants? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) await merch.deleteProduct(product.id);
  };

  return (
    <div>
      <PageHeader title="Merch" icon={Shirt} subtitle={`${totalUnits} units across ${merch.products.length} products`}>
        {merch.lowStockCount > 0 && (
          <span className="badge-danger flex items-center gap-1">
            <AlertTriangle size={12} /> {merch.lowStockCount} low
          </span>
        )}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            className="input-field pl-9 w-full sm:w-56"
            placeholder="Search merch..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <ScanOrderButton
          onFileSelected={(file) => {
            setScanOpen(true);
            scanner.startScan(file);
          }}
          disabled={scanner.state !== 'idle' && scanner.state !== 'done'}
        />
        <button onClick={() => setAddOpen(true)} className="btn-primary flex items-center gap-2 shrink-0">
          <Plus size={16} />
          <span className="hidden sm:inline">Add merch</span>
        </button>
      </PageHeader>

      {/* Content */}
      {merch.loading ? (
        <div className="card p-16 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-text-muted" />
        </div>
      ) : merch.error && merch.products.length === 0 ? (
        <ErrorState onRetry={merch.refresh} description="We couldn't load your merch. Your counts are safe." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title={search ? 'No merch matches your search' : 'No merch yet'}
          description={
            search
              ? 'Try a different name, size, or SKU.'
              : 'Add a merch type to start counting stock by size and style.'
          }
          action={
            !search ? (
              <button onClick={() => setAddOpen(true)} className="btn-primary inline-flex items-center gap-2">
                <Plus size={16} /> Add your first merch
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((product) => (
            <ProductRow
              key={product.id}
              product={product}
              onSet={merch.setVariantStock}
              onAdjust={merch.adjustVariantStock}
              onLog={(variantId, label) => setLogState({ open: true, variantId, label })}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Add merch wizard */}
      <AddMerchTypeModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreate={merch.createProductWithVariants}
      />

      {/* Scan intake review */}
      <MerchScanReviewModal
        open={scanOpen}
        onClose={() => {
          setScanOpen(false);
          if (scanner.state === 'done') {
            scanner.reset();
            merch.refresh();
          }
        }}
        state={scanner.state}
        supplier={scanner.result?.supplier ?? null}
        orderNumber={scanner.result?.orderNumber ?? null}
        items={scanner.result?.items ?? []}
        imageUrl={scanner.result?.imageUrl}
        error={scanner.error}
        onUpdateItem={scanner.updateItem}
        onUpdateSupplier={scanner.updateSupplier}
        onConfirm={async () => {
          const ok = await scanner.confirmIntake();
          if (ok) await merch.refresh();
        }}
        onRetry={() => {
          scanner.reset();
          setScanOpen(false);
        }}
      />

      {/* Variant history drawer */}
      <MerchLogDrawer
        open={logState.open}
        onClose={() => setLogState({ open: false, variantId: null, label: '' })}
        variantId={logState.variantId}
        label={logState.label}
      />
    </div>
  );
}

export default Merch;
