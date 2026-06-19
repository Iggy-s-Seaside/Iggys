// The "business day" cutoff — when does a new SERVICE day start?
//
// A bar's night spills past midnight: a closer counting the till at 1:30am is
// still closing *yesterday's* service. So the calendar date is the wrong key
// for "today's checklists". Instead we roll the day at a fixed wall-clock hour
// in the bar's own timezone (default 9:00am Pacific): any moment BEFORE the
// cutoff counts as the PREVIOUS calendar date, and at the cutoff the day flips.
//
//   1:30am Pacific  -> files under YESTERDAY
//   8:59am Pacific  -> still YESTERDAY
//   9:00am Pacific  -> flips to TODAY
//
// This is why checklists roll on their own: even if a tired closer never taps
// Close, the resolved service day advances at 9am and a fresh Open after 9am
// starts a clean checklist day. See scripts/add-business-day.sql for the
// shift_sessions.business_day column this stamps into.
//
// Implemented with Intl.DateTimeFormat in the target timezone — no external
// deps, DST-correct (we read the wall-clock hour the zone reports, never a
// fixed UTC offset).

const DEFAULT_CUTOFF_HOUR = 9;
const DEFAULT_TZ = 'America/Los_Angeles';

/** Read an instant's wall-clock parts (year/month/day/hour) in a given tz. */
function partsInTz(now: Date, tz: string): { year: number; month: number; day: number; hour: number } {
  // hourCycle h23 so midnight reports hour 0 (not 24), and 1am reports 1.
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  });
  const parts = fmt.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
  };
}

/** Zero-pad to 2 digits. */
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The business-day key (YYYY-MM-DD) for `now`. Any moment before `cutoffHour`
 * (wall-clock, in `tz`) counts as the previous calendar date; at the cutoff the
 * day flips forward. Defaults: 9am, America/Los_Angeles.
 *
 * Date math is done on the tz-local calendar parts via a UTC anchor (UTC has no
 * DST, so adding/subtracting whole days never lands on a skipped/ambiguous
 * hour), then formatted back to a plain date string. The anchor is only an
 * arithmetic device — the returned string is the intended Pacific date.
 */
export function businessDay(now: Date, cutoffHour = DEFAULT_CUTOFF_HOUR, tz = DEFAULT_TZ): string {
  const { year, month, day, hour } = partsInTz(now, tz);
  // Anchor the tz-local calendar date at UTC noon (safe from any rollover).
  const anchor = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (hour < cutoffHour) {
    anchor.setUTCDate(anchor.getUTCDate() - 1);
  }
  return `${anchor.getUTCFullYear()}-${pad(anchor.getUTCMonth() + 1)}-${pad(anchor.getUTCDate())}`;
}

/** The current business day (YYYY-MM-DD) right now, with the default cutoff/tz. */
export function todaysBusinessDay(): string {
  return businessDay(new Date());
}
