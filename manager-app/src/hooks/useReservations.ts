import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

// ── Types ──
// These mirror the canonical interfaces that belong in src/types/index.ts
// (Reservation, WaitlistEntry, Section, FloorTable). They are re-exported here
// so this feature is self-contained; once the shared types land, callers may
// import from either place — the shapes are identical.

export const RESERVATION_STATUSES = [
  'booked',
  'confirmed',
  'seated',
  'completed',
  'cancelled',
  'no_show',
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  booked: 'Booked',
  confirmed: 'Confirmed',
  seated: 'Seated',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
};

export const DEPOSIT_STATUSES = ['none', 'requested', 'paid'] as const;
export type ReservationDepositStatus = (typeof DEPOSIT_STATUSES)[number];

export const DEPOSIT_STATUS_LABELS: Record<ReservationDepositStatus, string> = {
  none: 'No deposit',
  requested: 'Deposit requested',
  paid: 'Deposit paid',
};

export const WAITLIST_STATUSES = ['waiting', 'notified', 'seated', 'cancelled'] as const;
export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number];

export interface Section {
  id: number;
  name: string;
}

export interface FloorTable {
  id: number;
  section_id: number | null;
  name: string;
  seats: number;
}

export interface Reservation {
  id: number;
  created_at: string;
  guest_name: string;
  phone: string | null;
  party_size: number;
  reserved_for: string;
  status: ReservationStatus;
  table_id: number | null;
  notes: string | null;
  deposit_status: ReservationDepositStatus;
}

export interface WaitlistEntry {
  id: number;
  created_at: string;
  guest_name: string;
  phone: string | null;
  party_size: number;
  status: WaitlistStatus;
  quoted_minutes: number | null;
  notified_at: string | null;
}

export type NewReservation = {
  guest_name: string;
  phone?: string | null;
  party_size: number;
  reserved_for: string;
  status?: ReservationStatus;
  table_id?: number | null;
  notes?: string | null;
  deposit_status?: ReservationDepositStatus;
};

export type NewWaitlistEntry = {
  guest_name: string;
  phone?: string | null;
  party_size: number;
  quoted_minutes?: number | null;
};

// ── Helpers ──

/** Bounds of "today" (local) as ISO strings, for the tonight board's window. */
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
 * Live host-board data: reservations for tonight, the active waitlist, and the
 * floor plan (sections + tables). Subscribes to realtime so the board stays in
 * sync across the host stand and any second screen. All write actions optimistically
 * refresh; realtime reconciles. "notify" calls the gated send-sms function and
 * tolerates it being disabled (the row is still advanced to 'notified').
 */
export function useReservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [tables, setTables] = useState<FloorTable[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { startISO, endISO } = todayBounds();

    const [resRes, waitRes, secRes, tblRes] = await Promise.all([
      supabase
        .from('reservations')
        .select('*')
        .gte('reserved_for', startISO)
        .lt('reserved_for', endISO)
        .order('reserved_for', { ascending: true }),
      supabase
        .from('waitlist_entries')
        .select('*')
        .in('status', ['waiting', 'notified'])
        .order('created_at', { ascending: true }),
      supabase.from('sections').select('*').order('name', { ascending: true }),
      supabase.from('floor_tables').select('*').order('name', { ascending: true }),
    ]);

    if (resRes.error || waitRes.error || secRes.error || tblRes.error) {
      const err = resRes.error || waitRes.error || secRes.error || tblRes.error;
      console.error('[reservations] load error:', err?.message);
      toast.error('Failed to load the host board. Please refresh.');
    } else {
      setReservations((resRes.data as Reservation[]) || []);
      setWaitlist((waitRes.data as WaitlistEntry[]) || []);
      setSections((secRes.data as Section[]) || []);
      setTables((tblRes.data as FloorTable[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime: any change to the two live tables re-pulls the board.
  useEffect(() => {
    const channel = supabase
      .channel('reservations-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waitlist_entries' }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  // ── Reservation actions ──

  const createReservation = async (input: NewReservation) => {
    const { error } = await supabase.from('reservations').insert({
      guest_name: input.guest_name,
      phone: input.phone ?? null,
      party_size: input.party_size,
      reserved_for: input.reserved_for,
      status: input.status ?? 'booked',
      table_id: input.table_id ?? null,
      notes: input.notes ?? null,
      deposit_status: input.deposit_status ?? 'none',
    });
    if (error) {
      console.error('[reservations] create error:', error.message);
      toast.error('Failed to add reservation. Please try again.');
      return false;
    }
    toast.success('Reservation added');
    await refresh();
    return true;
  };

  const updateReservation = async (id: number, fields: Partial<Reservation>) => {
    const { error } = await supabase.from('reservations').update(fields).eq('id', id);
    if (error) {
      console.error('[reservations] update error:', error.message);
      toast.error('Failed to update reservation. Please try again.');
      return false;
    }
    await refresh();
    return true;
  };

  const setReservationStatus = (id: number, status: ReservationStatus) =>
    updateReservation(id, { status });

  const assignTable = (id: number, table_id: number | null) =>
    updateReservation(id, { table_id });

  const seatReservation = (id: number, table_id?: number | null) =>
    updateReservation(id, { status: 'seated', ...(table_id != null ? { table_id } : {}) });

  const deleteReservation = async (id: number) => {
    const { error } = await supabase.from('reservations').delete().eq('id', id);
    if (error) {
      console.error('[reservations] delete error:', error.message);
      toast.error('Failed to delete reservation.');
      return false;
    }
    toast.success('Reservation removed');
    await refresh();
    return true;
  };

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

  const seatWaitlist = async (id: number) => {
    const { error } = await supabase.from('waitlist_entries').update({ status: 'seated' }).eq('id', id);
    if (error) {
      console.error('[waitlist] seat error:', error.message);
      toast.error('Failed to seat party. Please try again.');
      return false;
    }
    toast.success('Party seated');
    await refresh();
    return true;
  };

  const cancelWaitlist = async (id: number) => {
    const { error } = await supabase.from('waitlist_entries').update({ status: 'cancelled' }).eq('id', id);
    if (error) {
      console.error('[waitlist] cancel error:', error.message);
      toast.error('Failed to cancel. Please try again.');
      return false;
    }
    toast.success('Removed from waitlist');
    await refresh();
    return true;
  };

  const updateWaitlist = async (id: number, fields: Partial<WaitlistEntry>) => {
    const { error } = await supabase.from('waitlist_entries').update(fields).eq('id', id);
    if (error) {
      console.error('[waitlist] update error:', error.message);
      toast.error('Failed to update. Please try again.');
      return false;
    }
    await refresh();
    return true;
  };

  // ── Derived ──

  const sectionName = useMemo(() => {
    const map = new Map<number, string>();
    sections.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [sections]);

  const tableById = useMemo(() => {
    const map = new Map<number, FloorTable>();
    tables.forEach((t) => map.set(t.id, t));
    return map;
  }, [tables]);

  return {
    reservations,
    waitlist,
    sections,
    tables,
    sectionName,
    tableById,
    loading,
    refresh,
    // reservation actions
    createReservation,
    updateReservation,
    setReservationStatus,
    assignTable,
    seatReservation,
    deleteReservation,
    // waitlist actions
    addToWaitlist,
    notifyWaitlist,
    seatWaitlist,
    cancelWaitlist,
    updateWaitlist,
  };
}
