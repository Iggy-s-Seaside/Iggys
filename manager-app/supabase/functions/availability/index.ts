// supabase/functions/availability/index.ts
// PUBLIC endpoint — returns the list of TAKEN dates (confirmed events only) for a range,
// so the booking form can gray them out. Reveals NOTHING about who booked or event details.
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const pad = (n: number) => String(n).padStart(2, "0");
function dateKey(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    // Accept range via query (?from=&to=) or JSON body; default today → +120 days.
    let from: string | null = null, to: string | null = null;
    const url = new URL(req.url);
    from = url.searchParams.get("from");
    to = url.searchParams.get("to");
    if (!from && req.method === "POST") {
      try { const b = await req.json(); from = b.from ?? null; to = b.to ?? null; } catch { /* no body */ }
    }
    const today = new Date();
    const end = new Date(today.getTime() + 120 * 24 * 60 * 60 * 1000);
    const fromKey = from || dateKey(today);
    const toKey = to || dateKey(end);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Only CONFIRMED, PRIVATE (exclusive) events block the venue. No names, no details —
    // just the dates and time windows so the booking form can show availability.
    const { data, error } = await admin
      .from("parties")
      .select("event_date,start_min,end_min,all_day,space")
      .eq("status", "confirmed")
      .eq("is_private", true)
      .not("event_date", "is", null)
      .gte("event_date", fromKey)
      .lte("event_date", toKey);
    if (error) throw new Error(error.message);

    type Row = { event_date: string; start_min: number | null; end_min: number | null; all_day: boolean | null; space: string | null };
    const rows = (data || []) as Row[];

    const windows = rows.map((r) => ({
      date: r.event_date,
      start_min: r.start_min,
      end_min: r.end_min,
      all_day: r.all_day === true,
      space: r.space,
    }));

    // taken = distinct dates fully blocked (whole-day block or legacy null-time rows).
    const taken = Array.from(
      new Set(rows.filter((r) => r.all_day === true || r.start_min == null).map((r) => r.event_date))
    ).sort();

    return json({ windows, taken, from: fromKey, to: toKey });
  } catch (error) {
    console.error("availability error:", error);
    return json({ error: "Could not load availability" }, 500);
  }
});
