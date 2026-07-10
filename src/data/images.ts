const SUPABASE_STORAGE = 'https://nouxyrqpulkbjusriugx.supabase.co/storage/v1/object/public/images';

export const images = {
  // Hero / Background
  backgroundImage: `${SUPABASE_STORAGE}/IMG_8238.jpg`,
  nightOutside: `${SUPABASE_STORAGE}/IMG_8318.jpg`,
  iggyBuilding: `${SUPABASE_STORAGE}/iggybuilding.jpg`,

  // Interior shots (professional - Kaitlin Green)
  wallInside: `${SUPABASE_STORAGE}/Iggys-KaitlinGreen-7.jpg`,
  barTop: `${SUPABASE_STORAGE}/Iggys-KaitlinGreen-11.jpg`,
  mural: `${SUPABASE_STORAGE}/Iggys-KaitlinGreen-15.jpg`,
  tapOutside: `${SUPABASE_STORAGE}/Iggys-KaitlinGreen-19.jpg`,
  jellyFish: `${SUPABASE_STORAGE}/Iggys-KaitlinGreen-39.jpg`,

  // Event / DJ
  djFlyer: `${SUPABASE_STORAGE}/dj.jpg`,
  djNight: `${SUPABASE_STORAGE}/djnight.jpeg`,
  showUp: `${SUPABASE_STORAGE}/show_up.jpg`,

  // Slay nights
  slayClose: `${SUPABASE_STORAGE}/Slay_close.jpg`,
  slayWide: `${SUPABASE_STORAGE}/Slay_wide.jpg`,
  slayVid: `${SUPABASE_STORAGE}/Slay_vid.mp4`,

  // Food & drinks
  wineCrab: `${SUPABASE_STORAGE}/wineCrab.JPG`,
  cat: `${SUPABASE_STORAGE}/cat.jpg`,
  iggysFamily: `${SUPABASE_STORAGE}/Iggys-fam.jpg`,

  // Additional
  wallInside2: `${SUPABASE_STORAGE}/wall%20inside%202.jpg`,
  wallInsideOrig: `${SUPABASE_STORAGE}/wall%20inside.jpg`,
  tapsOutside: `${SUPABASE_STORAGE}/taps%20outside.jpg`,

  // SVG vectors
  drinksVector: `${SUPABASE_STORAGE}/drinks%20converted.svg`,
  martiniVector: `${SUPABASE_STORAGE}/martini%20converted.svg`,
  drinks2: `${SUPABASE_STORAGE}/drinks2.svg`,
};

// Drink photos (cocktail carousel)
export const drinkImages = [
  `${SUPABASE_STORAGE}/DRINK_6604.jpg`,
  `${SUPABASE_STORAGE}/DRINK_6605.jpg`,
  `${SUPABASE_STORAGE}/DRINK_6607.jpg`,
  `${SUPABASE_STORAGE}/DRINK_6609.jpg`,
  `${SUPABASE_STORAGE}/DRINK_6614.jpg`,
  `${SUPABASE_STORAGE}/DRINK_6615.jpg`,
  `${SUPABASE_STORAGE}/DRINK_6617.jpg`,
  `${SUPABASE_STORAGE}/DRINK_6619.jpg`,
];

// Curated cocktail cards (Cocktails page carousel) — one photo per distinct
// menu drink, cropped 4:5 and color-graded to match; served locally
export const cocktailCards = [
  { src: '/images/cocktails/burlini-espresso-martini.jpg', name: 'Burlini Espresso Martini' },
  { src: '/images/cocktails/iggys-old-fashion.jpg', name: "Iggy's Old Fashion" },
  { src: '/images/cocktails/dirty-chai.jpg', name: 'Dirty Chai' },
  { src: '/images/cocktails/margarita-on-the-rocks.jpg', name: 'Margarita on the Rocks' },
  { src: '/images/cocktails/negroni.jpg', name: 'Negroni' },
];
