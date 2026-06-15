import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ShiftSession } from '../types';
import { todaysBusinessDay } from '../utils/businessDay';
import toast from 'react-hot-toast';

// shift_sessions.business_day (see scripts/add-business-day.sql) is the service
// day this row belongs to (9am Pacific cutoff). The shared ShiftSession type
// may not carry it yet, so read it through a widened local view.
type ShiftSessionRow = ShiftSession & { business_day?: string | null };

/**
 * The shift spine. A shift_sessions row is one open->close bar shift; every
 * other shift reading (line checks, the log, the cash close) carries a
 * nullable shift_id pointing back here.
 *
 * Exposes the CURRENT service session, recent shifts, and the open/close
 * actions. "Current" is resolved by business_day (today's service day), NOT by
 * status=open — so after the 9am Pacific cutoff the day flips on its own even
 * if a tired closer left a session open, and a fresh open after 9am starts a
 * clean checklist day. Realtime-aware: any insert/update to shift_sessions
 * refreshes both lists so every device sees the change instantly.
 */
export function useShift() {
  const [current, setCurrent] = useState<ShiftSession | null>(null);
  const [recent, setRecent] = useState<ShiftSession[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!loadedRef.current) setLoading(true);
    const { data, error } = await supabase
      .from('shift_sessions')
      .select('*')
      .order('opened_at', { ascending: false })
      .limit(30);
    if (error) {
      toast.error('Failed to load shift status');
      console.error('[shift_sessions] load error:', error.message);
    } else {
      const rows = (data as ShiftSessionRow[]) || [];
      setRecent(rows);
      // The current SERVICE session is the most recent row stamped with today's
      // business day (rows arrive newest-first). This is what drives today's
      // checklists, so it rolls automatically at the 9am cutoff — independent of
      // whether anyone remembered to close. Fall back to a still-open session
      // for legacy rows written before business_day existed.
      const today = todaysBusinessDay();
      const byBusinessDay = rows.find((s) => s.business_day === today) ?? null;
      const openFallback =
        byBusinessDay == null ? rows.find((s) => s.business_day == null && s.status === 'open') ?? null : null;
      setCurrent(byBusinessDay ?? openFallback);
    }
    loadedRef.current = true;
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

  /**
   * Open the bar. Stamps opened_by + business_day (today's service day) so the
   * session — and the checklists hung off it — belong to the right day even
   * past midnight. Returns the new row (or null).
   */
  const openShift = useCallback(
    async (userEmail?: string | null): Promise<ShiftSession | null> => {
      // `current` is today's service session of ANY status (it drives the
      // checklists day). Only block when it's actually OPEN. If today's session
      // was already closed, re-open THAT row (same business day = same checklists)
      // rather than creating a duplicate business_day row.
      if (current?.status === 'open') {
        toast.error('A shift is already open');
        return current;
      }
      if (current && current.status === 'closed') {
        const { data, error } = await supabase
          .from('shift_sessions')
          .update({ status: 'open', closed_at: null, closed_by: null })
          .eq('id', current.id)
          .select()
          .single();
        if (error) {
          toast.error('Failed to re-open the bar');
          console.error('[shift_sessions] reopen error:', error.message);
          return null;
        }
        toast.success('Bar re-opened');
        const row = data as ShiftSession;
        setCurrent(row);
        await refresh();
        return row;
      }
      const { data, error } = await supabase
        .from('shift_sessions')
        .insert({ opened_by: userEmail ?? null, status: 'open', business_day: todaysBusinessDay() })
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

  // `current` = today's service session (any status, drives checklists).
  // `isOpen` = the bar is actually open right now — use THIS for open/closed UI.
  const isOpen = current?.status === 'open';
  return { current, isOpen, recent, loading, refresh, openShift, closeShift, updateNotes };
}
