// supabase/functions/gmail-sync/index.ts
// Pulls real Gmail inbox mail (Primary category) into the manager `messages`
// table so customer emails show up in the dashboard Inbox. Deduped by Gmail
// message id; mirrors Gmail's own read/unread state. Auth: an authenticated
// manager (JWT) OR the pg_cron job (x-cron-secret). Uses the shared Gmail
// OAuth token (iggysbarevents). Required secrets: SUPABASE_URL,
// SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN,
// optional CRON_SECRET.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://iggysmanagement.netlify.app",
  "http://localhost:5173",
  "http://localhost:5174",
];
const OWNER = "iggysbarevents@gmail.com";
// Exclude promo/social noise WITHOUT requiring tabbed categories (category:primary
// returns nothing on accounts that don't use Inbox tabs). If categories aren't
// enabled, the -category: clauses simply match nothing and all inbox mail flows in.
const QUERY = "in:inbox newer_than:30d -category:promotions -category:social";
const MAX_FETCH = 40;

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".netlify.app") ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

async function getAccessToken(): Promise<string> {
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
  if (!res.ok) throw new Error("token refresh failed: " + (await res.text()).slice(0, 160));
  return (await res.json()).access_token;
}

type Hdr = { name: string; value: string };
const header = (hs: Hdr[], name: string) =>
  (hs.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value) || "";

const EMAIL_RE = /[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+/;

function parseFrom(from: string): { name: string; email: string } {
  // Only ever consider the first address in the header.
  const first = from.split(',')[0].trim();
  const m = first.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (m) {
    const email = (m[2].match(EMAIL_RE)?.[0] || m[2].trim()).toLowerCase();
    return { name: (m[1].trim() || email), email };
  }
  const email = (first.match(EMAIL_RE)?.[0] || '').toLowerCase();
  return { name: email || first, email };
}

function b64urlDecode(data: string): string {
  try {
    const bin = atob(data.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

// Walk the MIME tree; prefer text/plain, fall back to stripped text/html.
function extractText(payload: any): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) return b64urlDecode(payload.body.data);
  if (Array.isArray(payload.parts)) {
    for (const p of payload.parts) {
      const t = extractText(p);
      if (t) return t;
    }
  }
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return b64urlDecode(payload.body.data).replace(/<[^>]+>/g, " ").replace(/\s+\n/g, "\n");
  }
  return "";
}

serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // Auth: cron secret OR an authenticated manager.
    let authed = false;
    const cronSecret = Deno.env.get("CRON_SECRET");
    const provided = req.headers.get("x-cron-secret");
    if (cronSecret && provided && provided === cronSecret) {
      authed = true;
    } else {
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await sb.auth.getUser();
        if (user) authed = true;
      }
    }
    if (!authed) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = await getAccessToken();

    // Optional query override (debugging / tuning).
    let q = QUERY;
    try { const b = await req.json(); if (typeof b?.q === "string" && b.q.trim()) q = b.q.trim(); } catch { /* no body */ }

    // 1) List candidate message ids.
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=50`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!listRes.ok) throw new Error("gmail list failed: " + (await listRes.text()).slice(0, 160));
    const listData = await listRes.json();
    const ids: string[] = (listData.messages || []).map((m: { id: string }) => m.id);

    // 2) Drop ids we already have.
    let have = new Set<string>();
    if (ids.length) {
      const { data: existing } = await admin.from("messages").select("gmail_id").in("gmail_id", ids);
      have = new Set((existing || []).map((r: { gmail_id: string }) => r.gmail_id));
    }
    const fresh = ids.filter((id) => !have.has(id));
    const todo = fresh.slice(0, MAX_FETCH);
    const truncated = fresh.length > MAX_FETCH || Boolean(listData.nextPageToken);
    if (truncated) {
      console.warn(`gmail-sync: ${fresh.length} new beyond cap ${MAX_FETCH} (nextPageToken=${!!listData.nextPageToken}); run again to catch up`);
    }

    // 3) Fetch + map each new message.
    const rows: Record<string, unknown>[] = [];
    for (const id of todo) {
      const mRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!mRes.ok) continue;
      const msg = await mRes.json();
      const hs: Hdr[] = msg.payload?.headers || [];
      const { name, email } = parseFrom(header(hs, "From"));
      if (!email || !EMAIL_RE.test(email) || email === OWNER) continue; // skip self / unparseable
      const labelIds: string[] = msg.labelIds || [];
      const created = msg.internalDate ? new Date(parseInt(msg.internalDate, 10)).toISOString() : null;
      const body = (extractText(msg.payload) || msg.snippet || "").trim().slice(0, 8000);
      rows.push({
        gmail_id: id,
        source: "gmail",
        name: name.slice(0, 120),
        email: email.slice(0, 254),
        subject: (header(hs, "Subject") || "(no subject)").slice(0, 300),
        message: body || "(no text content)",
        // Mirror Gmail's own read state so we don't flood the unread badge.
        status: labelIds.includes("UNREAD") ? "unread" : "read",
        ...(created ? { created_at: created } : {}),
      });
    }

    // 4) Insert (ignore any that raced in).
    if (rows.length) {
      const { error } = await admin
        .from("messages")
        .upsert(rows, { onConflict: "gmail_id", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    }

    return json({ synced: rows.length, scanned: ids.length, truncated });
  } catch (error) {
    console.error("gmail-sync error:", error);
    return json({ error: error instanceof Error ? error.message : "sync failed" }, 500);
  }
});
