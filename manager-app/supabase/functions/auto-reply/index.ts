// supabase/functions/auto-reply/index.ts
// Supabase Edge Function — sends an auto-reply when a new WEBSITE CONTACT-FORM
// message is submitted. Triggered via the on_new_message DB trigger, which now
// only fires for source='contact_form' rows (NOT Gmail-synced mail — see
// scripts/setup-messages.sql handle_new_message guard).
// Deploy: supabase functions deploy auto-reply --no-verify-jwt
// Required secrets: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const ALLOWED_ORIGINS = [
  "https://iggysmanagement.netlify.app",
  "http://localhost:5173",
  "http://localhost:5174",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".netlify.app") ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n\x00-\x1f]/g, "").trim();
}
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function isValidEmail(email: string): boolean {
  return /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email) && email.length < 254;
}

async function getGmailAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GMAIL_CLIENT_ID")!,
      client_secret: Deno.env.get("GMAIL_CLIENT_SECRET")!,
      refresh_token: Deno.env.get("GMAIL_REFRESH_TOKEN")!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Failed to refresh Gmail token: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

function buildRawEmail(to: string, subject: string, htmlBody: string, plainText: string,
  fromName = "Iggy's Bar in Seaside", fromEmail = "iggysbarevents@gmail.com"): string {
  const boundary = "boundary_" + crypto.randomUUID().replace(/-/g, "");
  const headers = [
    `From: ${sanitizeHeader(fromName)} <${fromEmail}>`,
    `To: ${sanitizeHeader(to)}`,
    `Subject: ${sanitizeHeader(subject)}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
  ].join("\r\n");
  const message = [
    headers,
    `--${boundary}`, "Content-Type: text/plain; charset=UTF-8", "", plainText,
    `--${boundary}`, "Content-Type: text/html; charset=UTF-8", "", htmlBody,
    `--${boundary}--`,
  ].join("\r\n");
  return btoa(unescape(encodeURIComponent(message))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildAutoReplyHtml(name: string, subject: string): string {
  const firstName = escapeHtml(name.split(" ")[0]);
  const safeSubject = escapeHtml(subject);
  return `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
  <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
    <div style="text-align: center; border-bottom: 2px solid #2dd4bf; padding-bottom: 20px; margin-bottom: 24px;">
      <h1 style="margin: 0; color: #1a1a2e; font-size: 24px;">Iggy's Bar in Seaside</h1>
      <p style="margin: 6px 0 0; font-size: 13px; color: #888; letter-spacing: 1px;">SEASIDE, OREGON</p>
    </div>
    <p style="font-size: 16px; line-height: 1.6;">Hey ${firstName}! 👋</p>
    <p style="font-size: 15px; line-height: 1.6;">
      Thanks for reaching out to us about <strong>"${safeSubject}"</strong>. We've received your message and one of our team members will get back to you within <strong>24 hours</strong>.
    </p>
    <p style="font-size: 15px; line-height: 1.6;">
      In the meantime, feel free to give us a call at <a href="tel:+15037380672" style="color: #2dd4bf; text-decoration: none; font-weight: bold;">(503) 738-0672</a> if you need anything urgent.
    </p>
    <div style="background: linear-gradient(135deg, #0a0f0f, #1a1a2e); border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
      <p style="color: #2dd4bf; margin: 0 0 4px; font-size: 13px; letter-spacing: 2px; text-transform: uppercase;">Visit Us</p>
      <p style="color: white; margin: 0; font-size: 14px;">200 S Franklin St, Seaside, OR 97138</p>
      <p style="color: #f59e0b; margin: 8px 0 0; font-size: 13px;">Open Daily 12pm – 12am &bull; Happy Hour 3pm – 5pm</p>
    </div>
    <p style="font-size: 15px; line-height: 1.6;">Cheers,<br><strong>The Iggy's Team</strong> 🍻</p>
    <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #999;">
      <p><a href="https://iggysseaside.com" style="color: #2dd4bf; text-decoration: none;">iggysseaside.com</a></p>
      <p style="margin-top: 8px; font-size: 11px;">This is an automated confirmation. Please don't reply to this email — we'll respond to your original message soon!</p>
    </div>
  </div>
</body></html>`;
}

function buildAutoReplyPlain(name: string, subject: string): string {
  const firstName = name.split(" ")[0];
  return `Hey ${firstName}!\n\nThanks for reaching out to us about "${subject}". We've received your message and one of our team members will get back to you within 24 hours.\n\nIn the meantime, feel free to give us a call at (503) 738-0672 if you need anything urgent.\n\n---\nIggy's Bar in Seaside\n200 S Franklin St, Seaside, OR 97138\nOpen Daily 12pm - 12am | Happy Hour 3pm - 5pm\niggysseaside.com\n\nCheers,\nThe Iggy's Team`;
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const payload = await req.json();
    const record = payload.record;
    if (!record) {
      return new Response(JSON.stringify({ error: "No record in payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Defense in depth: only auto-reply to website contact-form rows. The DB
    // trigger already guards on this, but never auto-reply to synced Gmail.
    if (record.source && record.source !== "contact_form") {
      return new Response(JSON.stringify({ skipped: "non-contact-form source" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { name, email, subject } = record;
    if (!name || !email || !subject) {
      return new Response(JSON.stringify({ error: "Missing name, email, or subject in record" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!isValidEmail(email)) {
      return new Response(JSON.stringify({ error: "Invalid email address in record" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getGmailAccessToken();
    const rawEmail = buildRawEmail(
      email,
      `Thanks for contacting Iggy's! Re: ${subject}`,
      buildAutoReplyHtml(name, subject),
      buildAutoReplyPlain(name, subject),
    );

    const gmailRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: rawEmail }),
    });
    if (!gmailRes.ok) throw new Error(`Gmail API error: ${gmailRes.status} ${await gmailRes.text()}`);
    const gmailData = await gmailRes.json();

    return new Response(JSON.stringify({ success: true, gmailMessageId: gmailData.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("auto-reply error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
