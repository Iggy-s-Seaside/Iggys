import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useCurrentShiftId } from './useChecklists';
import { todaysBusinessDay } from '../utils/businessDay';
import type { CashCount, EonReport } from '../types';

// ── Denominations (largest first) — value in CENTS keyed for the grid + jsonb ──
export const DENOMINATIONS: { cents: number; label: string }[] = [
  { cents: 10000, label: '$100' },
  { cents: 5000, label: '$50' },
  { cents: 2000, label: '$20' },
  { cents: 1000, label: '$10' },
  { cents: 500, label: '$5' },
  { cents: 100, label: '$1' },
  { cents: 25, label: '25¢' },
  { cents: 10, label: '10¢' },
  { cents: 5, label: '5¢' },
  { cents: 1, label: '1¢' },
];

/** Sum a {centsDenom: count} map into a cents total. */
export function totalFromDenominations(denoms: Record<string, number>): number {
  return Object.entries(denoms).reduce((sum, [cents, count]) => {
    const c = Number(cents);
    const n = Number(count);
    if (!Number.isFinite(c) || !Number.isFinite(n) || n <= 0) return sum;
    return sum + c * n;
  }, 0);
}

/** Format a cents integer as $X.XX (handles negatives for over/short). */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  return `${sign}$${(abs / 100).toFixed(2)}`;
}

interface EonShape {
  summary: string;
  metrics: Record<string, unknown>;
}

/**
 * Close-out spine: record a till count (counted - expected = over/short),
 * compose a preview of the End-of-Night report by gathering the shift's data
 * defensively (a missing table never throws), and generate+email the final
 * report via the generate-eon edge function.
 *
 * Works standalone (no shift open) or scoped to an optional shiftId.
 */
export function useCloseOut(shiftId?: number | null) {
  const { user } = useAuth();
  // When no explicit shift is given, scope the close-out (counts, reports,
  // close action) to today's service session — the same business-day
  // resolution Checks/Shift use — so a close past midnight files against the
  // night actually being closed. An explicit numeric shiftId still wins.
  const resolvedShiftId = useCurrentShiftId(shiftId);
  const sid = shiftId ?? resolvedShiftId;

  const [counts, setCounts] = useState<CashCount[]>([]);
  const [reports, setReports] = useState<EonReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  // ── Load existing counts + reports (scoped to the shift when given) ──
  const refresh = useCallback(async () => {
    setLoading(true);
    const countsQuery = supabase
      .from('cash_counts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    const reportsQuery = supabase
      .from('eon_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (sid != null) {
      countsQuery.eq('shift_id', sid);
      reportsQuery.eq('shift_id', sid);
    }
    const [{ data: cData, error: cErr }, { data: rData, error: rErr }] = await Promise.all([
      countsQuery,
      reportsQuery,
    ]);
    if (cErr) console.error('[cash_counts] load error:', cErr.message);
    else setCounts((cData as CashCount[]) || []);
    if (rErr) console.error('[eon_reports] load error:', rErr.message);
    else setReports((rData as EonReport[]) || []);
    setLoading(false);
  }, [sid]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ── Record a cash count ──
  const recordCashCount = useCallback(
    async (args: {
      expectedCents: number;
      denominations: Record<string, number>;
      note?: string | null;
    }): Promise<CashCount | null> => {
      setSaving(true);
      const countedCents = totalFromDenominations(args.denominations);
      const overShortCents = countedCents - args.expectedCents;
      const { data, error } = await supabase
        .from('cash_counts')
        .insert({
          shift_id: sid,
          counted_by: user?.email ?? null,
          expected_cents: Math.round(args.expectedCents),
          counted_cents: countedCents,
          over_short_cents: overShortCents,
          denominations: args.denominations,
          note: args.note?.trim() || null,
        })
        .select('*')
        .single();
      setSaving(false);
      if (error) {
        console.error('[cash_counts] insert error:', error.message);
        toast.error('Failed to save cash count. Please try again.');
        return null;
      }
      const row = data as CashCount;
      setCounts((prev) => [row, ...prev]);
      const msg =
        overShortCents === 0
          ? 'Till balanced — saved.'
          : overShortCents > 0
            ? `Saved — over by ${formatCents(overShortCents)}`
            : `Saved — short by ${formatCents(Math.abs(overShortCents))}`;
      toast.success(msg);
      return row;
    },
    [sid, user?.email]
  );

  // ── Compose a CLIENT-SIDE preview of the EON report by gathering shift data.
  //    Every SELECT is wrapped so a missing/empty table degrades gracefully. ──
  const composePreview = useCallback(async (): Promise<EonShape> => {
    // Use the SERVICE day (9am Pacific cutoff), not the raw UTC calendar date,
    // so a close run at 1am pulls the night being closed — and the preview
    // matches what the generate-eon edge function produces.
    const todayKey = todaysBusinessDay();
    const metrics: Record<string, unknown> = { date: todayKey, shift_id: sid };
    const lines: string[] = [];

    // — Events / parties happening today —
    let partiesToday = 0;
    try {
      const { data, error } = await supabase
        .from('parties')
        .select('title,contact_name,guest_count,start_time,space,space_name,status')
        .eq('event_date', todayKey);
      if (!error && data) {
        const live = data.filter((p) => p.status !== 'cancelled');
        partiesToday = live.length;
        metrics.parties = live;
        live.forEach((p) => {
          const who = p.title || p.contact_name || 'Private event';
          const guests = p.guest_count ? ` (${p.guest_count} guests)` : '';
          const where = p.space_name || p.space ? ` @ ${p.space_name || p.space}` : '';
          lines.push(`• ${who}${guests}${where}`);
        });
      }
    } catch { /* parties table absent — skip */ }

    let eventsToday = 0;
    try {
      const { data, error } = await supabase
        .from('events')
        .select('title,time,category')
        .eq('active', true)
        .eq('date', todayKey);
      if (!error && data) {
        eventsToday = data.length;
        metrics.events = data;
        data.forEach((e) => lines.push(`• ${e.title}${e.time ? ` — ${e.time}` : ''}`));
      }
    } catch { /* events table absent — skip */ }

    // — Checklist completion (opening/closing checks) —
    try {
      const q = supabase.from('checklist_runs').select('label,status,done');
      if (sid != null) q.eq('shift_id', sid);
      const { data, error } = await q;
      if (!error && data) {
        const total = data.length;
        const done = data.filter((r) => r.done === true || r.status === 'done').length;
        metrics.checklist = { total, done };
      }
    } catch { /* checklist table absent — skip */ }

    // — Line-check fails (temp/quality checks that failed) —
    try {
      const q = supabase.from('line_checks').select('label,status,passed,note');
      if (sid != null) q.eq('shift_id', sid);
      const { data, error } = await q;
      if (!error && data) {
        const fails = data.filter((r) => r.passed === false || r.status === 'fail');
        metrics.lineCheckFails = fails;
      }
    } catch { /* line_checks table absent — skip */ }

    // — Shift log highlights —
    try {
      const q = supabase
        .from('shift_log')
        .select('note,kind,created_at')
        .order('created_at', { ascending: false })
        .limit(10);
      if (sid != null) q.eq('shift_id', sid);
      const { data, error } = await q;
      if (!error && data) metrics.logHighlights = data;
    } catch { /* shift_log table absent — skip */ }

    // — Low stock at close —
    let lowStockCount = 0;
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('name,current_quantity,par_level,unit,active');
      if (!error && data) {
        const low = data.filter(
          (i) => i.active && Number(i.current_quantity) <= Number(i.par_level)
        );
        lowStockCount = low.length;
        metrics.lowStock = low;
      }
    } catch { /* inventory table absent — skip */ }

    // — Cash over/short (most recent count for this shift, else latest) —
    let cashLine = 'No till count recorded.';
    const latestCount = counts[0] ?? null;
    if (latestCount) {
      const os = latestCount.over_short_cents;
      cashLine =
        os === 0
          ? `Till balanced (${formatCents(latestCount.counted_cents)}).`
          : os > 0
            ? `Over by ${formatCents(os)} (counted ${formatCents(latestCount.counted_cents)}).`
            : `Short by ${formatCents(Math.abs(os))} (counted ${formatCents(latestCount.counted_cents)}).`;
      metrics.cash = {
        expected_cents: latestCount.expected_cents,
        counted_cents: latestCount.counted_cents,
        over_short_cents: latestCount.over_short_cents,
      };
    }

    const summary = [
      `End-of-Night — ${todayKey}`,
      '',
      `Events & parties today: ${partiesToday + eventsToday}`,
      ...lines,
      '',
      metrics.checklist
        ? `Checklist: ${(metrics.checklist as { done: number; total: number }).done}/${(metrics.checklist as { done: number; total: number }).total} complete`
        : 'Checklist: not tracked',
      `Line-check fails: ${(metrics.lineCheckFails as unknown[] | undefined)?.length ?? 0}`,
      `Low stock at close: ${lowStockCount} item${lowStockCount === 1 ? '' : 's'}`,
      '',
      `Cash: ${cashLine}`,
    ].join('\n');

    return { summary, metrics };
  }, [sid, counts]);

  // ── Generate the final EON report + email the owner via the edge function ──
  const generateAndEmail = useCallback(async (): Promise<EonReport | null> => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-eon', {
        body: { shift_id: sid, generated_by: user?.email ?? null },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Report emailed to the owner.');
      await refresh();
      return (data?.report as EonReport) ?? null;
    } catch (err) {
      console.error('[generate-eon] error:', err);
      toast.error('Could not generate & email the report.');
      return null;
    } finally {
      setGenerating(false);
    }
  }, [sid, user?.email, refresh]);

  // ── Close the bar — flip the open shift_sessions row to closed.
  //    Updated directly through supabase (NOT the shift hook) to avoid a race. ──
  const closeTheBar = useCallback(async (): Promise<boolean> => {
    try {
      let query = supabase
        .from('shift_sessions')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          closed_by: user?.email ?? null,
        })
        .eq('status', 'open');
      if (sid != null) query = query.eq('id', sid);
      const { error } = await query;
      if (error) throw error;
      toast.success('Bar closed. Good night.');
      return true;
    } catch (err) {
      console.error('[shift_sessions] close error:', err);
      toast.error('Could not close the bar. Please try again.');
      return false;
    }
  }, [sid, user?.email]);

  return {
    counts,
    reports,
    loading,
    saving,
    generating,
    refresh,
    recordCashCount,
    composePreview,
    generateAndEmail,
    closeTheBar,
  };
}
