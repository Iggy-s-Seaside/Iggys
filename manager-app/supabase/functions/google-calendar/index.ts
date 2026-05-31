// supabase/functions/google-calendar/index.ts
// Supabase Edge Function — create / update / delete / list events on the bar's Google Calendar
// (the primary calendar of iggysbarevents@gmail.com) using the same Google OAuth connection as Gmail.
// Deploy: supabase functions deploy google-calendar
// Required secrets: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN (MUST include the
//   https://www.googleapis.com/auth/calendar(.events) scope), SUPABASE_URL, SUPABASE_ANON_KEY,
//   SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://iggy-s-manager.netlify.app",
  "https://dev--iggy-s-manager.netlify.app",
  "http://localhost:5173",
  "http://localhost:5174",
];

const LOCATION = "Iggy's Seaside Bar, 200 S Franklin St, Seaside, OR 97138";
const TIME_ZONE = "America/Los_Angeles";
const DEFAULT_DURATION_HOURS = 2;
const CAL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

async function getGoogleAccessToken(): Promise<string> {
  const clientId = Deno.env.get("GMAIL_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET")!;
  const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN")!;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to refresh Google token: ${res.status} ${text}`);
  }
  const data = await res.json();
  return data.access_token;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Parse "5:30 PM" → { h, m } in 24-hour time, or null if unparseable. */
function parseTime(time: string | null): { h: number; m: number } | null {
  if (!time) return null;
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const mer = match[3]?.toUpperCase();
  if (mer === "PM" && h !== 12) h += 12;
  if (mer === "AM" && h === 12) h = 0;
  return { h, m };
}

function localDateTime(date: string, h: number, m: number): string {
  return `${date}T${pad(h)}:${pad(m)}:00`;
}

/** Add a day to a YYYY-MM-DD string (for all-day end.date, which is exclusive in Google's API). */
function nextDay(date: string): string {
  const [y, mo, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d + 1));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

interface PartyRow {
  id: number;
  title: string | null;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  company: string | null;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  setup_time: string | null;
  guest_count: number | null;
  space_name: string | null;
  food_service_type: string | null;
  food_notes: string | null;
  drink_notes: string | null;
  special_requests: string | null;
  google_calendar_event_id: string | null;
}

function buildDescription(p: PartyRow): string {
  const lines: string[] = [];
  lines.push(`Private event for ${p.contact_name}${p.company ? ` (${p.company})` : ""}`);
  if (p.contact_email) lines.push(`Email: ${p.contact_email}`);
  if (p.contact_phone) lines.push(`Phone: ${p.contact_phone}`);
  if (p.guest_count != null) lines.push(`Guests: ${p.guest_count}`);
  if (p.space_name) lines.push(`Space: ${p.space_name}`);
  if (p.setup_time) lines.push(`Setup: ${p.setup_time}`);
  if (p.food_service_type) lines.push(`Food service: ${p.food_service_type}`);
  if (p.food_notes) lines.push(`\nFood notes:\n${p.food_notes}`);
  if (p.drink_notes) lines.push(`\nDrink notes:\n${p.drink_notes}`);
  if (p.special_requests) lines.push(`\nSpecial requests:\n${p.special_requests}`);
  return lines.join("\n");
}

function buildEventResource(p: PartyRow) {
  const summary = p.title?.trim() || `Private Party — ${p.contact_name}`;
  const resource: Record<string, unknown> = {
    summary,
    location: LOCATION,
    description: buildDescription(p),
  };

  const date = p.event_date;
  if (!date) {
    // No date yet — cannot place on calendar with a time; throw so the caller surfaces it.
    throw new Error("This party has no event date set.");
  }

  const start = parseTime(p.start_time);
  if (!start) {
    // All-day event
    resource.start = { date };
    resource.end = { date: nextDay(date) };
    return resource;
  }

  let end = parseTime(p.end_time);
  if (!end) {
    end = { h: (start.h + DEFAULT_DURATION_HOURS) % 24, m: start.m };
  }

  resource.start = { dateTime: localDateTime(date, start.h, start.m), timeZone: TIME_ZONE };
  resource.end = { dateTime: localDateTime(date, end.h, end.m), timeZone: TIME_ZONE };
  return resource;
}

function mapGoogleErr(status: number, text: string): string {
  if (status === 401 || status === 403) {
    return "Google Calendar access is not authorized. The events Google account needs the Calendar scope added to its connection (see the one-time setup). Until then, use the one-click 'Add to Google Calendar' fallback.";
  }
  return `Google Calendar API error: ${status} ${text}`;
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const { action, partyId, timeMin, timeMax } = await req.json();
    const accessToken = await getGoogleAccessToken();
    const authHeaders = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    // ── LIST ──
    if (action === "list") {
      const params = new URLSearchParams({
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "50",
        timeMin: timeMin || new Date().toISOString(),
      });
      if (timeMax) params.set("timeMax", timeMax);

      const res = await fetch(`${CAL}?${params.toString()}`, { headers: authHeaders });
      if (!res.ok) return json({ error: mapGoogleErr(res.status, await res.text()) }, 502);
      const data = await res.json();
      const events = (data.items || []).map((it: Record<string, any>) => ({
        id: it.id,
        summary: it.summary || "(no title)",
        description: it.description || "",
        location: it.location || "",
        start: it.start?.dateTime || it.start?.date || "",
        end: it.end?.dateTime || it.end?.date || "",
        allDay: !it.start?.dateTime,
        htmlLink: it.htmlLink || "",
      }));
      return json({ events });
    }

    // The mutating actions all need the party row (read with service role to bypass RLS).
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (!partyId) return json({ error: "Missing partyId" }, 400);
    const { data: party, error: partyErr } = await admin
      .from("parties")
      .select("*")
      .eq("id", partyId)
      .maybeSingle();
    if (partyErr || !party) return json({ error: "Party not found" }, 404);
    const p = party as PartyRow;

    // ── DELETE ──
    if (action === "delete") {
      if (p.google_calendar_event_id) {
        const res = await fetch(`${CAL}/${p.google_calendar_event_id}`, {
          method: "DELETE",
          headers: authHeaders,
        });
        // 410 Gone = already deleted; treat as success
        if (!res.ok && res.status !== 410 && res.status !== 404) {
          return json({ error: mapGoogleErr(res.status, await res.text()) }, 502);
        }
        await admin.from("parties").update({ google_calendar_event_id: null }).eq("id", p.id);
      }
      return json({ deleted: true });
    }

    // ── CREATE / UPDATE ──
    const resource = buildEventResource(p);
    const hasExisting = Boolean(p.google_calendar_event_id);
    const doUpdate = action === "update" && hasExisting;

    const url = doUpdate ? `${CAL}/${p.google_calendar_event_id}` : CAL;
    const method = doUpdate ? "PATCH" : "POST";

    const res = await fetch(url, { method, headers: authHeaders, body: JSON.stringify(resource) });
    if (!res.ok) return json({ error: mapGoogleErr(res.status, await res.text()) }, 502);
    const ev = await res.json();

    await admin.from("parties").update({ google_calendar_event_id: ev.id }).eq("id", p.id);

    return json({ eventId: ev.id, htmlLink: ev.htmlLink });
  } catch (error) {
    console.error("google-calendar error:", error);
    return json({ error: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});
