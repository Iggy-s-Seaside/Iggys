// supabase/functions/send-purchase-order/index.ts
// MANAGER endpoint — emails a draft purchase order to its vendor from
// iggysbarevents@gmail.com via the Gmail API. Mirrors send-party-email /
// generate-eon exactly (same Gmail OAuth refresh-token approach, same
// hardening). SAFE TO DEPLOY: it uses the EXISTING Gmail secrets — no new
// third-party credentials. If those secrets are absent the send is GATED:
// the function returns 503 { error: "Email is not configured" } and never
// attempts to send, so a half-provisioned environment can't email anyone.
//
// Flow: authenticate the manager (anon client + Authorization header), load
// the PO + its lines + the vendor with the SERVICE ROLE, compose a plain-text
// + branded-HTML order, send via Gmail, then stamp purchase_orders.status='sent'
// and sent_at = now(). Idempotency is the caller's job (it only sends drafts).
//
// Deploy: supabase functions deploy send-purchase-order
// Required secrets (all already set for send-party-email):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
//   GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://iggy-s-manager.netlify.app",
  "https://dev--iggy-s-manager.netlify.app",
  "http://localhost:5173",
  "http://localhost:5174",
];

const FROM_NAME = "Iggy's Bar in Seaside";
const FROM_EMAIL = "iggysbarevents@gmail.com";

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".netlify.app") ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

/** Strip CRLF and control characters from email header values (header-injection guard). */
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

const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;

/** Exchange the Gmail OAuth2 refresh token for a fresh access token, or null if unconfigured. */
async function getGmailAccessToken(): Promise<string | null> {
  const clientId = Deno.env.get("GMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) return null; // GATE: not configured

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
  return (await res.json()).access_token ?? null;
}

interface POLine {
  name: string;
  unit: string | null;
  qty: number;
  unit_cost: number;
}

/** Compose the plain-text purchase order body. */
function composePoText(vendorName: string, poId: number, lines: POLine[], total: number, notes: string | null): string {
  const out: string[] = [];
  out.push(`Purchase Order #${poId}`);
  out.push(`Vendor: ${vendorName}`);
  out.push(`Date: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`);
  out.push("");
  out.push("Please supply the following:");
  out.push("");
  for (const l of lines) {
    const unit = l.unit ? ` ${l.unit}${l.qty === 1 ? "" : "s"}` : "";
    out.push(`  - ${l.qty}×${unit} ${l.name} @ ${money(l.unit_cost)} = ${money(l.qty * l.unit_cost)}`);
  }
  out.push("");
  out.push(`ORDER TOTAL: ${money(total)}`);
  if (notes && notes.trim()) {
    out.push("");
    out.push(`Notes: ${notes.trim()}`);
  }
  out.push("");
  out.push("Thank you,");
  out.push("Iggy's Bar in Seaside");
  return out.join("\n");
}

/** Build an RFC 2822 multipart email (plain + branded HTML) and base64url-encode it. */
function buildRawEmail(to: string, subject: string, vendorName: string, poId: number, lines: POLine[], total: number, notes: string | null): string {
  const safeTo = sanitizeHeader(to);
  const safeSubject = sanitizeHeader(subject);
  const boundary = "boundary_" + crypto.randomUUID().replace(/-/g, "");

  const plainText = composePoText(vendorName, poId, lines, total, notes);

  const rows = lines
    .map(
      (l) =>
        `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;">${escapeHtml(l.name)}</td>` +
        `<td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${l.qty}${l.unit ? " " + escapeHtml(l.unit) : ""}</td>` +
        `<td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${money(l.unit_cost)}</td>` +
        `<td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${money(l.qty * l.unit_cost)}</td></tr>`
    )
    .join("");

  const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="border-bottom: 2px solid #2dd4bf; padding-bottom: 15px; margin-bottom: 20px;">
    <h2 style="margin: 0; color: #1a1a2e;">Iggy's Bar in Seaside</h2>
    <p style="margin: 4px 0 0; font-size: 13px; color: #888;">Purchase Order #${poId} &bull; ${escapeHtml(vendorName)}</p>
  </div>
  <p style="line-height:1.6;">Hi ${escapeHtml(vendorName)}, please supply the following for Iggy's Bar in Seaside:</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px;">
    <thead>
      <tr style="text-align:left;color:#777;font-size:12px;text-transform:uppercase;">
        <th style="padding:6px 8px;">Item</th>
        <th style="padding:6px 8px;text-align:center;">Qty</th>
        <th style="padding:6px 8px;text-align:right;">Unit</th>
        <th style="padding:6px 8px;text-align:right;">Line</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr style="font-weight:700;">
        <td colspan="3" style="padding:10px 8px;text-align:right;border-top:2px solid #111;">Order total</td>
        <td style="padding:10px 8px;text-align:right;border-top:2px solid #111;">${money(total)}</td>
      </tr>
    </tfoot>
  </table>
  ${notes && notes.trim() ? `<p style="margin-top:16px;color:#444;"><strong>Notes:</strong> ${escapeHtml(notes.trim())}</p>` : ""}
  <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; font-size: 12px; color: #999;">
    <p>Iggy's Bar in Seaside &bull; 200 S Franklin St, Seaside, OR 97138 &bull; (503) 738-0672</p>
  </div>
</body>
</html>`;

  const headers = [
    `From: ${sanitizeHeader(FROM_NAME)} <${FROM_EMAIL}>`,
    `To: ${safeTo}`,
    `Subject: ${safeSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
  ].join("\r\n");

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
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // ── AuthN: must be a signed-in manager (mirrors send-party-email) ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const authed = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await authed.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const poId = Number(body?.poId);
    if (!poId || Number.isNaN(poId)) return json({ error: "Missing or invalid poId" }, 400);
    // Optional override recipient (for "send to a different address" cases).
    const overrideTo: string | null = typeof body?.to === "string" ? body.to : null;

    // ── Load the PO + lines + vendor with the service role (bypasses RLS) ──
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: po, error: poErr } = await admin
      .from("purchase_orders")
      .select("id, status, total, notes, vendor_id, sent_at, purchase_order_items(name, unit, qty, unit_cost), vendors(name, email)")
      .eq("id", poId)
      .single();
    if (poErr || !po) return json({ error: "Purchase order not found" }, 404);

    // deno-lint-ignore no-explicit-any
    const vendor = (po as any).vendors as { name: string; email: string | null } | null;
    // deno-lint-ignore no-explicit-any
    const lines = (((po as any).purchase_order_items as POLine[]) || []).filter((l) => Number(l.qty) > 0);

    if (lines.length === 0) return json({ error: "This purchase order has no line items to send" }, 400);

    const to = overrideTo || vendor?.email || null;
    if (!to) return json({ error: "No vendor email on file. Add a vendor email or pass a recipient." }, 400);
    if (!isValidEmail(to)) return json({ error: "Vendor email is invalid" }, 400);

    const vendorName = vendor?.name || "Vendor";
    const total = Number((po as { total: number }).total) || lines.reduce((s, l) => s + Number(l.qty) * Number(l.unit_cost), 0);
    const notes = (po as { notes: string | null }).notes ?? null;

    // ── GATE: Gmail must be configured, else fail safe (never sends) ──
    const accessToken = await getGmailAccessToken();
    if (!accessToken) {
      return json({ error: "Email is not configured (missing Gmail secrets). Purchase order was not sent." }, 503);
    }

    const subject = `Purchase Order #${poId} — Iggy's Bar in Seaside`;
    const raw = buildRawEmail(to, subject, vendorName, poId, lines, total, notes);

    const gmailRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ raw }),
      }
    );
    if (!gmailRes.ok) {
      const errText = await gmailRes.text();
      throw new Error(`Gmail API error: ${gmailRes.status} ${errText}`);
    }
    const gmailData = await gmailRes.json();

    // ── Stamp the PO as sent (service role bypasses RLS) ──
    await admin
      .from("purchase_orders")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", poId);

    return json({ success: true, sentTo: to, gmailMessageId: gmailData.id });
  } catch (error) {
    console.error("send-purchase-order error:", error);
    return json({ error: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});
