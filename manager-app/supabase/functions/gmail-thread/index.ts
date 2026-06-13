// supabase/functions/gmail-thread/index.ts
// Returns the full Gmail conversation for a thread (inbound mail + the bar's own
// sent replies), so the manager Inbox can show the back-and-forth. Manager-auth
// only. Uses the shared Gmail OAuth token (iggysbarevents).
// Required secrets: SUPABASE_URL, SUPABASE_ANON_KEY, GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://iggysmanagement.netlify.app",
  "http://localhost:5173",
  "http://localhost:5174",
];
const OWNER = "iggysbarevents@gmail.com";

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".netlify.app") ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  if (!res.ok) throw new Error("token refresh failed");
  return (await res.json()).access_token;
}

type Hdr = { name: string; value: string };
const header = (hs: Hdr[], name: string) =>
  (hs.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value) || "";

function b64urlDecode(data: string): string {
  try {
    const bin = atob(data.replace(/-/g, "+").replace(/_/g, "/"));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch { return ""; }
}

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

// Trim quoted reply history ("On ... wrote:" and >-quoted lines) for a cleaner view.
function stripQuoted(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (/^On .+wrote:$/.test(line.trim())) break;
    if (/^-----Original Message-----/.test(line.trim())) break;
    out.push(line);
  }
  let s = out.join("\n").trim();
  // Drop a trailing run of >-quoted lines.
  s = s.replace(/(?:^>.*\n?)+$/m, "").trim();
  return s || text.trim();
}

function emailOf(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim().toLowerCase();
}
function nameOf(from: string): string {
  const m = from.match(/^\s*"?([^"<]*)"?\s*</);
  return (m?.[1].trim()) || emailOf(from);
}

serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { threadId, messageId } = await req.json();
    if ((!threadId || typeof threadId !== "string") && (!messageId || typeof messageId !== "string")) {
      return json({ error: "Missing threadId or messageId" }, 400);
    }

    const token = await getAccessToken();

    // Rows synced before threadId capture have only a message id — resolve the
    // thread from the message so threads work without a backfill.
    let tid = threadId;
    if (!tid && messageId) {
      const mRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=minimal`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (mRes.ok) tid = (await mRes.json()).threadId;
    }
    if (!tid) return json({ error: "Could not resolve the conversation" }, 404);

    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(tid)}?format=full`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return json({ error: "Could not load the conversation" }, 502);
    const data = await res.json();

    const messages = (data.messages || []).map((m: any) => {
      const hs: Hdr[] = m.payload?.headers || [];
      const from = header(hs, "From");
      const email = emailOf(from);
      const body = stripQuoted((extractText(m.payload) || m.snippet || "").trim()).slice(0, 12000);
      return {
        id: m.id,
        from_name: nameOf(from),
        from_email: email,
        from_me: email === OWNER,
        date: m.internalDate ? new Date(parseInt(m.internalDate, 10)).toISOString() : null,
        subject: header(hs, "Subject"),
        body,
      };
    });

    return json({ messages });
  } catch (error) {
    console.error("gmail-thread error:", error);
    return json({ error: error instanceof Error ? error.message : "failed" }, 500);
  }
});
