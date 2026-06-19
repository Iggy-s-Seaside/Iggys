import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export type Band = 'SLOW' | 'STEADY' | 'BUSY' | 'PACKED';

export interface DemandRow {
  business_day: string;
  predicted_band: string | null;
  actual_band: string | null;
  hotels_full: boolean | null;
  note: string | null;
}

/**
 * The forecast-vs-actual trust loop. The bridge writes predicted_band when it
 * posts the daily pulse; the manager logs the actual via the close-out card.
 * `accuracy` = how many of Luna's last few calls she got right — the number that
 * earns the forecast its trust.
 */
export function useDemandLog() {
  const { user } = useAuth();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [todayRow, setTodayRow] = useState<DemandRow | null>(null);
  const [accuracy, setAccuracy] = useState<{ pct: number; n: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('demand_log')
      .select('business_day,predicted_band,actual_band,hotels_full,note')
      .order('business_day', { ascending: false })
      .limit(21);
    const rows = (data as DemandRow[]) || [];
    setTodayRow(rows.find((r) => r.business_day === today) ?? null);
    const scored = rows.filter((r) => r.predicted_band && r.actual_band).slice(0, 7);
    if (scored.length) {
      const hit = scored.filter((r) => r.predicted_band === r.actual_band).length;
      setAccuracy({ pct: Math.round((100 * hit) / scored.length), n: scored.length });
    } else {
      setAccuracy(null);
    }
  }, [today]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logActual = useCallback(
    async (band: Band, note?: string, hotelsFull?: boolean) => {
      setSaving(true);
      const payload: Record<string, unknown> = {
        business_day: today,
        actual_band: band,
        noted_by: user?.email ?? null,
        updated_at: new Date().toISOString(),
      };
      // The close-out "truth note" Luna asked for — one line on how the night
      // actually went; her Night Chronicle generator reads it the next morning.
      if (note !== undefined) payload.note = note.trim() || null;
      if (hotelsFull !== undefined) payload.hotels_full = hotelsFull;
      const { error } = await supabase.from('demand_log').upsert(payload, { onConflict: 'business_day' });
      setSaving(false);
      if (!error) await refresh();
      return !error;
    },
    [today, user, refresh]
  );

  return { todayRow, accuracy, saving, logActual, refresh };
}
