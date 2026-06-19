// supabase/functions/send-sms/index.ts
// OUTBOUND SMS — *clearly stubbed*. SAFE BY DEFAULT: this function does NOT
// text anyone yet. It validates the request, writes an sms_log row, and (while
// the rail is disabled) returns { blocked: true } WITHOUT ever calling Twilio.
//
// Real sending is guarded behind BOTH a master flag AND the Twilio credentials,
// ALL of which are intentionally absent until A2P 10DLC registration is approved
// (US carriers reject application-to-person traffic from unregistered numbers).
//
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Pending secrets (sending stays OFF until ALL are present AND the flag is "true"):
//   SMS_ENABLED         = "true"        — master kill-switch (defaults off)
//   TWILIO_ACCOUNT_SID                  — Twilio account SID
//   TWILIO_AUTH_TOKEN                   — Twilio auth token
//   TWILIO_FROM                         — the A2P-registered sending number (E.164)
//
// ── A2P 10DLC requirement (do NOT skip) ─────────────────────────────────────
// Before flipping SMS_ENABLED on, the Iggy's brand + a campaign use-case must be
// registered for A2P 10DLC via the Twilio console (Trust Hub). Unregistered 10DLC
// traffic is filtered/blocked by US carriers and can incur penalties. Marketing
// messages also require documented prior express consent + working STOP/HELP —
// the opt-in is enforced upstream (the composer's consent gate) and STOP is
// handled by the sms-webhook function.
//
// ── REAL SEND FLOW (to wire once registered + secrets present) ──────────────
//   const auth = btoa(`${ACCOUNT_SID}:${AUTH_TOKEN}`);
//   await fetch(`https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`, {
//     method: "POST",
//     headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
//     body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body }),
//   });
//   → on 2xx: update the sms_log row status='sent' (Twilio later POSTs delivery
//     status callbacks → 'delivered'); on error: status='failed', error=<message>.
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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

/** Best-effort E.164 normalization for US numbers (matches contacts.normalized_phone). */
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

  let to = "", body = "", campaignId: number | null = null;
  try {
    const b = await req.json();
    to = String(b.to ?? "").trim();
    body = String(b.body ?? "").trim();
    campaignId = typeof b.campaign_id === "number" ? b.campaign_id : null;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  // ── Validate BEFORE doing anything else ──────────────────────────────────
  const toE164 = to ? normalize(to) : null;
  if (!toE164) return json({ error: "A valid destination number is required." }, 400);
  if (!body) return json({ error: "Message body is required." }, 400);
  // SMS marketing best practice: cap at a sane length (Twilio splits at 1600).
  if (body.length > 1600) return json({ error: "Message is too long (max 1600 chars)." }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── SENDING GATE ─────────────────────────────────────────────────────────
  // Real sending requires the master flag AND every Twilio credential. All are
  // intentionally absent until A2P 10DLC registration lands, so by default this
  // branch is never taken — we log the attempt as 'blocked' and return.
  const flagOn = Deno.env.get("SMS_ENABLED") === "true";
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_FROM");
  const liveEnabled = flagOn && !!sid && !!token && !!from;

  if (!liveEnabled) {
    // DISABLED: write a 'blocked' audit row, never call Twilio.
    await admin.from("sms_log").insert({
      to_number: toE164,
      body,
      direction: "outbound",
      status: "blocked",
      error: `SMS rail disabled (flag=${flagOn}, sid=${!!sid}, token=${!!token}, from=${!!from})`,
    });
    console.log(`[send-sms] DISABLED — logged blocked SMS to ${toE164} (campaign=${campaignId ?? "—"}). No Twilio call.`);
    return json({
      blocked: true,
      message:
        "SMS sending is disabled. Set SMS_ENABLED=true and provide TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM (after A2P 10DLC registration) to go live.",
    });
  }

  // ── LIVE PATH (unreachable until the gate above opens) ─────────────────────
  // Real Twilio call is documented in the header. We pre-insert a 'queued' row,
  // then the implementation that ships with the approved credentials performs
  // the fetch and updates status. Until then we never reach this branch.
  const { data: logRow } = await admin
    .from("sms_log")
    .insert({ to_number: toE164, body, direction: "outbound", status: "queued" })
    .select("id")
    .single();

  try {
    const auth = btoa(`${sid}:${token}`);
    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: toE164, From: from!, Body: body }),
      },
    );
    if (!resp.ok) {
      const errText = await resp.text();
      if (logRow) await admin.from("sms_log").update({ status: "failed", error: errText.slice(0, 500) }).eq("id", logRow.id);
      return json({ error: "Twilio send failed" }, 502);
    }
    if (logRow) await admin.from("sms_log").update({ status: "sent" }).eq("id", logRow.id);
    return json({ sent: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "send error";
    if (logRow) await admin.from("sms_log").update({ status: "failed", error: msg.slice(0, 500) }).eq("id", logRow.id);
    console.error("send-sms error:", err);
    return json({ error: "Could not send SMS" }, 500);
  }
});
