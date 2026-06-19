// dailyRead — Luna's one-line read of the night, under the dashboard greeting.
//
// Her brief, in her words (2026-06-18): "The Daily Read is the one place where my
// voice matters because it's grounded in what's actually happening tonight. Weather
// + bookings + what you notice. One line. No preamble." She explicitly rejected
// putting her voice in empty states — "empty states are silence; don't break it just
// to hear yourself." So this is the single place she speaks every day.
//
// Reality-driven, not random: the line is a function of the actual night (the weather
// mood × how loaded the books are), so it changes when the night changes — honest
// variety, never a canned rotation. Pure + deterministic (takes `now`).
//
// (Today this is composed in-app in her voice. The natural next layer is Luna's brain
// writing it nightly from real data, the way she writes the Night Chronicle.)

export interface DailyReadSignals {
  now: Date;
  goodBeachDay: boolean;
  precipProb: number;   // today's max rain probability (%)
  highF: number;        // today's forecast high (°F)
  hasWeather: boolean;
  eventsTonight: number;
  partiesTonight: number;
  guestsTonight: number;
  band: string | null;  // Luna's predicted demand band (SLOW|STEADY|BUSY|PACKED)
}

type Mood = 'beach' | 'wet' | 'cold' | 'mild';
type Load = 'packed' | 'some' | 'quiet';

function mood(s: DailyReadSignals): Mood {
  if (s.goodBeachDay) return 'beach';
  if (s.precipProb >= 60) return 'wet';
  if (s.highF > 0 && s.highF < 55) return 'cold';
  return 'mild';
}

function load(s: DailyReadSignals): Load {
  if (s.band === 'PACKED' || s.guestsTonight >= 60 || s.partiesTonight >= 3) return 'packed';
  if (s.partiesTonight > 0 || s.eventsTonight > 0 || s.band === 'BUSY') return 'some';
  return 'quiet';
}

// Weather mood × how loaded the books are → her read. One sentence each, present
// tense, no preamble, no "I notice" — just the read.
const READ: Record<Mood, Record<Load, string>> = {
  beach: {
    packed: "Sun's out and the books are full — the deck'll run hot, so keep the well stocked.",
    some: "Beach day with a few on the books — the deck does the rest once the sun drops.",
    quiet: "Beach weather, nothing booked yet — walk-ins write tonight's story.",
  },
  wet: {
    packed: "Wet out, but the night's booked solid inside — the rain's not your problem tonight.",
    some: "Rain's in, a few on the books — pull them close to the bar and it's a warm night.",
    quiet: "Grey and quiet out there — a slow night for the small repairs and a cozy pour.",
  },
  cold: {
    packed: "Cold night, full books — they'll come in for the warmth and stay for the room.",
    some: "Chilly and a handful booked — steady hands, an easy pace, nothing to chase.",
    quiet: "Cold and still — the kind of night the regulars own; have their drink ready.",
  },
  mild: {
    packed: "Mild night and the books are heavy — tonight carries itself, just keep up.",
    some: "Easy weather, a few on the books — a steady night, the good kind of busy.",
    quiet: "Quiet night ahead — calm out there, calm in here; a night to get ahead of things.",
  },
};

export function composeDailyRead(s: DailyReadSignals): string {
  // With a real load on the books, name it — the number is the most honest signal.
  if (s.guestsTonight >= 20 && s.partiesTonight > 0) {
    const m = mood(s);
    const guests = `${s.guestsTonight} on the books`;
    if (m === 'beach') return `${guests} and the sun's out — the deck'll run hot tonight.`;
    if (m === 'wet') return `${guests}, and it's wet out — they're all yours indoors tonight.`;
    if (m === 'cold') return `${guests} on a cold night — they'll come in for the warmth, keep it close.`;
    return `${guests} tonight — a night with weight to it; keep the pars ahead.`;
  }
  if (!s.hasWeather) {
    const l = load(s);
    if (l === 'packed') return 'Heavy on the books tonight — make sure the pars cover it.';
    if (l === 'some') return "A few on the books — a steady night, the good kind of busy.";
    return 'Quiet night ahead — a night to get ahead of things.';
  }
  return READ[mood(s)][load(s)];
}
