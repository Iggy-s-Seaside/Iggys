import { useState, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  Pencil,
  Trash2,
  History,
  AlertTriangle,
  Loader2,
  X,
  ClipboardList,
} from 'lucide-react';
import {
  useInventoryItems,
  useInventoryCategories,
  adjustQuantity,
  getLowStockItems,
} from '../hooks/useInventory';
import { useAuth } from '../context/AuthContext';
import { useOrderScanner } from '../hooks/useOrderScanner';
import { QuickAdjust } from '../components/inventory/QuickAdjust';
import { InventoryLogDrawer } from '../components/inventory/InventoryLogDrawer';
import { ScanOrderButton } from '../components/inventory/ScanOrderButton';
import { ScanReviewModal } from '../components/inventory/ScanReviewModal';
import { OrderHistory } from '../components/inventory/OrderHistory';
import type { InventoryItem, InventoryCategory } from '../types';
import { INVENTORY_UNITS } from '../types';

// ── Item Form Modal ──

interface ItemFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<InventoryItem, 'id' | 'created_at' | 'inventory_categories'>) => Promise<boolean>;
  categories: InventoryCategory[];
  initial?: InventoryItem | null;
}

function ItemFormModal({ open, onClose, onSubmit, categories, initial }: ItemFormProps) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    category_id: initial?.category_id ?? (categories[0]?.id ?? null) as number | null,
    current_quantity: initial?.current_quantity ?? 0,
    unit: initial?.unit ?? 'units',
    par_level: initial?.par_level ?? 0,
    cost_per_unit: initial?.cost_per_unit ?? null as number | null,
    supplier: initial?.supplier ?? '',
    notes: initial?.notes ?? '',
    active: initial?.active ?? true,
  });
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const ok = await onSubmit({
      ...form,
      supplier: form.supplier || null,
      notes: form.notes || null,
    });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-text-primary">
            {initial ? 'Edit Item' : 'Add Item'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-hover">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="label">Name *</label>
            <input
              className="input-field"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category</label>
              <select
                className="input-field"
                value={form.category_id ?? ''}
                onChange={(e) =>
                  setForm({ ...form, category_id: e.target.value ? Number(e.target.value) : null })
                }
              >
                <option value="">None</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Unit</label>
              <select
                className="input-field"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              >
                {INVENTORY_UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Current Quantity</label>
              <input
                type="number"
                step="any"
                className="input-field"
                value={form.current_quantity}
                onChange={(e) => setForm({ ...form, current_quantity: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Par Level</label>
              <input
                type="number"
                step="any"
                className="input-field"
                value={form.par_level}
                onChange={(e) => setForm({ ...form, par_level: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Cost per Unit ($)</label>
              <input
                type="number"
                step="0.01"
                className="input-field"
                value={form.cost_per_unit ?? ''}
                onChange={(e) =>
                  setForm({ ...form, cost_per_unit: e.target.value ? Number(e.target.value) : null })
                }
              />
            </div>
            <div>
              <label className="label">Supplier</label>
              <input
                className="input-field"
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea
              className="input-field"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="rounded border-border"
            />
            <label htmlFor="active" className="text-sm text-text-secondary">Active</label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : initial ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Inventory Page ──

export function Inventory() {
  const { items, loading, refresh, create, update, remove } = useInventoryItems();
  const { data: categories } = useInventoryCategories();
  const { user } = useAuth();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [logDrawer, setLogDrawer] = useState<{ open: boolean; itemId: number | null; itemName: string }>({
    open: false,
    itemId: null,
    itemName: '',
  });
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [orderHistoryOpen, setOrderHistoryOpen] = useState(false);
  const scanner = useOrderScanner(items);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.sort_order - b.sort_order),
    [categories]
  );

  const filtered = useMemo(() => {
    let result = items;
    if (categoryFilter !== null) {
      result = result.filter((i) => i.category_id === categoryFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.supplier?.toLowerCase().includes(q) ||
          i.inventory_categories?.name.toLowerCase().includes(q)
      );
    }
    return result;
  }, [items, categoryFilter, search]);

  const lowStockCount = useMemo(() => getLowStockItems(items).length, [items]);

  const handleAdjust = async (item: InventoryItem, newQty: number, reason: string) => {
    const ok = await adjustQuantity(item.id, item.current_quantity, newQty, reason, user?.email ?? 'unknown');
    if (ok) await refresh();
  };

  const handleCreate = async (data: Omit<InventoryItem, 'id' | 'created_at' | 'inventory_categories'>) => {
    return create(data);
  };

  const handleUpdate = async (data: Omit<InventoryItem, 'id' | 'created_at' | 'inventory_categories'>) => {
    if (!editing) return false;
    return update(editing.id, data);
  };

  const handleDelete = async (item: InventoryItem) => {
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    await remove(item.id);
  };

  const openEdit = (item: InventoryItem) => {
    setEditing(item);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text-primary">Inventory</h1>
          <span className="badge text-text-muted">{filtered.length} items</span>
          {lowStockCount > 0 && (
            <span className="badge-danger flex items-center gap-1">
              <AlertTriangle size={12} />
              {lowStockCount} low
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:flex-none">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              className="input-field pl-9 w-full sm:w-64"
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <ScanOrderButton
            onFileSelected={(file) => {
              setScanModalOpen(true);
              scanner.startScan(file);
            }}
            disabled={scanner.state !== 'idle' && scanner.state !== 'done'}
          />
          <button
            onClick={() => setOrderHistoryOpen(true)}
            className="btn-secondary flex items-center gap-2"
            title="Order History"
          >
            <ClipboardList size={18} />
            <span className="hidden sm:inline">Orders</span>
          </button>
          <button
            onClick={() => { setEditing(null); setFormOpen(true); }}
            className="btn-primary flex items-center gap-2 shrink-0"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Add Item</span>
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-4 scrollbar-hide">
        <button
          onClick={() => setCategoryFilter(null)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
            categoryFilter === null
              ? 'bg-primary text-white'
              : 'bg-surface-hover text-text-secondary hover:text-text-primary'
          }`}
        >
          All
        </button>
        {sortedCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategoryFilter(categoryFilter === cat.id ? null : cat.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              categoryFilter === cat.id
                ? 'bg-primary text-white'
                : 'bg-surface-hover text-text-secondary hover:text-text-primary'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="card p-16 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-text-muted" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <Package size={48} className="mx-auto text-text-muted mb-3" />
          <p className="text-text-muted">
            {search || categoryFilter !== null ? 'No items match your filters' : 'No inventory items yet'}
          </p>
          {!search && categoryFilter === null && (
            <button
              onClick={() => setFormOpen(true)}
              className="btn-primary mt-4"
            >
              Add your first item
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden sm:block card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-xs text-text-muted uppercase tracking-wide">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium text-center">Quantity</th>
                  <th className="px-5 py-3 font-medium text-center">Par</th>
                  <th className="px-5 py-3 font-medium">Unit</th>
                  <th className="px-5 py-3 font-medium hidden lg:table-cell">Supplier</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((item) => (
                  <tr key={item.id} className={`hover:bg-surface-hover transition-colors ${!item.active ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-text-primary">{item.name}</p>
                      {item.notes && (
                        <p className="text-xs text-text-muted truncate max-w-[200px]">{item.notes}</p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {item.inventory_categories?.name ? (
                        <span className="badge-primary">{item.inventory_categories.name}</span>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <QuickAdjust
                        item={item}
                        onAdjust={(newQty, reason) => handleAdjust(item, newQty, reason)}
                      />
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="text-sm text-text-secondary tabular-nums">{item.par_level}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-sm text-text-secondary">{item.unit}</span>
                    </td>
                    <td className="px-5 py-3 hidden lg:table-cell">
                      <span className="text-sm text-text-muted">{item.supplier ?? '—'}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() =>
                            setLogDrawer({ open: true, itemId: item.id, itemName: item.name })
                          }
                          className="p-2 rounded-lg hover:bg-surface-active transition-colors text-text-muted hover:text-text-primary"
                          title="View log"
                        >
                          <History size={16} />
                        </button>
                        <button
                          onClick={() => openEdit(item)}
                          className="p-2 rounded-lg hover:bg-surface-active transition-colors text-text-muted hover:text-text-primary"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-2 rounded-lg hover:bg-red-500/10 transition-colors text-text-muted hover:text-danger"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout */}
          <div className="sm:hidden space-y-3">
            {filtered.map((item) => (
              <div key={item.id} className={`card p-4 ${!item.active ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{item.name}</p>
                    {item.inventory_categories?.name && (
                      <span className="badge-primary mt-1 inline-block">{item.inventory_categories.name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        setLogDrawer({ open: true, itemId: item.id, itemName: item.name })
                      }
                      className="p-2 rounded-lg hover:bg-surface-active text-text-muted"
                    >
                      <History size={16} />
                    </button>
                    <button
                      onClick={() => openEdit(item)}
                      className="p-2 rounded-lg hover:bg-surface-active text-text-muted"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-danger"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-text-muted">
                    Par: {item.par_level} {item.unit}
                  </div>
                  <QuickAdjust
                    item={item}
                    onAdjust={(newQty, reason) => handleAdjust(item, newQty, reason)}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Form Modal */}
      <ItemFormModal
        open={formOpen}
        onClose={closeForm}
        onSubmit={editing ? handleUpdate : handleCreate}
        categories={sortedCategories}
        initial={editing}
      />

      {/* Log Drawer */}
      <InventoryLogDrawer
        open={logDrawer.open}
        onClose={() => setLogDrawer({ open: false, itemId: null, itemName: '' })}
        itemId={logDrawer.itemId}
        itemName={logDrawer.itemName}
      />

      {/* Scan Order Review Modal */}
      <ScanReviewModal
        open={scanModalOpen}
        onClose={() => {
          setScanModalOpen(false);
          if (scanner.state === 'done') {
            scanner.reset();
            refresh();
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
          const ok = await scanner.confirmOrder();
          if (ok) await refresh();
        }}
        onRetry={() => {
          scanner.reset();
          setScanModalOpen(false);
        }}
      />

      {/* Order History Drawer */}
      <OrderHistory
        open={orderHistoryOpen}
        onClose={() => setOrderHistoryOpen(false)}
      />
    </div>
  );
}
