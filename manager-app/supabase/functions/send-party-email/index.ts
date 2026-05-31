// supabase/functions/send-party-email/index.ts
// Supabase Edge Function — sends a private-event email (follow-up / confirmation / cancellation)
// from iggysbarevents@gmail.com via the Gmail API. Mirrors the hardened send-reply function.
// Deploy: supabase functions deploy send-party-email
// Required secrets: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN,
//                   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://iggy-s-manager.netlify.app",
  "https://dev--iggy-s-manager.netlify.app",
  "http://localhost:5173",
  "http://localhost:5174",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

/** Strip CRLF and control characters from email header values to prevent header injection. */
function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n\x00-\x1f]/g, "").trim();
}

/** Escape HTML special characters to prevent injection in email bodies. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Validate an email address format (basic check). */
function isValidEmail(email: string): boolean {
  return /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email) && email.length < 254;
}

/** Exchange the Gmail OAuth2 refresh token for a fresh access token. */
async function getGmailAccessToken(): Promise<string> {
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
    throw new Error(`Failed to refresh Gmail token: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

/** Build an RFC 2822 multipart email and base64url-encode it for the Gmail API. */
function buildRawEmail(
  to: string,
  subject: string,
  body: string,
  fromName = "Iggy's Bar in Seaside",
  fromEmail = "iggysbarevents@gmail.com"
): string {
  const safeTo = sanitizeHeader(to);
  const safeSubject = sanitizeHeader(subject);
  const safeFromName = sanitizeHeader(fromName);

  const boundary = "boundary_" + crypto.randomUUID().replace(/-/g, "");

  const headers = [
    `From: ${safeFromName} <${fromEmail}>`,
    `To: ${safeTo}`,
    `Subject: ${safeSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
  ].join("\r\n");

  const plainText = body.replace(/<[^>]*>/g, "");
  const safeBody = escapeHtml(body);

  const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="border-bottom: 2px solid #2dd4bf; padding-bottom: 15px; margin-bottom: 20px;">
    <h2 style="margin: 0; color: #1a1a2e;">Iggy's Bar in Seaside</h2>
    <p style="margin: 4px 0 0; font-size: 13px; color: #888;">200 S Franklin St, Seaside, OR 97138</p>
  </div>
  <div style="line-height: 1.6; white-space: pre-wrap;">${safeBody.replace(/\n/g, "<br>")}</div>
  <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; font-size: 12px; color: #999;">
    <p>Iggy's Bar in Seaside &bull; Seaside, Oregon<br>
    <a href="https://iggysseaside.com" style="color: #2dd4bf;">iggysseaside.com</a> &bull; (503) 738-0672</p>
  </div>
</body>
</html>`;

  const message = [
    headers,
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    plainText,
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "",
    htmlBody,
    `--${boundary}--`,
  ].join("\r\n");

  return btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify the request is from an authenticated manager
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { to, subject, body, partyId, kind } = await req.json();

    if (!to || !subject || !body) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isValidEmail(to)) {
      return new Response(JSON.stringify({ error: "Invalid recipient email address" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getGmailAccessToken();
    const rawEmail = buildRawEmail(to, subject, body);

    const gmailRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: rawEmail }),
      }
    );

    if (!gmailRes.ok) {
      const errText = await gmailRes.text();
      throw new Error(`Gmail API error: ${gmailRes.status} ${errText}`);
    }

    const gmailData = await gmailRes.json();

    // Stamp the party when this was a confirmation send (service role bypasses RLS)
    if (partyId && kind === "confirmation") {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await admin
        .from("parties")
        .update({ confirmation_sent_at: new Date().toISOString() })
        .eq("id", partyId);
    }

    return new Response(
      JSON.stringify({ success: true, gmailMessageId: gmailData.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-party-email error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
