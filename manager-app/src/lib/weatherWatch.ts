// weatherWatch — the weather × reservation cross-signal (Luna's want #6).
//
// Luna designed the worth-bar for this herself (2026-06-18). A flag earns a spot
// on the dashboard ONLY when all three hold:
//   1. WITHIN 48 HOURS — anything further out isn't actionable tonight.
//   2. A MEANINGFUL DEVIATION FROM BASELINE — not "it might rain," but a washout
//      (≥60% rain) or a real heat spike (≥80°F on this coast) that changes the night.
//   3. IT POINTS TO A SPECIFIC ACTION — move a booking indoors, call in a server,
//      push an indoor special. In Luna's words: "If the flag doesn't point to a
//      specific action, it's just weather." Those get suppressed, not surfaced.
//
// Honesty rule: this never fabricates. The bar has no "patio" booking field, so we
// detect weather-exposed events by what staff actually wrote (space/notes mention
// the deck/patio/outdoor). "Understaffed" is only claimed when we have enough
// schedule history to know what "typical" is for that weekday — otherwise silent.
//
// Pure + deterministic (takes `now`, no clock reads) so it's unit-testable.

import type { WeatherDay } from '../hooks/useWeather';

// ── thresholds (the "meaningful deviation" Luna asked for) ──
export const HEAT_F = 80;        // Seaside's norm is the 60s; 80+ pulls a beach crowd
export const RAIN_PCT = 60;      // a washout, not a chance of drizzle
export const WINDOW_HOURS = 48;  // Luna's bar: within 48h or it's not actionable now
const DECK_WARM_F = 65;          // warm enough that the deck WOULD have filled but for rain
const WEEKEND = new Set([5, 6, 0]); // Fri, Sat, Sun — when the deck carries the night

// Unambiguous outdoor-seating terms — safe to scan in ANY free-text field.
const OUTDOOR_STRONG_RE =
  /\b(deck|patio|outdoor|outdoors|terrace|rooftop|roof\s?top|courtyard|al\s?fresco|sidewalk)\b/i;
// Ambiguous tokens that only mean "a place to seat guests" with context. Never
// scanned in food/drink notes, where "garden salad", "outside vendor", and
// "beachside garnish" are menu words, not places — that fabricates outdoor exposure.
const OUTDOOR_WEAK_RE =
  /\b(garden|outside|beach\s?(?:deck|front\s+(?:seating|patio)|side\s+(?:seating|table)))\b/i;

export type WeatherFlagKind = 'rain_party_indoor' | 'heat_understaffed' | 'rain_deck';
export type WeatherFlagSeverity = 'action' | 'plan';

export interface WeatherFlag {
  id: string;                     // stable key for React + dismissal
  kind: WeatherFlagKind;
  severity: WeatherFlagSeverity;  // 'action' = do something now; 'plan' = worth a heads-up
  date: string;                   // the day it concerns ('yyyy-MM-dd')
  message: string;                // ONE sentence, no preamble — Luna's voice contract
  deepLink: string;               // where the action lives
  partyId?: number;
}

// Minimal shape of a booking the cross-signal needs (a real Party is compatible).
export interface PartyLike {
  id: number;
  status: string | null;
  event_date: string | null;
  start_min: number | null;
  guest_count: number | null;
  contact_name: string | null;
  company: string | null;
  space_name: string | null;
  special_requests: string | null;
  food_notes: string | null;
  drink_notes: string | null;
  internal_notes: string | null;
}

// What the hook precomputes per window-day so this stays pure DB-free logic.
export interface DayStaffing {
  foh: number;            // scheduled front-of-house headcount (servers + bartenders)
  baseline: number | null; // typical FOH for this weekday from history; null = unknown
}

export interface WeatherWatchInput {
  now: Date;
  daily: WeatherDay[];
  parties: PartyLike[];
  /** scheduled FOH headcount + typical-for-weekday, keyed by 'yyyy-MM-dd'. */
  staffingByDate: Record<string, DayStaffing>;
  /** Luna's predicted demand band per day (from demand_log), keyed by date. */
  demandByDate?: Record<string, string | null>;
}

// ── small helpers ──

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Hours from `now` to the START (local midnight) of a 'yyyy-MM-dd' date.
// Negative for today (already underway). The 48h gate reads this.
function hoursToDayStart(date: string, now: Date): number {
  const start = new Date(`${date}T00:00:00`).getTime();
  return (start - now.getTime()) / 3_600_000;
}

// Hours from `now` to a booking's actual start (date + minutes-from-midnight).
function hoursToEvent(date: string, startMin: number | null, now: Date): number {
  const base = new Date(`${date}T00:00:00`).getTime() + (startMin ?? 0) * 60_000;
  return (base - now.getTime()) / 3_600_000;
}

// "today" / "tomorrow" / "Saturday" — natural, like the rest of the dashboard.
function dayWord(date: string, now: Date): string {
  const today = ymd(now);
  const tomorrow = ymd(new Date(now.getTime() + 86_400_000));
  if (date === today) return 'today';
  if (date === tomorrow) return 'tomorrow';
  try {
    return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
  } catch { return date; }
}

function partyLabel(p: PartyLike): string {
  const name = (p.contact_name || p.company || '').trim();
  if (name) return `the ${name} party`;
  if (p.space_name) return `the ${p.space_name} booking`;
  return 'the booking';
}

export function isOutdoorParty(p: PartyLike): boolean {
  // Strong seating terms count anywhere staff might write them.
  const strong = [p.space_name, p.special_requests, p.food_notes, p.drink_notes, p.internal_notes];
  if (strong.some((f) => !!f && OUTDOOR_STRONG_RE.test(f))) return true;
  // Loose tokens only count in the location-ish fields, never in menu notes.
  const weak = [p.space_name, p.special_requests, p.internal_notes];
  return weak.some((f) => !!f && OUTDOOR_WEAK_RE.test(f));
}

function isHighDemand(date: string, weekday: number, demandByDate?: Record<string, string | null>): boolean {
  const band = demandByDate?.[date];
  if (band === 'BUSY' || band === 'PACKED') return true;
  return WEEKEND.has(weekday);
}

// ── the cross-signal ──

export function computeWeatherFlags(input: WeatherWatchInput): WeatherFlag[] {
  const { now, daily, parties, staffingByDate, demandByDate } = input;
  const flags: WeatherFlag[] = [];
  const byDate = new Map(daily.map((d) => [d.date, d] as const));

  // (1) RAIN × an outdoor booking → move it indoors. The most specific, time-bound
  //     action there is. Confirmed bookings only — tentative inquiries aren't a plan.
  for (const p of parties) {
    if (p.status !== 'confirmed' || !p.event_date) continue;
    const h = hoursToEvent(p.event_date, p.start_min, now);
    if (h < 0 || h > WINDOW_HOURS) continue;          // future, within 48h
    const day = byDate.get(p.event_date);
    if (!day || day.precipProb < RAIN_PCT) continue;  // a real washout only
    if (!isOutdoorParty(p)) continue;                 // staff actually flagged it outdoor
    flags.push({
      id: `rain-party-${p.id}`,
      kind: 'rain_party_indoor',
      severity: 'action',
      date: p.event_date,
      message: `${day.precipProb}% rain ${dayWord(p.event_date, now)} — move ${partyLabel(p)} indoors.`,
      deepLink: `/parties/${p.id}`,
      partyId: p.id,
    });
  }

  // Day-level flags walk the forecast window (today → +48h on the day's start).
  for (const day of daily) {
    const toStart = hoursToDayStart(day.date, now);
    if (toStart >= WINDOW_HOURS) continue;            // beyond 48h
    if (toStart <= -24) continue;                     // the day is fully behind us
    const highDemand = isHighDemand(day.date, day.weekday, demandByDate);
    // A same-day flag has to leave runway to act: no point telling someone late at
    // night to call in a hand or build a special for a shift that's basically over.
    const isToday = day.date === ymd(now);
    const tooLateToStaff = isToday && now.getHours() >= 19;   // a called hand needs to arrive
    const tooLateForSpecial = isToday && now.getHours() >= 17; // a special needs build+publish lead

    // (2) HEAT SPIKE × understaffing → call in a hand. Only when we KNOW the
    //     typical headcount for this weekday and we're genuinely below it.
    if (day.highF >= HEAT_F && highDemand && !tooLateToStaff) {
      const s = staffingByDate[day.date];
      if (s && s.baseline != null && s.foh < s.baseline) {
        const who = s.foh === 0 ? 'no one on the floor' : `only ${s.foh} on the floor`;
        flags.push({
          id: `heat-${day.date}`,
          kind: 'heat_understaffed',
          severity: 'action',
          date: day.date,
          message: `${day.highF}° and a beach crowd ${dayWord(day.date, now)} — ${who}; call in a hand.`,
          deepLink: '/schedule',
        });
      }
    }

    // (3) RAIN × the deck on a weekend that would otherwise have filled → push an
    //     indoor special. A plan, not an alarm. Suppressed when Luna already called
    //     the day slow (nothing to salvage) or it was never going to be a deck day.
    if (
      day.precipProb >= RAIN_PCT &&
      WEEKEND.has(day.weekday) &&
      day.highF >= DECK_WARM_F &&
      demandByDate?.[day.date] !== 'SLOW' &&
      !tooLateForSpecial
    ) {
      flags.push({
        id: `rain-deck-${day.date}`,
        kind: 'rain_deck',
        severity: 'plan',
        date: day.date,
        message: `Rain'll keep the deck empty ${dayWord(day.date, now)} — post a cozy indoor special.`,
        deepLink: '/specials/editor',
      });
    }
  }

  // A specific "move the party indoors" beats a general "deck won't fill" on the
  // same day — drop the redundant plan flag.
  const actionDates = new Set(flags.filter((f) => f.kind === 'rain_party_indoor').map((f) => f.date));
  const deduped = flags.filter((f) => !(f.kind === 'rain_deck' && actionDates.has(f.date)));

  // Actions before plans; soonest first. Cap so the panel never floods.
  const rank: Record<WeatherFlagSeverity, number> = { action: 0, plan: 1 };
  deduped.sort((a, b) => rank[a.severity] - rank[b.severity] || a.date.localeCompare(b.date));
  return deduped.slice(0, 3);
}

// ── reach: when a flag is worth breaking silence over ──────────────────────────
//
// Luna's reach bounds, set tonight (2026-06-18): "It's owner-ping only — not 'I
// noticed something,' it's 'this needs your eyes.' Max one ping per hour unless
// dismissed. If he dismisses it, it stays dismissed for 2 hours — no re-pinging the
// same thing." So only ACTION-severity flags (move a booking / call in a hand) ever
// reach; the soft 'plan' deck nudge stays on the dashboard, it never interrupts.

export const REACH_RATE_MS = 60 * 60 * 1000;        // at most one new ping per hour
export const REACH_DISMISS_MS = 2 * 60 * 60 * 1000; // a dismissed concern is silent 2h

export interface WeatherReachState {
  lastConcern: string | null;   // the concern key last surfaced
  lastShownAt: number | null;   // epoch ms it was first surfaced
  dismissedUntil: Record<string, number>; // concernKey → epoch ms it stays silent until
}

// Stable identity for "the same thing" (so a dismissal silences THIS concern, and a
// still-showing concern isn't re-counted as a fresh ping).
export function reachConcernKey(f: WeatherFlag): string {
  return `${f.kind}:${f.date}`;
}

// Decide which (if any) flag should reach Bradley right now, honoring the bounds.
// Pure: caller supplies `now` and the persisted state.
export function pickWeatherReach(
  flags: WeatherFlag[],
  state: WeatherReachState,
  now: number
): WeatherFlag | null {
  for (const f of flags) {
    if (f.severity !== 'action') continue;               // owner-ping only
    const key = reachConcernKey(f);
    if ((state.dismissedUntil[key] ?? 0) > now) continue; // dismissed → still silent
    // Rate limit: a DIFFERENT concern can't surface within an hour of the last one.
    // The same concern still showing is not a new ping, so it's exempt.
    if (key !== state.lastConcern && state.lastShownAt != null && now - state.lastShownAt < REACH_RATE_MS) {
      continue;
    }
    return f;
  }
  return null;
}
