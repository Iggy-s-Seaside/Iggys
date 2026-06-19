// supabase/functions/manage-users/index.ts
// Supabase Edge Function — manual manager-account administration for the
// dashboard Team page. Public signup is blocked by a DB trigger that only
// admits emails present in public.manager_allowlist; this function (service
// role) adds the allowlist row, creates the user, and returns a one-time
// temp password. Any authenticated manager may manage the team (single-
// tenant app; the bar's managers are mutually trusted).
// Actions: list | create {email, role?} | reset_password {user_id} | delete {user_id}
// Each account carries a role (owner|manager|employee) stored on the allowlist
// row AND mirrored into the auth user's app_metadata for cheap client reads.
// Required secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email) && email.length < 254;
}

type Role = "owner" | "manager" | "employee";
const ROLES: Role[] = ["owner", "manager", "employee"];
const isRole = (v: unknown): v is Role => typeof v === "string" && (ROLES as string[]).includes(v);

/** Hash a 4-digit PIN with PBKDF2-SHA256 + per-row salt (verified by pin-login). */
async function hashPin(pin: string): Promise<string> {
  const iters = 120000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: iters, hash: "SHA-256" }, key, 256);
  const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
  return `pbkdf2$${iters}$${b64(salt)}$${b64(new Uint8Array(bits))}`;
}

/** Read the role an existing auth user carries (app_metadata first, allowlist fallback). */
function roleFromMetadata(meta: Record<string, unknown> | null | undefined): Role | null {
  const r = meta?.role;
  return isRole(r) ? r : null;
}

/** Random, readable temp password (no ambiguous chars). Shown ONCE. */
function tempPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // Caller must be an authenticated manager.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const {
      data: { user: caller },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !caller) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, email, user_id, role, pin, name } = await req.json();

    // ── SERVER-SIDE ROLE GATE ──
    // The app's UI gates Team to owners, but a UI gate is not security: this fn
    // runs on the service role, so without a check here any authenticated
    // employee could POST {action:'create', role:'owner'} and escalate. Resolve
    // the caller's real role from the allowlist and enforce: employees blocked
    // entirely; managers may 'list'; only the owner may create/delete/reset.
    const { data: callerRow } = await admin
      .from("manager_allowlist")
      .select("role")
      .ilike("email", caller.email ?? "")
      .maybeSingle();
    const callerRole: Role = isRole(callerRow?.role) ? callerRow.role : "employee";
    const isManagerPlus = callerRole === "owner" || callerRole === "manager";
    // set_pin is special: a user may set their OWN pin (self-service), and the
    // owner may set anyone's. Everything else is owner-only (list is manager+).
    const isSelfPinSet = action === "set_pin" && typeof user_id === "string" && user_id === caller.id;
    if (!isManagerPlus && !isSelfPinSet) return json({ error: "Forbidden" }, 403);
    if (action !== "list" && action !== "set_pin" && callerRole !== "owner") {
      return json({ error: "Only the owner can manage team accounts." }, 403);
    }
    if (action === "set_pin" && callerRole !== "owner" && !isSelfPinSet) {
      return json({ error: "Only the owner can set another teammate's PIN." }, 403);
    }

    // ── LIST ──
    if (action === "list") {
      const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (error) throw new Error(error.message);

      // Allowlist holds the source-of-truth role; app_metadata mirrors it but
      // pre-migration accounts may only have it on the allowlist row.
      const { data: allow } = await admin.from("manager_allowlist").select("email, role");
      const roleByEmail = new Map<string, Role>();
      for (const row of allow ?? []) {
        if (row?.email && isRole(row.role)) roleByEmail.set(String(row.email).toLowerCase(), row.role);
      }

      const users = data.users.map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        is_me: u.id === caller.id,
        role:
          roleFromMetadata(u.app_metadata as Record<string, unknown> | undefined) ??
          (u.email ? roleByEmail.get(u.email.toLowerCase()) : undefined) ??
          "employee",
      }));
      return json({ users });
    }

    // ── SET PIN ── (owner sets anyone's; a user may set their own)
    if (action === "set_pin") {
      const targetId = typeof user_id === "string" ? user_id : "";
      if (!targetId) return json({ error: "Missing user." }, 400);
      if (!/^\d{4}$/.test(String(pin ?? ""))) return json({ error: "PIN must be exactly 4 digits." }, 400);
      // Block trivially-guessable PINs so a money-guarding code isn't 0000/1234.
      if (["0000", "1234", "1111", "2222", "9999"].includes(String(pin))) {
        return json({ error: "Pick a less obvious PIN." }, 400);
      }
      const { data: u, error: uErr } = await admin.auth.admin.getUserById(targetId);
      if (uErr || !u?.user?.email) return json({ error: "User not found." }, 404);
      const targetEmail = u.user.email.toLowerCase();
      const displayName =
        (typeof name === "string" && name.trim()) || targetEmail.split("@")[0];
      const pin_hash = await hashPin(String(pin));
      const { error: upErr } = await admin
        .from("staff_pins")
        .upsert(
          { email: targetEmail, name: displayName, pin_hash, failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() },
          { onConflict: "email" },
        );
      if (upErr) throw new Error(upErr.message);
      return json({ success: true });
    }

    // ── CREATE ──
    if (action === "create") {
      const target = typeof email === "string" ? email.trim().toLowerCase() : "";
      if (!isValidEmail(target)) return json({ error: "Enter a valid email address." }, 400);

      // Role: optional, defaults to manager; reject anything off the enum.
      let newRole: Role = "manager";
      if (role !== undefined && role !== null && role !== "") {
        if (!isRole(role)) return json({ error: "Invalid role." }, 400);
        newRole = role;
      }

      // Allowlist first: the auth.users insert trigger requires it.
      const { error: alErr } = await admin
        .from("manager_allowlist")
        .upsert({ email: target, added_by: caller.email ?? caller.id, role: newRole });
      if (alErr) throw new Error(`allowlist: ${alErr.message}`);

      const password = tempPassword();
      const { data, error } = await admin.auth.admin.createUser({
        email: target,
        password,
        email_confirm: true,
        app_metadata: { role: newRole },
      });
      if (error) {
        // Roll the allowlist entry back so a failed create leaves no door open.
        await admin.from("manager_allowlist").delete().eq("email", target);
        return json({ error: error.message }, 400);
      }
      return json({ created: { id: data.user.id, email: target, role: newRole }, temp_password: password });
    }

    // ── RESET PASSWORD ──
    if (action === "reset_password") {
      if (typeof user_id !== "string" || !user_id) return json({ error: "Missing user_id" }, 400);
      const password = tempPassword();
      const { data, error } = await admin.auth.admin.updateUserById(user_id, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ reset: { id: user_id, email: data.user.email }, temp_password: password });
    }

    // ── DELETE ──
    if (action === "delete") {
      if (typeof user_id !== "string" || !user_id) return json({ error: "Missing user_id" }, 400);
      if (user_id === caller.id) return json({ error: "You can't remove your own account." }, 400);

      const { data: target, error: getErr } = await admin.auth.admin.getUserById(user_id);
      if (getErr || !target?.user) return json({ error: "User not found" }, 404);

      const { error } = await admin.auth.admin.deleteUser(user_id);
      if (error) return json({ error: error.message }, 400);
      if (target.user.email) {
        await admin.from("manager_allowlist").delete().eq("email", target.user.email.toLowerCase());
      }
      return json({ deleted: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("manage-users error:", error);
    return json({ error: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});
