// supabase/functions/send-campaign/index.ts
// OUTBOUND EMAIL CAMPAIGN — *clearly stubbed*. SAFE BY DEFAULT: this function
// does NOT email anyone yet. It re-applies the consent gate server-side, builds
// the recipient list from contacts where email_opt_in = true, and (while the
// rail is disabled) returns { blocked: true, would_send: N } WITHOUT ever
// calling Resend. This mirrors the send-sms stub exactly.
//
// Real sending is guarded behind the Resend credential. RESEND_API_KEY is
// intentionally absent today, so by default we never send — we count the
// would-reach audience and return. Once Resend + the domain are verified, set
// the secret and (during the controlled rollout) the recipient allowlist below
// keeps real delivery limited to the single approved test inbox until cleared.
//
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-provided).
// Pending secrets (sending stays OFF until present):
//   RESEND_API_KEY                      — Resend API key (sender rail)
//   MARKETING_FROM                      — verified From, e.g. "Iggy's <news@iggysseaside.com>"
// Optional rollout guard:
//   CAMPAIGN_ALLOWLIST  = "true"        — when "true" (default), real sends are
//                                         restricted to ALLOWED_TEST_RECIPIENTS
//                                         even if RESEND_API_KEY is present. Set
//                                         to "false" only after Resend is fully
//                                         live and the audience is cleared.
//
// ── CAN-SPAM requirements (do NOT skip) ─────────────────────────────────────
// Every marketing email MUST carry a working unsubscribe mechanism + a physical
// postal address. This function adds BOTH a List-Unsubscribe header (one-click,
// RFC 8058) AND a visible footer unsubscribe link pointing at the `unsubscribe`
// edge function, which flips contacts.email_opt_in = false and appends a
// consent_events row (source = 'email_unsubscribe'). The opt-in itself is
// enforced upstream (the composer's consent gate) AND re-checked here.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://iggysseaside.com",
  "https://www.iggysseaside.com",
  "https://iggy-s-manager.netlify.app",
  "https://dev--iggy-s-manager.netlify.app",
  "http://localhost:5173",
  "http://localhost:5174",
];

// During the controlled rollout the ONLY inbox we are permitted to actually
// deliver to is the owner's test address. Everyone else is logged but skipped.
const ALLOWED_TEST_RECIPIENTS = ["bradleyb1rd@icloud.com"];

const DEFAULT_FROM = "Iggy's in Seaside <noreply@recoupappeals.com>";
const BUSINESS_ADDRESS = "Iggy's Bar in Seaside · 200 S Franklin St, Seaside, OR 97138";

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".netlify.app") ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

/** Basic email format check (mirrors send-party-email). */
function isValidEmail(email: string): boolean {
  return /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email) && email.length < 254;
}

/** Escape HTML special chars to prevent injection in the email body. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Strip CRLF + control chars from header-bound values (header-injection guard). */
function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n\x00-\x1f]/g, "").trim();
}

interface Recipient {
  id: number;
  email: string;
}

serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let campaignId: number | null = null;
  let subject = "";
  let body = "";
  try {
    const b = await req.json();
    campaignId = typeof b.campaign_id === "number" ? b.campaign_id : null;
    subject = sanitizeHeader(String(b.subject ?? "")).slice(0, 200);
    body = String(b.body ?? "").trim();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  // ── Validate BEFORE doing anything else ──────────────────────────────────
  if (!subject) return json({ error: "An email subject is required." }, 400);
  if (!body) return json({ error: "Message body is required." }, 400);
  if (body.length > 20000) return json({ error: "Message is too long (max 20000 chars)." }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── Build the audience SERVER-SIDE from the source of truth ──────────────
  // We do NOT trust a recipient list from the client. We re-query contacts and
  // RE-APPLY the consent gate: only contacts with email_opt_in = true AND a
  // syntactically valid email are eligible. This is defense-in-depth on top of
  // the composer's gate — there is no path that emails a non-consenting contact.
  const { data: rows, error: qErr } = await admin
    .from("contacts")
    .select("id, email, email_opt_in")
    .eq("email_opt_in", true);
  if (qErr) {
    console.error("[send-campaign] contacts query error:", qErr.message);
    return json({ error: "Could not load audience." }, 500);
  }

  // Dedupe by lowercased email; drop rows without a valid address.
  const seen = new Set<string>();
  const audience: Recipient[] = [];
  for (const r of (rows ?? []) as Array<{ id: number; email: string | null; email_opt_in: boolean }>) {
    if (!r.email_opt_in) continue; // belt-and-suspenders
    const email = (r.email ?? "").trim();
    const key = email.toLowerCase();
    if (!email || !isValidEmail(email) || seen.has(key)) continue;
    seen.add(key);
    audience.push({ id: r.id, email });
  }

  const wouldSend = audience.length;

  // ── SENDING GATE ─────────────────────────────────────────────────────────
  // Real sending requires the Resend credential AND a From address. Both are
  // intentionally absent until the domain is verified, so by default this branch
  // is never taken — we log and return { blocked: true, would_send }.
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromAddr = Deno.env.get("MARKETING_FROM") || DEFAULT_FROM;
  if (!resendKey) {
    console.log(
      `[send-campaign] DISABLED — RESEND_API_KEY absent. would_send=${wouldSend} (campaign=${campaignId ?? "—"}). No email sent.`,
    );
    return json({
      blocked: true,
      would_send: wouldSend,
      sent: 0,
      message:
        "Email sending is disabled. Set RESEND_API_KEY and MARKETING_FROM (after verifying the sending domain in Resend) to go live.",
    });
  }

  // ── LIVE PATH (reachable only once RESEND_API_KEY is present) ─────────────
  // Rollout guard: while CAMPAIGN_ALLOWLIST is on (default), real delivery is
  // restricted to the approved test inbox. Everyone else is counted but skipped
  // so we never blast the real list before the rail is fully cleared.
  const allowlistOn = (Deno.env.get("CAMPAIGN_ALLOWLIST") ?? "true") !== "false";
  const siteBase = ALLOWED_ORIGINS[0]; // https://iggysseaside.com
  const fnBase = `${Deno.env.get("SUPABASE_URL")}/functions/v1/unsubscribe`;

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const r of audience) {
    if (allowlistOn && !ALLOWED_TEST_RECIPIENTS.includes(r.email.toLowerCase())) {
      skipped += 1;
      continue;
    }

    // Per-recipient unsubscribe URL (carries the contact id; the unsubscribe fn
    // validates + flips the flag + logs the consent event).
    const unsubUrl = `${fnBase}?c=${encodeURIComponent(String(r.id))}&e=${encodeURIComponent(r.email)}`;
    const safeBody = escapeHtml(body).replace(/\n/g, "<br>");

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="border-bottom: 2px solid #2dd4bf; padding-bottom: 15px; margin-bottom: 20px;">
    <h2 style="margin: 0; color: #1a1a2e;">Iggy's in Seaside</h2>
  </div>
  <div style="line-height: 1.6;">${safeBody}</div>
  <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; font-size: 12px; color: #999;">
    <p>${escapeHtml(BUSINESS_ADDRESS)}<br>
    <a href="${siteBase}" style="color: #2dd4bf;">iggysseaside.com</a></p>
    <p>You're receiving this because you opted in to updates from Iggy's.
    <a href="${unsubUrl}" style="color: #2dd4bf;">Unsubscribe</a>.</p>
  </div>
</body>
</html>`;

    const text = `${body}\n\n—\n${BUSINESS_ADDRESS}\nUnsubscribe: ${unsubUrl}`;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromAddr,
          to: [r.email],
          subject,
          html,
          text,
          headers: {
            // RFC 8058 one-click + mailto fallback to the unsubscribe endpoint.
            "List-Unsubscribe": `<${unsubUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        }),
      });
      if (res.ok) {
        sent += 1;
      } else {
        failed += 1;
        console.error(`[send-campaign] Resend ${res.status} for ${r.email}: ${(await res.text()).slice(0, 200)}`);
      }
    } catch (err) {
      failed += 1;
      console.error(`[send-campaign] send error for ${r.email}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(
    `[send-campaign] LIVE — campaign=${campaignId ?? "—"} sent=${sent} skipped=${skipped} failed=${failed} (allowlist=${allowlistOn})`,
  );
  return json({ sent, skipped, failed, would_send: wouldSend, allowlist: allowlistOn });
});
