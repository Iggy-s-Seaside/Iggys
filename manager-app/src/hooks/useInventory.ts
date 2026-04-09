import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useSupabaseCRUD } from './useSupabaseCRUD';
import type { InventoryCategory, InventoryItem, InventoryLog } from '../types';

// ── Items with category join ──

export function useInventoryItems() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
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
    const { error: err } = await supabase.from('inventory_items').delete().eq('id', id);
    if (err) {
      toast.error(`Failed to delete: ${err.message}`);
      return false;
    }
    toast.success('Item deleted');
    await refresh();
    return true;
  };

  return { items, loading, error, refresh, create, update, remove };
}

// ── Categories (simple CRUD) ──

export function useInventoryCategories() {
  return useSupabaseCRUD<InventoryCategory>('inventory_categories');
}

// ── Low stock filter (pure function) ──

export function getLowStockItems(items: InventoryItem[]): InventoryItem[] {
  return items.filter((i) => i.active && i.current_quantity <= i.par_level);
}

// ── Logs for a specific item ──

export function useInventoryLogs(itemId: number | null) {
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!itemId) return;
    setLoading(true);
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
    setLoading(false);
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
