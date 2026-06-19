import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useSupabaseCRUD } from './useSupabaseCRUD';
import { undoableDelete } from './useUndoableDelete';
import type { InventoryCategory, InventoryItem, InventoryLog } from '../types';

// ── "Mark, don't count" qualitative stock state ──
// Counting bottles mid-shift is impossible, so current_quantity is fiction.
// The day-to-day signal is now a one-tap qualitative chip (stock_state). par_level
// stays the on-hand target / reorder math; reorder_point falls back to it when null.
// See scripts/add-inventory-state.sql.

export type StockState = 'out' | 'one_left' | 'low' | 'half' | 'ok';

// Local widened view of an inventory row until src/types/index.ts gains these
// fields (see integration_notes). The supabase client is untyped, so the columns
// exist at runtime regardless.
export interface InventoryItemState extends InventoryItem {
  stock_state?: StockState | null;
  state_set_at?: string | null;
  state_set_by?: string | null;
  last_counted_at?: string | null;
  reorder_point?: number | null;
  count_interval_days?: number | null;
}

/** Chip row order, lowest stock first → tap target left to right is Out…OK. */
export const STOCK_STATES: { value: StockState; label: string }[] = [
  { value: 'out', label: 'Out' },
  { value: 'one_left', label: '1 left' },
  { value: 'low', label: 'Low' },
  { value: 'half', label: '~Half' },
  { value: 'ok', label: 'OK' },
];

/** States that count as "someone flagged this needs attention". */
export const ATTENTION_STATES: StockState[] = ['out', 'one_left', 'low'];

/** Sort rank: most urgent first (Out → OK). Used to order the table by signal. */
const STATE_RANK: Record<StockState, number> = {
  out: 0,
  one_left: 1,
  low: 2,
  half: 3,
  ok: 4,
};

/** Effective stock_state for a row (defaults to 'ok' until someone marks it). */
export function stockStateOf(item: InventoryItemState): StockState {
  return (item.stock_state as StockState) ?? 'ok';
}

/** Sort comparator: most urgent qualitative state first, then by name. */
export function compareByStockState(a: InventoryItemState, b: InventoryItemState): number {
  const ra = STATE_RANK[stockStateOf(a)] ?? 4;
  const rb = STATE_RANK[stockStateOf(b)] ?? 4;
  if (ra !== rb) return ra - rb;
  return a.name.localeCompare(b.name);
}

/** Someone flagged this item out / one-left / low. */
export function isMarkedLow(item: InventoryItemState): boolean {
  return ATTENTION_STATES.includes(stockStateOf(item));
}

/**
 * Nobody touched this in > count_interval_days. The real safety net for items
 * nobody marked: now − greatest(state_set_at, last_counted_at) exceeds the
 * interval. A row that has never been touched (no timestamps) counts as stale.
 */
export function isStale(item: InventoryItemState, now: Date = new Date()): boolean {
  const interval = item.count_interval_days ?? 7;
  const stamps = [item.state_set_at, item.last_counted_at]
    .filter((s): s is string => !!s)
    .map((s) => new Date(s).getTime())
    .filter((t) => Number.isFinite(t));
  if (stamps.length === 0) return true; // never tracked → stale
  const last = Math.max(...stamps);
  const ageDays = (now.getTime() - last) / 86_400_000;
  return ageDays > interval;
}

/** Count-based fallback: on-hand at/below reorder_point (or par_level when null). */
export function isBelowReorderPoint(item: InventoryItemState): boolean {
  const threshold = item.reorder_point ?? item.par_level;
  return item.current_quantity <= threshold;
}

/**
 * The three low-stock triggers, OR'd together. An active item needs attention if
 * it's marked low/out, OR it's gone stale, OR its count is at/below the reorder
 * point. This is the single source of truth the widget + dashboards read.
 */
export function needsAttention(item: InventoryItemState, now: Date = new Date()): boolean {
  if (!item.active) return false;
  return isMarkedLow(item) || isStale(item, now) || isBelowReorderPoint(item);
}

// ── Items with category join ──

export function useInventoryItems() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!loadedRef.current) setLoading(true);
    const { data, error: err } = await supabase
      .from('inventory_items')
      .select('*, inventory_categories(name)')
      .order('name');
    if (err) {
      setError(err.message);
      toast.error('Failed to load inventory items');
    } else {
      setItems((data as InventoryItem[]) || []);
      setError(null);
    }
    loadedRef.current = true;
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = async (item: Omit<InventoryItem, 'id' | 'created_at' | 'inventory_categories'>) => {
    const { error: err } = await supabase.from('inventory_items').insert(item as Record<string, unknown>);
    if (err) {
      toast.error(`Failed to create: ${err.message}`);
      return false;
    }
    toast.success('Item created');
    await refresh();
    return true;
  };

  const update = async (id: number, fields: Partial<InventoryItem>) => {
    // Strip joined field before sending to supabase
    const { inventory_categories: _join, ...rest } = fields;
    const { error: err } = await supabase
      .from('inventory_items')
      .update(rest as Record<string, unknown>)
      .eq('id', id);
    if (err) {
      toast.error(`Failed to update: ${err.message}`);
      return false;
    }
    toast.success('Item updated');
    await refresh();
    return true;
  };

  const remove = async (id: number) => {
    const item = items.find((i) => i.id === id);
    if (!item) {
      const { error: err } = await supabase.from('inventory_items').delete().eq('id', id);
      if (err) {
        toast.error(`Failed to delete: ${err.message}`);
        return false;
      }
      await refresh();
      return true;
    }
    undoableDelete('inventory_items', id, item, setItems, 'Item removed');
    return true;
  };

  // Optimistic one-tap mark: flip the chip locally, then persist + log. On
  // failure, refresh pulls the true row back so the UI self-heals.
  const setState = useCallback(
    async (itemId: number, state: StockState, userEmail: string) => {
      const target = (items as InventoryItemState[]).find((i) => i.id === itemId);
      const setAt = new Date().toISOString();
      setItems((prev) =>
        (prev as InventoryItemState[]).map((i) =>
          i.id === itemId
            ? { ...i, stock_state: state, state_set_at: setAt, state_set_by: userEmail }
            : i
        ) as InventoryItem[]
      );
      const ok = await markState(itemId, state, target?.current_quantity ?? 0, userEmail);
      if (!ok) await refresh();
      return ok;
    },
    [items, refresh]
  );

  return { items, loading, error, refresh, create, update, remove, setState };
}

// ── Categories (simple CRUD) ──

export function useInventoryCategories() {
  return useSupabaseCRUD<InventoryCategory>('inventory_categories');
}

// ── Low stock filter (pure function) ──
// Now qualitative-first: an item is "low" if it was marked low/out, OR went stale
// (nobody touched it past its count interval), OR its count is at/below the
// reorder point. Consumed by LowStockWidget, the activity feed, the run sheet and
// the Dashboard — all get the broadened signal for free.

export function getLowStockItems(items: InventoryItem[]): InventoryItem[] {
  const now = new Date();
  return (items as InventoryItemState[]).filter((i) => needsAttention(i, now));
}

// ── Logs for a specific item ──

export function useInventoryLogs(itemId: number | null) {
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!itemId) return;
    if (!loadedRef.current) setLoading(true);
    const { data, error: err } = await supabase
      .from('inventory_logs')
      .select('*')
      .eq('item_id', itemId)
      .order('created_at', { ascending: false });
    if (err) {
      setError(err.message);
      toast.error('Failed to load logs');
    } else {
      setLogs((data as InventoryLog[]) || []);
      setError(null);
    }
    loadedRef.current = true;
    setLoading(false);
  }, [itemId]);

  // Reset the first-load guard on a genuine item switch so the spinner shows
  // for the new item (same-item realtime refetches stay strobe-free).
  useEffect(() => {
    loadedRef.current = false;
  }, [itemId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { logs, loading, error, refresh };
}

// ── Adjust quantity + log entry ──

export async function adjustQuantity(
  itemId: number,
  previousQuantity: number,
  newQuantity: number,
  reason: string,
  userEmail: string
): Promise<boolean> {
  const { error: updateErr } = await supabase
    .from('inventory_items')
    .update({ current_quantity: newQuantity })
    .eq('id', itemId);

  if (updateErr) {
    toast.error(`Failed to adjust quantity: ${updateErr.message}`);
    return false;
  }

  const { error: logErr } = await supabase.from('inventory_logs').insert({
    item_id: itemId,
    user_email: userEmail,
    previous_quantity: previousQuantity,
    new_quantity: newQuantity,
    change_amount: newQuantity - previousQuantity,
    reason,
  });

  if (logErr) {
    toast.error(`Quantity updated but failed to log: ${logErr.message}`);
    return false;
  }

  return true;
}

// ── Mark qualitative state (one-tap; no number, no reason dropdown) ──
// Sets stock_state + state_set_at/by and writes an inventory_logs row. A mark
// does NOT change the count, so prev/new mirror the current quantity and
// change_amount is 0 — the log captures the qualitative move, not a delta.

/** Reason string for a given mark, so the log reads sensibly per state. */
function markReason(state: StockState): string {
  if (state === 'out') return 'mark_out';
  if (state === 'low' || state === 'one_left') return 'mark_low';
  return 'mark_state';
}

export async function markState(
  itemId: number,
  state: StockState,
  currentQuantity: number,
  userEmail: string
): Promise<boolean> {
  const setAt = new Date().toISOString();

  const { error: updateErr } = await supabase
    .from('inventory_items')
    .update({ stock_state: state, state_set_at: setAt, state_set_by: userEmail })
    .eq('id', itemId);

  if (updateErr) {
    toast.error(`Failed to mark: ${updateErr.message}`);
    return false;
  }

  const { error: logErr } = await supabase.from('inventory_logs').insert({
    item_id: itemId,
    user_email: userEmail,
    previous_quantity: currentQuantity,
    new_quantity: currentQuantity,
    change_amount: 0,
    reason: markReason(state),
  });

  if (logErr) {
    // The mark itself landed; the log is best-effort. Don't block the optimistic UI.
    console.error('[markState] mark saved but log failed:', logErr.message);
  }

  return true;
}
