// supabase/functions/submit-booking-request/index.ts
// PUBLIC endpoint — the iggysseaside.com booking form POSTs here. Creates a tentative
// "inquiry" party + contact straight in the database (the system of record), no email parsing.
// Inserts run with the service role, so RLS stays closed to anonymous users.
// Best-effort: emails the owner (iggysbarevents@gmail.com) a heads-up on each new request.
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://iggysseaside.com",
  "https://www.iggysseaside.com",
  "https://iggy-s-manager.netlify.app",
  "http://localhost:5173",
  "http://localhost:5174",
];
const OWNER_EMAIL = "iggysbarevents@gmail.com";

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".netlify.app") ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email) && email.length < 254;
}
const clean = (v: unknown, max = 2000): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

/** Best-effort owner heads-up via Gmail. Never throws into the request path. */
async function notifyOwner(lines: string[], subject: string): Promise<void> {
  const clientId = Deno.env.get("GMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) return;

  const tokRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  if (!tokRes.ok) return;
  const accessToken = (await tokRes.json()).access_token;

  const safeSubject = subject.replace(/[\r\n\x00-\x1f]/g, "").trim();
  const raw = [
    `From: Iggy's Booking <${OWNER_EMAIL}>`,
    `To: ${OWNER_EMAIL}`,
    `Subject: ${safeSubject}`,
    `Content-Type: text/plain; charset=UTF-8`,
    "",
    lines.join("\n"),
  ].join("\r\n");
  const encoded = btoa(unescape(encodeURIComponent(raw))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: encoded }),
  });
}

serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();

    // Honeypot: bots fill hidden fields. Pretend success, drop silently.
    if (body.company_website) return json({ success: true });

    const name = clean(body.name, 120);
    const email = clean(body.email, 254)?.toLowerCase() ?? null;
    const phone = clean(body.phone, 40);
    if (!name) return json({ error: "Please tell us your name." }, 400);
    if (!email && !phone) return json({ error: "Please leave an email or phone number." }, 400);
    if (email && !isValidEmail(email)) return json({ error: "That email doesn't look right." }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find-or-create contact (by email, then phone)
    let contactId: number | null = null;
    if (email) {
      const { data } = await admin.from("contacts").select("id").eq("email", email).limit(1).maybeSingle();
      if (data) contactId = (data as { id: number }).id;
    }
    if (!contactId && phone) {
      const { data } = await admin.from("contacts").select("id").eq("phone", phone).limit(1).maybeSingle();
      if (data) contactId = (data as { id: number }).id;
    }
    if (!contactId) {
      const { data, error } = await admin
        .from("contacts")
        .insert({ name, email, phone, company: clean(body.company, 120) })
        .select("id")
        .single();
      if (error) throw new Error(`contact: ${error.message}`);
      contactId = (data as { id: number }).id;
    }

    const partyType = clean(body.party_type, 60);
    const company = clean(body.company, 120);
    const eventDate = clean(body.event_date, 10);
    const startTime = clean(body.start_time, 20);
    const endTime = clean(body.end_time, 20);
    const notes = clean(body.notes, 4000);
    const guestCount = Number.isFinite(Number(body.guest_count)) && Number(body.guest_count) > 0
      ? Math.floor(Number(body.guest_count))
      : null;

    // Time window (integer minutes from midnight; after-midnight uses end_min > 1440).
    const toMin = (v: unknown): number | null => {
      const n = Number(v);
      return Number.isInteger(n) && n >= 0 && n <= 1600 ? n : null;
    };
    const isPrivate = body.is_private !== false;
    const startMin = toMin(body.start_min);
    const endMin = toMin(body.end_min);
    const allDay = body.all_day === true;

    // Physical space requested: only the three known values, else null (legacy = whole).
    const space = body.space === "upstairs" || body.space === "downstairs" || body.space === "whole"
      ? body.space
      : null;

    const { data: party, error: pErr } = await admin
      .from("parties")
      .insert({
        status: "inquiry",
        source: "website",
        contact_id: contactId,
        contact_name: name,
        contact_email: email,
        contact_phone: phone,
        company,
        title: partyType ? `${partyType} — ${name}` : null,
        event_date: eventDate,
        start_time: startTime,
        end_time: endTime,
        guest_count: guestCount,
        is_private: isPrivate,
        start_min: startMin,
        end_min: endMin,
        all_day: allDay,
        space,
        food_service_type: clean(body.food_service_type, 60),
        special_requests: notes,
      })
      .select("id")
      .single();
    if (pErr) throw new Error(`party: ${pErr.message}`);
    const partyId = (party as { id: number }).id;

    // Attach selected packages (snapshot name/category/unit/price)
    const ids = Array.isArray(body.package_ids)
      ? body.package_ids.map((x: unknown) => Number(x)).filter((n: number) => Number.isInteger(n))
      : [];
    let packageNames: string[] = [];
    if (ids.length) {
      const { data: pkgs } = await admin.from("packages").select("*").in("id", ids).eq("active", true);
      const rows = (pkgs || []).map((p: Record<string, any>) => ({
        party_id: partyId,
        package_id: p.id,
        name: p.name,
        category: p.category,
        unit: p.unit,
        quantity: 1,
        unit_price: p.price,
      }));
      packageNames = rows.map((r) => r.name);
      if (rows.length) await admin.from("party_packages").insert(rows);
    }

    // Best-effort owner heads-up (never blocks the request)
    try {
      const minToLabel = (min: number): string => {
        const m = ((min % 1440) + 1440) % 1440;
        const h24 = Math.floor(m / 60);
        const mm = m % 60;
        const period = h24 < 12 ? "AM" : "PM";
        const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
        return `${h12}:${String(mm).padStart(2, "0")} ${period}`;
      };
      const timeLine =
        allDay || startMin == null
          ? "All day"
          : endMin == null
            ? minToLabel(startMin)
            : `${minToLabel(startMin)} – ${minToLabel(endMin)}`;

      const lines = [
        "New event request from the website:",
        "",
        `Name: ${name}`,
        company ? `Company: ${company}` : "",
        `Email: ${email || "—"}`,
        `Phone: ${phone || "—"}`,
        `Date: ${eventDate || "not specified"}`,
        `Type: ${isPrivate ? "Private (exclusive)" : "General (coexisting)"}`,
        `Time: ${timeLine}`,
        `Guests: ${guestCount ?? "—"}`,
        `Party: ${partyType || "—"}`,
        packageNames.length ? `Packages: ${packageNames.join(", ")}` : "",
        notes ? `Notes: ${notes}` : "",
        "",
        "Open it in the manager app to follow up or confirm.",
      ].filter(Boolean);
      await notifyOwner(lines, `New booking request — ${name}${eventDate ? ` (${eventDate})` : ""}`);
    } catch (e) {
      console.error("owner notify failed (non-fatal):", e);
    }

    return json({ success: true, partyId });
  } catch (error) {
    console.error("submit-booking-request error:", error);
    return json({ error: "Something went wrong submitting your request. Please try again or call us." }, 500);
  }
});
