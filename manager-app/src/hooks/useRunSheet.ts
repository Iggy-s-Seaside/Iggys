import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useSupabaseCRUD } from './useSupabaseCRUD';
import { useParties } from './useParties';
import { useInventoryItems, getLowStockItems } from './useInventory';
import type { IggyEvent, Special, Party, InventoryItem, HappyHourItem } from '../types';

// ── Pure helpers (exported for reuse / testing) ──

/** Today's date key, matching the yyyy-MM-dd shape stored on events.date and parties.event_date. */
export function runSheetDateKey(d: Date = new Date()): string {
  return format(d, 'yyyy-MM-dd');
}

/** Human label for a single event's start time, mirroring TodaysPulse. */
export function eventTimeLabel(e: IggyEvent): string {
  if (e.all_day) return 'All day';
  if (e.time) return e.time;
  if (e.start_min != null) {
    const h = Math.floor(e.start_min / 60) % 24;
    const m = e.start_min % 60;
    const ampm = h < 12 ? 'AM' : 'PM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}${m ? ':' + String(m).padStart(2, '0') : ''} ${ampm}`;
  }
  return '';
}

/** Best-effort space label for a party (space_name is the friendly one, space the slug). */
export function partySpaceLabel(p: Party): string | null {
  return p.space_name?.trim() || p.space?.trim() || null;
}

/** Best-effort space label for an event. */
export function eventSpaceLabel(e: IggyEvent): string | null {
  return e.space?.trim() || null;
}

// ── Composed shape ──

export interface HuddleBullet {
  /** Stable key for React. */
  id: string;
  /** The plain line an MOD reads aloud. */
  text: string;
  /** Drives the accent dot color: focus = teal, push = amber, watch = red, info = muted. */
  tone: 'focus' | 'push' | 'watch' | 'info';
}

export interface RunSheet {
  dateKey: string;
  dateLabel: string;     // "Friday, June 13"
  weekday: string;       // "Friday"
  events: IggyEvent[];
  parties: Party[];
  specials: Special[];
  happyHour: HappyHourItem[];
  lowStock: InventoryItem[];
  guestsTonight: number;
  huddle: HuddleBullet[];
  loading: boolean;
}

// ── Happy-hour fetch (no dedicated hook exists; small read like useInventoryItems) ──

function useHappyHour() {
  const [items, setItems] = useState<HappyHourItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase.from('happy_hour').select('*').order('type');
      if (!active) return;
      if (!error) setItems((data as HappyHourItem[]) || []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  return { items, loading };
}

// ── Huddle composer (pure) ──

function composeHuddle(args: {
  events: IggyEvent[];
  parties: Party[];
  specials: Special[];
  happyHour: HappyHourItem[];
  lowStock: InventoryItem[];
  guestsTonight: number;
}): HuddleBullet[] {
  const { events, parties, specials, happyHour, lowStock, guestsTonight } = args;
  const bullets: HuddleBullet[] = [];

  // 1) Events tonight — what's drawing the room.
  if (events.length > 0) {
    const list = events
      .map((e) => {
        const t = eventTimeLabel(e);
        const where = eventSpaceLabel(e);
        return `${e.title}${t ? ` at ${t}` : ''}${where ? ` in the ${where}` : ''}`;
      })
      .join('; ');
    bullets.push({
      id: 'events',
      tone: 'focus',
      text:
        events.length === 1
          ? `Tonight we've got ${list} — let's give it energy.`
          : `${events.length} things on tonight: ${list}.`,
    });
  }

  // 2) Confirmed parties — the bookings the floor must protect.
  if (parties.length > 0) {
    const parts = parties.map((p) => {
      const name = p.title?.trim() || p.contact_name;
      const where = partySpaceLabel(p);
      const setup = p.setup_time?.trim();
      const guests = p.guest_count != null ? `${p.guest_count} guests` : null;
      const bits = [guests, where ? `in the ${where}` : null, setup ? `set up by ${setup}` : null]
        .filter(Boolean)
        .join(', ');
      return `${name}${bits ? ` (${bits})` : ''}`;
    });
    const guestTail = guestsTonight > 0 ? ` That's ${guestsTonight} booked guests on top of walk-ins.` : '';
    bullets.push({
      id: 'parties',
      tone: 'focus',
      text:
        parties.length === 1
          ? `Private booking: ${parts[0]}.${guestTail}`
          : `${parties.length} private bookings — ${parts.join('; ')}.${guestTail}`,
    });

    // Surface explicit special requests so nothing gets missed at the table.
    const requests = parties
      .filter((p) => p.special_requests?.trim())
      .map((p) => `${p.title?.trim() || p.contact_name}: ${p.special_requests!.trim()}`);
    if (requests.length > 0) {
      bullets.push({
        id: 'party-requests',
        tone: 'watch',
        text: `Special requests to honor — ${requests.join(' | ')}.`,
      });
    }
  }

  // 3) Specials + happy hour to push.
  const specialTitles = specials.map((s) => s.title.trim()).filter(Boolean);
  if (specialTitles.length > 0) {
    bullets.push({
      id: 'specials',
      tone: 'push',
      text:
        specialTitles.length === 1
          ? `Push the special: ${specialTitles[0]}. Lead with it on every table.`
          : `Specials to push: ${specialTitles.join(', ')}. Suggest one to every table.`,
    });
  }
  if (happyHour.length > 0) {
    const drinks = happyHour.filter((h) => h.type === 'drink').length;
    bullets.push({
      id: 'happy-hour',
      tone: 'push',
      text: `Happy hour is live (${happyHour.length} item${happyHour.length === 1 ? '' : 's'}${
        drinks ? `, ${drinks} drink${drinks === 1 ? '' : 's'}` : ''
      }) — mention it the moment guests sit down.`,
    });
  }

  // 4) Low stock that matters tonight — don't 86 by surprise.
  if (lowStock.length > 0) {
    const names = lowStock.slice(0, 5).map((i) => i.name);
    const more = lowStock.length > 5 ? ` +${lowStock.length - 5} more` : '';
    bullets.push({
      id: 'low-stock',
      tone: 'watch',
      text: `Running low — ${names.join(', ')}${more}. Check before you promise it, flag the bar if we 86 anything.`,
    });
  }

  // 5) Always close with a floor line. If it's a quiet night, this is the whole huddle.
  bullets.push({
    id: 'close',
    tone: 'info',
    text:
      bullets.length === 0
        ? 'Quiet night on the books — steady service, push specials, keep the room warm and we set up tomorrow to win.'
        : 'Phones charged, sections covered, water and clean glassware first. Take care of each other out there.',
  });

  // Guarantee 3-6 bullets: pad a thin night, cap a heavy one (keep the close).
  if (bullets.length < 3) {
    if (!bullets.find((b) => b.id === 'specials') && specialTitles.length === 0) {
      bullets.splice(bullets.length - 1, 0, {
        id: 'upsell',
        tone: 'push',
        text: 'No special running — lean on cocktails and the kitchen favorites to lift the check average.',
      });
    }
    if (bullets.length < 3) {
      bullets.splice(bullets.length - 1, 0, {
        id: 'service',
        tone: 'info',
        text: 'Greet within two minutes, read the table, and own any problem until it is fixed.',
      });
    }
  }
  if (bullets.length > 6) {
    const close = bullets[bullets.length - 1];
    return [...bullets.slice(0, 5), close];
  }

  return bullets;
}

// ── Main hook ──

/**
 * Composes tonight's run-sheet from the tables the app already owns — no new
 * storage. Mirrors the Dashboard/TodaysPulse "today" logic: an event counts for
 * tonight if it's dated today OR it's a recurring event whose recurring_day is
 * today's weekday. Parties count when confirmed and dated today.
 */
export function useRunSheet(): RunSheet {
  const { data: events, loading: eventsLoading } = useSupabaseCRUD<IggyEvent>('events');
  const { data: specials, loading: specialsLoading } = useSupabaseCRUD<Special>('specials');
  const { parties: allParties, loading: partiesLoading } = useParties();
  const { items: inventory, loading: inventoryLoading } = useInventoryItems();
  const { items: happyHour, loading: happyHourLoading } = useHappyHour();

  const dateKey = runSheetDateKey();
  const weekday = format(new Date(), 'EEEE');
  const dateLabel = format(new Date(), 'EEEE, MMMM d');

  const tonightEvents = useMemo(
    () =>
      events
        .filter((e) => e.active && (e.date === dateKey || (e.is_recurring && e.recurring_day === weekday)))
        .sort((a, b) => (a.start_min ?? 9999) - (b.start_min ?? 9999)),
    [events, dateKey, weekday]
  );

  const todaysParties = useMemo(
    () =>
      allParties
        .filter((p) => p.status === 'confirmed' && p.event_date === dateKey)
        .sort((a, b) => {
          const am = a.start_min ?? 9999;
          const bm = b.start_min ?? 9999;
          if (am !== bm) return am - bm;
          return (a.setup_time ?? '').localeCompare(b.setup_time ?? '');
        }),
    [allParties, dateKey]
  );

  const activeSpecials = useMemo(() => specials.filter((s) => s.active), [specials]);
  const lowStock = useMemo(() => getLowStockItems(inventory), [inventory]);
  const guestsTonight = useMemo(
    () => todaysParties.reduce((sum, p) => sum + (p.guest_count ?? 0), 0),
    [todaysParties]
  );

  const huddle = useMemo(
    () =>
      composeHuddle({
        events: tonightEvents,
        parties: todaysParties,
        specials: activeSpecials,
        happyHour,
        lowStock,
        guestsTonight,
      }),
    [tonightEvents, todaysParties, activeSpecials, happyHour, lowStock, guestsTonight]
  );

  const loading =
    eventsLoading || specialsLoading || partiesLoading || inventoryLoading || happyHourLoading;

  return {
    dateKey,
    dateLabel,
    weekday,
    events: tonightEvents,
    parties: todaysParties,
    specials: activeSpecials,
    happyHour,
    lowStock,
    guestsTonight,
    huddle,
    loading,
  };
}

/** Re-export for pages that want to format an event date consistently. */
export function formatRunSheetDate(d: string): string {
  try {
    return format(parseISO(d), 'EEE, MMM d');
  } catch {
    return d;
  }
}
