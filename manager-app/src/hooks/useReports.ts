import { useEffect, useMemo, useState } from 'react';
import { addDays, format, parseISO, startOfMonth, subMonths } from 'date-fns';
import { supabase } from '../lib/supabase';
import { computeInvoice, partyToInvoiceInputs } from '../utils/invoice';
import type { Party, PartyPackage } from '../types';
import { useParties } from './useParties';
import type { Space } from '../lib/timeWindows';

export interface MonthRevenue {
  /** First-of-month ISO date, e.g. "2026-04-01" — stable sort/compare key. */
  key: string;
  /** Short display label, e.g. "Apr". */
  label: string;
  revenue: number;
  /** Number of confirmed events booked in this month. */
  events: number;
}

export interface SpaceRevenue {
  space: Space;
  label: string;
  revenue: number;
  events: number;
}

export interface ReportsData {
  loading: boolean;
  /** All confirmed parties had a non-zero invoice computed. */
  totalRevenue: number;
  /** Trailing-12-months revenue, oldest → newest (always 12 buckets, zero-filled). */
  byMonth: MonthRevenue[];
  /** Revenue split across the three physical spaces (null space folds into "whole"). */
  bySpace: SpaceRevenue[];
  /** inquiries that became confirmed / all non-cancelled inquiries, as a 0–100 percentage. */
  conversionPct: number;
  /** Count of confirmed parties (the denominator for avg event value). */
  confirmedCount: number;
  /** Count of all inquiries ever received (inquiry + confirmed + cancelled). */
  inquiryCount: number;
  /** Average grand-total across confirmed parties with billing data. */
  avgEventValue: number;
  /** Confirmed $ on the books for events dated in the next 90 days. */
  forwardBook90: number;
  /** Confirmed events count in the next 90 days. */
  forwardBookCount: number;
  /** Month-over-month revenue delta (latest full month vs the one before), as a %. */
  momRevenuePct: number | null;
}

const SPACE_LABELS: Record<Space, string> = {
  upstairs: 'Upstairs',
  downstairs: 'Downstairs',
  whole: 'Whole building',
};

/** Conservative bucket: legacy/null space rows count as "whole" (matches booking-conflict logic). */
function spaceOf(p: Party): Space {
  const s = p.space as Space | null;
  return s === 'upstairs' || s === 'downstairs' || s === 'whole' ? s : 'whole';
}

function pctChange(curr: number, prev: number): number | null {
  if (prev <= 0) return null;
  return ((curr - prev) / prev) * 100;
}

/**
 * Owner-facing revenue analytics, computed entirely from the parties the bar already
 * books — zero POS required. Loads every party_packages row once (mirrors the Invoices
 * page) and runs computeInvoice per confirmed party so totals match invoices exactly.
 */
export function useReports(): ReportsData {
  const { parties, loading: partiesLoading } = useParties();
  const [linesByParty, setLinesByParty] = useState<Record<number, PartyPackage[]>>({});
  const [linesLoading, setLinesLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.from('party_packages').select('*');
      if (!active) return;
      const grouped: Record<number, PartyPackage[]> = {};
      for (const row of (data as PartyPackage[]) || []) {
        (grouped[row.party_id] ??= []).push(row);
      }
      setLinesByParty(grouped);
      setLinesLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  return useMemo<ReportsData>(() => {
    const loading = partiesLoading || linesLoading;

    const totalOf = (p: Party) =>
      computeInvoice(partyToInvoiceInputs(p), linesByParty[p.id] || []).grandTotal;

    const confirmed = parties.filter((p) => p.status === 'confirmed');
    const confirmedValues = confirmed.map((p) => ({ party: p, total: totalOf(p) }));

    const totalRevenue = confirmedValues.reduce((s, c) => s + c.total, 0);

    // ── Conversion: confirmed / (all inquiries ever, excluding nothing — cancelled count too) ──
    const inquiryCount = parties.length;
    const confirmedCount = confirmed.length;
    // Conversion measures of every lead that wasn't cancelled, how many we closed.
    const decided = parties.filter((p) => p.status === 'confirmed' || p.status === 'cancelled').length;
    const conversionPct = decided > 0 ? (confirmedCount / decided) * 100 : 0;

    // ── Average event value (confirmed parties that actually have billing) ──
    const billed = confirmedValues.filter((c) => c.total > 0);
    const avgEventValue = billed.length > 0 ? billed.reduce((s, c) => s + c.total, 0) / billed.length : 0;

    // ── Revenue by space ──
    const spaceTotals: Record<Space, { revenue: number; events: number }> = {
      upstairs: { revenue: 0, events: 0 },
      downstairs: { revenue: 0, events: 0 },
      whole: { revenue: 0, events: 0 },
    };
    for (const { party, total } of confirmedValues) {
      const bucket = spaceTotals[spaceOf(party)];
      bucket.revenue += total;
      bucket.events += 1;
    }
    const bySpace: SpaceRevenue[] = (Object.keys(spaceTotals) as Space[]).map((space) => ({
      space,
      label: SPACE_LABELS[space],
      revenue: spaceTotals[space].revenue,
      events: spaceTotals[space].events,
    }));

    // ── Trailing 12 months (zero-filled), keyed by the confirmed party's event_date ──
    const now = new Date();
    const months: MonthRevenue[] = [];
    const monthIndex: Record<string, number> = {};
    for (let i = 11; i >= 0; i--) {
      const d = startOfMonth(subMonths(now, i));
      const key = format(d, 'yyyy-MM-dd');
      monthIndex[key] = months.length;
      months.push({ key, label: format(d, 'MMM'), revenue: 0, events: 0 });
    }
    for (const { party, total } of confirmedValues) {
      if (!party.event_date) continue;
      let d: Date;
      try {
        d = parseISO(party.event_date);
      } catch {
        continue;
      }
      const key = format(startOfMonth(d), 'yyyy-MM-dd');
      const idx = monthIndex[key];
      if (idx == null) continue; // outside the trailing-12 window
      months[idx].revenue += total;
      months[idx].events += 1;
    }

    // ── Month-over-month: last fully elapsed month vs the one before it ──
    const lastFullKey = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');
    const prevFullKey = format(startOfMonth(subMonths(now, 2)), 'yyyy-MM-dd');
    const lastFull = months[monthIndex[lastFullKey]]?.revenue ?? 0;
    const prevFull = months[monthIndex[prevFullKey]]?.revenue ?? 0;
    const momRevenuePct = pctChange(lastFull, prevFull);

    // ── Forward book: confirmed $ for events dated today → +90 days ──
    const horizon = addDays(now, 90);
    const todayStr = format(now, 'yyyy-MM-dd');
    const horizonStr = format(horizon, 'yyyy-MM-dd');
    let forwardBook90 = 0;
    let forwardBookCount = 0;
    for (const { party, total } of confirmedValues) {
      if (!party.event_date) continue;
      if (party.event_date >= todayStr && party.event_date <= horizonStr) {
        forwardBook90 += total;
        forwardBookCount += 1;
      }
    }

    return {
      loading,
      totalRevenue,
      byMonth: months,
      bySpace,
      conversionPct,
      confirmedCount,
      inquiryCount,
      avgEventValue,
      forwardBook90,
      forwardBookCount,
      momRevenuePct,
    };
  }, [parties, linesByParty, partiesLoading, linesLoading]);
}
