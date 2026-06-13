import { useEffect, useState } from 'react';

// Seaside, OR — the bar's location. Weather is the single biggest demand driver
// for a coastal bar, so Luna and the dashboard treat it as first-class context:
// a slow night that lines up with cold/rain is weather, not a problem.
const SEASIDE = { lat: 45.9929, lon: -123.9229 };

export interface Weather {
  tempF: number;       // current temperature
  highF: number;       // today's forecast high
  precipProb: number;  // today's max precipitation probability (%)
  windMph: number;     // current wind speed
  code: number;        // WMO weather code
  label: string;       // "Sunny", "Light rain", …
  emoji: string;
  goodBeachDay: boolean;
  summary: string;     // "☀️ 71° high · light wind — beach day"
}

// Condensed WMO weather-code → label/emoji map (open-meteo.com docs).
function describe(code: number): { label: string; emoji: string } {
  if (code === 0) return { label: 'Clear', emoji: '☀️' };
  if (code === 1 || code === 2) return { label: 'Partly cloudy', emoji: '⛅' };
  if (code === 3) return { label: 'Overcast', emoji: '☁️' };
  if (code === 45 || code === 48) return { label: 'Fog', emoji: '🌫️' };
  if (code >= 51 && code <= 57) return { label: 'Drizzle', emoji: '🌦️' };
  if (code >= 61 && code <= 67) return { label: 'Rain', emoji: '🌧️' };
  if (code >= 71 && code <= 77) return { label: 'Snow', emoji: '🌨️' };
  if (code >= 80 && code <= 82) return { label: 'Showers', emoji: '🌧️' };
  if (code >= 85 && code <= 86) return { label: 'Snow showers', emoji: '🌨️' };
  if (code >= 95) return { label: 'Thunderstorm', emoji: '⛈️' };
  return { label: 'Mixed', emoji: '🌤️' };
}

function windWord(mph: number): string {
  if (mph < 8) return 'light wind';
  if (mph < 18) return 'breezy';
  return 'windy';
}

// Cache per (date + hour) so we hit Open-Meteo at most once an hour per session.
function cacheKey() {
  const d = new Date();
  return `iggys.weather.${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
}

export function useWeather() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const cached = sessionStorage.getItem(cacheKey());
    if (cached) {
      try {
        setWeather(JSON.parse(cached) as Weather);
        setLoading(false);
        return;
      } catch { /* fall through to fetch */ }
    }

    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${SEASIDE.lat}&longitude=${SEASIDE.lon}` +
      `&current=temperature_2m,weather_code,wind_speed_10m` +
      `&daily=temperature_2m_max,precipitation_probability_max,weather_code` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FLos_Angeles&forecast_days=1`;

    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`weather ${r.status}`))))
      .then((j) => {
        if (cancelled) return;
        const code = Math.round(j?.daily?.weather_code?.[0] ?? j?.current?.weather_code ?? 0);
        const { label, emoji } = describe(code);
        const tempF = Math.round(j?.current?.temperature_2m ?? 0);
        const highF = Math.round(j?.daily?.temperature_2m_max?.[0] ?? tempF);
        const precipProb = Math.round(j?.daily?.precipitation_probability_max?.[0] ?? 0);
        const windMph = Math.round(j?.current?.wind_speed_10m ?? 0);
        const goodBeachDay = highF >= 65 && precipProb <= 30 && code <= 3;
        const w: Weather = {
          tempF, highF, precipProb, windMph, code, label, emoji, goodBeachDay,
          summary: `${emoji} ${highF}° high · ${windWord(windMph)}${goodBeachDay ? ' — beach day' : precipProb >= 50 ? ` · ${precipProb}% rain` : ''}`,
        };
        setWeather(w);
        setLoading(false);
        try { sessionStorage.setItem(cacheKey(), JSON.stringify(w)); } catch { /* quota */ }
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  return { weather, loading, error };
}
