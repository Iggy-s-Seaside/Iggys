import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Package as PackageIcon, Loader2 } from 'lucide-react';
import { usePackages } from '../hooks/usePackages';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import {
  PACKAGE_CATEGORIES, PACKAGE_UNITS, PACKAGE_UNIT_LABELS, type Package, type PackageCategory, type PackageUnit,
} from '../types';

const money = (n: number) => `$${(n || 0).toFixed(2)}`;

const emptyForm = {
  name: '',
  description: '',
  category: 'addon' as PackageCategory,
  price: '0',
  unit: 'flat' as PackageUnit,
  active: true,
  sort_order: '0',
};

export function Packages() {
  const { packages, loading, create, update, remove } = usePackages();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Package | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name,
        description: editing.description ?? '',
        category: editing.category,
        price: String(editing.price),
        unit: editing.unit,
        active: editing.active,
        sort_order: String(editing.sort_order),
      });
    } else {
      setForm({ ...emptyForm });
    }
  }, [editing, formOpen]);

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (p: Package) => { setEditing(p); setFormOpen(true); };

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category,
      price: parseFloat(form.price) || 0,
      unit: form.unit,
      active: form.active,
      sort_order: parseInt(form.sort_order, 10) || 0,
    };
    const ok = editing
      ? await update(editing.id, payload)
      : await create(payload as Omit<Package, 'id' | 'created_at'>);
    setSaving(false);
    if (ok) setFormOpen(false);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Packages</h1>
          <p className="text-sm text-text-muted mt-1">The catalog of offerings you can add to any party</p>
        </div>
        <button onClick={openNew} className="btn-primary"><Plus size={18} /> New Package</button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="card p-4 animate-pulse h-16" />)}
        </div>
      ) : packages.length === 0 ? (
        <div className="card p-12 text-center">
          <PackageIcon size={40} className="mx-auto text-text-muted mb-3" />
          <p className="text-text-secondary font-medium">No packages yet</p>
          <button onClick={openNew} className="btn-primary mt-4 inline-flex"><Plus size={18} /> New Package</button>
        </div>
      ) : (
        <div className="card divide-y divide-border overflow-hidden">
          {packages.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 sm:px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-medium ${p.active ? 'text-text-primary' : 'text-text-muted line-through'}`}>{p.name}</p>
                  <span className="badge-primary capitalize">{p.category}</span>
                </div>
                {p.description && <p className="text-xs text-text-muted truncate mt-0.5">{p.description}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-medium text-text-primary">{money(p.price)}</p>
                <p className="text-xs text-text-muted">{PACKAGE_UNIT_LABELS[p.unit]}</p>
              </div>
              <button
                onClick={() => update(p.id, { active: !p.active })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${p.active ? 'bg-primary' : 'bg-surface-active'}`}
                title={p.active ? 'Active' : 'Inactive'}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm ${p.active ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <button onClick={() => openEdit(p)} className="p-2 rounded-lg hover:bg-surface-hover text-text-muted hover:text-primary transition-colors shrink-0">
                <Pencil size={15} />
              </button>
              <button onClick={() => setDeleteId(p.id)} className="p-2 rounded-lg hover:bg-surface-hover text-text-muted hover:text-danger transition-colors shrink-0">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit Package' : 'New Package'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input className="input-field" value={form.name} onChange={(e) => setField('name', e.target.value)}
              placeholder="Upstairs Room Rental" required />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input-field min-h-[60px] resize-y" value={form.description}
              onChange={(e) => setField('description', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category</label>
              <select className="input-field" value={form.category}
                onChange={(e) => setField('category', e.target.value as PackageCategory)}>
                {PACKAGE_CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Unit</label>
              <select className="input-field" value={form.unit}
                onChange={(e) => setField('unit', e.target.value as PackageUnit)}>
                {PACKAGE_UNITS.map((u) => <option key={u} value={u}>{PACKAGE_UNIT_LABELS[u]}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Price ($)</label>
              <input type="number" min="0" step="any" className="input-field" value={form.price}
                onChange={(e) => setField('price', e.target.value)} />
            </div>
            <div>
              <label className="label">Sort order</label>
              <input type="number" className="input-field" value={form.sort_order}
                onChange={(e) => setField('sort_order', e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setField('active', !form.active)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.active ? 'bg-primary' : 'bg-surface-active'}`}>
              <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm ${form.active ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className="text-sm text-text-secondary">Active (available to add to parties)</span>
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={() => setFormOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving || !form.name.trim()} className="btn-primary">
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              {editing ? 'Save Changes' : 'Create Package'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) remove(deleteId); }}
        title="Delete Package"
        message="Delete this package from the catalog? Parties that already use it keep their saved copy."
        confirmLabel="Delete"
      />
    </div>
  );
}
