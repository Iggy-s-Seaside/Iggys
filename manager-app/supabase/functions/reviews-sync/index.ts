// supabase/functions/reviews-sync/index.ts
// REVIEWS INGEST — *clearly stubbed*. SAFE BY DEFAULT: this function does NOT
// reach out to Google Business Profile (or any platform) yet. Until the GBP
// OAuth credentials below are present, it NO-OPS cleanly and returns a status
// payload describing what it WOULD do. Nothing is posted, sent, or fetched.
//
// It is gated behind BOTH a master flag and the required GBP credentials — all
// intentionally absent until Google Business Profile API access is granted.
//
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Pending secrets (ingest stays off until ALL are present + the flag is "true"):
//   REVIEWS_SYNC_ENABLED   = "true"     — master kill-switch (defaults off)
//   GBP_CLIENT_ID                       — Google OAuth client id
//   GBP_CLIENT_SECRET                   — Google OAuth client secret
//   GBP_REFRESH_TOKEN                   — long-lived refresh token (offline access)
//   GBP_ACCOUNT_ID                      — GBP account resource id (accounts/{id})
//   GBP_LOCATION_ID                     — GBP location resource id (locations/{id})
//
// ── REAL GOOGLE BUSINESS PROFILE FLOW (to wire once API access is approved) ──────
//  1) Exchange the refresh token for an access token:
//       POST https://oauth2.googleapis.com/token
//         grant_type=refresh_token, client_id, client_secret, refresh_token
//     → { access_token }
//  2) Page through reviews for the location:
//       GET https://mybusinessbusinessinformation.googleapis.com/v1/
//           accounts/{GBP_ACCOUNT_ID}/locations/{GBP_LOCATION_ID}/reviews
//         (legacy: mybusiness.googleapis.com/v4/.../reviews)
//       Authorization: Bearer {access_token}, paginate via nextPageToken
//     → reviews[]: { reviewId, reviewer.displayName, starRating ('FIVE'…'ONE'),
//                    comment, createTime, name (deep link) }
//  3) Map each review → a row and UPSERT on (source, external_id) so re-syncs
//     don't duplicate (the reviews_source_external_idx unique index backs this):
//       { source:'google', external_id:reviewId, author, rating (1–5 int from
//         starRating word), body:comment, url, sentiment (derived), created_at }
//  4) (optional) For reviews with an existing GBP reply, set replied=true.
//  Run on a schedule (Supabase cron) once live. Errors are logged, never thrown
//  to the caller — a sync failure must not break the manager dashboard.
// ─────────────────────────────────────────────────────────────────────────────────

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

// Star word → integer, for when the real ingest lands. Exported-in-spirit helper
// kept here so the mapping lives next to the flow doc above.
const STAR_WORD_TO_INT: Record<string, number> = {
  ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
};
function sentimentFor(rating: number): string {
  return rating >= 4 ? "positive" : rating === 3 ? "neutral" : "negative";
}

/** True only when EVERY credential needed for a real GBP sync is configured. */
function gbpConfigured(): boolean {
  const enabled = (Deno.env.get("REVIEWS_SYNC_ENABLED") || "").toLowerCase() === "true";
  const creds = [
    "GBP_CLIENT_ID",
    "GBP_CLIENT_SECRET",
    "GBP_REFRESH_TOKEN",
    "GBP_ACCOUNT_ID",
    "GBP_LOCATION_ID",
  ];
  return enabled && creds.every((k) => !!Deno.env.get(k));
}

serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    // SAFE STUB: when GBP isn't fully configured, do nothing and say so.
    if (!gbpConfigured()) {
      console.log("reviews-sync: GBP not configured — no-op (stub).");
      return json({
        ok: true,
        configured: false,
        synced: 0,
        message:
          "Reviews sync is not configured. Set REVIEWS_SYNC_ENABLED=true and the GBP_* " +
          "credentials to enable Google Business Profile ingest. No network calls were made.",
      });
    }

    // ── Live path (only reached once ALL creds + the flag are present) ──
    // The real GBP fetch + upsert goes here, following the flow documented in
    // the header. Until those credentials exist this branch is never taken, so
    // there is no real third-party call in this codebase. The service-role
    // client below is created only on the live path so the stub stays inert.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Defensive: even with the flag on, refuse to invent reviews. The upsert
    // shape is shown so the wiring is unambiguous; `incoming` is empty until the
    // real GBP fetch (header step 2) populates it.
    type IncomingReview = {
      external_id: string;
      author: string | null;
      rating: number;
      body: string | null;
      url: string | null;
      created_at: string;
    };
    const incoming: IncomingReview[] = []; // ← real GBP fetch fills this

    let synced = 0;
    if (incoming.length > 0) {
      const rows = incoming.map((r) => ({
        source: "google",
        external_id: r.external_id,
        author: r.author,
        rating: r.rating,
        body: r.body,
        url: r.url,
        sentiment: sentimentFor(r.rating),
        created_at: r.created_at,
      }));
      const { error, count } = await admin
        .from("reviews")
        .upsert(rows, { onConflict: "source,external_id", count: "exact", ignoreDuplicates: false });
      if (error) throw new Error(`reviews upsert: ${error.message}`);
      synced = count ?? rows.length;
    }

    return json({ ok: true, configured: true, synced });
  } catch (error) {
    // Never throw to the caller — a sync failure must not break the dashboard.
    console.error("reviews-sync error:", error);
    return json({ ok: false, configured: gbpConfigured(), synced: 0, error: "Reviews sync failed" }, 500);
  }
});

// Referenced by the live-path mapping (header step 3). Kept to document the
// star-word → integer conversion the GBP API requires.
void STAR_WORD_TO_INT;
