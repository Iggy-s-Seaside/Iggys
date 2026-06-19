import { createElement } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { supabase } from '../lib/supabase';
import { enqueue, isOffline } from '../lib/outbox';
import toast from 'react-hot-toast';

/**
 * Rows that have been optimistically deleted but whose 5s commit hasn't fired
 * yet, keyed by table. Realtime hooks call refresh() on *any* table change, and
 * during the undo window the row still physically exists in the DB — so a
 * concurrent refresh would re-pull and re-show it, defeating the optimistic
 * delete. Refreshes filter their results through filterPendingDeletes() so a
 * mid-window refresh keeps the row hidden until the delete actually commits.
 */
const pendingDeletes = new Map<string, Set<string | number>>();

function markPending(table: string, id: string | number) {
  let set = pendingDeletes.get(table);
  if (!set) { set = new Set(); pendingDeletes.set(table, set); }
  set.add(id);
}
function clearPending(table: string, id: string | number) {
  pendingDeletes.get(table)?.delete(id);
}

/**
 * Drop any rows currently mid-undo-window for this table. Wrap a refresh's
 * result with this before setState so a realtime tick doesn't resurrect a row
 * the user just deleted:
 *   setRows(filterPendingDeletes('todos', (data as Todo[]) || []));
 */
export function filterPendingDeletes<T extends { id: string | number }>(table: string, rows: T[]): T[] {
  const set = pendingDeletes.get(table);
  if (!set || set.size === 0) return rows;
  return rows.filter((r) => !set.has(r.id));
}

/** Stable order for the restored row — numeric ids by value, slug ids alphabetically. */
function cmpId<T extends { id: string | number }>(a: T, b: T): number {
  if (typeof a.id === 'number' && typeof b.id === 'number') return a.id - b.id;
  return String(a.id).localeCompare(String(b.id));
}

/**
 * Optimistic delete with a 5s UNDO window — the proven pattern lifted out of
 * useSupabaseCRUD.remove so every dedicated hook gets the same wet-bar-friendly
 * mis-tap recovery instead of a raw `.delete().eq()` that's gone for good.
 *
 * The row vanishes from the UI instantly, a toast offers Undo for 5s, and only
 * then does the DB delete actually commit. Undo is a true restore of the same
 * row (id preserved — no early delete, no re-insert). Offline → the delete is
 * queued to the shared outbox and replays on reconnect.
 *
 * Usage inside a dedicated hook that owns a `setRows` state setter:
 *   const item = rows.find((r) => r.id === id);
 *   if (!item) return false;
 *   undoableDelete('parties', id, item, setRows, 'Party removed');
 *   return true;
 *
 * IMPORTANT: if the hook has a realtime channel, also wrap its refresh result
 * with filterPendingDeletes(table, rows) so a concurrent tick can't resurrect
 * the row mid-window.
 *
 * @param table   Supabase table name
 * @param id      row id to delete
 * @param item    the full row (preserved for a true restore)
 * @param setData the hook's React setState for its row array
 * @param label   what the toast says was removed (default "Deleted")
 */
export function undoableDelete<T extends { id: string | number }>(
  table: string,
  id: string | number,
  item: T,
  setData: Dispatch<SetStateAction<T[]>>,
  label = 'Deleted',
): void {
  markPending(table, id);
  setData((prev) => prev.filter((r) => r.id !== id));
  let undone = false;
  const restore = () => {
    clearPending(table, id);
    setData((prev) => (prev.some((r) => r.id === id) ? prev : [...prev, item].sort(cmpId)));
  };
  const commit = setTimeout(async () => {
    if (undone) return;
    const { error: err } = await supabase.from(table).delete().eq('id', id);
    clearPending(table, id);
    if (err) {
      console.error(`[${table}] delete error:`, err.message);
      if (isOffline()) {
        // Undo window already elapsed; keep the delete pending instead of restoring.
        enqueue({ table, op: 'delete', rowId: id });
        toast('Delete saved offline — will sync');
        return;
      }
      restore();
      toast.error("Couldn't delete — restored.");
    }
  }, 5000);
  toast(
    (t) =>
      createElement(
        'span',
        { style: { display: 'flex', alignItems: 'center', gap: '14px' } },
        label,
        createElement(
          'button',
          {
            onClick: () => { undone = true; clearTimeout(commit); restore(); toast.dismiss(t.id); },
            style: { fontWeight: 700, color: '#2dd4bf', cursor: 'pointer' },
          },
          'Undo',
        ),
      ),
    { duration: 5000 },
  );
}
