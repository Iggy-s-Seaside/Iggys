// supabase/functions/submit-contact-message/index.ts
// PUBLIC endpoint — the iggysseaside.com contact form POSTs here. Replaces
// the old client-side EmailJS send. The INSERT into `messages` is the point:
// submissions land in the manager dashboard Inbox (realtime + unread badge,
// replyable via send-reply) and in Luna's briefing context. The owner email
// is a best-effort notification on top — Resend when RESEND_API_KEY is set,
// otherwise the same Gmail connection the other functions use.
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY; optional:
// RESEND_API_KEY (+ CONTACT_FROM), GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://iggysseaside.com",
  "https://www.iggysseaside.com",
  "http://localhost:5173",
  "http://localhost:5174",
];
const OWNER_EMAIL = "iggysbarevents@gmail.com";
// Until iggysseaside.com is verified in Resend, send from the domain that is.
const DEFAULT_FROM = "Iggy's Website <noreply@recoupappeals.com>";

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
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml(name: string, email: string | null, phone: string | null, subject: string, message: string): string {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#888;font-size:13px;vertical-align:top;">${label}</td>
     <td style="padding:4px 0;font-size:14px;color:#333;">${escapeHtml(value)}</td></tr>`;
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="border-bottom: 2px solid #2dd4bf; padding-bottom: 15px; margin-bottom: 20px;">
    <h2 style="margin: 0; color: #1a1a2e;">New website message</h2>
    <p style="margin: 4px 0 0; font-size: 13px; color: #888;">${escapeHtml(subject)}</p>
  </div>
  <table style="border-collapse:collapse;margin-bottom:16px;">
    ${row("From", name)}
    ${email ? row("Email", email) : ""}
    ${phone ? row("Phone", phone) : ""}
  </table>
  <div style="line-height: 1.6; white-space: pre-wrap; background:#f8f8f8; border-radius:8px; padding:14px;">${escapeHtml(message)}</div>
  <div style="margin-top: 24px; padding-top: 14px; border-top: 1px solid #eee; font-size: 12px; color: #999;">
    <p>Reply from the manager dashboard Inbox, or directly to the sender's email above.<br>
    Iggy's Bar in Seaside &bull; <a href="https://iggysseaside.com" style="color: #2dd4bf;">iggysseaside.com</a></p>
  </div>
</body>
</html>`;
}

/** Owner heads-up via Resend (preferred) or the existing Gmail connection. */
async function notifyOwner(name: string, email: string | null, phone: string | null, subject: string, message: string): Promise<void> {
  const html = buildHtml(name, email, phone, subject, message);
  const text = [
    `New website message — ${subject}`,
    "",
    `From: ${name}`,
    email ? `Email: ${email}` : "",
    phone ? `Phone: ${phone}` : "",
    "",
    message,
    "",
    "Reply from the manager dashboard Inbox.",
  ].filter(Boolean).join("\n");
  const mailSubject = `Website message from ${name} — ${subject}`.replace(/[\r\n\x00-\x1f]/g, "").slice(0, 200);

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (resendKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("CONTACT_FROM") || DEFAULT_FROM,
        to: [OWNER_EMAIL],
        subject: mailSubject,
        html,
        text,
        ...(email ? { reply_to: email } : {}),
      }),
    });
    if (!res.ok) throw new Error(`Resend: ${res.status} ${await res.text()}`);
    return;
  }

  // Gmail fallback — same OAuth connection as the other functions.
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

  const boundary = "boundary_" + crypto.randomUUID().replace(/-/g, "");
  const raw = [
    `From: Iggy's Website <${OWNER_EMAIL}>`,
    `To: ${OWNER_EMAIL}`,
    ...(email ? [`Reply-To: ${email}`] : []),
    `Subject: ${mailSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    text,
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "",
    html,
    `--${boundary}--`,
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
    const subject = clean(body.subject, 120) ?? "General Inquiry";
    const message = clean(body.message, 4000);

    if (!name) return json({ error: "Please tell us your name." }, 400);
    if (!message) return json({ error: "Please write a message." }, 400);
    if (!email && !phone) return json({ error: "Please leave an email or phone number." }, 400);
    if (email && !isValidEmail(email)) return json({ error: "That email doesn't look right." }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // System of record: the manager dashboard Inbox reads this table.
    const { error: insErr } = await admin.from("messages").insert({
      name,
      email,
      phone,
      subject,
      message,
      status: "unread",
    });
    if (insErr) throw new Error(`messages: ${insErr.message}`);

    // Best-effort owner heads-up — never blocks the submission.
    try {
      await notifyOwner(name, email, phone, subject, message);
    } catch (e) {
      console.error("owner notify failed (non-fatal):", e);
    }

    return json({ success: true });
  } catch (error) {
    console.error("submit-contact-message error:", error);
    return json({ error: "Something went wrong sending your message. Please try again or call us." }, 500);
  }
});
