import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { enqueue, flush, subscribeOnline, isOffline } from '../lib/outbox';
import { undoableDelete, filterPendingDeletes } from './useUndoableDelete';
import toast from 'react-hot-toast';

export function useSupabaseCRUD<T extends { id: number }>(table: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Only show the skeleton on the FIRST load — realtime refreshes patch data in
  // place so a teammate's edit doesn't strobe the whole list to gray mid-shift.
  const loadedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!loadedRef.current) setLoading(true);
    const { data: result, error: err } = await supabase.from(table).select('*');
    if (err) {
      setError(err.message);
      console.error(`[${table}] load error:`, err.message);
      toast.error('Failed to load data. Please refresh.');
    } else {
      // filterPendingDeletes: a realtime tick during a 5s undo window must not
      // resurrect a row the user just deleted (matches the dedicated hooks).
      setData(filterPendingDeletes(table, (result as T[]) || []));
      setError(null);
    }
    loadedRef.current = true;
    setLoading(false);
  }, [table]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Drain any writes queued while offline — on mount and whenever the
  // connection returns. flush() is a no-op when the outbox is empty, and it
  // replays the whole cross-table queue (one shared outbox); the trailing
  // refresh only re-pulls this table's authoritative state.
  useEffect(() => {
    flush(supabase);
    const unsub = subscribeOnline(() => {
      flush(supabase).then(() => refresh());
    });
    return unsub;
  }, [refresh]);

  const create = async (item: Omit<T, 'id' | 'created_at'>) => {
    const { error: err } = await supabase.from(table).insert(item as Record<string, unknown>);
    if (err) {
      console.error(`[${table}] create error:`, err.message);
      if (isOffline()) {
        enqueue({ table, op: 'insert', payload: item as Record<string, unknown> });
        toast('Saved offline — will sync when back online');
        await refresh();
        return true;
      }
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
    // Field-scoped rollback: capture only the prior values of the fields we're
    // about to patch on THIS row. A failed update then reverts just those fields
    // and leaves any concurrent edit / fresh realtime data intact (snapshotting
    // the whole array would stomp a second in-flight edit on flaky bar wifi).
    let prevFields: Partial<T> | undefined;
    setData((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        prevFields = Object.fromEntries(
          Object.keys(fields).map((k) => [k, (r as Record<string, unknown>)[k]]),
        ) as Partial<T>;
        return { ...r, ...fields };
      }),
    );
    const { error: err } = await supabase.from(table).update(fields as Record<string, unknown>).eq('id', id);
    if (err) {
      console.error(`[${table}] update error:`, err.message);
      if (isOffline()) {
        // Keep the optimistic patch — it matches what flush() will land.
        enqueue({ table, op: 'update', rowId: id, payload: fields as Record<string, unknown> });
        toast('Edit saved offline — will sync');
        return true;
      }
      setData((prev) => prev.map((r) => (r.id === id ? { ...r, ...(prevFields ?? {}) } : r)));
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
    // Route through the shared undoableDelete: same 5s optimistic-undo UX, but it
    // registers the row in pendingDeletes so a concurrent realtime refresh (via
    // filterPendingDeletes above) can't resurrect it mid-window.
    undoableDelete(table, id, item, setData);
    return true;
  };

  return { data, loading, error, create, update, remove, refresh };
}
