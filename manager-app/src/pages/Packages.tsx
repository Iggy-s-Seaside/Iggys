import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Package as PackageIcon, Loader2, Tag } from 'lucide-react';
import { usePackages } from '../hooks/usePackages';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import Select from '../components/ui/Select';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { Field } from '../components/ui/Field';
import { Toggle } from '../components/ui/Toggle';
import { money } from '../utils/format';
import {
  PACKAGE_CATEGORIES, PACKAGE_UNITS, PACKAGE_UNIT_LABELS, type Package, type PackageCategory, type PackageUnit,
} from '../types';

const emptyForm = {
  name: '',
  description: '',
  category: 'addon' as PackageCategory,
  price: '0',
  unit: 'flat' as PackageUnit,
  active: true,
  public_visible: true,
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
        public_visible: editing.public_visible !== false,
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
      public_visible: form.public_visible,
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
      <PageHeader title="Packages" subtitle="The catalog of offerings you can add to any party">
        <button onClick={openNew} className="btn-primary"><Plus size={18} /> New Package</button>
      </PageHeader>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : packages.length === 0 ? (
        <EmptyState
          icon={PackageIcon}
          title="No packages yet"
          action={<button onClick={openNew} className="btn-primary inline-flex"><Plus size={18} /> New Package</button>}
        />
      ) : (
        <div className="card divide-y divide-border overflow-hidden">
          {packages.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 sm:px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-medium ${p.active ? 'text-text-primary' : 'text-text-muted line-through'}`}>{p.name}</p>
                  <span className="badge-primary capitalize">{p.category}</span>
                  {p.public_visible === false && (
                    <span className="badge bg-surface-hover text-text-muted">Manager only</span>
                  )}
                </div>
                {p.description && <p className="text-xs text-text-muted truncate mt-0.5">{p.description}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-medium text-text-primary">{money(p.price, { cents: true })}</p>
                <p className="text-xs text-text-muted">{PACKAGE_UNIT_LABELS[p.unit]}</p>
              </div>
              <Toggle
                checked={p.active}
                onChange={(next) => update(p.id, { active: next })}
                ariaLabel={p.active ? 'Active' : 'Inactive'}
                className="shrink-0"
              />
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
          <Field label="Name *">
            <input className="input-field" value={form.name} onChange={(e) => setField('name', e.target.value)}
              placeholder="Upstairs Room Rental" required />
          </Field>
          <Field label="Description">
            <textarea className="input-field min-h-[60px] resize-y" value={form.description}
              onChange={(e) => setField('description', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">
              <Select<PackageCategory>
                variant="manager"
                leadingIcon={Tag}
                value={form.category}
                onChange={(v) => setField('category', v)}
                options={PACKAGE_CATEGORIES.map((c) => ({ value: c, label: c }))}
              />
            </Field>
            <Field label="Unit">
              <Select<PackageUnit>
                variant="manager"
                value={form.unit}
                onChange={(v) => setField('unit', v)}
                options={PACKAGE_UNITS.map((u) => ({ value: u, label: PACKAGE_UNIT_LABELS[u] }))}
              />
            </Field>
            <Field label="Price ($)">
              <input type="number" min="0" step="any" className="input-field" value={form.price}
                onChange={(e) => setField('price', e.target.value)} />
            </Field>
            <Field label="Sort order">
              <input type="number" className="input-field" value={form.sort_order}
                onChange={(e) => setField('sort_order', e.target.value)} />
            </Field>
          </div>
          <Toggle
            checked={form.active}
            onChange={(next) => setField('active', next)}
            label="Active (available to add to parties)"
          />
          <Toggle
            checked={form.public_visible}
            onChange={(next) => setField('public_visible', next)}
            label="Show on public booking (customers see this in the estimator)"
          />
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
