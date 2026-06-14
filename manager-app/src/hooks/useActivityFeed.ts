import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getLowStockItems } from './useInventory';
import { todayBounds } from './useReservations';
import type {
  Party,
  Message,
  LunaInsight,
  Review,
  InventoryItem,
} from '../types';

/**
 * useActivityFeed — one unified, time-sorted activity stream that aggregates the
 * meaningful realtime events already firing across the app into a single feed
 * the {@link NotificationBell} / {@link NotificationCenter} render.
 *
 * Sources (each already realtime elsewhere): new party inquiries, unread inbox
 * messages, fresh Luna insights, low-stock inventory, tonight's reservations and
 * recent reviews. Rather than mount every feature hook (each opens its own
 * channel and fires its own toasts), this hook does focused recent-row fetches
 * and opens ONE realtime channel covering the relevant tables — lighter, and it
 * never double-toasts.
 *
 * "Seen" state is a single high-water timestamp in localStorage
 * (`iggys.activity.lastSeen`): everything created after it counts as unseen.
 */

export type ActivityKind =
  | 'party'
  | 'message'
  | 'insight'
  | 'inventory'
  | 'reservation'
  | 'review';

export interface ActivityItem {
  /** Stable, source-prefixed id so cross-source ids never collide. */
  id: string;
  kind: ActivityKind;
  title: string;
  subtitle?: string;
  /** ISO timestamp used for sorting + relative-time display. */
  time: string;
  /** In-app route this item deep-links to on tap. */
  to: string;
  /** True once `time` is at/before the stored last-seen high-water mark. */
  read: boolean;
}

const LAST_SEEN_KEY = 'iggys.activity.lastSeen';

/** Cap per source so a noisy table can't flood the panel. */
const PER_SOURCE_LIMIT = 15;
/** Hard cap on the merged feed. */
const FEED_LIMIT = 40;

function readLastSeen(): number {
  if (typeof window === 'undefined') return 0;
  const raw = window.localStorage.getItem(LAST_SEEN_KEY);
  const ms = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(ms) ? ms : 0;
}

export function useActivityFeed() {
  const [parties, setParties] = useState<Party[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [insights, setInsights] = useState<LunaInsight[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [reservations, setReservations] = useState<
    { id: number; guest_name: string; party_size: number; reserved_for: string; created_at: string }[]
  >([]);
  const [reviews, setReviews] = useState<Review[]>([]);

  // Bumped whenever markAllSeen runs so derived `read` flags + unseenCount
  // recompute against the new high-water mark.
  const [lastSeen, setLastSeen] = useState<number>(() => readLastSeen());

  const refresh = useCallback(async () => {
    const { startISO, endISO } = todayBounds();
    const [partyRes, msgRes, insightRes, invRes, resvRes, revRes] = await Promise.all([
      supabase
        .from('parties')
        .select('id, contact_name, title, event_date, guest_count, status, created_at')
        .eq('status', 'inquiry')
        .order('created_at', { ascending: false })
        .limit(PER_SOURCE_LIMIT),
      supabase
        .from('messages')
        .select('id, name, subject, created_at, status')
        .eq('status', 'unread')
        .order('created_at', { ascending: false })
        .limit(PER_SOURCE_LIMIT),
      supabase
        .from('luna_insights')
        .select('id, kind, title, body, status, created_at')
        .neq('status', 'dismissed')
        .order('created_at', { ascending: false })
        .limit(PER_SOURCE_LIMIT),
      supabase
        .from('inventory_items')
        .select('id, name, current_quantity, par_level, unit, active, created_at, category_id')
        .eq('active', true),
      supabase
        .from('reservations')
        .select('id, guest_name, party_size, reserved_for, created_at')
        .gte('reserved_for', startISO)
        .lt('reserved_for', endISO)
        .order('created_at', { ascending: false })
        .limit(PER_SOURCE_LIMIT),
      supabase
        .from('reviews')
        .select('id, author, rating, body, source, created_at')
        .order('created_at', { ascending: false })
        .limit(PER_SOURCE_LIMIT),
    ]);

    if (!partyRes.error) setParties((partyRes.data as Party[]) || []);
    if (!msgRes.error) setMessages((msgRes.data as Message[]) || []);
    if (!insightRes.error) setInsights((insightRes.data as LunaInsight[]) || []);
    if (!invRes.error) setInventory((invRes.data as InventoryItem[]) || []);
    if (!resvRes.error)
      setReservations(
        (resvRes.data as {
          id: number;
          guest_name: string;
          party_size: number;
          reserved_for: string;
          created_at: string;
        }[]) || []
      );
    if (!revRes.error) setReviews((revRes.data as Review[]) || []);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // One channel for every source table — any change re-pulls the focused
  // queries. Cheaper than six feature channels and keeps the feed authoritative.
  useEffect(() => {
    const channel = supabase
      .channel(`activity-feed-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parties' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'luna_insights' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  const items = useMemo<ActivityItem[]>(() => {
    const out: ActivityItem[] = [];

    for (const p of parties) {
      const label = p.title?.trim() || p.contact_name || 'New inquiry';
      const pieces = [
        p.contact_name && p.title ? p.contact_name : null,
        p.guest_count ? `${p.guest_count} guests` : null,
      ].filter(Boolean);
      out.push({
        id: `party-${p.id}`,
        kind: 'party',
        title: `New inquiry: ${label}`,
        subtitle: pieces.join(' · ') || undefined,
        time: p.created_at,
        to: `/parties/${p.id}`,
        read: false,
      });
    }

    for (const m of messages) {
      out.push({
        id: `message-${m.id}`,
        kind: 'message',
        title: m.subject?.trim() || 'New message',
        subtitle: m.name ? `From ${m.name}` : undefined,
        time: m.created_at,
        to: '/messages',
        read: false,
      });
    }

    for (const i of insights) {
      out.push({
        id: `insight-${i.id}`,
        kind: 'insight',
        title: i.title,
        subtitle: i.body?.trim() || undefined,
        time: i.created_at,
        to: '/luna',
        read: false,
      });
    }

    for (const r of reservations) {
      out.push({
        id: `reservation-${r.id}`,
        kind: 'reservation',
        title: `Reservation: ${r.guest_name}`,
        subtitle: `Party of ${r.party_size}`,
        time: r.created_at ?? r.reserved_for,
        to: '/reservations',
        read: false,
      });
    }

    for (const r of reviews) {
      const stars = '★'.repeat(Math.max(0, Math.min(5, r.rating)));
      out.push({
        id: `review-${r.id}`,
        kind: 'review',
        title: `New review${r.author ? ` from ${r.author}` : ''}`,
        subtitle: [stars || undefined, r.body?.trim()].filter(Boolean).join(' · ') || undefined,
        time: r.created_at,
        to: '/reputation',
        read: false,
      });
    }

    // Low stock is a state, not an event — synthesize one item per low item,
    // timestamped to its row so it sorts sensibly and respects last-seen.
    for (const item of getLowStockItems(inventory)) {
      out.push({
        id: `inventory-${item.id}`,
        kind: 'inventory',
        title: `Low stock: ${item.name}`,
        subtitle: `${item.current_quantity} ${item.unit} left · par ${item.par_level}`,
        time: item.created_at,
        to: '/inventory',
        read: false,
      });
    }

    // Newest first, then stamp read against the high-water mark and cap.
    out.sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
    return out.slice(0, FEED_LIMIT).map((it) => ({
      ...it,
      read: Date.parse(it.time) <= lastSeen,
    }));
  }, [parties, messages, insights, reservations, reviews, inventory, lastSeen]);

  const unseenCount = useMemo(() => items.filter((it) => !it.read).length, [items]);

  const markAllSeen = useCallback(() => {
    const now = new Date().toISOString();
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LAST_SEEN_KEY, now);
    }
    setLastSeen(Date.parse(now));
  }, []);

  return { items, unseenCount, markAllSeen, refresh };
}
