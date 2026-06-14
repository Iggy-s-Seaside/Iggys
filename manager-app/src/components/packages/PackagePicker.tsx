import { useState } from 'react';
import { Plus, Package as PackageIcon, Sparkles } from 'lucide-react';
import Select from '../ui/Select';
import { usePackages } from '../../hooks/usePackages';
import { money } from '../../utils/format';
import { InvoiceLineEditor } from '../parties/InvoiceLineEditor';
import { PACKAGE_UNIT_LABELS, type Package, type PartyPackage } from '../../types';

interface PackagePickerProps {
  items: PartyPackage[];
  guestCount: number | null;
  roomHours: number | null;
  onAdd: (pkg: Package, qty: number) => Promise<boolean> | void;
  onUpdateLine: (id: number, fields: Partial<PartyPackage>) => Promise<boolean> | void;
  onRemoveLine: (id: number) => Promise<boolean> | void;
  /** Optional: insert a one-off custom line (package_id=null). When omitted, the custom-line button is hidden. */
  onAddCustom?: (fields?: Partial<PartyPackage>) => Promise<boolean> | void;
}

export function PackagePicker({
  items, guestCount, roomHours, onAdd, onUpdateLine, onRemoveLine, onAddCustom,
}: PackagePickerProps) {
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
        <PackageIcon size={14} /> Packages &amp; line items
      </h3>

      {items.length === 0 ? (
        <p className="text-xs text-text-muted">No line items yet — add a package or a custom line.</p>
      ) : (
        <div className="divide-y divide-border">
          {items.map((line) => (
            <InvoiceLineEditor
              key={line.id}
              line={line}
              guestCount={guestCount}
              roomHours={roomHours}
              onUpdate={onUpdateLine}
              onRemove={onRemoveLine}
            />
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 mt-4">
        <div className="flex-1 min-w-0">
          <label className="label">Add package</label>
          <Select<string>
            variant="manager"
            value={selectedId || null}
            onChange={setSelectedId}
            options={active.map((p) => ({
              value: String(p.id),
              label: `${p.name} — ${money(p.price, { cents: true })} ${PACKAGE_UNIT_LABELS[p.unit]}`,
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

      {onAddCustom && (
        <button
          type="button"
          onClick={() => onAddCustom({ name: 'Custom line', category: 'other', unit: 'flat', quantity: 1, unit_price: 0 })}
          className="btn-ghost text-sm mt-3 text-primary"
        >
          <Sparkles size={15} /> Add custom line
        </button>
      )}
    </div>
  );
}
