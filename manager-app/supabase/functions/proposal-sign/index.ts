// supabase/functions/proposal-sign/index.ts
// PUBLIC endpoint — the tokenized proposal portal's only write path.
//   action 'view' (default) → stamp viewed_at on FIRST view + bump status to 'viewed'
//   action 'sign'           → stamp signed_at + signer_name + signer_ip, status 'signed'
// Anon never writes the proposals table directly (no anon UPDATE policy); this
// function runs under the SERVICE ROLE so a stranger with a token can read their
// proposal but can only forge a signature THROUGH here, where we validate the
// token, require a non-empty name, and never downgrade a more-advanced status.
//
// Deploy: supabase functions deploy proposal-sign --no-verify-jwt
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

/** Best-effort client IP from the standard proxy headers (Supabase sits behind one). */
function clientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

type Action = "view" | "sign";

serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const token: string | undefined = typeof body.token === "string" ? body.token : undefined;
    const action: Action = body.action === "sign" ? "sign" : "view";
    const signerNameRaw: string =
      typeof body.signer_name === "string" ? body.signer_name.trim().slice(0, 120) : "";

    if (!token) return json({ error: "Missing token" }, 400);
    if (action === "sign" && !signerNameRaw) {
      return json({ error: "A typed name is required to sign." }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate the token → load the current proposal.
    const { data: proposal, error: loadErr } = await admin
      .from("proposals")
      .select("id,status,viewed_at,signed_at")
      .eq("token", token)
      .maybeSingle();
    if (loadErr) throw new Error(loadErr.message);
    if (!proposal) return json({ error: "Proposal not found" }, 404);

    const nowIso = new Date().toISOString();
    const updates: Record<string, unknown> = {};

    if (action === "sign") {
      // Idempotent: keep the first signature if one already exists.
      if (!proposal.signed_at) {
        updates.signed_at = nowIso;
        updates.signer_name = signerNameRaw;
        updates.signer_ip = clientIp(req);
      }
      // Never downgrade a deposit_paid proposal back to 'signed'.
      if (proposal.status !== "deposit_paid") updates.status = "signed";
      // Also record the view if this is somehow the first touch.
      if (!proposal.viewed_at) updates.viewed_at = nowIso;
    } else {
      // First view only — never overwrite an existing timestamp.
      if (!proposal.viewed_at) updates.viewed_at = nowIso;
      // Bump draft/sent → viewed; leave signed/deposit_paid untouched.
      if (proposal.status === "draft" || proposal.status === "sent") updates.status = "viewed";
    }

    if (Object.keys(updates).length > 0) {
      const { error: updErr } = await admin
        .from("proposals")
        .update(updates)
        .eq("id", proposal.id);
      if (updErr) throw new Error(updErr.message);
    }

    return json({ ok: true, action });
  } catch (error) {
    console.error("proposal-sign error:", error);
    return json({ error: error instanceof Error ? error.message : "Could not record signature" }, 500);
  }
});
