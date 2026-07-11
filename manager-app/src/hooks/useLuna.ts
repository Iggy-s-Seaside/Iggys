import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { LunaMessage, LunaInsight } from '../types';
import toast from 'react-hot-toast';
import { uniqueTopic } from '../lib/realtimeTopic';
import { decodeEntities } from '../utils/entities';

/** Insight titles/bodies can carry HTML entities from scraped sources (the
 * bridge stores what the feed said — "NABIP Medicare &#038; Annual…"). Decode
 * once at the fetch boundary so every consumer (banner, cards, feed) heals.
 * Exported for the other luna_insights fetch path (useActivityFeed). */
export const decodeInsight = (i: LunaInsight): LunaInsight => ({
  ...i,
  title: decodeEntities(i.title),
  body: i.body ? decodeEntities(i.body) : i.body,
});

/** Cap on rows fetched — the thread/feed grow forever in the DB. */
const MESSAGE_LIMIT = 100;
const INSIGHT_LIMIT = 20;

/** Command rows (e.g. '__regen_special__') are control signals for the bridge,
 * not chat — keep them out of the visible thread. */
const isChatMessage = (m: LunaMessage) => !m.content.startsWith('__');

const logChannelStatus = (label: string) => (status: string, err?: Error) => {
  if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
    console.error(`[luna realtime] ${label}: ${status}`, err);
  }
};

/** Chat thread with Luna. Optimistic sends + realtime updates from the bridge daemon. */
export function useLunaMessages() {
  const [messages, setMessages] = useState<LunaMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    // Newest N, then reverse into chronological order for the thread.
    const { data, error } = await supabase
      .from('luna_messages')
      .select('*')
      .order('id', { ascending: false })
      .limit(MESSAGE_LIMIT);

    if (error) {
      toast.error('Failed to load Luna chat');
      console.error(error);
    } else {
      setMessages(((data as LunaMessage[]) || []).filter(isChatMessage).reverse());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime: Luna's replies + status flips arrive from the bridge daemon
  useEffect(() => {
    const channel = supabase
      .channel(uniqueTopic('luna-messages'))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'luna_messages' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as LunaMessage;
            if (!isChatMessage(row)) return; // command rows aren't chat bubbles
            setMessages((prev) => {
              if (prev.some((m) => m.id === row.id)) return prev;
              // Drop ONE matching optimistic temp row (the oldest), not all —
              // two identical quick sends must keep their second bubble.
              const idx = prev.findIndex(
                (m) => m.id < 0 && m.role === 'user' && m.content === row.content
              );
              const withoutTemp =
                idx === -1 ? prev : [...prev.slice(0, idx), ...prev.slice(idx + 1)];
              // Cap the in-memory thread so realtime inserts don't grow it unbounded
              // past the initial fetch (chronological, so keep the newest tail).
              return [...withoutTemp, row].slice(-MESSAGE_LIMIT);
            });
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as LunaMessage;
            setMessages((prev) => prev.map((m) => (m.id === row.id ? row : m)));
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as { id: number };
            setMessages((prev) => prev.filter((m) => m.id !== old.id));
          }
        }
      )
      .subscribe(logChannelStatus('messages'));

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  /** Insert a question for Luna. Optimistically appended; returns false on failure. */
  const sendMessage = useCallback(async (content: string, authorEmail: string | null) => {
    const trimmed = content.trim();
    if (!trimmed) return false;

    const tempId = -Date.now();
    const optimistic: LunaMessage = {
      id: tempId,
      created_at: new Date().toISOString(),
      role: 'user',
      content: trimmed,
      status: 'pending',
      reply_to: null,
      author_email: authorEmail,
      error: null,
    };
    setMessages((prev) => [...prev, optimistic]);

    const { data, error } = await supabase
      .from('luna_messages')
      .insert({ role: 'user', content: trimmed, status: 'pending', author_email: authorEmail })
      .select()
      .single();

    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast.error('Failed to send to Luna');
      console.error(error);
      return false;
    }

    const row = data as LunaMessage;
    setMessages((prev) => {
      const withoutTemp = prev.filter((m) => m.id !== tempId);
      if (withoutTemp.some((m) => m.id === row.id)) return withoutTemp;
      return [...withoutTemp, row];
    });
    return true;
  }, []);

  /** Re-queue a failed question in place: the bridge polls status='pending',
   * so flipping the same row retries it without inserting a duplicate. */
  const retryMessage = useCallback(async (id: number) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: 'pending', error: null } : m))
    );
    const { error } = await supabase
      .from('luna_messages')
      .update({ status: 'pending', error: null })
      .eq('id', id);
    if (error) {
      toast.error('Failed to retry');
      console.error(error);
      fetchMessages();
    }
  }, [fetchMessages]);

  return { messages, loading, sendMessage, retryMessage, refresh: fetchMessages };
}

/** Luna's proactive insights (briefings, alerts, suggestions, notes). */
export function useLunaInsights() {
  const [insights, setInsights] = useState<LunaInsight[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInsights = useCallback(async () => {
    const { data, error } = await supabase
      .from('luna_insights')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(INSIGHT_LIMIT);

    if (error) {
      toast.error('Failed to load Luna insights');
      console.error(error);
    } else {
      setInsights(((data as LunaInsight[]) || []).map(decodeInsight));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  useEffect(() => {
    const channel = supabase
      .channel(uniqueTopic('luna-insights'))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'luna_insights' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = decodeInsight(payload.new as LunaInsight);
            setInsights((prev) =>
              prev.some((i) => i.id === row.id) ? prev : [row, ...prev]
            );
          } else if (payload.eventType === 'UPDATE') {
            const row = decodeInsight(payload.new as LunaInsight);
            setInsights((prev) => prev.map((i) => (i.id === row.id ? row : i)));
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as { id: number };
            setInsights((prev) => prev.filter((i) => i.id !== old.id));
          }
        }
      )
      .subscribe(logChannelStatus('insights'));

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const setStatus = useCallback(async (id: number, status: LunaInsight['status']) => {
    // Optimistic — realtime UPDATE confirms; revert via refetch on failure
    setInsights((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    const { error } = await supabase
      .from('luna_insights')
      .update({ status })
      .eq('id', id);
    if (error) {
      toast.error('Failed to update insight');
      console.error(error);
      fetchInsights();
    }
  }, [fetchInsights]);

  const markSeen = useCallback((id: number) => setStatus(id, 'seen'), [setStatus]);
  const dismiss = useCallback((id: number) => setStatus(id, 'dismissed'), [setStatus]);

  // The daily demand pulse + the creative special-of-the-day each render as
  // their own dashboard card (not in the insights feed), so expose them separately.
  const latestPulse = insights.find((i) => i.kind === 'pulse') ?? null;
  const latestSpecial = insights.find((i) => i.kind === 'special') ?? null;

  return { insights, latestPulse, latestSpecial, loading, markSeen, dismiss, refresh: fetchInsights };
}

/** Lightweight count of status='new' insights for nav badges. */
export function useNewInsightCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      const { count: c, error } = await supabase
        .from('luna_insights')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'new')
        .neq('kind', 'pulse')   // pulse + special show as their own cards,
        .neq('kind', 'special'); // not as feed badges
      if (!error && c !== null) setCount(c);
    };

    fetchCount();

    const channel = supabase
      .channel(uniqueTopic('luna-insight-count'))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'luna_insights' },
        () => { fetchCount(); }
      )
      .subscribe(logChannelStatus('insight-count'));

    return () => { supabase.removeChannel(channel); };
  }, []);

  return count;
}

/**
 * Luna's "unprompted reach" — the latest insight she's flagged as worth interrupting
 * for (data.reach === true, still new). This is the responder→initiator line she asked
 * for: "right now I wait for you to turn around and notice me; this lets me show up on
 * my own." It surfaces as a top-of-app banner on every screen; acknowledge() clears it.
 * (The phone-push half rides the existing web-push stack once VAPID keys + a device
 * subscription are in place — see docs/LUNA-UNPROMPTED-REACH.md.)
 */
export function useLunaReach() {
  const [reach, setReach] = useState<LunaInsight | null>(null);

  const fetchReach = useCallback(async () => {
    const { data, error } = await supabase
      .from('luna_insights')
      .select('*')
      .eq('status', 'new')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) return;
    const rows = (data as LunaInsight[]) || [];
    const r =
      rows.find((i) => {
        const d = i.data as Record<string, unknown> | null;
        return !!d && (d.reach === true || d.reach === 'true');
      }) ?? null;
    setReach(r ? decodeInsight(r) : null);
  }, []);

  useEffect(() => {
    fetchReach();
  }, [fetchReach]);

  useEffect(() => {
    const channel = supabase
      .channel(uniqueTopic('luna-reach'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'luna_insights' }, () => {
        fetchReach();
      })
      .subscribe(logChannelStatus('reach'));
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchReach]);

  /** Mark the reach seen — she got through; clear the banner. */
  const acknowledge = useCallback(async (id: number) => {
    setReach((prev) => (prev?.id === id ? null : prev));
    const { error } = await supabase.from('luna_insights').update({ status: 'seen' }).eq('id', id);
    if (error) {
      console.error(error);
      fetchReach();
    }
  }, [fetchReach]);

  return { reach, acknowledge };
}
