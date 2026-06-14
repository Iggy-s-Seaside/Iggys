import { useMemo, useState } from 'react';
import { Shirt, Crop, Layers, HardHat, Plus, Trash2, ChevronLeft, Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Sheet } from '../ui/Sheet';
import { Field } from '../ui/Field';
import { ImageDropzone } from '../ui/ImageDropzone';
import type { MerchProductDraft, MerchVariantDraft } from '../../hooks/useMerch';

interface AddMerchTypeModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (product: MerchProductDraft, variants: MerchVariantDraft[]) => Promise<string | null>;
}

type TemplateKey = 'tee' | 'crop' | 'sweatshirt' | 'hat';

interface Template {
  key: TemplateKey;
  name: string;
  icon: LucideIcon;
  blurb: string;
  /** 'size' = apparel size run; 'label' = user-entered variant labels (hats). */
  kind: 'size' | 'label';
  /** Default size run for apparel templates. */
  sizes?: string[];
}

const STANDARD_RUN = ['S', 'M', 'L', 'XL', 'XXL'];

const TEMPLATES: Template[] = [
  { key: 'tee', name: 'T-shirt', icon: Shirt, blurb: 'Standard size run S–XXL', kind: 'size', sizes: STANDARD_RUN },
  { key: 'crop', name: 'Crop top', icon: Crop, blurb: 'Standard size run S–XXL', kind: 'size', sizes: STANDARD_RUN },
  { key: 'sweatshirt', name: 'Sweatshirt', icon: Layers, blurb: 'Standard size run S–XXL', kind: 'size', sizes: STANDARD_RUN },
  { key: 'hat', name: 'Hat (by variant)', icon: HardHat, blurb: 'Enter your own colorways / styles', kind: 'label' },
];

/** Editable variant row in step 3. */
interface DraftRow {
  /** size token (apparel) OR free label (hats). */
  key: string;
  stock: string;
  par: string;
}

export function AddMerchTypeModal({ open, onClose, onCreate }: AddMerchTypeModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [template, setTemplate] = useState<Template | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const isHat = template?.kind === 'label';

  const reset = () => {
    setStep(1);
    setTemplate(null);
    setName('');
    setPrice('');
    setImage(null);
    setRows([]);
    setNewLabel('');
    setSaving(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const pickTemplate = (t: Template) => {
    setTemplate(t);
    if (t.kind === 'size') {
      setRows((t.sizes ?? STANDARD_RUN).map((s) => ({ key: s, stock: '0', par: '0' })));
    } else {
      setRows([]);
    }
    setStep(2);
  };

  const addLabelRow = () => {
    const label = newLabel.trim();
    if (!label) return;
    if (rows.some((r) => r.key.toLowerCase() === label.toLowerCase())) {
      setNewLabel('');
      return;
    }
    setRows((r) => [...r, { key: label, stock: '0', par: '0' }]);
    setNewLabel('');
  };

  const removeRow = (key: string) => setRows((r) => r.filter((row) => row.key !== key));
  const setRow = (key: string, field: 'stock' | 'par', value: string) =>
    setRows((r) =>
      r.map((row) => (row.key === key ? { ...row, [field]: value.replace(/[^0-9]/g, '') } : row))
    );

  const canCreate = useMemo(
    () => name.trim().length > 0 && rows.length > 0 && !saving,
    [name, rows, saving]
  );

  const handleCreate = async () => {
    if (!template || !canCreate) return;
    setSaving(true);
    const variants: MerchVariantDraft[] = rows.map((r) => ({
      variant_type: isHat ? 'style' : 'size',
      size: isHat ? null : r.key,
      variant_label: isHat ? r.key : null,
      stock: parseInt(r.stock, 10) || 0,
      par_level: parseInt(r.par, 10) || 0,
    }));
    const product: MerchProductDraft = {
      name: name.trim(),
      price: price ? Number(price) : 0,
      image,
    };
    const id = await onCreate(product, variants);
    setSaving(false);
    if (id) close();
  };

  const footer = (
    <div className="flex items-center justify-between gap-3">
      {step > 1 ? (
        <button
          type="button"
          onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
          className="btn-ghost flex items-center gap-1"
        >
          <ChevronLeft size={16} /> Back
        </button>
      ) : (
        <button type="button" onClick={close} className="btn-ghost">
          Cancel
        </button>
      )}

      {step === 1 && <span className="text-xs text-text-muted">Pick a template to start</span>}
      {step === 2 && (
        <button
          type="button"
          onClick={() => setStep(3)}
          disabled={!name.trim()}
          className="btn-primary"
        >
          Next
        </button>
      )}
      {step === 3 && (
        <button
          type="button"
          onClick={handleCreate}
          disabled={!canCreate}
          className="btn-primary flex items-center gap-2"
        >
          <Check size={16} />
          {saving ? 'Creating...' : 'Create merch'}
        </button>
      )}
    </div>
  );

  return (
    <Sheet open={open} onClose={close} title="Add new merch type" footer={footer} maxWidth="max-w-xl">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-5">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              n <= step ? 'bg-primary' : 'bg-surface-active'
            }`}
          />
        ))}
      </div>

      {/* Step 1 — template */}
      {step === 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TEMPLATES.map((t) => {
            const Icon = t.icon;
            const selected = template?.key === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => pickTemplate(t)}
                className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-colors min-h-[64px] ${
                  selected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-surface-hover'
                }`}
              >
                <span className="w-10 h-10 rounded-lg bg-surface-hover flex items-center justify-center text-primary shrink-0">
                  <Icon size={20} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-text-primary">{t.name}</span>
                  <span className="block text-xs text-text-muted">{t.blurb}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Step 2 — name + price + image */}
      {step === 2 && (
        <div className="space-y-4">
          <Field label="Name" required>
            <input
              className="input-field"
              autoFocus
              placeholder={isHat ? 'e.g. Iggy’s Trucker Hat' : 'e.g. Classic Logo Tee'}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field
            label="Price (optional)"
            hint="Starting retail price. You can change it later in Merch settings. Leave blank for $0."
          >
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                className="input-field pl-7"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          </Field>
          <Field label="Image (optional)">
            <ImageDropzone value={image} onChange={setImage} folder="merch" />
          </Field>
        </div>
      )}

      {/* Step 3 — variant rows + starting counts */}
      {step === 3 && (
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            {isHat
              ? 'Add each colorway or style, then set its starting count.'
              : 'Set the starting count for each size. Remove any sizes you don’t carry.'}
          </p>

          {isHat && (
            <div className="flex gap-2">
              <input
                className="input-field flex-1"
                placeholder="Variant label (e.g. Black, Sand)"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addLabelRow();
                  }
                }}
              />
              <button
                type="button"
                onClick={addLabelRow}
                disabled={!newLabel.trim()}
                className="btn-secondary flex items-center gap-1 shrink-0"
              >
                <Plus size={16} /> Add
              </button>
            </div>
          )}

          {rows.length === 0 ? (
            <div className="text-center text-sm text-text-muted py-6 border border-dashed border-border rounded-xl">
              {isHat ? 'Add at least one variant above.' : 'No sizes — go back and pick a template.'}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-1 text-[11px] uppercase tracking-wide text-text-muted">
                <span>{isHat ? 'Variant' : 'Size'}</span>
                <span className="w-20 text-center">Count</span>
                <span className="w-20 text-center">Par</span>
                <span className="w-9" />
              </div>
              {rows.map((row) => (
                <div key={row.key} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                  <span className="text-sm font-medium text-text-primary truncate px-1">{row.key}</span>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="input-field w-20 text-center py-2"
                    value={row.stock}
                    onChange={(e) => setRow(row.key, 'stock', e.target.value)}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label={`${row.key} starting count`}
                  />
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="input-field w-20 text-center py-2"
                    value={row.par}
                    onChange={(e) => setRow(row.key, 'par', e.target.value)}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label={`${row.key} par level`}
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    aria-label={`Remove ${row.key}`}
                    className="w-9 h-9 flex items-center justify-center rounded-lg text-text-muted hover:bg-red-500/10 hover:text-danger transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
