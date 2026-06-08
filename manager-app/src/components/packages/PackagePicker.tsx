import { useState } from 'react';
import { Plus, Trash2, Package as PackageIcon } from 'lucide-react';
import Select from '../ui/Select';
import { usePackages } from '../../hooks/usePackages';
import { lineAmount } from '../../utils/invoice';
import { PACKAGE_UNIT_LABELS, type Package, type PartyPackage } from '../../types';

interface PackagePickerProps {
  items: PartyPackage[];
  guestCount: number | null;
  roomHours: number | null;
  onAdd: (pkg: Package, qty: number) => Promise<boolean> | void;
  onUpdateLine: (id: number, fields: Partial<PartyPackage>) => Promise<boolean> | void;
  onRemoveLine: (id: number) => Promise<boolean> | void;
}

const fmt = (n: number) => `$${(n || 0).toFixed(2)}`;

export function PackagePicker({ items, guestCount, roomHours, onAdd, onUpdateLine, onRemoveLine }: PackagePickerProps) {
  const { packages } = usePackages();
  const [selectedId, setSelectedId] = useState('');
  const [qty, setQty] = useState('1');

  const active = packages.filter((p) => p.active);

  const handleAdd = async () => {
    const pkg = packages.find((p) => p.id === Number(selectedId));
    if (!pkg) return;
    await onAdd(pkg, Number(qty) || 1);
    setSelectedId('');
    setQty('1');
  };

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
        <PackageIcon size={14} /> Packages
      </h3>

      {items.length === 0 ? (
        <p className="text-xs text-text-muted">No packages added yet.</p>
      ) : (
        <div className="divide-y divide-border">
          {items.map((line) => (
            <div key={line.id} className="flex items-center gap-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate">{line.name}</p>
                <p className="text-xs text-text-muted">
                  {fmt(line.unit_price)} {PACKAGE_UNIT_LABELS[line.unit]} · {line.category}
                </p>
              </div>
              <input
                type="number"
                min="0"
                step="any"
                key={`${line.id}:${line.quantity}`}
                defaultValue={line.quantity}
                onBlur={(e) => {
                  const q = parseFloat(e.target.value) || 0;
                  if (q !== line.quantity) onUpdateLine(line.id, { quantity: q });
                }}
                className="input-field w-16 py-1.5 text-center"
                aria-label="Quantity"
              />
              <span className="text-sm font-medium text-text-primary w-20 text-right">
                {fmt(lineAmount(line, guestCount, roomHours))}
              </span>
              <button
                onClick={() => onRemoveLine(line.id)}
                className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-danger transition-colors"
                aria-label="Remove package"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 mt-4">
        <div className="flex-1">
          <label className="label">Add package</label>
          <Select<string>
            variant="manager"
            value={selectedId || null}
            onChange={setSelectedId}
            options={active.map((p) => ({
              value: String(p.id),
              label: `${p.name} — ${fmt(p.price)} ${PACKAGE_UNIT_LABELS[p.unit]}`,
            }))}
            placeholder="Select a package…"
          />
        </div>
        <div className="w-20">
          <label className="label">Qty</label>
          <input type="number" min="1" step="any" className="input-field" value={qty}
            onChange={(e) => setQty(e.target.value)} />
        </div>
        <button onClick={handleAdd} disabled={!selectedId} className="btn-primary">
          <Plus size={16} /> Add
        </button>
      </div>
    </div>
  );
}
