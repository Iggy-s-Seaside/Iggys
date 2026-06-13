// supabase/functions/submit-feedback/index.ts
// PUBLIC endpoint — the table-side /feedback QR page POSTs here. Mirrors
// submit-contact-message: a service-role INSERT (into `feedback`) is the point,
// so guest feedback lands in the manager Reputation page (realtime). The form
// is FTC-SAFE: the public-review CTA is shown to EVERY guest regardless of
// rating, and `public_review_clicked` is recorded only as funnel analytics —
// we never route or gate by sentiment.
//
// Public writes go through the SERVICE ROLE here (not a direct anon INSERT), so
// the `feedback` table needs no anon grant and stays tamper-resistant.
//
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://iggysseaside.com",
  "https://www.iggysseaside.com",
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

function isValidEmail(email: string): boolean {
  return /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email) && email.length < 254;
}
const clean = (v: unknown, max = 2000): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

const VALID_AREAS = ["food", "drinks", "service", "atmosphere", "other"];

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

    // Rating is optional but, when present, must be 1–5.
    let rating: number | null = null;
    if (body.rating != null && body.rating !== "") {
      const n = Number(body.rating);
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        return json({ error: "Rating must be between 1 and 5." }, 400);
      }
      rating = n;
    }

    const areaRaw = clean(body.area, 40)?.toLowerCase() ?? null;
    const area = areaRaw && VALID_AREAS.includes(areaRaw) ? areaRaw : null;
    const comment = clean(body.comment, 4000);
    const contactEmail = clean(body.contact_email, 254)?.toLowerCase() ?? null;
    const publicReviewClicked = body.public_review_clicked === true;

    // Require *something* — a rating, a comment, or that they went to leave a
    // public review. Empty submissions are dropped without an error.
    if (rating == null && !comment && !publicReviewClicked) {
      return json({ error: "Please add a rating or a comment." }, 400);
    }
    if (contactEmail && !isValidEmail(contactEmail)) {
      return json({ error: "That email doesn't look right." }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: insErr } = await admin.from("feedback").insert({
      area,
      rating,
      comment,
      contact_email: contactEmail,
      public_review_clicked: publicReviewClicked,
    });
    if (insErr) throw new Error(`feedback: ${insErr.message}`);

    return json({ success: true });
  } catch (error) {
    console.error("submit-feedback error:", error);
    return json({ error: "Something went wrong sending your feedback. Please try again." }, 500);
  }
});
