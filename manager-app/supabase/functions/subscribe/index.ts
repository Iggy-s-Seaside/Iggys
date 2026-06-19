// supabase/functions/subscribe/index.ts
// PUBLIC endpoint — the iggysseaside.com newsletter / SMS opt-in form POSTs here.
// THE point: grow a *legally mailable* list. It find-or-creates a contact, sets
// ONLY the per-channel opt-in booleans the visitor explicitly checked, and writes
// an immutable consent_events row per opted channel (TCPA / CAN-SPAM trail).
//
// SAFE BY DEFAULT — this function NEVER sends anything. It only records consent.
// The send rails (send-sms / campaigns) read these flags as a non-bypassable
// gate and stay disabled until A2P 10DLC + provider creds land.
//
// Deploy with --no-verify-jwt (public, anon-callable; writes use the service role
// so RLS stays closed to anonymous users).
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

/** Best-effort E.164 normalization for US numbers (matches contacts.normalized_phone
 *  and the normalize() in send-sms — keep these in sync). */
function normalize(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits.length >= 8 ? digits : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
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
    const rawPhone = clean(body.phone, 40);
    const normalizedPhone = rawPhone ? normalize(rawPhone) : null;

    const wantEmail = body.email_opt_in === true;
    const wantSms = body.sms_opt_in === true;

    // Need at least one channel checked, and the contact detail it needs.
    if (!wantEmail && !wantSms) {
      return json({ error: "Please choose at least one — email or text." }, 400);
    }
    if (wantEmail) {
      if (!email) return json({ error: "Please enter your email to get email updates." }, 400);
      if (!isValidEmail(email)) return json({ error: "That email doesn't look right." }, 400);
    }
    if (wantSms && !normalizedPhone) {
      return json({ error: "Please enter a valid mobile number to get texts." }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Find-or-create contact (by email, then phone) — mirrors submit-booking-request.
    let contactId: number | null = null;
    if (email) {
      const { data } = await admin.from("contacts").select("id").eq("email", email).limit(1).maybeSingle();
      if (data) contactId = (data as { id: number }).id;
    }
    if (!contactId && normalizedPhone) {
      const { data } = await admin.from("contacts").select("id").eq("normalized_phone", normalizedPhone).limit(1).maybeSingle();
      if (data) contactId = (data as { id: number }).id;
    }
    if (!contactId && rawPhone) {
      const { data } = await admin.from("contacts").select("id").eq("phone", rawPhone).limit(1).maybeSingle();
      if (data) contactId = (data as { id: number }).id;
    }

    // Set ONLY the channels the visitor checked (never silently un-opt the other).
    const optFields: Record<string, unknown> = {};
    if (wantEmail) optFields.email_opt_in = true;
    if (wantSms) optFields.sms_opt_in = true;

    if (!contactId) {
      const { data, error } = await admin
        .from("contacts")
        .insert({
          // contacts.name is NOT NULL — the footer signup rarely collects a name,
          // so fall back to the email local-part / phone so the insert can't fail.
          name: name ?? (email ? email.split("@")[0] : null) ?? rawPhone ?? "Subscriber",
          email,
          phone: rawPhone,
          normalized_phone: normalizedPhone,
          ...optFields,
        })
        .select("id")
        .single();
      if (error) throw new Error(`contact: ${error.message}`);
      contactId = (data as { id: number }).id;
    } else {
      // Update existing: flip opt-ins on, backfill name/phone/normalized_phone if missing.
      const patch: Record<string, unknown> = { ...optFields };
      if (name) patch.name = name; // harmless refresh; keep the latest name they gave
      if (normalizedPhone) patch.normalized_phone = normalizedPhone;
      const { error } = await admin.from("contacts").update(patch).eq("id", contactId);
      if (error) throw new Error(`contact update: ${error.message}`);
    }

    // Append a consent_events row per opted channel (immutable audit trail).
    const events: Array<Record<string, unknown>> = [];
    if (wantEmail) events.push({ contact_id: contactId, channel: "email", action: "opt_in", source: "website" });
    if (wantSms) events.push({ contact_id: contactId, channel: "sms", action: "opt_in", source: "website" });
    if (events.length) {
      const { error } = await admin.from("consent_events").insert(events);
      if (error) throw new Error(`consent_events: ${error.message}`);
    }

    // NOTE: intentionally NO send here. This function only records consent.
    return json({ success: true });
  } catch (error) {
    console.error("subscribe error:", error);
    return json({ error: "Something went wrong. Please try again in a moment." }, 500);
  }
});
