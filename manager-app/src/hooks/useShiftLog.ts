import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { ShiftLogEntry, ShiftLogTag } from '../types';
import toast from 'react-hot-toast';

/** A menu item as we need it for the "86 an item" picker. */
export interface MenuItemRef {
  id: number;
  name: string;
  is_86d: boolean;
}

export interface ShiftLogFilters {
  /** Limit to a single shift (logical shift_sessions.id). null = all shifts. */
  shiftId?: number | null;
  /** Limit to a single tag. null/undefined = all tags. */
  tag?: ShiftLogTag | null;
  /** Free-text search over body + item_ref + author. */
  search?: string;
}

export interface AddShiftLogInput {
  tag: ShiftLogTag;
  body: string;
  itemRef?: string | null;
  photoUrl?: string | null;
  shiftId?: number | null;
}

/**
 * Shift log / mod journal — the tagged, searchable floor record.
 *
 * Works standalone or scoped to a shift via `shiftId`. New entries are
 * attributed to the signed-in manager (author = user.email). Realtime keeps
 * every device's feed in sync.
 */
export function useShiftLog(shiftId?: number | null) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<ShiftLogEntry[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemRef[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('shift_log')
      .select('*')
      .order('created_at', { ascending: false });
    if (shiftId != null) query = query.eq('shift_id', shiftId);

    const { data, error } = await query;
    if (error) {
      toast.error('Failed to load shift log');
      console.error('[shift_log] load error:', error.message);
    } else {
      setEntries((data as ShiftLogEntry[]) || []);
    }
    setLoading(false);
  }, [shiftId]);

  const refreshMenuItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('menu_items')
      .select('id, name, is_86d')
      .order('name', { ascending: true });
    if (error) {
      // Non-fatal: the journal still works without the 86 picker.
      console.error('[menu_items] load error:', error.message);
      return;
    }
    setMenuItems((data as MenuItemRef[]) || []);
  }, []);

  useEffect(() => {
    refresh();
    refreshMenuItems();
  }, [refresh, refreshMenuItems]);

  // Realtime: keep the floor feed live across devices.
  useEffect(() => {
    const channel = supabase
      .channel('shift_log-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_log' }, () => {
        refresh();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  /** Add a journal entry. Author is the signed-in manager. */
  const add = useCallback(
    async (input: AddShiftLogInput): Promise<boolean> => {
      const body = input.body.trim();
      if (!body && !input.itemRef) {
        toast.error('Add a note or an item first');
        return false;
      }
      const { error } = await supabase.from('shift_log').insert({
        shift_id: input.shiftId ?? shiftId ?? null,
        author: user?.email ?? null,
        tag: input.tag,
        body,
        item_ref: input.itemRef?.trim() || null,
        photo_url: input.photoUrl || null,
      });
      if (error) {
        toast.error('Failed to add entry');
        console.error('[shift_log] insert error:', error.message);
        return false;
      }
      await refresh();
      return true;
    },
    [refresh, shiftId, user?.email]
  );

  /** Toggle the resolved flag (incidents / maintenance close out). */
  const toggleResolved = useCallback(
    async (id: number, resolved: boolean): Promise<boolean> => {
      const { error } = await supabase
        .from('shift_log')
        .update({ resolved })
        .eq('id', id);
      if (error) {
        toast.error('Failed to update entry');
        console.error('[shift_log] update error:', error.message);
        return false;
      }
      await refresh();
      return true;
    },
    [refresh]
  );

  /** Delete a journal entry. */
  const remove = useCallback(
    async (id: number): Promise<boolean> => {
      const { error } = await supabase.from('shift_log').delete().eq('id', id);
      if (error) {
        toast.error('Failed to delete entry');
        console.error('[shift_log] delete error:', error.message);
        return false;
      }
      await refresh();
      return true;
    },
    [refresh]
  );

  /**
   * 86 an item: write a '86' journal entry AND flag the matching menu item
   * (best-effort case-insensitive name match) so the public menu can hide it.
   * Pass a known menuItemId to flag exactly, or just a name to match.
   */
  const eightySix = useCallback(
    async (opts: {
      name: string;
      menuItemId?: number | null;
      note?: string;
    }): Promise<boolean> => {
      const name = opts.name.trim();
      if (!name) {
        toast.error('Pick an item to 86');
        return false;
      }

      // Resolve the menu item: explicit id, else best-effort name match.
      let matchId = opts.menuItemId ?? null;
      let matched = matchId != null ? menuItems.find((m) => m.id === matchId) ?? null : null;
      if (matchId == null) {
        const lower = name.toLowerCase();
        matched =
          menuItems.find((m) => m.name.toLowerCase() === lower) ??
          menuItems.find((m) => m.name.toLowerCase().includes(lower)) ??
          null;
        matchId = matched?.id ?? null;
      }

      // Flag the public-menu item if we found one (best-effort, non-fatal).
      if (matchId != null) {
        const { error: flagErr } = await supabase
          .from('menu_items')
          .update({ is_86d: true })
          .eq('id', matchId);
        if (flagErr) {
          console.error('[menu_items] 86 flag error:', flagErr.message);
          toast.error('Logged, but could not flag the menu');
        }
      }

      // Always write the journal entry, even if no menu match (off-menu 86s).
      const bodyParts = [`86 — ${matched?.name ?? name}`];
      if (opts.note?.trim()) bodyParts.push(opts.note.trim());
      const { error: logErr } = await supabase.from('shift_log').insert({
        shift_id: shiftId ?? null,
        author: user?.email ?? null,
        tag: '86' as ShiftLogTag,
        body: bodyParts.join(' — '),
        item_ref: matched?.name ?? name,
      });
      if (logErr) {
        toast.error('Failed to log the 86');
        console.error('[shift_log] 86 insert error:', logErr.message);
        return false;
      }

      toast.success(matchId != null ? `86'd ${matched?.name ?? name}` : `Logged 86 — ${name}`);
      await refresh();
      await refreshMenuItems();
      return true;
    },
    [menuItems, refresh, refreshMenuItems, shiftId, user?.email]
  );

  /** Clear the 86 flag on a menu item (best-effort) and log the un-86. */
  const unEightySix = useCallback(
    async (menuItemId: number): Promise<boolean> => {
      const item = menuItems.find((m) => m.id === menuItemId) ?? null;
      const { error: flagErr } = await supabase
        .from('menu_items')
        .update({ is_86d: false })
        .eq('id', menuItemId);
      if (flagErr) {
        toast.error('Failed to un-86 the item');
        console.error('[menu_items] un-86 error:', flagErr.message);
        return false;
      }

      await supabase.from('shift_log').insert({
        shift_id: shiftId ?? null,
        author: user?.email ?? null,
        tag: 'note' as ShiftLogTag,
        body: `Back on — ${item?.name ?? `item #${menuItemId}`}`,
        item_ref: item?.name ?? null,
      });

      toast.success(`Back on the menu${item ? `: ${item.name}` : ''}`);
      await refresh();
      await refreshMenuItems();
      return true;
    },
    [menuItems, refresh, refreshMenuItems, shiftId, user?.email]
  );

  /** Filter the loaded entries client-side (tag / search). */
  const filter = useCallback(
    (filters: ShiftLogFilters): ShiftLogEntry[] => {
      let result = entries;
      if (filters.shiftId != null) {
        result = result.filter((e) => e.shift_id === filters.shiftId);
      }
      if (filters.tag) {
        result = result.filter((e) => e.tag === filters.tag);
      }
      const q = filters.search?.trim().toLowerCase();
      if (q) {
        result = result.filter(
          (e) =>
            e.body.toLowerCase().includes(q) ||
            (e.item_ref?.toLowerCase().includes(q) ?? false) ||
            (e.author?.toLowerCase().includes(q) ?? false)
        );
      }
      return result;
    },
    [entries]
  );

  /** Menu items currently flagged 86 (for the "back on" list). */
  const eightySixedItems = useMemo(
    () => menuItems.filter((m) => m.is_86d),
    [menuItems]
  );

  return {
    entries,
    menuItems,
    eightySixedItems,
    loading,
    refresh,
    add,
    toggleResolved,
    remove,
    eightySix,
    unEightySix,
    filter,
  };
}
