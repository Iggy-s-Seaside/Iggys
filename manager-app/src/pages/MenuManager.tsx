import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, Loader2, DollarSign } from 'lucide-react';
import { useSupabaseCRUD } from '../hooks/useSupabaseCRUD';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import { MENU_SCHEMAS, type ColumnConfig } from '../types';
import { supabase } from '../lib/supabase';
import { MassPriceChange } from '../components/menu/MassPriceChange';

export function MenuManager() {
  const { table: urlTable } = useParams();
  const navigate = useNavigate();
  const activeSchema = MENU_SCHEMAS.find((s) => s.table === urlTable) || MENU_SCHEMAS[0];

  const { data, loading, create, update, remove, refresh } = useSupabaseCRUD<Record<string, unknown> & { id: number }>(activeSchema.table);

  const [editItem, setEditItem] = useState<(Record<string, unknown> & { id: number }) | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showMassPrice, setShowMassPrice] = useState(false);

  // Dynamic FK options: fetch related tables for select dropdowns
  const [dynamicOptions, setDynamicOptions] = useState<Record<string, { id: number; label: string }[]>>({});

  useEffect(() => {
    const dynamicCols = activeSchema.columns.filter((c) => c.dynamicOptionsTable);
    if (dynamicCols.length === 0) {
      setDynamicOptions({});
      return;
    }

    const fetchOptions = async () => {
      const results: Record<string, { id: number; label: string }[]> = {};
      for (const col of dynamicCols) {
        const { data: rows } = await supabase
          .from(col.dynamicOptionsTable!)
          .select('*')
          .order(col.dynamicOptionsLabel!);
        if (rows) {
          results[col.key] = (rows as Record<string, unknown>[]).map((r) => ({
            id: r.id as number,
            label: String(r[col.dynamicOptionsLabel!] ?? ''),
          }));
        }
      }
      setDynamicOptions(results);
    };
    fetchOptions();
  }, [activeSchema]);

  // Build a lookup map for FK display in table cells
  const fkLookup = useMemo(() => {
    const map: Record<string, Record<number, string>> = {};
    for (const [key, options] of Object.entries(dynamicOptions)) {
      map[key] = {};
      for (const opt of options) {
        map[key][opt.id] = opt.label;
      }
    }
    return map;
  }, [dynamicOptions]);

  const openNew = () => {
    const initial: Record<string, string> = {};
    activeSchema.columns.forEach((c) => { initial[c.key] = ''; });
    setFormData(initial);
    setEditItem(null);
    setIsNew(true);
  };

  const openEdit = (item: Record<string, unknown> & { id: number }) => {
    const initial: Record<string, string> = {};
    activeSchema.columns.forEach((c) => { initial[c.key] = String(item[c.key] ?? ''); });
    setFormData(initial);
    setEditItem(item);
    setIsNew(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload: Record<string, string | number | null> = {};
    activeSchema.columns.forEach((c) => {
      const val = formData[c.key];
      if (c.type === 'number' || c.dynamicOptionsTable) {
        payload[c.key] = val ? Number(val) : null;
      } else {
        payload[c.key] = val || null;
      }
    });

    if (isNew) {
      await create(payload as never);
    } else if (editItem) {
      await update(editItem.id, payload as never);
    }
    setSaving(false);
    setEditItem(null);
    setIsNew(false);
  };

  // Resolve display value for a cell — show FK label if available
  const getCellDisplay = (item: Record<string, unknown>, col: ColumnConfig): string => {
    const raw = item[col.key];
    if (col.dynamicOptionsTable && fkLookup[col.key] && raw != null) {
      return fkLookup[col.key][Number(raw)] || String(raw);
    }
    return String(raw ?? '--');
  };

  const displayColumns = activeSchema.columns.filter((c) => c.type !== 'textarea').slice(0, 4);

  const priceableTables = MENU_SCHEMAS.filter((s) =>
    s.columns.some((c) => c.key === 'price')
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Menu Manager</h1>
        <button
          onClick={() => setShowMassPrice(true)}
          className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
        >
          <DollarSign size={14} /> Mass Price Change
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1 scrollbar-hide">
        {MENU_SCHEMAS.map((schema) => (
          <button
            key={schema.table}
            onClick={() => navigate(`/menu/${schema.table}`)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeSchema.table === schema.table
                ? 'bg-primary text-white'
                : 'bg-surface border border-border text-text-secondary hover:bg-surface-hover'
            }`}
          >
            {schema.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-surface-hover/30">
          <p className="text-sm font-medium text-text-secondary">{data.length} items</p>
          <button onClick={openNew} className="btn-primary text-xs py-1.5 px-3">
            <Plus size={14} /> Add Item
          </button>
        </div>

        {loading ? (
          <div className="divide-y divide-border">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="px-5 py-3.5 flex items-center gap-4 animate-pulse">
                <div className="flex-1">
                  <div className="h-4 bg-surface-hover rounded w-1/3 mb-2" />
                  <div className="h-3 bg-surface-hover rounded w-1/5" />
                </div>
                <div className="h-4 w-12 bg-surface-hover rounded" />
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="p-8 text-center text-text-muted text-sm">No items in {activeSchema.label}</div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {displayColumns.map((col) => (
                      <th key={col.key} className="text-left px-5 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wider">
                        {col.label}
                      </th>
                    ))}
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wider w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.map((item) => (
                    <tr key={item.id} className="hover:bg-surface-hover/50 transition-colors">
                      {displayColumns.map((col) => (
                        <td key={col.key} className="px-5 py-3 text-sm text-text-secondary max-w-[200px] truncate">
                          {getCellDisplay(item, col)}
                        </td>
                      ))}
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-primary transition-colors">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => setDeleteId(item.id)} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-danger transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="sm:hidden divide-y divide-border">
              {data.map((item) => (
                <div key={item.id} className="px-4 py-3 flex items-center gap-3 active:bg-surface-hover/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {getCellDisplay(item, displayColumns[0])}
                    </p>
                    {displayColumns[1] && (
                      <p className="text-xs text-text-muted mt-0.5">
                        {displayColumns[1].label}: {getCellDisplay(item, displayColumns[1])}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(item)} className="p-2 rounded-lg hover:bg-surface-hover text-text-muted hover:text-primary transition-colors" aria-label="Edit item">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => setDeleteId(item.id)} className="p-2 rounded-lg hover:bg-surface-hover text-text-muted hover:text-danger transition-colors" aria-label="Delete item">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        open={isNew || editItem !== null}
        onClose={() => { setIsNew(false); setEditItem(null); }}
        title={isNew ? `Add ${activeSchema.label} Item` : `Edit ${activeSchema.label} Item`}
      >
        <div className="space-y-4">
          {activeSchema.columns.map((col: ColumnConfig) => (
            <div key={col.key}>
              <label className="label">{col.label} {col.required && '*'}</label>
              {col.type === 'textarea' ? (
                <textarea
                  className="input-field min-h-[80px] resize-y"
                  value={formData[col.key] ?? ''}
                  onChange={(e) => setFormData((f) => ({ ...f, [col.key]: e.target.value }))}
                  required={col.required}
                />
              ) : col.dynamicOptionsTable ? (
                <select
                  className="input-field"
                  value={formData[col.key] ?? ''}
                  onChange={(e) => setFormData((f) => ({ ...f, [col.key]: e.target.value }))}
                  required={col.required}
                >
                  <option value="">Select {col.label}...</option>
                  {(dynamicOptions[col.key] || []).map((opt) => (
                    <option key={opt.id} value={String(opt.id)}>{opt.label}</option>
                  ))}
                </select>
              ) : col.type === 'select' ? (
                <select
                  className="input-field"
                  value={formData[col.key] ?? ''}
                  onChange={(e) => setFormData((f) => ({ ...f, [col.key]: e.target.value }))}
                  required={col.required}
                >
                  <option value="">Select...</option>
                  {col.options?.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="input-field"
                  type={col.type === 'number' ? 'number' : 'text'}
                  value={formData[col.key] ?? ''}
                  onChange={(e) => setFormData((f) => ({ ...f, [col.key]: e.target.value }))}
                  required={col.required}
                />
              )}
            </div>
          ))}
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => { setIsNew(false); setEditItem(null); }} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              {isNew ? 'Add Item' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) remove(deleteId); }}
        title="Delete Item"
        message="Are you sure you want to delete this menu item?"
        confirmLabel="Delete"
      />

      <MassPriceChange
        open={showMassPrice}
        onClose={() => setShowMassPrice(false)}
        tables={priceableTables}
        onComplete={refresh}
      />
    </div>
  );
}
