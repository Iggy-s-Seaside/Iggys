import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ShiftSession } from '../types';
import toast from 'react-hot-toast';

/**
 * The shift spine. A shift_sessions row is one open->close bar shift; every
 * other shift reading (line checks, the log, the cash close) carries a
 * nullable shift_id pointing back here.
 *
 * Exposes the current open shift (if any), recent shifts, and the
 * open/close actions. Realtime-aware: any insert/update to shift_sessions
 * refreshes both lists so every device sees "the bar is open" instantly.
 */
export function useShift() {
  const [current, setCurrent] = useState<ShiftSession | null>(null);
  const [recent, setRecent] = useState<ShiftSession[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('shift_sessions')
      .select('*')
      .order('opened_at', { ascending: false })
      .limit(30);
    if (error) {
      toast.error('Failed to load shift status');
      console.error('[shift_sessions] load error:', error.message);
    } else {
      const rows = (data as ShiftSession[]) || [];
      setRecent(rows);
      setCurrent(rows.find((s) => s.status === 'open') ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const channel = supabase
      .channel('shift-sessions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_sessions' }, () => {
        refresh();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  /** Open the bar. Stamps opened_by from the manager's email. Returns the new row (or null). */
  const openShift = useCallback(
    async (userEmail?: string | null): Promise<ShiftSession | null> => {
      // Guard against a double-open if two devices race.
      if (current) {
        toast.error('A shift is already open');
        return current;
      }
      const { data, error } = await supabase
        .from('shift_sessions')
        .insert({ opened_by: userEmail ?? null, status: 'open' })
        .select()
        .single();
      if (error) {
        toast.error('Failed to open the bar');
        console.error('[shift_sessions] open error:', error.message);
        return null;
      }
      toast.success('Bar opened');
      const row = data as ShiftSession;
      setCurrent(row);
      await refresh();
      return row;
    },
    [current, refresh]
  );

  /** Close the bar. Stamps closed_at + closed_by; optional handoff notes. */
  const closeShift = useCallback(
    async (id: number, userEmail?: string | null, notes?: string | null): Promise<boolean> => {
      const fields: Partial<ShiftSession> = {
        status: 'closed',
        closed_at: new Date().toISOString(),
        closed_by: userEmail ?? null,
      };
      if (notes !== undefined) fields.notes = notes;
      const { error } = await supabase.from('shift_sessions').update(fields).eq('id', id);
      if (error) {
        toast.error('Failed to close the bar');
        console.error('[shift_sessions] close error:', error.message);
        return false;
      }
      toast.success('Bar closed');
      await refresh();
      return true;
    },
    [refresh]
  );

  /** Update free-form notes on a shift (handoff, anything notable). */
  const updateNotes = useCallback(
    async (id: number, notes: string | null): Promise<boolean> => {
      const { error } = await supabase.from('shift_sessions').update({ notes }).eq('id', id);
      if (error) {
        toast.error('Failed to save notes');
        console.error('[shift_sessions] notes error:', error.message);
        return false;
      }
      await refresh();
      return true;
    },
    [refresh]
  );

  return { current, recent, loading, refresh, openShift, closeShift, updateNotes };
}
