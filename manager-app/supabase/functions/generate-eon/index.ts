// supabase/functions/generate-eon/index.ts
// MANAGER endpoint — composes the End-of-Night (EON) report for a shift and emails it
// to the owner from iggysbarevents@gmail.com via the Gmail API. Gathers the shift's
// data DEFENSIVELY (a missing table never breaks the report), writes/patches an
// eon_reports row with the service role, stamps emailed_at, and returns the summary.
// A Luna narrative can be layered on later; for now the summary is composed server-side.
// Deploy: supabase functions deploy generate-eon
// Required secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
//                   GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://iggy-s-manager.netlify.app",
  "https://dev--iggy-s-manager.netlify.app",
  "http://localhost:5173",
  "http://localhost:5174",
];
const OWNER_EMAIL = "iggysbarevents@gmail.com";

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".netlify.app") ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

// The SERVICE day (business day) — mirrors src/utils/businessDay.ts. A bar's
// night spills past midnight, so we roll the day at 9:00am Pacific: any moment
// before the cutoff counts as the previous calendar date. This is the date the
// EON's parties/events query and header must use, so the report matches the
// night actually being closed (not the next morning's calendar date).
const BUSINESS_DAY_CUTOFF_HOUR = 9;
const BUSINESS_DAY_TZ = "America/Los_Angeles";
function todayKey(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_DAY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  // Anchor the Pacific calendar date at UTC noon (DST-safe whole-day math).
  const anchor = new Date(Date.UTC(get("year"), get("month") - 1, get("day"), 12, 0, 0));
  if (get("hour") < BUSINESS_DAY_CUTOFF_HOUR) {
    anchor.setUTCDate(anchor.getUTCDate() - 1);
  }
  return `${anchor.getUTCFullYear()}-${pad(anchor.getUTCMonth() + 1)}-${pad(anchor.getUTCDate())}`;
}
function fmtCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  return `${sign}$${(abs / 100).toFixed(2)}`;
}
function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n\x00-\x1f]/g, "").trim();
}
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Exchange the Gmail OAuth2 refresh token for a fresh access token. */
async function getGmailAccessToken(): Promise<string | null> {
  const clientId = Deno.env.get("GMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) return null;

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
  if (!res.ok) return null;
  return (await res.json()).access_token ?? null;
}

/** Build a multipart RFC 2822 email (plain + branded HTML) and base64url-encode it. */
function buildRawEmail(to: string, subject: string, body: string): string {
  const safeTo = sanitizeHeader(to);
  const safeSubject = sanitizeHeader(subject);
  const boundary = "boundary_" + crypto.randomUUID().replace(/-/g, "");
  const headers = [
    `From: Iggy's Bar in Seaside <${OWNER_EMAIL}>`,
    `To: ${safeTo}`,
    `Subject: ${safeSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
  ].join("\r\n");

  const safeBody = escapeHtml(body);
  const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="border-bottom: 2px solid #2dd4bf; padding-bottom: 15px; margin-bottom: 20px;">
    <h2 style="margin: 0; color: #1a1a2e;">Iggy's Bar in Seaside</h2>
    <p style="margin: 4px 0 0; font-size: 13px; color: #888;">End-of-Night Report</p>
  </div>
  <div style="line-height: 1.6; white-space: pre-wrap;">${safeBody.replace(/\n/g, "<br>")}</div>
  <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; font-size: 12px; color: #999;">
    <p>Iggy's Bar in Seaside &bull; Seaside, Oregon</p>
  </div>
</body>
</html>`;

  const message = [
    headers,
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    body,
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

// deno-lint-ignore no-explicit-any
type Admin = ReturnType<typeof createClient<any>>;

/** Run a query and swallow any failure (missing table, RLS) into null. */
async function safe<T>(fn: () => Promise<{ data: T | null; error: unknown }>): Promise<T | null> {
  try {
    const { data, error } = await fn();
    if (error) return null;
    return data ?? null;
  } catch {
    return null;
  }
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
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await authed.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    let body: { shift_id?: number | null; generated_by?: string | null } = {};
    try { body = await req.json(); } catch { /* allow empty body */ }
    const shiftId = body.shift_id ?? null;
    const generatedBy = body.generated_by ?? user.email ?? null;
    const date = todayKey();

    const admin: Admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const metrics: Record<string, unknown> = { date, shift_id: shiftId };
    const lines: string[] = [];

    // ── Events / parties today ──
    const parties = await safe<Array<Record<string, unknown>>>(() =>
      admin
        .from("parties")
        .select("title,contact_name,guest_count,start_time,space,space_name,status")
        .eq("event_date", date),
    );
    const liveParties = (parties || []).filter((p) => p.status !== "cancelled");
    metrics.parties = liveParties;

    const events = await safe<Array<Record<string, unknown>>>(() =>
      admin
        .from("events")
        .select("title,time,category")
        .eq("active", true)
        .eq("date", date),
    );
    metrics.events = events || [];

    const eventLines: string[] = [];
    liveParties.forEach((p) => {
      const who = p.title || p.contact_name || "Private event";
      const guests = p.guest_count ? ` (${p.guest_count} guests)` : "";
      const where = p.space_name || p.space ? ` @ ${p.space_name || p.space}` : "";
      eventLines.push(`• ${who}${guests}${where}`);
    });
    (events || []).forEach((e) => {
      eventLines.push(`• ${e.title}${e.time ? ` — ${e.time}` : ""}`);
    });
    const eventCount = liveParties.length + (events?.length ?? 0);

    // ── Checklist completion ──
    const checklist = await safe<Array<Record<string, unknown>>>(() => {
      let q = admin.from("checklist_runs").select("label,status,done");
      if (shiftId != null) q = q.eq("shift_id", shiftId);
      return q;
    });
    if (checklist) {
      const total = checklist.length;
      const done = checklist.filter((r) => r.done === true || r.status === "done").length;
      metrics.checklist = { total, done };
    }

    // ── Line-check fails ──
    const lineChecks = await safe<Array<Record<string, unknown>>>(() => {
      let q = admin.from("line_checks").select("label,status,passed,note");
      if (shiftId != null) q = q.eq("shift_id", shiftId);
      return q;
    });
    const lineCheckFails = (lineChecks || []).filter((r) => r.passed === false || r.status === "fail");
    metrics.lineCheckFails = lineCheckFails;

    // ── Shift log highlights ──
    const logHighlights = await safe<Array<Record<string, unknown>>>(() => {
      let q = admin.from("shift_log").select("note,kind,created_at").order("created_at", { ascending: false }).limit(10);
      if (shiftId != null) q = q.eq("shift_id", shiftId);
      return q;
    });
    metrics.logHighlights = logHighlights || [];

    // ── Low stock at close ──
    const inventory = await safe<Array<Record<string, unknown>>>(() =>
      admin.from("inventory_items").select("name,current_quantity,par_level,unit,active"),
    );
    const lowStock = (inventory || []).filter(
      (i) => i.active && Number(i.current_quantity) <= Number(i.par_level),
    );
    metrics.lowStock = lowStock;

    // ── Cash over/short (most recent count for this shift, else latest) ──
    const cashCounts = await safe<Array<Record<string, unknown>>>(() => {
      let q = admin
        .from("cash_counts")
        .select("expected_cents,counted_cents,over_short_cents,note,created_at")
        .order("created_at", { ascending: false })
        .limit(1);
      if (shiftId != null) q = q.eq("shift_id", shiftId);
      return q;
    });
    const cash = cashCounts?.[0] ?? null;
    let cashLine = "No till count recorded.";
    if (cash) {
      const os = Number(cash.over_short_cents);
      cashLine =
        os === 0
          ? `Till balanced (${fmtCents(Number(cash.counted_cents))}).`
          : os > 0
            ? `Over by ${fmtCents(os)} (counted ${fmtCents(Number(cash.counted_cents))}).`
            : `Short by ${fmtCents(Math.abs(os))} (counted ${fmtCents(Number(cash.counted_cents))}).`;
      metrics.cash = {
        expected_cents: Number(cash.expected_cents),
        counted_cents: Number(cash.counted_cents),
        over_short_cents: Number(cash.over_short_cents),
      };
    }

    // ── Compose the plain-text summary ──
    const cl = metrics.checklist as { done: number; total: number } | undefined;
    lines.push(`End-of-Night — ${date}`);
    lines.push("");
    lines.push(`Events & parties today: ${eventCount}`);
    if (eventLines.length) lines.push(...eventLines);
    lines.push("");
    lines.push(cl ? `Checklist: ${cl.done}/${cl.total} complete` : "Checklist: not tracked");
    lines.push(`Line-check fails: ${lineCheckFails.length}`);
    if (lineCheckFails.length) {
      lineCheckFails.forEach((f) => lines.push(`  ✗ ${f.label ?? "check"}${f.note ? ` — ${f.note}` : ""}`));
    }
    lines.push(`Low stock at close: ${lowStock.length} item${lowStock.length === 1 ? "" : "s"}`);
    if (lowStock.length) {
      lowStock.slice(0, 12).forEach((i) =>
        lines.push(`  • ${i.name} (${i.current_quantity}/${i.par_level} ${i.unit ?? ""})`.trimEnd()),
      );
    }
    if (logHighlights && logHighlights.length) {
      lines.push("");
      lines.push("Shift log:");
      logHighlights.forEach((l) => lines.push(`  • ${l.note ?? ""}`.trimEnd()));
    }
    lines.push("");
    lines.push(`Cash: ${cashLine}`);
    if (cash?.note) lines.push(`  ${cash.note}`);

    const summary = lines.join("\n");

    // ── Persist the eon_reports row (service role bypasses RLS) ──
    const { data: inserted, error: insertErr } = await admin
      .from("eon_reports")
      .insert({
        shift_id: shiftId,
        generated_by: generatedBy,
        summary,
        metrics,
      })
      .select("*")
      .single();
    if (insertErr) throw new Error(insertErr.message);
    const report = inserted as Record<string, unknown>;

    // ── Email the owner (best-effort — report is saved regardless) ──
    let emailed = false;
    try {
      const accessToken = await getGmailAccessToken();
      if (accessToken) {
        const raw = buildRawEmail(OWNER_EMAIL, `End-of-Night — ${date}`, summary);
        const gmailRes = await fetch(
          "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ raw }),
          },
        );
        emailed = gmailRes.ok;
        if (!gmailRes.ok) console.error("generate-eon gmail error:", gmailRes.status, await gmailRes.text());
      } else {
        console.error("generate-eon: Gmail secrets missing — report saved but not emailed");
      }
    } catch (e) {
      console.error("generate-eon email failed (non-fatal):", e);
    }

    // ── Stamp emailed_at when the email actually went out ──
    if (emailed && report.id != null) {
      const emailedAt = new Date().toISOString();
      await admin.from("eon_reports").update({ emailed_at: emailedAt }).eq("id", report.id);
      report.emailed_at = emailedAt;
    }

    return json({ success: true, emailed, summary, report });
  } catch (error) {
    console.error("generate-eon error:", error);
    return json({ error: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});
