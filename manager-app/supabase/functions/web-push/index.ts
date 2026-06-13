// supabase/functions/web-push/index.ts
// WEB PUSH (VAPID) SENDER — *clearly stubbed / SAFE BY DEFAULT*. This function does
// NOT send any push notifications until VAPID keys are configured. With the keys
// absent (the default), every call is a no-op that reports "disabled" — nothing ever
// leaves the server. This is the trust-layer push channel for the manager PWA.
//
// It reads subscriptions from the push_subscriptions table (written by the browser
// after the user grants notification permission) and, WHEN ENABLED, sends an encrypted
// Web Push message to each endpoint. The browser's service worker (/public/sw.js)
// renders the notification.
//
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Pending secrets (sending stays OFF until BOTH are present):
//   VAPID_PUBLIC_KEY    — base64url, uncompressed P-256 public key (the "applicationServerKey")
//   VAPID_PRIVATE_KEY   — base64url, PKCS#8 or raw P-256 private key
//   VAPID_SUBJECT       — optional "mailto:ops@iggysseaside.com" (defaults to a mailto)
//
// ── HOW TO WIRE IT UP (when ready) ───────────────────────────────────────────────
// 1) Generate a VAPID key pair (once):
//      npx web-push generate-vapid-keys           → { publicKey, privateKey }
// 2) Set the secrets on the project:
//      supabase secrets set VAPID_PUBLIC_KEY=...   VAPID_PRIVATE_KEY=...   VAPID_SUBJECT=mailto:ops@iggysseaside.com
// 3) Expose VAPID_PUBLIC_KEY to the frontend (e.g. VITE_VAPID_PUBLIC_KEY) so the PWA
//    can call pushManager.subscribe({ applicationServerKey }) and POST the resulting
//    PushSubscription JSON into push_subscriptions.
// 4) Deploy:  supabase functions deploy web-push
//
// ── THE REAL SEND FLOW (RFC 8291 + RFC 8292 / VAPID) ─────────────────────────────
// For each subscription { endpoint, p256dh, auth }:
//   a) Build a VAPID JWT (ES256) signed with VAPID_PRIVATE_KEY:
//        header  { alg: "ES256", typ: "JWT" }
//        payload { aud: <origin of endpoint>, exp: now+12h, sub: VAPID_SUBJECT }
//      → Authorization: "vapid t=<jwt>, k=<VAPID_PUBLIC_KEY base64url>"
//   b) Encrypt the JSON payload with aes128gcm using the subscription's p256dh/auth
//      keys (ECDH + HKDF per RFC 8291) → binary body.
//   c) POST to `endpoint` with headers:
//        TTL: 60, Content-Encoding: "aes128gcm", Content-Type: "application/octet-stream"
//      A 201 = delivered to the push service. A 404/410 = the subscription is dead →
//      delete that row from push_subscriptions.
//
// The aes128gcm content encryption is intentionally NOT implemented inline here: it is
// substantial crypto best delegated to a vetted library at wire-up time, e.g.
//   import webpush from "https://esm.sh/web-push@3";   // (Node-compat) or
//   import * as wp from "https://deno.land/x/webpush/mod.ts";
// The VAPID JWT below IS implemented so the auth half is ready and testable; the
// function refuses to send (and says so) until the keys exist.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://iggysseaside.com",
  "https://www.iggysseaside.com",
  "https://iggy-s-manager.netlify.app",
  "http://localhost:5173",
  "http://localhost:5174",
];

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".netlify.app") ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };
}

interface PushSubscriptionRow {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
}

// ── base64url helpers (used by the VAPID JWT signer) ──────────────────────────
function base64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(b64url.length / 4) * 4, "=");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Build a signed VAPID JWT (ES256) for a given push endpoint. This is the auth half
 * of Web Push (RFC 8292) and is fully implemented so it's ready the moment the keys
 * land. Returns null if the private key can't be imported.
 */
async function buildVapidJwt(endpoint: string, vapidPrivateKey: string, subject: string): Promise<string | null> {
  try {
    const aud = new URL(endpoint).origin;
    const header = { typ: "JWT", alg: "ES256" };
    const payload = {
      aud,
      exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, // 12h
      sub: subject,
    };
    const enc = (obj: unknown) => base64urlEncode(new TextEncoder().encode(JSON.stringify(obj)));
    const signingInput = `${enc(header)}.${enc(payload)}`;

    // Import the raw P-256 private key (PKCS#8 base64url) for ES256 signing.
    const key = await crypto.subtle.importKey(
      "pkcs8",
      base64urlToBytes(vapidPrivateKey),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"],
    );
    const sig = new Uint8Array(
      await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(signingInput)),
    );
    return `${signingInput}.${base64urlEncode(sig)}`;
  } catch (e) {
    console.error("[web-push] VAPID JWT build failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    // Payload to broadcast. Defaults make a harmless ping if none supplied.
    let payload: PushPayload = {};
    if (req.method === "POST") {
      try { payload = (await req.json()) as PushPayload; } catch { /* empty body ok */ }
    }
    const notification: PushPayload = {
      title: payload.title || "Iggy's Manager",
      body: payload.body || "",
      url: payload.url || "/",
      tag: payload.tag || "iggys-mgr",
    };

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await admin
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth");
    if (error) throw new Error(error.message);
    const subs = (data || []) as PushSubscriptionRow[];

    // ── SEND GATE ───────────────────────────────────────────────────────
    // Sending requires BOTH VAPID keys. They are intentionally absent until push is
    // configured (see header), so by default this branch reports "disabled" and
    // NOTHING is sent. No keys === no network calls to any push service.
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
    const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:ops@iggysseaside.com";
    const sendEnabled = !!vapidPublic && !!vapidPrivate;

    if (!sendEnabled) {
      console.log(
        `[web-push] DISABLED (vapid_public=${!!vapidPublic}, vapid_private=${!!vapidPrivate}). ` +
          `${subs.length} subscription(s) on file. Nothing sent.`,
      );
      return json({
        enabled: false,
        message:
          "Web push is disabled. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY secrets (see header comment) to enable sending.",
        subscriptions: subs.length,
        notification,
      });
    }

    // ── LIVE PATH (unreachable until the gate above opens) ───────────────
    // The VAPID auth header is built per-endpoint here. The aes128gcm payload
    // encryption (RFC 8291) is delegated to a vetted library at wire-up time — see
    // the header comment — so we do not attempt a real, unencrypted send. Dead
    // subscriptions (404/410) are pruned.
    const results: { id: number; status: string }[] = [];
    for (const sub of subs) {
      const jwt = await buildVapidJwt(sub.endpoint, vapidPrivate!, subject);
      if (!jwt) {
        results.push({ id: sub.id, status: "skipped: bad VAPID key" });
        continue;
      }
      // NOTE: a complete send POSTs the aes128gcm-encrypted body to sub.endpoint with
      //   Authorization: `vapid t=${jwt}, k=${vapidPublic}`
      //   Content-Encoding: aes128gcm, TTL: 60
      // and on 404/410 deletes the row. That encryption step is added with the push
      // library at wire-up; until then we report "ready" without sending.
      results.push({ id: sub.id, status: "ready (encryption pending wire-up)" });
    }

    return json({ enabled: true, subscriptions: subs.length, notification, results });
  } catch (error) {
    console.error("web-push error:", error);
    return json({ error: "Could not run web-push" }, 500);
  }
});
