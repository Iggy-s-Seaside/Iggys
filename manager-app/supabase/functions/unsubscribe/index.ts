// supabase/functions/unsubscribe/index.ts
// PUBLIC one-click email unsubscribe (CAN-SPAM / RFC 8058). Reached two ways:
//   1. GET  ?c=<contact_id>&e=<email>  — the visible footer link (browser);
//      returns a small confirmation HTML page.
//   2. POST  (same query params)       — the RFC 8058 List-Unsubscribe-Post
//      one-click handler invoked by the mail client; returns 200 plain text.
//
// Either way it flips contacts.email_opt_in = false and appends a consent_events
// row with source = 'email_unsubscribe' (immutable audit trail). It NEVER sends
// anything, so it is safe regardless of whether the Resend rail is enabled.
//
// Deploy with --no-verify-jwt (mail clients / browsers won't carry a JWT).
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-provided).

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function page(title: string, msg: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
</head>
<body style="font-family: -apple-system, Arial, sans-serif; color: #1a1a2e; background: #f7f7f8; margin: 0; padding: 40px 16px;">
  <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 14px; padding: 32px; box-shadow: 0 2px 16px rgba(0,0,0,0.06);">
    <h1 style="margin: 0 0 8px; font-size: 20px;">Iggy's in Seaside</h1>
    <p style="line-height: 1.6; font-size: 15px; color: #444;">${msg}</p>
    <p style="margin-top: 24px;"><a href="https://iggysseaside.com" style="color: #2dd4bf; text-decoration: none;">Back to iggysseaside.com</a></p>
  </div>
</body>
</html>`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = new URL(req.url);
  const contactId = Number(url.searchParams.get("c"));
  const email = (url.searchParams.get("e") ?? "").trim().toLowerCase();
  const wantsHtml = req.method === "GET";

  const fail = (msg: string, status = 400) =>
    wantsHtml
      ? new Response(page("Unsubscribe", msg), { status, headers: { ...cors, "Content-Type": "text/html; charset=utf-8" } })
      : new Response(msg, { status, headers: { ...cors, "Content-Type": "text/plain" } });

  if (!Number.isInteger(contactId) || contactId <= 0) {
    return fail("This unsubscribe link is missing or invalid.");
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Confirm the contact exists (and, if an email was supplied in the link, that
  // it matches — guards against tampered ids unsubscribing the wrong person).
  const { data: contact, error: cErr } = await admin
    .from("contacts")
    .select("id, email, email_opt_in")
    .eq("id", contactId)
    .maybeSingle();

  if (cErr) {
    console.error("[unsubscribe] lookup error:", cErr.message);
    return fail("Something went wrong. Please try again later.", 500);
  }
  if (!contact) {
    return fail("We couldn't find that subscription. It may already be removed.", 404);
  }
  if (email && (contact.email ?? "").trim().toLowerCase() !== email) {
    return fail("This unsubscribe link doesn't match our records.");
  }

  // Already opted out? Idempotent success — no duplicate event, friendly page.
  if (contact.email_opt_in === false) {
    const msg = "You're already unsubscribed from Iggy's emails. No further action needed.";
    return wantsHtml
      ? new Response(page("Unsubscribed", msg), { headers: { ...cors, "Content-Type": "text/html; charset=utf-8" } })
      : new Response("OK", { headers: { ...cors, "Content-Type": "text/plain" } });
  }

  // Flip the flag (source of truth for the consent gate).
  const { error: upErr } = await admin
    .from("contacts")
    .update({ email_opt_in: false })
    .eq("id", contactId);
  if (upErr) {
    console.error("[unsubscribe] update error:", upErr.message);
    return fail("Something went wrong. Please try again later.", 500);
  }

  // Append the immutable audit row. A failure here doesn't roll back the opt-out
  // (the flag is what gates sends) but we log it loudly.
  const { error: evErr } = await admin.from("consent_events").insert({
    contact_id: contactId,
    channel: "email",
    action: "opt_out",
    source: "email_unsubscribe",
  });
  if (evErr) console.error("[consent_events] unsubscribe insert error:", evErr.message);

  console.log(`[unsubscribe] contact=${contactId} opted out of email.`);

  const msg = "You've been unsubscribed from Iggy's emails. We're sorry to see you go — you can re-subscribe anytime.";
  return wantsHtml
    ? new Response(page("Unsubscribed", msg), { headers: { ...cors, "Content-Type": "text/html; charset=utf-8" } })
    : new Response("OK", { headers: { ...cors, "Content-Type": "text/plain" } });
});
