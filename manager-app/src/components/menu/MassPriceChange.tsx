import { useState } from 'react';
import { Loader2, ArrowRight } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { supabase } from '../../lib/supabase';
import type { TableSchema } from '../../types';
import toast from 'react-hot-toast';

interface MassPriceChangeProps {
  open: boolean;
  onClose: () => void;
  tables: TableSchema[];
  onComplete: () => void;
}

type Operation = 'find_replace' | 'increase' | 'decrease';

interface PreviewItem {
  id: number;
  name: string;
  table: string;
  tableLabel: string;
  oldPrice: string;
  newPrice: string;
}

export function MassPriceChange({ open, onClose, tables, onComplete }: MassPriceChangeProps) {
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [operation, setOperation] = useState<Operation>('find_replace');
  const [fromPrice, setFromPrice] = useState('');
  const [toPrice, setToPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  const reset = () => {
    setSelectedTables([]);
    setOperation('find_replace');
    setFromPrice('');
    setToPrice('');
    setAmount('');
    setPreview(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const toggleTable = (table: string) => {
    setSelectedTables((prev) =>
      prev.includes(table) ? prev.filter((t) => t !== table) : [...prev, table]
    );
    setPreview(null);
  };

  const selectAllTables = () => {
    if (selectedTables.length === tables.length) {
      setSelectedTables([]);
    } else {
      setSelectedTables(tables.map((t) => t.table));
    }
    setPreview(null);
  };

  const normalizePrice = (p: string): string => {
    const cleaned = p.replace(/[^0-9.]/g, '');
    return cleaned ? `$${cleaned}` : p;
  };

  const parsePriceNum = (p: string): number | null => {
    const cleaned = p.replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  };

  const generatePreview = async () => {
    if (selectedTables.length === 0) {
      toast.error('Select at least one menu section');
      return;
    }

    setLoading(true);
    const items: PreviewItem[] = [];

    for (const tableName of selectedTables) {
      const schema = tables.find((t) => t.table === tableName);
      if (!schema) continue;

      const nameCol = schema.columns.find((c) => c.key === 'name' || c.key === 'title');
      const { data: rows } = await supabase
        .from(tableName)
        .select(`id, price${nameCol ? `, ${nameCol.key}` : ''}`);

      if (!rows) continue;

      for (const row of rows) {
        const price = String(row.price ?? '');
        if (!price || price === 'Market Price') continue;

        const priceNum = parsePriceNum(price);
        if (priceNum === null) continue;

        let newPriceNum: number | null = null;

        if (operation === 'find_replace') {
          const target = normalizePrice(fromPrice);
          if (price === target || price === fromPrice) {
            newPriceNum = parsePriceNum(toPrice);
          }
        } else if (operation === 'increase') {
          const inc = parseFloat(amount);
          if (!isNaN(inc)) newPriceNum = priceNum + inc;
        } else if (operation === 'decrease') {
          const dec = parseFloat(amount);
          if (!isNaN(dec)) newPriceNum = Math.max(0, priceNum - dec);
        }

        if (newPriceNum !== null && newPriceNum !== priceNum) {
          const formatted = newPriceNum % 1 === 0 ? `$${newPriceNum}` : `$${newPriceNum.toFixed(2)}`;
          items.push({
            id: row.id as number,
            name: String(nameCol ? row[nameCol.key] : row.id),
            table: tableName,
            tableLabel: schema.label,
            oldPrice: price,
            newPrice: formatted,
          });
        }
      }
    }

    setPreview(items);
    setLoading(false);

    if (items.length === 0) {
      toast('No items matched your criteria', { icon: '🔍' });
    }
  };

  const applyChanges = async () => {
    if (!preview || preview.length === 0) return;

    setApplying(true);
    let success = 0;
    let failed = 0;

    // Group by table for efficient batch updates
    const byTable = new Map<string, PreviewItem[]>();
    for (const item of preview) {
      const arr = byTable.get(item.table) || [];
      arr.push(item);
      byTable.set(item.table, arr);
    }

    for (const [tableName, items] of byTable) {
      for (const item of items) {
        const { error } = await supabase
          .from(tableName)
          .update({ price: item.newPrice })
          .eq('id', item.id);

        if (error) {
          failed++;
        } else {
          success++;
        }
      }
    }

    if (failed > 0) {
      toast.error(`Updated ${success} items, ${failed} failed`);
    } else {
      toast.success(`Updated ${success} items`);
    }

    setApplying(false);
    onComplete();
    handleClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Mass Price Change">
      <div className="space-y-5">
        {/* Step 1: Select tables */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Menu Sections</label>
            <button onClick={selectAllTables} className="text-xs text-primary hover:underline">
              {selectedTables.length === tables.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tables.map((t) => (
              <button
                key={t.table}
                onClick={() => toggleTable(t.table)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedTables.includes(t.table)
                    ? 'bg-primary text-white'
                    : 'bg-surface border border-border text-text-secondary hover:bg-surface-hover'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Operation */}
        <div>
          <label className="label">Operation</label>
          <div className="flex gap-1.5">
            {([
              { value: 'find_replace', label: 'Find & Replace' },
              { value: 'increase', label: 'Increase' },
              { value: 'decrease', label: 'Decrease' },
            ] as const).map((op) => (
              <button
                key={op.value}
                onClick={() => { setOperation(op.value); setPreview(null); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  operation === op.value
                    ? 'bg-primary text-white'
                    : 'bg-surface border border-border text-text-secondary hover:bg-surface-hover'
                }`}
              >
                {op.label}
              </button>
            ))}
          </div>
        </div>

        {/* Step 3: Values */}
        {operation === 'find_replace' ? (
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="label">From Price</label>
              <input
                className="input-field"
                placeholder="$8"
                value={fromPrice}
                onChange={(e) => { setFromPrice(e.target.value); setPreview(null); }}
              />
            </div>
            <ArrowRight size={16} className="text-text-muted mt-6 shrink-0" />
            <div className="flex-1">
              <label className="label">To Price</label>
              <input
                className="input-field"
                placeholder="$9"
                value={toPrice}
                onChange={(e) => { setToPrice(e.target.value); setPreview(null); }}
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="label">{operation === 'increase' ? 'Increase' : 'Decrease'} by ($)</label>
            <input
              className="input-field"
              type="number"
              step="0.01"
              min="0"
              placeholder="1.00"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setPreview(null); }}
            />
          </div>
        )}

        {/* Preview button */}
        <button
          onClick={generatePreview}
          disabled={loading}
          className="btn-secondary w-full flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : null}
          Preview Changes
        </button>

        {/* Preview results */}
        {preview && preview.length > 0 && (
          <div>
            <p className="text-sm font-medium text-text-secondary mb-2">
              {preview.length} item{preview.length !== 1 ? 's' : ''} will be updated:
            </p>
            <div className="max-h-60 overflow-y-auto border border-border rounded-lg divide-y divide-border">
              {preview.map((item, i) => (
                <div key={`${item.table}-${item.id}`} className="px-3 py-2 flex items-center justify-between text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="text-text-primary truncate">{item.name}</p>
                    <p className="text-text-muted text-xs">{item.tableLabel}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-text-muted line-through">{item.oldPrice}</span>
                    <ArrowRight size={12} className="text-text-muted" />
                    <span className="text-primary font-semibold">{item.newPrice}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Apply */}
        {preview && preview.length > 0 && (
          <button
            onClick={applyChanges}
            disabled={applying}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {applying ? <Loader2 size={14} className="animate-spin" /> : null}
            Apply {preview.length} Price Change{preview.length !== 1 ? 's' : ''}
          </button>
        )}
      </div>
    </Modal>
  );
}
