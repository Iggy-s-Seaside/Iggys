const SUPABASE_STORAGE = 'https://nouxyrqpulkbjusriugx.supabase.co/storage/v1/object/public/images';

// Heavy photos are served as local web derivatives (public/images/opt/,
// ~200-600KB) — the Supabase originals run 2-13MB each and blanked out
// galleries on slow connections. Regenerate via ffmpeg scale=1600 q:v 4.
export const images = {
  // Hero / Background
  backgroundImage: '/images/opt/background.jpg',
  nightOutside: '/images/opt/night-outside.jpg',
  iggyBuilding: '/images/opt/iggy-building.jpg',

  // Interior shots (professional - Kaitlin Green)
  wallInside: '/images/opt/kg-wall-inside.jpg',
  barTop: '/images/opt/kg-bar-top.jpg',
  mural: '/images/opt/kg-mural.jpg',
  tapOutside: '/images/opt/kg-taps-outside.jpg',
  jellyFish: '/images/opt/kg-jellyfish.jpg',

  // Event / DJ
  djFlyer: `${SUPABASE_STORAGE}/dj.jpg`,
  djNight: '/images/opt/dj-night.jpg',
  showUp: `${SUPABASE_STORAGE}/show_up.jpg`,

  // Slay nights
  slayClose: '/images/opt/slay-close.jpg',
  slayWide: `${SUPABASE_STORAGE}/Slay_wide.jpg`,
  slayVid: `${SUPABASE_STORAGE}/Slay_vid.mp4`,

  // Food & drinks
  wineCrab: '/images/opt/wine-crab.jpg',
  cat: `${SUPABASE_STORAGE}/cat.jpg`,
  iggysFamily: '/images/opt/iggys-family.jpg',

  // Additional
  wallInside2: '/images/opt/wall-inside-2.jpg',
  wallInsideOrig: `${SUPABASE_STORAGE}/wall%20inside.jpg`,
  tapsOutside: `${SUPABASE_STORAGE}/taps%20outside.jpg`,

  // SVG vectors
  drinksVector: `${SUPABASE_STORAGE}/drinks%20converted.svg`,
  martiniVector: `${SUPABASE_STORAGE}/martini%20converted.svg`,
  drinks2: `${SUPABASE_STORAGE}/drinks2.svg`,
};

// Curated cocktail cards (Cocktails page carousel) — one photo per distinct
// menu drink, cropped 4:5 and color-graded to match; served locally
export const cocktailCards = [
  { src: '/images/cocktails/burlini-espresso-martini.jpg', name: 'Burlini Espresso Martini' },
  { src: '/images/cocktails/iggys-old-fashion.jpg', name: "Iggy's Old Fashion" },
  { src: '/images/cocktails/dirty-chai.jpg', name: 'Dirty Chai' },
  { src: '/images/cocktails/margarita-on-the-rocks.jpg', name: 'Margarita on the Rocks' },
  { src: '/images/cocktails/negroni.jpg', name: 'Negroni' },
];
