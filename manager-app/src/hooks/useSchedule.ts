// useSchedule — data + math for the weekly scheduling board, labor-% gauge,
// and tip-pool calculator. Backs src/pages/Schedule.tsx.
//
// Tables (see scripts/add-labor.sql): staff, shifts, staff_availability,
// time_off_requests, tip_pools. Times are integer minutes-from-midnight;
// weekday is 0=Sun..6=Sat (JS Date.getDay()). staff.wage is dollars/hour.
//
// Realtime: shifts + time_off_requests + staff drive a live board, so we
// subscribe and refetch on any change (debounced by Supabase's channel).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { supabase } from '../lib/supabase';
import { undoableDelete, filterPendingDeletes } from './useUndoableDelete';
import type { Staff, Shift, TimeOffRequest, TipPool } from '../types';
import toast from 'react-hot-toast';

// ── time helpers (minutes-from-midnight) ──

/** "17:00" / "1020" minutes -> "5:00 PM". */
export function minToLabel(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const ampm = h24 < 12 ? 'AM' : 'PM';
  return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
}

/** "17:00" <input type=time> value <-> minutes. */
export function minToTimeInput(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
export function timeInputToMin(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Shift length in hours (handles past-midnight end_min < start_min). */
export function shiftHours(startMin: number, endMin: number): number {
  // >= so a zero-length shift (start == end) is 0h, not a full 24h day. Only a
  // genuine past-midnight end (endMin < startMin) wraps by +1440.
  const span = endMin >= startMin ? endMin - startMin : endMin + 1440 - startMin;
  return span / 60;
}

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const TIP_METHODS = ['hours', 'even', 'points'] as const;
export type TipMethod = (typeof TIP_METHODS)[number];
export const TIP_METHOD_LABELS: Record<TipMethod, string> = {
  hours: 'Hours-weighted',
  even: 'Even split',
  points: 'Role points',
};

/** Per-role weighting used when tip method = 'points'. Falls back to 1. */
export const ROLE_POINTS: Record<string, number> = {
  bartender: 1.5,
  server: 1.25,
  barback: 1,
  kitchen: 1,
  manager: 0,
};

export const STAFF_ROLES = ['bartender', 'server', 'barback', 'kitchen', 'manager'] as const;

// ── allocation result type (one staffer's cut of a tip pool) ──

export interface TipAllocation {
  staff_id: number;
  name: string;
  hours: number;
  share_cents: number;
}

/**
 * Split a pool (in cents) across allocations. `hours` weights by worked hours,
 * `even` splits equally, `points` weights by role points × hours. Largest-
 * remainder rounding guarantees the parts sum EXACTLY to total_cents (no lost
 * pennies). Staff with zero weight (e.g. managers in points mode) get $0.
 */
export function allocateTips(
  totalCents: number,
  rows: { staff_id: number; name: string; hours: number; role?: string }[],
  method: TipMethod
): TipAllocation[] {
  if (rows.length === 0 || totalCents <= 0) {
    return rows.map((r) => ({ staff_id: r.staff_id, name: r.name, hours: r.hours, share_cents: 0 }));
  }

  const weight = (r: { hours: number; role?: string }) => {
    if (method === 'even') return 1;
    if (method === 'points') return (ROLE_POINTS[r.role ?? ''] ?? 1) * r.hours;
    return r.hours; // 'hours'
  };

  const weights = rows.map(weight);
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  if (totalWeight <= 0) {
    return rows.map((r) => ({ staff_id: r.staff_id, name: r.name, hours: r.hours, share_cents: 0 }));
  }

  // Floor each share, then hand out the leftover cents to the largest fractional parts.
  const raw = weights.map((w) => (w / totalWeight) * totalCents);
  const floors = raw.map(Math.floor);
  let remainder = totalCents - floors.reduce((s, n) => s + n, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  const shares = [...floors];
  for (let k = 0; k < order.length && remainder > 0; k++) {
    shares[order[k].i] += 1;
    remainder--;
  }

  return rows.map((r, i) => ({
    staff_id: r.staff_id,
    name: r.name,
    hours: r.hours,
    share_cents: shares[i],
  }));
}

// ── week helpers ──

export interface WeekDay {
  date: string;       // 'yyyy-MM-dd'
  weekday: number;    // 0..6
  label: string;      // 'Mon'
  dayNum: string;     // '14'
  isToday: boolean;
}

/** The 7 days of the week containing `anchor` (weeks start Sunday). */
export function buildWeek(anchor: Date): WeekDay[] {
  const start = startOfWeek(anchor, { weekStartsOn: 0 });
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    const date = format(d, 'yyyy-MM-dd');
    return {
      date,
      weekday: d.getDay(),
      label: format(d, 'EEE'),
      dayNum: format(d, 'd'),
      isToday: date === todayKey,
    };
  });
}

// ── the hook ──

export function useSchedule(weekAnchor: Date) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [timeOff, setTimeOff] = useState<TimeOffRequest[]>([]);
  const [tipPools, setTipPools] = useState<TipPool[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);

  const week = useMemo(() => buildWeek(weekAnchor), [weekAnchor]);
  const weekStart = week[0]?.date ?? '';
  const weekEnd = week[6]?.date ?? '';

  const refresh = useCallback(async () => {
    if (!loadedRef.current) setLoading(true);
    const [staffRes, shiftRes, offRes, poolRes] = await Promise.all([
      supabase.from('staff').select('*').order('name'),
      supabase.from('shifts').select('*').gte('date', weekStart).lte('date', weekEnd),
      supabase.from('time_off_requests').select('*').order('date_from', { ascending: true }),
      supabase.from('tip_pools').select('*').order('date', { ascending: false }).limit(20),
    ]);
    const firstErr = staffRes.error || shiftRes.error || offRes.error || poolRes.error;
    if (firstErr) {
      console.error('[schedule] load error:', firstErr.message);
      toast.error('Failed to load schedule. Please refresh.');
    } else {
      setStaff(filterPendingDeletes('staff', (staffRes.data as Staff[]) || []));
      setShifts(filterPendingDeletes('shifts', (shiftRes.data as Shift[]) || []));
      setTimeOff((offRes.data as TimeOffRequest[]) || []);
      setTipPools(filterPendingDeletes('tip_pools', (poolRes.data as TipPool[]) || []));
    }
    loadedRef.current = true;
    setLoading(false);
  }, [weekStart, weekEnd]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Live board: refetch when any labor table changes elsewhere.
  useEffect(() => {
    const channel = supabase
      .channel('schedule-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_off_requests' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refresh]);

  // ── staff CRUD ──
  const createStaff = async (input: Omit<Staff, 'id' | 'created_at'>) => {
    const { error } = await supabase.from('staff').insert(input);
    if (error) { toast.error('Failed to add staff'); return false; }
    toast.success('Staff added'); await refresh(); return true;
  };
  const updateStaff = async (id: number, fields: Partial<Staff>) => {
    const { error } = await supabase.from('staff').update(fields).eq('id', id);
    if (error) { toast.error('Failed to update staff'); return false; }
    await refresh(); return true;
  };
  const removeStaff = async (id: number) => {
    const item = staff.find((r) => r.id === id);
    if (!item) {
      const { error } = await supabase.from('staff').delete().eq('id', id);
      if (error) { toast.error('Failed to remove staff'); return false; }
      await refresh(); return true;
    }
    undoableDelete('staff', id, item, setStaff, 'Staff removed');
    return true;
  };

  // ── shift CRUD ──
  const addShift = async (input: Omit<Shift, 'id' | 'created_at'>) => {
    const { error } = await supabase.from('shifts').insert(input);
    if (error) { toast.error('Failed to add shift'); return false; }
    await refresh(); return true;
  };
  const updateShift = async (id: number, fields: Partial<Shift>) => {
    const { error } = await supabase.from('shifts').update(fields).eq('id', id);
    if (error) { toast.error('Failed to update shift'); return false; }
    await refresh(); return true;
  };
  const removeShift = async (id: number) => {
    const item = shifts.find((r) => r.id === id);
    if (!item) {
      const { error } = await supabase.from('shifts').delete().eq('id', id);
      if (error) { toast.error('Failed to remove shift'); return false; }
      await refresh(); return true;
    }
    undoableDelete('shifts', id, item, setShifts, 'Shift removed');
    return true;
  };

  /** Publish (or unpublish) every shift in the current week in one shot. */
  const setWeekPublished = async (published: boolean) => {
    const { error } = await supabase
      .from('shifts')
      .update({ published })
      .gte('date', weekStart)
      .lte('date', weekEnd);
    if (error) { toast.error('Failed to update publish state'); return false; }
    toast.success(published ? 'Schedule published' : 'Schedule unpublished');
    await refresh(); return true;
  };

  // ── time-off ──
  const setTimeOffStatus = async (id: number, status: TimeOffRequest['status']) => {
    const { error } = await supabase.from('time_off_requests').update({ status }).eq('id', id);
    if (error) { toast.error('Failed to update request'); return false; }
    toast.success(`Request ${status}`); await refresh(); return true;
  };

  // ── tip pools ──
  const saveTipPool = async (input: Omit<TipPool, 'id' | 'created_at'>) => {
    const { error } = await supabase.from('tip_pools').insert(input);
    if (error) { toast.error('Failed to save tip pool'); return false; }
    toast.success('Tip pool saved'); await refresh(); return true;
  };
  const removeTipPool = async (id: number) => {
    const item = tipPools.find((r) => r.id === id);
    if (!item) {
      const { error } = await supabase.from('tip_pools').delete().eq('id', id);
      if (error) { toast.error('Failed to delete tip pool'); return false; }
      await refresh(); return true;
    }
    undoableDelete('tip_pools', id, item, setTipPools, 'Tip pool removed');
    return true;
  };

  return {
    week, weekStart, weekEnd,
    staff, shifts, timeOff, tipPools, loading, refresh,
    createStaff, updateStaff, removeStaff,
    addShift, updateShift, removeShift, setWeekPublished,
    setTimeOffStatus,
    saveTipPool, removeTipPool,
  };
}

// ── derived labor math (pure; used by the page + gauge) ──

/** Staff lookup by id. */
export function indexStaff(staff: Staff[]): Map<number, Staff> {
  return new Map(staff.map((s) => [s.id, s] as const));
}

export interface LaborSummary {
  scheduledHours: number;
  laborCost: number;        // dollars: Σ wage × hours
  perDayCost: number[];     // 7 entries, Sun..Sat order of the passed week
  perDayHours: number[];
}

/** Roll the week's shifts up into hours + wage cost (total and per-day). */
export function summarizeLabor(shifts: Shift[], staff: Staff[], week: WeekDay[]): LaborSummary {
  const byId = indexStaff(staff);
  const perDayCost = new Array(week.length).fill(0);
  const perDayHours = new Array(week.length).fill(0);
  const dayIndex = new Map(week.map((d, i) => [d.date, i] as const));

  let scheduledHours = 0;
  let laborCost = 0;
  for (const sh of shifts) {
    const hrs = shiftHours(sh.start_min, sh.end_min);
    const wage = byId.get(sh.staff_id)?.wage ?? 0;
    const cost = hrs * wage;
    scheduledHours += hrs;
    laborCost += cost;
    const di = dayIndex.get(sh.date);
    if (di != null) { perDayCost[di] += cost; perDayHours[di] += hrs; }
  }
  return { scheduledHours, laborCost, perDayCost, perDayHours };
}

/**
 * Labor % = scheduled labor cost ÷ forecast sales. With no live POS feed we
 * derive a defensible forecast from the venue's own history: a per-weekday
 * sales target (weekend nights pull more). The owner can tune `targetMultiplier`
 * from the UI; default weekday targets below are conservative Seaside-bar nights.
 */
export const DEFAULT_DAY_SALES_TARGET: number[] = [
  // Sun   Mon   Tue   Wed   Thu   Fri    Sat
  2200, 1500, 1500, 1800, 2400, 4200, 4800,
];

export interface LaborGauge {
  laborCost: number;
  forecastSales: number;
  laborPct: number;          // 0..100+
  /** Industry-standard healthy bar labor band is ~20–30%. */
  status: 'good' | 'watch' | 'over';
}

export function laborGauge(laborCost: number, forecastSales: number): LaborGauge {
  const laborPct = forecastSales > 0 ? (laborCost / forecastSales) * 100 : 0;
  const status: LaborGauge['status'] = laborPct <= 25 ? 'good' : laborPct <= 32 ? 'watch' : 'over';
  return { laborCost, forecastSales, laborPct, status };
}

/** Sum the per-weekday targets for the days in the week (scaled by a multiplier). */
export function forecastForWeek(week: WeekDay[], targets: number[], multiplier = 1): number {
  return week.reduce((sum, d) => sum + (targets[d.weekday] ?? 0) * multiplier, 0);
}

/** A staffer's worked hours on a given date (for the tip calculator). */
export function hoursForStaffOnDate(shifts: Shift[], staffId: number, date: string): number {
  return shifts
    .filter((s) => s.staff_id === staffId && s.date === date)
    .reduce((sum, s) => sum + shiftHours(s.start_min, s.end_min), 0);
}

/** Format an ISO date ('yyyy-MM-dd') for display, tolerant of bad input. */
export function fmtDate(d: string, pattern = 'EEE, MMM d'): string {
  try { return format(parseISO(d), pattern); } catch { return d; }
}
