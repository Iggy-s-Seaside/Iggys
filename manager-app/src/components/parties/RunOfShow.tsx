import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, GripVertical, Trash2, Save, ListChecks } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Party } from '../../types';

/** One timeline row in the run-of-show (5:00 setup, 6:00 doors, 7:00 toast). */
export interface RunOfShowRow {
  time: string;
  label: string;
}

/** Safely read the stored timeline off a party (JSONB array, may be null/garbage). */
export function readRunOfShow(party: Party): RunOfShowRow[] {
  const raw = (party as { run_of_show?: unknown }).run_of_show;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .map((r) => ({
      time: typeof r.time === 'string' ? r.time : '',
      label: typeof r.label === 'string' ? r.label : '',
    }));
}

const STARTER: RunOfShowRow[] = [
  { time: '5:00 PM', label: 'Setup — tables, bar, signage' },
  { time: '6:00 PM', label: 'Doors open' },
  { time: '7:00 PM', label: 'Toast' },
];

interface RunOfShowProps {
  party: Party;
  onSave: (fields: Partial<Party>) => Promise<boolean>;
}

/**
 * Editable run-of-show timeline persisted on the party as the `run_of_show` JSONB
 * column (see scripts/add-party-timeline.sql). Rows are an ordered list of
 * { time, label }; blank rows are dropped on save.
 */
export function RunOfShow({ party, onSave }: RunOfShowProps) {
  const saved = useMemo(() => readRunOfShow(party), [party]);
  const [rows, setRows] = useState<RunOfShowRow[]>(saved);
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    setRows(readRunOfShow(party));
  }, [party]);

  const cleaned = (list: RunOfShowRow[]) =>
    list
      .map((r) => ({ time: r.time.trim(), label: r.label.trim() }))
      .filter((r) => r.time !== '' || r.label !== '');

  const dirty = JSON.stringify(cleaned(rows)) !== JSON.stringify(saved);

  const setRow = (i: number, field: keyof RunOfShowRow, value: string) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));

  const addRow = () => setRows((prev) => [...prev, { time: '', label: '' }]);
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));
  const useStarter = () => setRows(STARTER.map((r) => ({ ...r })));

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    setRows((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const handleSave = async () => {
    const next = cleaned(rows);
    setSaving(true);
    const ok = await onSave({ run_of_show: next.length ? next : null } as Partial<Party>);
    if (ok) {
      setRows(next);
      toast.success('Run-of-show saved');
    }
    setSaving(false);
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <ListChecks size={14} /> Run of show
        </h3>
        {saved.length > 0 && (
          <span className="text-xs text-text-muted">{saved.length} {saved.length === 1 ? 'cue' : 'cues'}</span>
        )}
      </div>
      <p className="text-xs text-text-muted mb-4">The minute-by-minute the team works off on the day.</p>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-5 text-center">
          <p className="text-sm text-text-secondary mb-3">No timeline yet.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button onClick={useStarter} className="btn-secondary text-xs">Use a starter</button>
            <button onClick={addRow} className="btn-secondary text-xs">
              <Plus size={14} /> Add a row
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div
              key={i}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex != null) reorder(dragIndex, i);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              className={`flex items-center gap-2 rounded-lg bg-surface-hover/50 p-2 ${
                dragIndex === i ? 'opacity-50' : ''
              }`}
            >
              <span className="text-text-muted cursor-grab active:cursor-grabbing touch-none shrink-0" aria-hidden="true">
                <GripVertical size={16} />
              </span>
              <input
                className="input-field w-24 shrink-0 text-sm"
                value={row.time}
                onChange={(e) => setRow(i, 'time', e.target.value)}
                placeholder="7:00 PM"
                aria-label="Time"
              />
              <input
                className="input-field flex-1 min-w-0 text-sm"
                value={row.label}
                onChange={(e) => setRow(i, 'label', e.target.value)}
                placeholder="What happens"
                aria-label="What happens"
              />
              <button
                onClick={() => removeRow(i)}
                className="btn-ghost p-2 text-text-muted hover:text-danger shrink-0"
                aria-label="Remove row"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <button onClick={addRow} className="btn-secondary text-xs">
            <Plus size={14} /> Add row
          </button>
          <div className="flex-1" />
          <button onClick={handleSave} disabled={saving || !dirty} className="btn-primary text-sm">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save run-of-show
          </button>
        </div>
      )}
    </div>
  );
}
