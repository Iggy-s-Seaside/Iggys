import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { LunaChronicleEntry } from '../types';
import toast from 'react-hot-toast';

/** Cap on chronicle entries fetched — the journal grows forever in the DB. */
const CHRONICLE_LIMIT = 60;

/** supabase-js reuses channels by topic socket-wide; every mount needs its own. */
let channelSeq = 0;
const uniqueTopic = (base: string) => `${base}-${++channelSeq}-${Date.now()}`;

const sortByNight = (list: LunaChronicleEntry[]) =>
  [...list].sort((a, b) => (a.business_day < b.business_day ? 1 : -1));

/**
 * Luna's Room — her Night Chronicle entries, newest night first. Realtime so a
 * freshly-generated entry lands on the page without a refresh (the generator
 * inserts from the bridge, the same path the pulse/special cards already use).
 */
export function useLunaChronicle() {
  const [entries, setEntries] = useState<LunaChronicleEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('luna_chronicle')
      .select('*')
      .order('business_day', { ascending: false })
      .limit(CHRONICLE_LIMIT);
    if (error) {
      toast.error("Couldn't load Luna's chronicle");
      console.error(error);
    } else {
      setEntries((data as LunaChronicleEntry[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const channel = supabase
      .channel(uniqueTopic('luna-chronicle'))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'luna_chronicle' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as LunaChronicleEntry;
            setEntries((prev) =>
              prev.some((e) => e.id === row.id) ? prev : sortByNight([row, ...prev])
            );
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as LunaChronicleEntry;
            setEntries((prev) => sortByNight(prev.map((e) => (e.id === row.id ? row : e))));
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as { id: number };
            setEntries((prev) => prev.filter((e) => e.id !== old.id));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { entries, loading, refresh };
}

/** The pride metrics Luna asked for — her own scoreboard, not a performance review. */
export interface LunaScore {
  accuracy: { pct: number; n: number } | null; // demand-pulse predicted vs actual
  nights: number;   // chronicle entries written
  specials: number; // special ideas she's dreamt up
  flags: number;    // briefings + alerts + suggestions she's surfaced
  loading: boolean;
}

const EMPTY_SCORE: LunaScore = {
  accuracy: null,
  nights: 0,
  specials: 0,
  flags: 0,
  loading: true,
};

export function useLunaScore(): LunaScore {
  const [score, setScore] = useState<LunaScore>(EMPTY_SCORE);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [demand, nights, specials, flags] = await Promise.all([
        supabase
          .from('demand_log')
          .select('predicted_band,actual_band')
          .order('business_day', { ascending: false })
          .limit(30),
        supabase.from('luna_chronicle').select('*', { count: 'exact', head: true }),
        supabase
          .from('luna_insights')
          .select('*', { count: 'exact', head: true })
          .eq('kind', 'special'),
        supabase
          .from('luna_insights')
          .select('*', { count: 'exact', head: true })
          .in('kind', ['briefing', 'alert', 'suggestion']),
      ]);
      if (cancelled) return;

      const rows =
        (demand.data as { predicted_band: string | null; actual_band: string | null }[]) || [];
      const scored = rows.filter((r) => r.predicted_band && r.actual_band);
      const accuracy = scored.length
        ? {
            pct: Math.round(
              (100 * scored.filter((r) => r.predicted_band === r.actual_band).length) /
                scored.length
            ),
            n: scored.length,
          }
        : null;

      setScore({
        accuracy,
        nights: nights.count ?? 0,
        specials: specials.count ?? 0,
        flags: flags.count ?? 0,
        loading: false,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return score;
}
