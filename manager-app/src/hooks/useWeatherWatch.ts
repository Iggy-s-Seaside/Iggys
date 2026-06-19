// useWeatherWatch — assembles the inputs the weather × reservation cross-signal
// needs and returns the actionable flags (see lib/weatherWatch.ts for the rules).
//
// Three data sources, joined here so the rule logic stays a pure function:
//   • weather forecast (useWeather.daily) — tomorrow's high + rain odds
//   • bookings (useParties) — confirmed events in the next 48h
//   • the schedule (shifts + staff) — front-of-house headcount per day, and the
//     historical "typical" for that weekday so "understaffed" is earned, not guessed
//   • demand_log — Luna's predicted band per day (to read high-demand / suppress slow)

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useParties } from './useParties';
import { useWeather } from './useWeather';
import { computeWeatherFlags, type DayStaffing, type WeatherFlag } from '../lib/weatherWatch';
import type { Staff, Shift } from '../types';

// Floor staff — who covers a busy night (managers/kitchen don't count toward "a hand").
const FOH_ROLES = new Set(['server', 'bartender', 'barback']);
const MIN_BASELINE_SAMPLES = 3; // need this many same-weekday nights before we trust a "typical"

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

export function useWeatherWatch(): { flags: WeatherFlag[]; loading: boolean } {
  const { daily } = useWeather();
  const { parties } = useParties();
  const [staffingByDate, setStaffingByDate] = useState<Record<string, DayStaffing>>({});
  const [demandByDate, setDemandByDate] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [refetchKey, setRefetchKey] = useState(0);

  // `now` is captured once per mount: the 48h window is stable across a session,
  // and a fixed reference keeps the memo below from thrashing.
  const now = useMemo(() => new Date(), []);
  const windowDates = useMemo(
    () => [0, 1, 2].map((n) => ymd(new Date(now.getTime() + n * 86_400_000))),
    [now]
  );

  // Recompute when the schedule or Luna's demand bands change under us. Parties
  // already refresh live via useParties; these two are direct queries, so subscribe
  // (mirrors useSchedule's shifts channel) and bump a key to re-run the loader.
  useEffect(() => {
    const ch = supabase
      .channel('weatherwatch-inputs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => setRefetchKey((k) => k + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'demand_log' }, () => setRefetchKey((k) => k + 1))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const histStart = ymd(new Date(now.getTime() - 35 * 86_400_000));
    const windowEnd = windowDates[windowDates.length - 1];

    (async () => {
      const [staffRes, shiftRes, demandRes] = await Promise.all([
        supabase.from('staff').select('id,role'),
        // Published only — a draft schedule isn't "the schedule," so we never claim
        // understaffed off uncommitted shifts (and the weekday baseline stays committed-only).
        supabase.from('shifts').select('staff_id,date').eq('published', true).gte('date', histStart).lte('date', windowEnd),
        supabase.from('demand_log').select('business_day,predicted_band').in('business_day', windowDates),
      ]);
      if (cancelled) return;

      const staff = (staffRes.data as Pick<Staff, 'id' | 'role'>[]) || [];
      const fohIds = new Set(staff.filter((s) => FOH_ROLES.has(s.role)).map((s) => s.id));
      const shifts = (shiftRes.data as Pick<Shift, 'staff_id' | 'date'>[]) || [];

      // Per date: how many shifts of any role (does a schedule exist?) and the set
      // of distinct FOH people on the floor.
      const anyByDate = new Map<string, number>();
      const fohByDate = new Map<string, Set<number>>();
      for (const sh of shifts) {
        anyByDate.set(sh.date, (anyByDate.get(sh.date) ?? 0) + 1);
        if (fohIds.has(sh.staff_id)) {
          if (!fohByDate.has(sh.date)) fohByDate.set(sh.date, new Set());
          fohByDate.get(sh.date)!.add(sh.staff_id);
        }
      }
      const fohCount = (date: string) => fohByDate.get(date)?.size ?? 0;

      // Historical "typical" FOH for each weekday — median over PAST nights that
      // actually had a schedule (so an unstaffed/closed day doesn't drag it to 0).
      const histByWeekday = new Map<number, number[]>();
      for (const [date, count] of anyByDate) {
        if (count <= 0 || date >= windowDates[0]) continue; // history only
        const foh = fohCount(date);
        if (foh <= 0) continue; // only nights the floor actually ran inform "typical"
        const wd = new Date(`${date}T12:00:00`).getDay();
        if (!histByWeekday.has(wd)) histByWeekday.set(wd, []);
        histByWeekday.get(wd)!.push(foh);
      }
      const baselineForWeekday = (wd: number): number | null => {
        const samples = histByWeekday.get(wd);
        return samples && samples.length >= MIN_BASELINE_SAMPLES ? median(samples) : null;
      };

      const staffing: Record<string, DayStaffing> = {};
      for (const date of windowDates) {
        const hasSchedule = (anyByDate.get(date) ?? 0) > 0;
        const wd = new Date(`${date}T12:00:00`).getDay();
        // No schedule for the day yet → we can't claim "understaffed," so baseline
        // is unknown and the heat flag stays silent (honesty over a false alarm).
        staffing[date] = { foh: fohCount(date), baseline: hasSchedule ? baselineForWeekday(wd) : null };
      }

      const demand: Record<string, string | null> = {};
      for (const row of (demandRes.data as { business_day: string; predicted_band: string | null }[]) || []) {
        demand[row.business_day] = row.predicted_band;
      }

      setStaffingByDate(staffing);
      setDemandByDate(demand);
      setLoading(false);
    })().catch(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [now, windowDates, refetchKey]);

  const flags = useMemo(
    () => computeWeatherFlags({ now, daily, parties, staffingByDate, demandByDate }),
    [now, daily, parties, staffingByDate, demandByDate]
  );

  return { flags, loading };
}
