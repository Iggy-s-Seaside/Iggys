// supabase/functions/track-event/index.ts
// PUBLIC endpoint — records one funnel event into public.funnel_events via the
// service role. Fire-and-forget from the website (estimator_engaged ->
// estimator_cta_clicked -> form_started -> booking_submitted). No PII required;
// session_id is an anonymous client id. Deploy with --no-verify-jwt.
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-provided).

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

serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const body = await req.json().catch(() => ({}));
    const event = typeof body.event === "string" ? body.event.slice(0, 80) : "";
    if (!event) return json({ error: "event required" }, 400);
    const session_id = typeof body.session_id === "string" ? body.session_id.slice(0, 80) : null;
    const props = body.props && typeof body.props === "object" ? body.props : {};

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { error } = await admin.from("funnel_events").insert({ event, session_id, props });
    if (error) throw new Error(error.message);

    return json({ ok: true });
  } catch (error) {
    console.error("track-event error:", error);
    // Never surface an error to the page — tracking must be invisible.
    return json({ ok: false }, 200);
  }
});
