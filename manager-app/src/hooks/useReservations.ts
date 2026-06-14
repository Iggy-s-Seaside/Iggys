import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

// ── Types ──
// The family does NOT take table reservations — the host stand runs purely off a
// walk-up waitlist. This hook owns the live waitlist board. The file keeps its
// `useReservations` name/path for now so existing imports don't break; the
// integrator may alias it to `useWaitlist` later.

export const WAITLIST_STATUSES = ['waiting', 'notified', 'seated', 'cancelled', 'no_show'] as const;
export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number];

/** Statuses that keep a party on the *active* board (waiting + notified). */
export const ACTIVE_WAITLIST_STATUSES: WaitlistStatus[] = ['waiting', 'notified'];

/** Default room area for a new walk-up. Bar / patio can be added later. */
export const DEFAULT_WAITLIST_AREA = 'main-restaurant';

export interface WaitlistEntry {
  id: number;
  created_at: string;
  guest_name: string;
  phone: string | null;
  party_size: number;
  status: WaitlistStatus;
  quoted_minutes: number | null;
  notified_at: string | null;
  area: string;
}

export type NewWaitlistEntry = {
  guest_name: string;
  phone?: string | null;
  party_size: number;
  quoted_minutes?: number | null;
  area?: string;
};

// ── Helpers ──

/**
 * Bounds of "today" (local) as ISO strings. Exported for other surfaces that
 * window on the current day (e.g. the activity feed). Kept here for back-compat.
 */
export function todayBounds(now = new Date()): { startISO: string; endISO: string } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

/**
 * Suggest a wait quote (minutes) for a new walk-in: a small base plus a per-party
 * increment scaled by how many parties are already waiting and the size of the
 * new party. Rounded to the nearest 5 so it reads like a real host's estimate.
 */
export function suggestWaitQuote(partiesWaiting: number, partySize: number): number {
  const base = 10;
  const perParty = 8;
  const sizeBump = partySize >= 6 ? 15 : partySize >= 4 ? 8 : 0;
  const raw = base + partiesWaiting * perParty + sizeBump;
  return Math.min(120, Math.round(raw / 5) * 5);
}

// ── Hook ──

/**
 * Live waitlist board: the active walk-up queue (waiting + notified). Subscribes
 * to realtime so the board stays in sync across the host stand and any second
 * screen. All write actions refresh; realtime reconciles. "notify" calls the
 * gated send-sms function and tolerates it being disabled (the row is still
 * advanced to 'notified').
 *
 * NOTE: the hook name `useReservations` is retained for now to avoid churning
 * every import site; this hook no longer touches the reservations table.
 */
export function useReservations() {
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('waitlist_entries')
      .select('*')
      .in('status', ACTIVE_WAITLIST_STATUSES)
      .order('created_at', { ascending: true });

    if (err) {
      console.error('[waitlist] load error:', err.message);
      toast.error('Failed to load the waitlist. Please refresh.');
      setError(err.message ?? 'Failed to load the waitlist.');
    } else {
      setWaitlist((data as WaitlistEntry[]) || []);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime: any change to the waitlist table re-pulls the board.
  useEffect(() => {
    const channel = supabase
      .channel('waitlist-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waitlist_entries' }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  // ── Waitlist actions ──

  const addToWaitlist = async (input: NewWaitlistEntry) => {
    const waiting = waitlist.filter((w) => w.status === 'waiting').length;
    const quote = input.quoted_minutes ?? suggestWaitQuote(waiting, input.party_size);
    const { error } = await supabase.from('waitlist_entries').insert({
      guest_name: input.guest_name,
      phone: input.phone ?? null,
      party_size: input.party_size,
      status: 'waiting',
      quoted_minutes: quote,
      area: input.area ?? DEFAULT_WAITLIST_AREA,
    });
    if (error) {
      console.error('[waitlist] create error:', error.message);
      toast.error('Failed to add to waitlist. Please try again.');
      return false;
    }
    toast.success(`Added to waitlist — quoted ${quote} min`);
    await refresh();
    return true;
  };

  /**
   * Text the guest that their table is ready and advance them to 'notified'.
   * Calls the gated send-sms Edge Function (built by the CRM agent), which writes
   * an sms_log row when the SMS rail is configured. If SMS is disabled or the
   * function errors, the guest is still marked 'notified' (the host saw them) and
   * we surface a soft warning instead of failing the action outright.
   */
  const notifyWaitlist = async (entry: WaitlistEntry) => {
    let smsDelivered = false;
    if (entry.phone) {
      try {
        const body = `Hi ${entry.guest_name}, your table at Iggy's is ready! Please head to the host stand. Reply STOP to opt out.`;
        const { data, error } = await supabase.functions.invoke('send-sms', {
          body: { to: entry.phone, body, source: 'waitlist', ref_id: entry.id },
        });
        if (error) throw error;
        // The function returns { sent: boolean, disabled?: boolean } when present.
        smsDelivered = !error && !(data && data.disabled) && !(data && data.error);
      } catch (e) {
        // Tolerate a missing/disabled send-sms function — never block the host.
        console.warn('[waitlist] send-sms unavailable:', e instanceof Error ? e.message : e);
      }
    }

    const { error } = await supabase
      .from('waitlist_entries')
      .update({ status: 'notified', notified_at: new Date().toISOString() })
      .eq('id', entry.id);
    if (error) {
      console.error('[waitlist] notify update error:', error.message);
      toast.error('Failed to mark as notified. Please try again.');
      return false;
    }

    if (smsDelivered) toast.success(`Texted ${entry.guest_name}`);
    else if (entry.phone) toast(`Marked notified — SMS not sent (texting is off)`, { icon: '📵' });
    else toast.success(`Marked ${entry.guest_name} as notified`);
    await refresh();
    return true;
  };

  /** Set any waitlist status (free-text column — no enum migration needed). */
  const setWaitlistStatus = async (id: number, status: WaitlistStatus) => {
    const { error } = await supabase.from('waitlist_entries').update({ status }).eq('id', id);
    if (error) {
      console.error('[waitlist] status update error:', error.message);
      toast.error('Failed to update. Please try again.');
      return false;
    }
    await refresh();
    return true;
  };

  const seatWaitlist = async (id: number) => {
    const ok = await setWaitlistStatus(id, 'seated');
    if (ok) toast.success('Party seated');
    return ok;
  };

  const cancelWaitlist = async (id: number) => {
    const ok = await setWaitlistStatus(id, 'cancelled');
    if (ok) toast.success('Removed from waitlist');
    return ok;
  };

  const addNoShow = async (id: number) => {
    const ok = await setWaitlistStatus(id, 'no_show');
    if (ok) toast.success('Marked as no-show');
    return ok;
  };

  return {
    waitlist,
    loading,
    error,
    refresh,
    // waitlist actions
    addToWaitlist,
    notifyWaitlist,
    setWaitlistStatus,
    seatWaitlist,
    cancelWaitlist,
    addNoShow,
  };
}
