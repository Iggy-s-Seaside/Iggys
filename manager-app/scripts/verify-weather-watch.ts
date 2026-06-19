// Verification of the weather × reservation cross-signal worth-bar. No test runner
// is wired in this repo, so this is the executable spec of Luna's worth-bar — it
// guards the honesty rules (no fabricated outdoor exposure, no false "understaffed",
// no late-night just-weather noise) the office review hardened.
// Run: npx tsx scripts/verify-weather-watch.ts
import {
  computeWeatherFlags,
  pickWeatherReach,
  REACH_RATE_MS,
  REACH_DISMISS_MS,
  type PartyLike,
  type WeatherWatchInput,
  type WeatherFlag,
  type WeatherReachState,
} from '../src/lib/weatherWatch';
import type { WeatherDay } from '../src/hooks/useWeather';
import { composeDailyRead, type DailyReadSignals } from '../src/lib/dailyRead';

// Anchor "now" at Fri 2026-06-19 14:00 local. Window = Fri, Sat, Sun.
const now = new Date('2026-06-19T14:00:00');
const D = (n: number) => {
  const d = new Date(now.getTime() + n * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const FRI = D(0), SAT = D(1), SUN = D(2);

const day = (date: string, highF: number, precipProb: number, code = 0): WeatherDay => ({
  date, weekday: new Date(`${date}T12:00:00`).getDay(), highF, precipProb, code,
  label: 'x', emoji: 'x', goodBeachDay: highF >= 65 && precipProb <= 30 && code <= 3,
});

const party = (over: Partial<PartyLike>): PartyLike => ({
  id: 1, status: 'confirmed', event_date: SAT, start_min: 19 * 60, guest_count: 30,
  contact_name: 'Henderson', company: null, space_name: null, special_requests: null,
  food_notes: null, drink_notes: null, internal_notes: null, ...over,
});

let pass = 0, fail = 0;
function check(name: string, cond: boolean) {
  (cond ? (pass++, console.log(`  ✓ ${name}`)) : (fail++, console.log(`  ✗ FAIL: ${name}`)));
}
function run(name: string, input: Partial<WeatherWatchInput>) {
  const flags = computeWeatherFlags({
    now, daily: [], parties: [], staffingByDate: {}, demandByDate: {}, ...input,
  });
  console.log(`\n${name}: ${flags.map((f) => `[${f.severity}] ${f.message}`).join('  ||  ') || '(silent)'}`);
  return flags;
}

// 1. Rain + outdoor party within 48h → action flag.
let f = run('rain × outdoor party', {
  daily: [day(SAT, 68, 75)],
  parties: [party({ special_requests: 'cocktails on the deck' })],
});
check('fires move-indoors', f.some((x) => x.kind === 'rain_party_indoor' && x.severity === 'action'));
check('mentions 75% rain + party', /75% rain/.test(f[0]?.message) && /Henderson/.test(f[0]?.message));

// 2. Rain but party is INDOOR (no outdoor keyword) → silent.
f = run('rain × indoor party (no keyword)', {
  daily: [day(SAT, 68, 75)],
  parties: [party({ space_name: 'upstairs', internal_notes: 'normal setup' })],
});
check('indoor party stays silent', !f.some((x) => x.kind === 'rain_party_indoor'));

// 3. Light rain (40%) + outdoor party → below deviation bar → silent for that party.
f = run('light rain (40%) × outdoor party', {
  daily: [day(SAT, 68, 40)],
  parties: [party({ special_requests: 'deck' })],
});
check('40% rain does not fire (washout bar is 60%)', !f.some((x) => x.kind === 'rain_party_indoor'));

// 4. Heat spike + understaffed (foh below typical) → action flag.
f = run('heat × understaffed', {
  daily: [day(SAT, 84, 10)],
  staffingByDate: { [SAT]: { foh: 1, baseline: 3 } },
});
check('fires call-in-a-hand', f.some((x) => x.kind === 'heat_understaffed' && x.severity === 'action'));
check('mentions 84° + only 1', /84°/.test(f[0]?.message) && /only 1/.test(f[0]?.message));

// 5. Heat spike but NO schedule (baseline null) → silent (honesty guard).
f = run('heat × no schedule yet', {
  daily: [day(SAT, 84, 10)],
  staffingByDate: { [SAT]: { foh: 0, baseline: null } },
});
check('no-schedule stays silent (no false understaffed)', !f.some((x) => x.kind === 'heat_understaffed'));

// 6. Heat spike but adequately staffed (foh >= baseline) → silent.
f = run('heat × adequately staffed', {
  daily: [day(SAT, 84, 10)],
  staffingByDate: { [SAT]: { foh: 4, baseline: 3 } },
});
check('adequate staffing stays silent', !f.some((x) => x.kind === 'heat_understaffed'));

// 7. Warm weekend washout, no outdoor party → deck plan flag.
f = run('rain × deck (warm weekend)', {
  daily: [day(SAT, 72, 80)],
});
check('fires deck-plan', f.some((x) => x.kind === 'rain_deck' && x.severity === 'plan'));

// 8. Warm weekend washout BUT Luna already called it SLOW → silent.
f = run('rain × deck but pulse=SLOW', {
  daily: [day(SAT, 72, 80)],
  demandByDate: { [SAT]: 'SLOW' },
});
check('deck flag suppressed when already SLOW', !f.some((x) => x.kind === 'rain_deck'));

// 9. Cold rainy weekend (highF 55) → deck obviously empty, no insight → silent.
f = run('rain × cold weekend', { daily: [day(SAT, 55, 80)] });
check('cold day no deck flag', !f.some((x) => x.kind === 'rain_deck'));

// 10. Dedup: outdoor party action + deck plan same day → only the action.
f = run('dedup action over plan', {
  daily: [day(SAT, 72, 80)],
  parties: [party({ special_requests: 'deck party' })],
});
check('deck plan deduped when party action exists', f.some((x) => x.kind === 'rain_party_indoor') && !f.some((x) => x.kind === 'rain_deck'));

// 11. Event 5 days out → outside 48h → no move-indoors flag for it.
f = run('outdoor party beyond 48h', {
  daily: [day(D(5), 68, 80)], // forecast only for the far-off day → no deck flag in-window
  parties: [party({ event_date: D(5), special_requests: 'deck' })],
});
check('beyond-window party produces no flag', f.length === 0);

// ── review-driven cases: outdoor detection must not fabricate from menu notes ──
const noMove = (label: string, over: Partial<PartyLike>) => {
  const ff = run(label, { daily: [day(SAT, 68, 75)], parties: [party({ space_name: 'upstairs', ...over })] });
  check(label + ' → no move-indoors', !ff.some((x) => x.kind === 'rain_party_indoor'));
};
noMove('12. "Garden salad" in food_notes', { food_notes: 'Garden salad to start, then plated entrees' });
noMove('13. "outside catering" in food_notes', { food_notes: 'outside catering by an outside vendor' });
noMove('14. "beachside garnish" in drink_notes', { drink_notes: 'beachside garnish on the spritz' });
noMove('15. "beach view table" in special_requests', { special_requests: 'wants a beach view table' });
noMove('16. "garden party theme" in food_notes', { food_notes: 'garden party theme, floral plating' });

// True positives must still fire.
f = run('17. space_name "garden patio"', { daily: [day(SAT, 68, 75)], parties: [party({ space_name: 'garden patio' })] });
check('garden patio still fires (strong: patio)', f.some((x) => x.kind === 'rain_party_indoor'));
f = run('18. space_name "Garden" (weak, location field)', { daily: [day(SAT, 68, 75)], parties: [party({ space_name: 'Garden' })] });
check('garden as a space name fires (weak in space_name)', f.some((x) => x.kind === 'rain_party_indoor'));

// Late same-day: no runway → both day-level flags silent.
{
  const lateNow = new Date('2026-06-20T22:00:00'); // Sat 10pm
  const sat = `${lateNow.getFullYear()}-${String(lateNow.getMonth() + 1).padStart(2, '0')}-${String(lateNow.getDate()).padStart(2, '0')}`;
  const flags = computeWeatherFlags({
    now: lateNow,
    daily: [{ date: sat, weekday: 6, highF: 84, precipProb: 80, code: 61, label: 'x', emoji: 'x', goodBeachDay: false }],
    parties: [], staffingByDate: { [sat]: { foh: 1, baseline: 3 } }, demandByDate: {},
  });
  console.log(`\n19. late same-day (Sat 10pm): ${flags.map((x) => x.kind).join(',') || '(silent)'}`);
  check('no heat flag late at night', !flags.some((x) => x.kind === 'heat_understaffed'));
  check('no deck flag late at night', !flags.some((x) => x.kind === 'rain_deck'));
}

// ── reach decider: Luna's bounds (owner-ping only, 1/hour, dismissed 2h) ──
console.log('\n— reach bounds —');
const T = 1_750_000_000_000; // a fixed "now" epoch
const action = (kind: WeatherFlag['kind'], date: string): WeatherFlag => ({ id: kind + date, kind, severity: 'action', date, message: 'x', deepLink: '/x' });
const plan: WeatherFlag = { id: 'p', kind: 'rain_deck', severity: 'plan', date: SAT, message: 'x', deepLink: '/x' };
const fresh: WeatherReachState = { lastConcern: null, lastShownAt: null, dismissedUntil: {} };
const A = action('rain_party_indoor', SAT);
const B = action('heat_understaffed', SUN);

check('R1 action flag reaches', pickWeatherReach([A, plan], fresh, T)?.id === A.id);
check('R2 plan-only never reaches', pickWeatherReach([plan], fresh, T) === null);
check('R3 dismissed concern silent for 2h', pickWeatherReach([A], { ...fresh, dismissedUntil: { ['rain_party_indoor:' + SAT]: T + 1000 } }, T) === null);
check('R4 dismissed concern returns after window', pickWeatherReach([A], { ...fresh, dismissedUntil: { ['rain_party_indoor:' + SAT]: T - 1000 } }, T)?.id === A.id);
check('R5 a NEW concern is rate-limited within the hour', pickWeatherReach([B], { lastConcern: 'rain_party_indoor:' + SAT, lastShownAt: T - 10 * 60 * 1000, dismissedUntil: {} }, T) === null);
check('R6 the SAME concern still shows within the hour', pickWeatherReach([A], { lastConcern: 'rain_party_indoor:' + SAT, lastShownAt: T - 10 * 60 * 1000, dismissedUntil: {} }, T)?.id === A.id);
check('R7 a new concern surfaces after the hour passes', pickWeatherReach([B], { lastConcern: 'rain_party_indoor:' + SAT, lastShownAt: T - REACH_RATE_MS - 1000, dismissedUntil: {} }, T)?.id === B.id);
// After a dismiss (rate clock reset + concern silenced 2h), a DIFFERENT new concern
// must not be starved by the just-dismissed one's leftover hour.
const afterDismiss: WeatherReachState = { lastConcern: null, lastShownAt: null, dismissedUntil: { ['rain_party_indoor:' + SAT]: T + REACH_DISMISS_MS } };
check('R8 a new concern reaches immediately after a dismiss', pickWeatherReach([B], afterDismiss, T)?.id === B.id);
check('R9 the dismissed concern stays silent, the new one wins', pickWeatherReach([A, B], afterDismiss, T)?.id === B.id);

// ── Daily Read: one grounded sentence, never empty, varies by the night ──
console.log('\n— daily read —');
const drBase: DailyReadSignals = { now: new Date('2026-06-20T17:00:00'), goodBeachDay: false, precipProb: 10, highF: 68, hasWeather: true, eventsTonight: 0, partiesTonight: 0, guestsTonight: 0, band: null };
const dr = (over: Partial<DailyReadSignals>) => composeDailyRead({ ...drBase, ...over });
const oneLine = (s: string) => s.length > 0 && !s.includes('\n');
check('D1 always a non-empty one-liner (with and without weather)', oneLine(dr({})) && oneLine(dr({ hasWeather: false })));
check('D2 a real load on the books names the count', dr({ partiesTonight: 2, guestsTonight: 45 }).includes('45'));
check('D3 beach and washout read differently', dr({ goodBeachDay: true, highF: 74 }) !== dr({ precipProb: 80, highF: 60 }));
check('D4 a packed night reads differently from a quiet one', dr({ band: 'PACKED', partiesTonight: 3, guestsTonight: 70 }) !== dr({}));
check('D5 no-weather still speaks a real line', oneLine(dr({ hasWeather: false })) && dr({ hasWeather: false }).length > 12);

console.log(`\n── ${pass} passed, ${fail} failed ──`);
process.exit(fail ? 1 : 0);
