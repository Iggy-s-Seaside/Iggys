import { useEffect, useState } from 'react';
import { Trash2, ChevronDown, Tag, Sparkles } from 'lucide-react';
import Select from '../ui/Select';
import { lineAmount } from '../../utils/invoice';
import { money } from '../../utils/format';
import {
  PACKAGE_CATEGORIES,
  PACKAGE_UNITS,
  PACKAGE_UNIT_LABELS,
  type PackageCategory,
  type PackageUnit,
  type PartyPackage,
} from '../../types';

interface InvoiceLineEditorProps {
  line: PartyPackage;
  guestCount: number | null;
  roomHours: number | null;
  /** Persist a field change (debounced on blur for text/number, immediate for selects). */
  onUpdate: (id: number, fields: Partial<PartyPackage>) => Promise<boolean> | void;
  onRemove: (id: number) => Promise<boolean> | void;
}

const CATEGORY_LABELS: Record<PackageCategory, string> = {
  food: 'Food',
  drink: 'Drink',
  room: 'Room',
  addon: 'Add-on',
  other: 'Other',
};

/** Categories that gratuity is charged on (matches computeInvoice). */
const GRATUITY_CATEGORIES = new Set<PackageCategory>(['food', 'drink']);

/**
 * One editable invoice line. Existing catalog lines and one-off custom lines use
 * the same editor — both are party_packages rows. The header row stays compact
 * (name · qty · amount); an expandable drawer exposes the full field set
 * (category, unit, unit price, notes) so the manager can edit anything inline.
 */
export function InvoiceLineEditor({ line, guestCount, roomHours, onUpdate, onRemove }: InvoiceLineEditorProps) {
  const isCustom = line.package_id == null;
  // Custom lines and anything mid-edit default to expanded so the fields are visible.
  const [open, setOpen] = useState(isCustom);

  // Local field mirrors so typing is smooth; committed to the DB on blur / change.
  const [name, setName] = useState(line.name);
  const [unitPrice, setUnitPrice] = useState(String(line.unit_price ?? 0));
  const [qty, setQty] = useState(String(line.quantity ?? 1));
  const [notes, setNotes] = useState(line.notes ?? '');

  // Re-sync local mirrors if the row changes underneath us (refresh after save).
  useEffect(() => { setName(line.name); }, [line.name]);
  useEffect(() => { setUnitPrice(String(line.unit_price ?? 0)); }, [line.unit_price]);
  useEffect(() => { setQty(String(line.quantity ?? 1)); }, [line.quantity]);
  useEffect(() => { setNotes(line.notes ?? ''); }, [line.notes]);

  const amount = lineAmount(line, guestCount, roomHours);
  const inGratuity = GRATUITY_CATEGORIES.has(line.category);
  const isDiscount = (line.unit_price ?? 0) < 0;

  const commitName = () => {
    const v = name.trim();
    if (v && v !== line.name) onUpdate(line.id, { name: v });
    else if (!v) setName(line.name); // never allow an empty name
  };
  const commitPrice = () => {
    const v = parseFloat(unitPrice);
    const next = Number.isFinite(v) ? v : 0;
    if (next !== line.unit_price) onUpdate(line.id, { unit_price: next });
  };
  const commitQty = () => {
    const v = parseFloat(qty);
    const next = Number.isFinite(v) ? v : 0;
    if (next !== line.quantity) onUpdate(line.id, { quantity: next });
  };
  const commitNotes = () => {
    const v = notes.trim();
    if (v !== (line.notes ?? '')) onUpdate(line.id, { notes: v || null });
  };

  return (
    <div className="py-2.5">
      {/* Header row — always visible */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="p-1 -ml-1 rounded-lg hover:bg-surface-hover text-text-muted shrink-0 transition-colors"
          aria-label={open ? 'Collapse line' : 'Edit line'}
          aria-expanded={open}
        >
          <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-sm text-text-primary truncate flex items-center gap-1.5">
            {line.name}
            {isCustom && (
              <span className="badge-accent text-[10px] py-0 px-1.5 shrink-0 inline-flex items-center gap-1">
                <Sparkles size={9} /> Custom
              </span>
            )}
            {isDiscount && (
              <span className="badge-danger text-[10px] py-0 px-1.5 shrink-0">Discount</span>
            )}
          </p>
          <p className="text-xs text-text-muted truncate">
            {money(line.unit_price, { cents: true })} {PACKAGE_UNIT_LABELS[line.unit]} · {CATEGORY_LABELS[line.category]}
            {!inGratuity && <span className="text-text-muted"> · no gratuity</span>}
          </p>
        </div>

        <input
          type="number"
          step="any"
          key={`${line.id}:qty:${line.quantity}`}
          defaultValue={line.quantity}
          onBlur={(e) => {
            const q = parseFloat(e.target.value);
            const next = Number.isFinite(q) ? q : 0;
            if (next !== line.quantity) onUpdate(line.id, { quantity: next });
          }}
          className="input-field w-16 py-1.5 text-center shrink-0"
          aria-label="Quantity"
        />
        <span className={`text-sm font-medium w-24 text-right shrink-0 ${amount < 0 ? 'text-danger' : 'text-text-primary'}`}>
          {money(amount, { cents: true })}
        </span>
        <button
          type="button"
          onClick={() => onRemove(line.id)}
          className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-danger transition-colors shrink-0"
          aria-label="Remove line"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* Expanded field set */}
      {open && (
        <div className="mt-3 ml-6 grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg bg-surface-hover/50 p-3">
          <div className="sm:col-span-2">
            <label className="label">Line name</label>
            <input
              className="input-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitName}
              placeholder="e.g. Welcome cocktail hour"
            />
          </div>

          <div>
            <label className="label flex items-center gap-1.5"><Tag size={12} /> Category</label>
            <Select<PackageCategory>
              variant="manager"
              value={line.category}
              onChange={(v) => { if (v !== line.category) onUpdate(line.id, { category: v }); }}
              options={PACKAGE_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
            />
            <p className="text-[11px] text-text-muted mt-1">
              {inGratuity ? 'Charged gratuity (food/drink).' : 'No gratuity on this category.'}
            </p>
          </div>

          <div>
            <label className="label">Unit</label>
            <Select<PackageUnit>
              variant="manager"
              value={line.unit}
              onChange={(v) => { if (v !== line.unit) onUpdate(line.id, { unit: v }); }}
              options={PACKAGE_UNITS.map((u) => ({ value: u, label: PACKAGE_UNIT_LABELS[u] }))}
            />
          </div>

          <div>
            <label className="label">Unit price ($)</label>
            <input
              type="number"
              step="any"
              className="input-field"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              onBlur={commitPrice}
            />
            <p className="text-[11px] text-text-muted mt-1">Negative = discount / comp.</p>
          </div>

          <div>
            <label className="label">Quantity</label>
            <input
              type="number"
              step="any"
              className="input-field"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              onBlur={commitQty}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="label">Notes (printed under the line)</label>
            <textarea
              className="input-field min-h-[56px] resize-y"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={commitNotes}
              placeholder="Optional detail shown on the invoice, e.g. “includes setup + linens”."
            />
          </div>
        </div>
      )}
    </div>
  );
}
