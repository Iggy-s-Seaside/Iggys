// supabase/functions/send-reply/index.ts
// Supabase Edge Function — sends a reply from iggysbarevents@gmail.com via the Gmail API.
// When the original message is a synced Gmail message (gmailId provided), the reply is
// sent INTO that Gmail thread (threadId + In-Reply-To/References headers) so it threads
// for the recipient and shows in the dashboard conversation view.
// Deploy: supabase functions deploy send-reply --no-verify-jwt
// Required secrets: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN,
//                   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

type Hdr = { name: string; value: string };
const headerVal = (hs: Hdr[], name: string) =>
  (hs.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value) || "";

/** Look up the original message's threadId + Message-ID/References for threading. */
async function lookupThread(accessToken: string, gmailId: string): Promise<{ threadId?: string; inReplyTo?: string; references?: string }> {
  try {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(gmailId)}?format=metadata&metadataHeaders=Message-ID&metadataHeaders=References`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return {};
    const data = await res.json();
    const hs: Hdr[] = data.payload?.headers || [];
    const msgId = headerVal(hs, "Message-ID");
    const refs = headerVal(hs, "References");
    return {
      threadId: data.threadId,
      inReplyTo: msgId || undefined,
      references: [refs, msgId].filter(Boolean).join(" ") || undefined,
    };
  } catch {
    return {};
  }
}

function buildRawEmail(
  to: string,
  subject: string,
  body: string,
  threading: { inReplyTo?: string; references?: string },
  fromName = "Iggy's Bar in Seaside",
  fromEmail = "iggysbarevents@gmail.com",
): string {
  const safeTo = sanitizeHeader(to);
  const safeSubject = sanitizeHeader(subject);
  const safeFromName = sanitizeHeader(fromName);
  const boundary = "boundary_" + crypto.randomUUID().replace(/-/g, "");

  const headerLines = [
    `From: ${safeFromName} <${fromEmail}>`,
    `To: ${safeTo}`,
    `Subject: ${safeSubject}`,
  ];
  if (threading.inReplyTo) headerLines.push(`In-Reply-To: ${sanitizeHeader(threading.inReplyTo)}`);
  if (threading.references) headerLines.push(`References: ${sanitizeHeader(threading.references)}`);
  headerLines.push(`MIME-Version: 1.0`, `Content-Type: multipart/alternative; boundary="${boundary}"`, "");
  const headers = headerLines.join("\r\n");

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
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { to, subject, body, messageId, gmailId } = await req.json();
    if (!to || !subject || !body || !messageId) {
      return new Response(JSON.stringify({ error: "Missing required fields: to, subject, body, messageId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!isValidEmail(to)) {
      return new Response(JSON.stringify({ error: "Invalid recipient email address" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getGmailAccessToken();

    // Thread the reply when replying to a synced Gmail message.
    const thread = gmailId ? await lookupThread(accessToken, gmailId) : {};
    const rawEmail = buildRawEmail(to, `Re: ${subject}`, body, thread);

    const sendBody: Record<string, unknown> = { raw: rawEmail };
    if (thread.threadId) sendBody.threadId = thread.threadId;

    const gmailRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(sendBody),
    });
    if (!gmailRes.ok) throw new Error(`Gmail API error: ${gmailRes.status} ${await gmailRes.text()}`);
    const gmailData = await gmailRes.json();

    const adminSupabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await adminSupabase
      .from("messages")
      .update({
        status: "replied",
        replied_at: new Date().toISOString(),
        reply_text: body,
        replied_by: user.email,
      })
      .eq("id", messageId);

    return new Response(JSON.stringify({ success: true, gmailMessageId: gmailData.id, threadId: gmailData.threadId }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-reply error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
