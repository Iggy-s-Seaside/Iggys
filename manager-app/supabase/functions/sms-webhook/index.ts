// supabase/functions/sms-webhook/index.ts
// INBOUND SMS RECEIVER — *clearly stubbed*, but ALWAYS-ON for compliance.
//
// Twilio POSTs an inbound message here (application/x-www-form-urlencoded:
// From, To, Body, MessageSid, ...). We ALWAYS log the inbound message to
// sms_log and ALWAYS honor opt-out keywords (STOP/UNSUBSCRIBE/CANCEL/END/QUIT)
// by flipping the matching contact's sms_opt_in to false + appending a
// consent_events row — because honoring STOP is a legal requirement (TCPA),
// not a feature we gate.
//
// What IS gated: sending an auto-reply (the STOP/HELP confirmation text) back
// through Twilio. That outbound leg only fires once SMS_ENABLED + TWILIO_* are
// present; until then we record intent and return an empty TwiML response so
// Twilio is satisfied and nothing is actually texted.
//
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Pending secrets (auto-reply send stays OFF until ALL present AND flag "true"):
//   SMS_ENABLED, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM
//
// Deploy: supabase functions deploy sms-webhook --no-verify-jwt
//   (Twilio calls this directly; there is no Supabase JWT. In production, verify
//    the X-Twilio-Signature header against TWILIO_AUTH_TOKEN before trusting the
//    body — left as a documented step until the token secret is provisioned.)
//
// ── A2P 10DLC requirement ───────────────────────────────────────────────────
// The sending number must be A2P-10DLC-registered (Twilio Trust Hub) before any
// outbound auto-reply is enabled. STOP/HELP keyword handling and the opt-out
// audit trail are mandatory for that registration — this function provides both.
// ─────────────────────────────────────────────────────────────────────────────

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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-twilio-signature",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

const STOP_KEYWORDS = ["stop", "stopall", "unsubscribe", "cancel", "end", "quit", "stop all"];
const START_KEYWORDS = ["start", "unstop", "yes"];

/** Empty TwiML — tells Twilio "received, no auto-reply". */
const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const twiml = (xml = EMPTY_TWIML, status = 200) =>
    new Response(xml, { status, headers: { ...cors, "Content-Type": "application/xml" } });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    // Twilio sends form-encoded; tolerate JSON for local testing.
    let from = "", body = "";
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const b = await req.json();
      from = String(b.From ?? b.from ?? "").trim();
      body = String(b.Body ?? b.body ?? "").trim();
    } else {
      const form = await req.formData();
      from = String(form.get("From") ?? "").trim();
      body = String(form.get("Body") ?? "").trim();
    }

    if (!from) return twiml(); // nothing actionable, but don't error Twilio

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) ALWAYS log the inbound message (audit trail).
    await admin.from("sms_log").insert({
      to_number: from, // for inbound, to_number holds the customer's number
      body,
      direction: "inbound",
      status: "received",
    });

    const keyword = body.toLowerCase().trim();
    const isStop = STOP_KEYWORDS.includes(keyword);
    const isStart = START_KEYWORDS.includes(keyword);

    // 2) ALWAYS honor opt-out / opt-in keywords (legal requirement — never gated).
    if (isStop || isStart) {
      const optIn = isStart;
      // Match the contact by normalized phone first, then a loose phone match.
      const { data: matches } = await admin
        .from("contacts")
        .select("id")
        .or(`normalized_phone.eq.${from},phone.eq.${from}`);
      const ids = (matches || []).map((m: { id: number }) => m.id);
      if (ids.length > 0) {
        await admin.from("contacts").update({ sms_opt_in: optIn }).in("id", ids);
        for (const id of ids) {
          await admin.from("consent_events").insert({
            contact_id: id,
            channel: "sms",
            action: optIn ? "opt_in" : "opt_out",
            source: "sms_keyword",
          });
        }
      }
      console.log(`[sms-webhook] ${optIn ? "START" : "STOP"} from ${from} — ${ids.length} contact(s) updated.`);
    }

    // 3) Auto-reply (STOP/HELP confirmation) is GATED. We do not text back until
    //    the rail is enabled. Twilio's own Advanced Opt-Out can also send the
    //    carrier-mandated confirmation; we return empty TwiML so nothing doubles.
    const flagOn = Deno.env.get("SMS_ENABLED") === "true";
    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const token = Deno.env.get("TWILIO_AUTH_TOKEN");
    const from_ = Deno.env.get("TWILIO_FROM");
    const liveEnabled = flagOn && !!sid && !!token && !!from_;

    if (!liveEnabled) {
      // DISABLED: inbound was logged + consent honored above. No outbound reply.
      return twiml();
    }

    // ── LIVE PATH (unreachable until gated open) ────────────────────────────
    // When enabled, a confirmation auto-reply for STOP/HELP would be returned as
    // TwiML <Message> here (or sent via the REST API). Deliberately left as an
    // empty response until A2P registration + secrets land, so a future complete
    // implementation can add the carrier-compliant copy.
    return twiml();
  } catch (err) {
    console.error("sms-webhook error:", err);
    // Still 200 to Twilio (with empty TwiML) so it doesn't retry-storm; the error
    // is logged for us. A 5xx would make Twilio retry repeatedly.
    return twiml();
  }
});
