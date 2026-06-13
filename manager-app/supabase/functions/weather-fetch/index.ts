// supabase/functions/weather-fetch/index.ts
// PUBLIC endpoint — current + today's forecast for Seaside, OR, from Open-Meteo
// (free, no API key). One cached source of weather truth reused by the manager
// dashboard, Luna's bridge (slow-night attribution), and the End-of-Night report.
// No secrets required.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const SEASIDE = { lat: 45.9929, lon: -123.9229 };

const ALLOWED_ORIGINS = [
  "https://iggysseaside.com",
  "https://www.iggysseaside.com",
  "https://iggy-s-manager.netlify.app",
  "http://localhost:5173",
  "http://localhost:5174",
];

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".netlify.app") ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };
}

function describe(code: number): { label: string; emoji: string } {
  if (code === 0) return { label: "Clear", emoji: "☀️" };
  if (code === 1 || code === 2) return { label: "Partly cloudy", emoji: "⛅" };
  if (code === 3) return { label: "Overcast", emoji: "☁️" };
  if (code === 45 || code === 48) return { label: "Fog", emoji: "🌫️" };
  if (code >= 51 && code <= 57) return { label: "Drizzle", emoji: "🌦️" };
  if (code >= 61 && code <= 67) return { label: "Rain", emoji: "🌧️" };
  if (code >= 71 && code <= 77) return { label: "Snow", emoji: "🌨️" };
  if (code >= 80 && code <= 82) return { label: "Showers", emoji: "🌧️" };
  if (code >= 85 && code <= 86) return { label: "Snow showers", emoji: "🌨️" };
  if (code >= 95) return { label: "Thunderstorm", emoji: "⛈️" };
  return { label: "Mixed", emoji: "🌤️" };
}

// 15-minute in-memory cache (per warm instance) — plenty for a forecast.
let cache: { at: number; body: unknown } | null = null;
const TTL_MS = 15 * 60 * 1000;

serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    if (cache && Date.now() - cache.at < TTL_MS) return json(cache.body);

    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${SEASIDE.lat}&longitude=${SEASIDE.lon}` +
      `&current=temperature_2m,weather_code,wind_speed_10m` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FLos_Angeles&forecast_days=1`;

    const r = await fetch(url);
    if (!r.ok) throw new Error(`open-meteo ${r.status}`);
    const j = await r.json();

    const code = Math.round(j?.daily?.weather_code?.[0] ?? j?.current?.weather_code ?? 0);
    const { label, emoji } = describe(code);
    const tempF = Math.round(j?.current?.temperature_2m ?? 0);
    const highF = Math.round(j?.daily?.temperature_2m_max?.[0] ?? tempF);
    const lowF = Math.round(j?.daily?.temperature_2m_min?.[0] ?? tempF);
    const precipProb = Math.round(j?.daily?.precipitation_probability_max?.[0] ?? 0);
    const windMph = Math.round(j?.current?.wind_speed_10m ?? 0);
    const goodBeachDay = highF >= 65 && precipProb <= 30 && code <= 3;

    const body = { tempF, highF, lowF, precipProb, windMph, code, label, emoji, goodBeachDay, source: "open-meteo", at: new Date().toISOString() };
    cache = { at: Date.now(), body };
    return json(body);
  } catch (error) {
    console.error("weather-fetch error:", error);
    return json({ error: "Could not load weather" }, 500);
  }
});
