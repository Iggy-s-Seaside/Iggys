import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import type { InventoryItem } from '../types';

// ── Periodic count: snapshot expected, recount, reconcile the fiction ──
//
// A "count" is a slow-time exact recount. We snapshot expected_qty (the
// system's current_quantity) per item when the count starts, the manager
// enters counted_qty per line, and CLOSING the count writes each counted_qty
// back to inventory_items.current_quantity, stamps last_counted_at, resets
// stock_state to 'ok', and logs a count_adjustment inventory_logs row per
// changed line. Variance = counted - expected; $variance = variance * cost.
//
// The supabase client is untyped (see src/lib/supabase.ts), so these row
// shapes are local widened types — runtime is fine. The integrator can add
// the canonical InventoryCount / InventoryCountItem types to types/index.ts.

export interface InventoryCount {
  id: number;
  started_at: string;
  finished_at: string | null;
  counted_by: string | null;
  status: 'open' | 'closed';
  note: string | null;
}

export interface InventoryCountItem {
  id: number;
  count_id: number;
  item_id: number | null;
  expected_qty: number | null;
  counted_qty: number | null;
  cost_per_unit_at_count: number | null;
  created_at: string;
  // Joined item info (hydrated client-side from the live items list).
  name?: string;
  unit?: string;
  category_id?: number | null;
}

/** A single line ready for display: count row + variance maths. */
export interface CountLine extends InventoryCountItem {
  variance: number; // counted - expected (0 when not yet counted)
  varianceCost: number; // variance * cost_per_unit_at_count
  counted: boolean; // has the manager entered a counted_qty for this line?
}

const cleanNum = (v: number | null | undefined): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : 0;

/**
 * Compute variance fields for a count item. Variance is only meaningful once
 * a counted_qty has been entered; before that we treat variance as 0 so the
 * running totals don't punish uncounted lines.
 */
export function deriveLine(row: InventoryCountItem): CountLine {
  const counted = row.counted_qty != null;
  const variance = counted ? cleanNum(row.counted_qty) - cleanNum(row.expected_qty) : 0;
  const varianceCost = variance * cleanNum(row.cost_per_unit_at_count);
  return { ...row, variance, varianceCost, counted };
}

export function useInventoryCount(items: InventoryItem[]) {
  const [count, setCount] = useState<InventoryCount | null>(null);
  const [rows, setRows] = useState<InventoryCountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [closing, setClosing] = useState(false);

  // Hydrate display fields (name/unit/category) from the live items list so we
  // never need a join and stay resilient if an item is later renamed/deleted.
  const itemMap = useMemo(() => {
    const m = new Map<number, InventoryItem>();
    for (const it of items) m.set(it.id, it);
    return m;
  }, [items]);

  const hydrate = useCallback(
    (r: InventoryCountItem): InventoryCountItem => {
      const it = r.item_id != null ? itemMap.get(r.item_id) : undefined;
      return {
        ...r,
        name: it?.name ?? r.name ?? `Item #${r.item_id ?? '?'}`,
        unit: it?.unit ?? r.unit ?? 'units',
        category_id: it?.category_id ?? r.category_id ?? null,
      };
    },
    [itemMap]
  );

  // ── Load any existing open count (resume) ──
  const loadOpen = useCallback(async () => {
    setLoading(true);
    const { data: counts, error: cErr } = await supabase
      .from('inventory_counts')
      .select('*')
      .eq('status', 'open')
      .order('started_at', { ascending: false })
      .limit(1);

    if (cErr) {
      setError(cErr.message);
      toast.error('Failed to load count');
      setLoading(false);
      return;
    }

    const open = (counts as InventoryCount[] | null)?.[0] ?? null;
    if (!open) {
      setCount(null);
      setRows([]);
      setError(null);
      setLoading(false);
      return;
    }

    const { data: lineRows, error: lErr } = await supabase
      .from('inventory_count_items')
      .select('*')
      .eq('count_id', open.id)
      .order('id');

    if (lErr) {
      setError(lErr.message);
      toast.error('Failed to load count lines');
      setLoading(false);
      return;
    }

    setCount(open);
    setRows(((lineRows as InventoryCountItem[]) || []).map(hydrate));
    setError(null);
    setLoading(false);
  }, [hydrate]);

  useEffect(() => {
    loadOpen();
  }, [loadOpen]);

  // Re-hydrate display fields when the items list arrives/changes after rows load.
  useEffect(() => {
    setRows((prev) => (prev.length ? prev.map(hydrate) : prev));
  }, [hydrate]);

  // ── Start a new count: snapshot expected_qty per active item ──
  const start = useCallback(
    async (opts: { categoryId?: number | null; countedBy?: string | null; note?: string | null } = {}) => {
      if (count) {
        toast.error('A count is already open — resume or close it first.');
        return false;
      }
      setStarting(true);

      const snapshot = items
        .filter((i) => i.active)
        .filter((i) => (opts.categoryId == null ? true : i.category_id === opts.categoryId));

      if (snapshot.length === 0) {
        toast.error('No active items to count in that category.');
        setStarting(false);
        return false;
      }

      const { data: created, error: cErr } = await supabase
        .from('inventory_counts')
        .insert({ counted_by: opts.countedBy ?? null, note: opts.note ?? null, status: 'open' })
        .select('*')
        .single();

      if (cErr || !created) {
        toast.error(`Failed to start count: ${cErr?.message ?? 'unknown error'}`);
        setStarting(false);
        return false;
      }

      const newCount = created as InventoryCount;
      const lines = snapshot.map((i) => ({
        count_id: newCount.id,
        item_id: i.id,
        expected_qty: i.current_quantity,
        counted_qty: null,
        cost_per_unit_at_count: i.cost_per_unit ?? null,
      }));

      const { data: insertedLines, error: lErr } = await supabase
        .from('inventory_count_items')
        .insert(lines)
        .select('*');

      if (lErr) {
        // Roll back the orphaned header so we never resume an empty count.
        await supabase.from('inventory_counts').delete().eq('id', newCount.id);
        toast.error(`Failed to start count: ${lErr.message}`);
        setStarting(false);
        return false;
      }

      setCount(newCount);
      setRows(((insertedLines as InventoryCountItem[]) || []).map(hydrate));
      setStarting(false);
      toast.success(`Count started — ${snapshot.length} items`);
      return true;
    },
    [count, items, hydrate]
  );

  // ── Set counted_qty for one line (optimistic + persisted) ──
  const setCounted = useCallback(
    async (lineId: number, value: number | null) => {
      // Optimistic local update keeps the keypad snappy on the floor.
      setRows((prev) => prev.map((r) => (r.id === lineId ? { ...r, counted_qty: value } : r)));
      const { error: err } = await supabase
        .from('inventory_count_items')
        .update({ counted_qty: value })
        .eq('id', lineId);
      if (err) {
        toast.error('Failed to save count — check connection');
        // Reload to resync truth if a write failed.
        await loadOpen();
        return false;
      }
      return true;
    },
    [loadOpen]
  );

  // ── Discard an open count entirely (cancel without reconciling) ──
  const discard = useCallback(async () => {
    if (!count) return false;
    const { error: err } = await supabase.from('inventory_counts').delete().eq('id', count.id);
    if (err) {
      toast.error(`Failed to discard count: ${err.message}`);
      return false;
    }
    setCount(null);
    setRows([]);
    toast.success('Count discarded');
    return true;
  }, [count]);

  // ── Close the count: reconcile the fiction ──
  // For every counted line: write counted_qty back to current_quantity, stamp
  // last_counted_at, reset stock_state to 'ok', and log a count_adjustment.
  // Uncounted lines are left untouched (their stock is unchanged).
  const close = useCallback(
    async (userEmail: string) => {
      if (!count) return false;
      setClosing(true);

      const counted = rows.filter((r) => r.counted_qty != null && r.item_id != null);
      const now = new Date().toISOString();
      let failures = 0;

      for (const line of counted) {
        const itemId = line.item_id as number;
        const newQty = cleanNum(line.counted_qty);
        const prevQty = cleanNum(line.expected_qty);

        const { error: upErr } = await supabase
          .from('inventory_items')
          .update({ current_quantity: newQty, last_counted_at: now, stock_state: 'ok' })
          .eq('id', itemId);

        if (upErr) {
          failures++;
          continue;
        }

        // Log the reconciliation only when it actually changed stock.
        if (newQty !== prevQty) {
          const { error: logErr } = await supabase.from('inventory_logs').insert({
            item_id: itemId,
            user_email: userEmail,
            previous_quantity: prevQty,
            new_quantity: newQty,
            change_amount: newQty - prevQty,
            reason: 'count_adjustment',
          });
          if (logErr) failures++;
        }
      }

      const { error: closeErr } = await supabase
        .from('inventory_counts')
        .update({ status: 'closed', finished_at: now })
        .eq('id', count.id);

      setClosing(false);

      if (closeErr) {
        toast.error(`Adjustments applied but failed to close count: ${closeErr.message}`);
        return false;
      }

      if (failures > 0) {
        toast.error(`Count closed with ${failures} issue(s) — review the log.`);
      } else {
        toast.success(`Count closed — ${counted.length} item(s) reconciled`);
      }

      setCount(null);
      setRows([]);
      return true;
    },
    [count, rows]
  );

  // ── Derived display lines + running totals ──
  const lines = useMemo(() => rows.map(deriveLine), [rows]);

  const totals = useMemo(() => {
    let countedLines = 0;
    let adjustments = 0; // counted lines whose qty differs from expected
    let netVarianceCost = 0; // signed $ (negative = shrink/loss)
    let shrinkCost = 0; // absolute $ of negative variances only
    for (const l of lines) {
      if (l.counted) {
        countedLines++;
        if (l.variance !== 0) adjustments++;
        netVarianceCost += l.varianceCost;
        if (l.varianceCost < 0) shrinkCost += -l.varianceCost;
      }
    }
    return {
      totalLines: lines.length,
      countedLines,
      adjustments,
      netVarianceCost,
      shrinkCost,
    };
  }, [lines]);

  return {
    count,
    lines,
    totals,
    loading,
    error,
    starting,
    closing,
    start,
    setCounted,
    close,
    discard,
    refresh: loadOpen,
  };
}
