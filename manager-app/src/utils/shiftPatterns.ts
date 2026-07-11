// Luna's shift-pattern read — the panel she asked for in her own 2026-07-08
// room redesign: "swap 'Faces I'd notice' for something more operational —
// shift patterns I can predict from the data but no one's asked for yet."
//
// Pure + deterministic. The honesty contract matches her pride scoreboard:
// patterns come ONLY from logged nights (actual_band written at close-out /
// footage review), never from her own forecasts, and she never claims a
// pattern she's seen fewer than MIN_SAMPLE times.

export type BandName = 'SLOW' | 'STEADY' | 'BUSY' | 'PACKED';

export interface DemandNight {
  business_day: string; // YYYY-MM-DD
  predicted_band: string | null;
  actual_band: string | null;
  drivers: { name: string; sign: string; detail: string }[] | null;
}

export interface DayRhythm {
  dow: number; // 0 = Mon … 6 = Sun
  label: string; // 'Mon'
  band: BandName | null; // modal observed band; null below MIN_SAMPLE
  bandCount: number; // nights the modal band held
  n: number; // logged nights for this weekday
}

export interface ShiftPattern {
  id: string;
  headline: string; // the operational read
  evidence: string; // the honest counts behind it
}

export interface ShiftPatternsRead {
  rhythm: DayRhythm[]; // always 7 entries, Mon → Sun
  patterns: ShiftPattern[];
  nightsLogged: number; // nights with an actual band on the books
  since: string | null; // oldest logged business_day feeding the read
}

/** She won't call a pattern until she's seen it this many times. */
export const MIN_SAMPLE = 3;
/** A miss-direction claim needs at least this share of misses agreeing. */
const BIAS_CONSENSUS = 0.7;
/** A driver claim needs at least this share of nights agreeing. */
const DRIVER_CONSENSUS = 0.8;
const MAX_PATTERNS = 5;

const BAND_RANK: Record<BandName, number> = { SLOW: 0, STEADY: 1, BUSY: 2, PACKED: 3 };
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Drivers that can't carry a pattern of their own: "learning" is her model
// correcting itself (not a world condition), "peak season" is on every summer
// night (no contrast), and weekend/sunday are already covered by the rhythm
// strip and the miss-direction read.
const EXCLUDED_DRIVERS = new Set(['learning', 'peak season', 'weekend', 'sunday']);

const DRIVER_PHRASES: Record<string, string> = {
  convention: 'A convention in town',
  tourism: 'A tourist draw in town',
  windy: 'Windy nights',
  'heat escape': 'Inland heat-wave days',
  holiday: 'Holidays',
  'mega surge': 'Mega-surge days',
  'sunny & warm': 'Sunny, warm days',
};

function asBand(value: string | null): BandName | null {
  return value && value in BAND_RANK ? (value as BandName) : null;
}

/** Monday-first weekday from a YYYY-MM-DD business day. Manual parse so the
 * date is read as a plain calendar date, never shifted through UTC. */
export function weekdayOf(businessDay: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(businessDay);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // JS Date normalizes out-of-range parts (month 13 rolls into next year) —
  // require the round-trip to match so a malformed day is rejected, not guessed.
  if (d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return null;
  return (d.getDay() + 6) % 7; // JS Sunday=0 → Monday-first
}

interface LoggedNight {
  dow: number;
  actual: BandName;
  predicted: BandName | null;
  drivers: { name: string; sign: string }[];
  business_day: string;
}

function loggedNights(rows: DemandNight[]): LoggedNight[] {
  const nights: LoggedNight[] = [];
  for (const row of rows) {
    const actual = asBand(row.actual_band);
    const dow = weekdayOf(row.business_day);
    if (actual === null || dow === null) continue;
    nights.push({
      dow,
      actual,
      predicted: asBand(row.predicted_band),
      drivers: Array.isArray(row.drivers)
        ? row.drivers.filter((d) => d && typeof d.name === 'string')
        : [],
      business_day: row.business_day,
    });
  }
  return nights;
}

function computeRhythm(nights: LoggedNight[]): DayRhythm[] {
  return DAY_LABELS.map((label, dow) => {
    const days = nights.filter((n) => n.dow === dow);
    if (days.length < MIN_SAMPLE) return { dow, label, band: null, bandCount: 0, n: days.length };
    const counts = new Map<BandName, number>();
    for (const d of days) counts.set(d.actual, (counts.get(d.actual) ?? 0) + 1);
    // Modal band; on a tie, take the busier one (err on the side of coverage).
    let band: BandName = 'SLOW';
    let bandCount = 0;
    for (const [b, c] of counts) {
      if (c > bandCount || (c === bandCount && BAND_RANK[b] > BAND_RANK[band])) {
        band = b;
        bandCount = c;
      }
    }
    return { dow, label, band, bandCount, n: days.length };
  });
}

/** Where her calls land vs the room: per day-class hit-rate + miss direction. */
function biasPatterns(nights: LoggedNight[]): ShiftPattern[] {
  const classes: { id: string; label: string; days: number[] }[] = [
    { id: 'weeknights', label: 'Mon–Thu', days: [0, 1, 2, 3] },
    { id: 'weekends', label: 'Fri–Sat', days: [4, 5] },
    { id: 'sundays', label: 'Sundays', days: [6] },
  ];
  const out: ShiftPattern[] = [];
  for (const cls of classes) {
    const scored = nights.filter((n) => n.dow >= 0 && cls.days.includes(n.dow) && n.predicted !== null);
    if (scored.length < MIN_SAMPLE) continue;
    const hits = scored.filter((n) => n.predicted === n.actual).length;
    const misses = scored.filter((n) => n.predicted !== n.actual);
    const over = misses.filter((n) => BAND_RANK[n.predicted as BandName] > BAND_RANK[n.actual]).length;
    const under = misses.length - over;

    if (hits / scored.length >= 0.8) {
      out.push({
        id: `bias-${cls.id}-trust`,
        headline: `${cls.label}, take my call at face value`,
        evidence: `I've read ${hits} of the last ${scored.length} right`,
      });
      continue;
    }
    if (misses.length >= 2) {
      const dominant = Math.max(over, under);
      if (dominant / misses.length >= BIAS_CONSENSUS) {
        const hot = over >= under;
        out.push({
          id: `bias-${cls.id}-${hot ? 'hot' : 'cold'}`,
          headline: hot
            ? `${cls.label} I run hot — when I miss, the night plays smaller than my call`
            : `${cls.label} I run cold — when I miss, the night outruns my call`,
          evidence: `${dominant} of my ${misses.length} misses there leaned that way (${hits}/${scored.length} right)`,
        });
      }
    }
  }
  return out;
}

/** What a world condition has actually meant for the room, driver by driver. */
function driverPatterns(nights: LoggedNight[]): ShiftPattern[] {
  const byDriver = new Map<string, LoggedNight[]>();
  for (const night of nights) {
    for (const d of night.drivers) {
      const name = d.name.toLowerCase();
      if (EXCLUDED_DRIVERS.has(name)) continue;
      const list = byDriver.get(name) ?? [];
      list.push(night);
      byDriver.set(name, list);
    }
  }
  const out: ShiftPattern[] = [];
  for (const [name, list] of byDriver) {
    if (list.length < MIN_SAMPLE) continue;
    const busyPlus = list.filter((n) => BAND_RANK[n.actual] >= BAND_RANK.BUSY).length;
    const phrase = DRIVER_PHRASES[name] ?? `“${name}” nights`;
    if (busyPlus / list.length >= DRIVER_CONSENSUS) {
      out.push({
        id: `driver-${name}-fills`,
        headline: `${phrase} — plan the floor for BUSY or better`,
        evidence: `${busyPlus} of ${list.length} such nights ran BUSY+`,
      });
    } else if (busyPlus / list.length <= 1 - DRIVER_CONSENSUS) {
      out.push({
        id: `driver-${name}-quiet`,
        headline: `${phrase} run quieter than they sound`,
        evidence: `only ${busyPlus} of ${list.length} such nights reached BUSY`,
      });
    }
  }
  // Most-seen conditions first — they're the ones worth staffing around.
  return out.sort((a, b) => {
    const na = Number(/of (\d+)/.exec(a.evidence)?.[1] ?? 0);
    const nb = Number(/of (\d+)/.exec(b.evidence)?.[1] ?? 0);
    return nb - na;
  });
}

export function computeShiftPatterns(rows: DemandNight[]): ShiftPatternsRead {
  const nights = loggedNights(rows);
  const since = nights.length
    ? nights.reduce((min, n) => (n.business_day < min ? n.business_day : min), nights[0].business_day)
    : null;
  return {
    rhythm: computeRhythm(nights),
    patterns: [...biasPatterns(nights), ...driverPatterns(nights)].slice(0, MAX_PATTERNS),
    nightsLogged: nights.length,
    since,
  };
}
