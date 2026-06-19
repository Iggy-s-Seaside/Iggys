// Verification of the weather × reservation cross-signal worth-bar. No test runner
// is wired in this repo, so this is the executable spec of Luna's worth-bar — it
// guards the honesty rules (no fabricated outdoor exposure, no false "understaffed",
// no late-night just-weather noise) the office review hardened.
// Run: npx tsx scripts/verify-weather-watch.ts
import { computeWeatherFlags, type PartyLike, type WeatherWatchInput } from '../src/lib/weatherWatch';
import type { WeatherDay } from '../src/hooks/useWeather';

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

console.log(`\n── ${pass} passed, ${fail} failed ──`);
process.exit(fail ? 1 : 0);
