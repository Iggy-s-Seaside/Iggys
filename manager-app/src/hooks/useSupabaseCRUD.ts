import { createElement, useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export function useSupabaseCRUD<T extends { id: number }>(table: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data: result, error: err } = await supabase.from(table).select('*');
    if (err) {
      setError(err.message);
      console.error(`[${table}] load error:`, err.message);
      toast.error('Failed to load data. Please refresh.');
    } else {
      setData((result as T[]) || []);
      setError(null);
    }
    setLoading(false);
  }, [table]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = async (item: Omit<T, 'id' | 'created_at'>) => {
    const { error: err } = await supabase.from(table).insert(item as Record<string, unknown>);
    if (err) {
      console.error(`[${table}] create error:`, err.message);
      toast.error('Failed to create. Please try again.');
      return false;
    }
    toast.success('Created successfully');
    await refresh();
    return true;
  };

  // Optimistic: patch the row locally now, fire in the background, roll back on
  // failure. Makes toggles/edits feel instant on bar wifi (no round-trip wait).
  const update = async (id: number, fields: Partial<T>) => {
    const snapshot = data;
    setData((prev) => prev.map((r) => (r.id === id ? { ...r, ...fields } : r)));
    const { error: err } = await supabase.from(table).update(fields as Record<string, unknown>).eq('id', id);
    if (err) {
      console.error(`[${table}] update error:`, err.message);
      setData(snapshot);
      toast.error('Failed to update. Please try again.');
      return false;
    }
    return true;
  };

  // Optimistic remove with a 5s UNDO window before the DB delete commits — a
  // mis-tap behind a wet bar is recoverable, and the id is preserved (no early
  // delete, so undo is a true restore, not a re-insert).
  const remove = async (id: number) => {
    const item = data.find((r) => r.id === id);
    if (!item) {
      const { error: err } = await supabase.from(table).delete().eq('id', id);
      if (err) { console.error(`[${table}] delete error:`, err.message); toast.error('Failed to delete. Please try again.'); return false; }
      await refresh();
      return true;
    }
    setData((prev) => prev.filter((r) => r.id !== id));
    let undone = false;
    const restore = () => setData((prev) => (prev.some((r) => r.id === id) ? prev : [...prev, item].sort((a, b) => a.id - b.id)));
    const commit = setTimeout(async () => {
      if (undone) return;
      const { error: err } = await supabase.from(table).delete().eq('id', id);
      if (err) { console.error(`[${table}] delete error:`, err.message); restore(); toast.error("Couldn't delete — restored."); }
    }, 5000);
    toast(
      (t) => createElement(
        'span',
        { style: { display: 'flex', alignItems: 'center', gap: '14px' } },
        'Deleted',
        createElement('button', {
          onClick: () => { undone = true; clearTimeout(commit); restore(); toast.dismiss(t.id); },
          style: { fontWeight: 700, color: '#2dd4bf', cursor: 'pointer' },
        }, 'Undo'),
      ),
      { duration: 5000 },
    );
    return true;
  };

  return { data, loading, error, create, update, remove, refresh };
}
