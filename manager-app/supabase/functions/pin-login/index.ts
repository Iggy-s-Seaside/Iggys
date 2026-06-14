// supabase/functions/pin-login/index.ts
// POS-style 4-digit PIN login for the MANAGER app (shared terminal + personal phones).
//
// Two actions:
//   { action: "list" }            -> [{ id, name }] for every staff member who has a PIN
//                                    (names only — emails/hashes never leave the server).
//   { action: "login", id, pin }  -> verifies the PIN against staff_pins (PBKDF2, per-row
//                                    salt) with brute-force LOCKOUT, then mints a real
//                                    Supabase session via admin.generateLink (magiclink)
//                                    and returns { email, token } for the client to
//                                    exchange with supabase.auth.verifyOtp.
//
// A 4-digit PIN is low-entropy, so the REAL defense is server-side rate-limiting:
// 5 wrong tries -> locked 15 min. The hash is the secondary defense if the DB leaks.
// staff_pins is service-role-only (RLS on, no policies), so the hash never reaches a client.
//
// Deploy with --no-verify-jwt (the whole point is to authenticate someone who has no session yet).
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

function b64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}
function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
/** Constant-time string compare (avoid leaking hash via timing). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iters = parseInt(parts[1], 10);
  const salt = fromB64(parts[2]);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: iters, hash: "SHA-256" }, key, 256);
  return timingSafeEqual(b64(new Uint8Array(bits)), parts[3]);
}

serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // ── LIST: names for the picker (no emails, no hashes) ──
    if (action === "list") {
      const { data, error } = await admin
        .from("staff_pins")
        .select("id, name")
        .order("name", { ascending: true });
      if (error) throw new Error(error.message);
      return json({ staff: (data ?? []).map((r) => ({ id: r.id, name: r.name ?? "Staff" })) });
    }

    // ── LOGIN: verify PIN -> mint session ──
    if (action === "login") {
      const id = Number(body.id);
      const pin = typeof body.pin === "string" ? body.pin : "";
      if (!Number.isInteger(id) || !/^\d{4}$/.test(pin)) {
        return json({ error: "Enter your 4-digit PIN." }, 400);
      }

      const { data: row } = await admin.from("staff_pins").select("*").eq("id", id).maybeSingle();
      // Generic message either way so we don't reveal which names exist.
      if (!row) return json({ error: "That PIN didn't work." }, 401);

      if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
        return json({ error: `Locked — too many tries. Try again in a few minutes.`, locked: true }, 429);
      }

      const ok = await verifyPin(pin, row.pin_hash);
      if (!ok) {
        const attempts = (row.failed_attempts ?? 0) + 1;
        const locked = attempts >= MAX_ATTEMPTS;
        await admin
          .from("staff_pins")
          .update({
            failed_attempts: attempts,
            locked_until: locked ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null,
          })
          .eq("id", id);
        if (locked) return json({ error: `Too many tries — locked for ${LOCK_MINUTES} minutes.`, locked: true }, 429);
        return json({ error: "That PIN didn't work.", attempts_left: MAX_ATTEMPTS - attempts }, 401);
      }

      // Success: clear lockout state, mint a one-time login token for the real account.
      await admin.from("staff_pins").update({ failed_attempts: 0, locked_until: null }).eq("id", id);
      const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: row.email,
      });
      if (linkErr || !link?.properties?.email_otp) {
        console.error("[pin-login] generateLink failed:", linkErr?.message);
        return json({ error: "Couldn't start your session. Try the email sign-in." }, 500);
      }
      return json({ email: row.email, token: link.properties.email_otp });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("[pin-login] error:", e instanceof Error ? e.message : e);
    return json({ error: "Something went wrong. Try again." }, 500);
  }
});
