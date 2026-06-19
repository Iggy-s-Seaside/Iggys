// supabase/functions/social-publish/index.ts
// SOCIAL DRAFT-QUEUE PUBLISHER — *clearly stubbed*. SAFE BY DEFAULT: this function
// does NOT post to Instagram / Facebook / Google Business Profile yet.
//
// It reads social_posts that a human has already approved/scheduled and are DUE now,
// validates them, and (while live posting is disabled) leaves their status unchanged.
// Real publishing is guarded behind BOTH an env flag and the required access tokens —
// all of which are intentionally absent until Meta App Review lands. See below.
//
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Pending secrets (live posting stays off until ALL are present + the flag is "true"):
//   SOCIAL_PUBLISH_ENABLED = "true"     — master kill-switch (defaults off)
//   IG_ACCESS_TOKEN                     — long-lived Instagram Graph token
//   FB_PAGE_ID                          — Facebook Page id (and IG business account)
//   (Google Business Profile creds — separate OAuth, wired in the same place later)
//
// ── REAL GRAPH API FLOW (to wire once Meta App Review is approved) ───────────────
// Instagram (Graph API, two-step container → publish):
//   1) POST https://graph.facebook.com/v21.0/{ig_user_id}/media
//        ?image_url={image_url}&caption={caption}&access_token={IG_ACCESS_TOKEN}
//      → returns { id: creation_id }   (the media "container")
//   2) POST https://graph.facebook.com/v21.0/{ig_user_id}/media_publish
//        ?creation_id={creation_id}&access_token={IG_ACCESS_TOKEN}
//      → returns { id: published_media_id }   → store in external_post_ids.instagram
// Facebook Page photo post:
//   POST https://graph.facebook.com/v21.0/{FB_PAGE_ID}/photos
//        ?url={image_url}&caption={caption}&access_token={PAGE_ACCESS_TOKEN}
//      → returns { id, post_id }   → store post_id in external_post_ids.facebook
// Google Business Profile (separate API + OAuth):
//   POST https://mybusiness.googleapis.com/v4/{location}/localPosts
//        body { languageCode, summary, media:[{mediaFormat:PHOTO, sourceUrl}] }
//      → returns the localPost name   → store in external_post_ids.google
// On success: status='posted', external_post_ids merged, error=null.
// On failure: status='failed', error=<message>. Each platform is independent.
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

const VALID_PLATFORMS = ["instagram", "facebook", "google"];

interface SocialPostRow {
  id: number;
  source: string;
  ref_id: number | null;
  image_url: string | null;
  caption: string | null;
  target_platforms: string[] | null;
  scheduled_at: string | null;
  status: string;
}

/** A post is "ready" if it has a caption, at least one valid platform, and an image. */
function validate(post: SocialPostRow): string | null {
  const platforms = (post.target_platforms || []).filter((p) => VALID_PLATFORMS.includes(p));
  if (platforms.length === 0) return "No valid target platforms.";
  if (!post.caption || !post.caption.trim()) return "Caption is empty.";
  // Instagram requires an image; Facebook/Google strongly prefer one.
  if (!post.image_url) return "No image attached.";
  return null;
}

serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Pull approved/scheduled posts that are DUE now (scheduled_at <= now, or null = asap).
    const nowIso = new Date().toISOString();
    const { data, error } = await admin
      .from("social_posts")
      .select("id,source,ref_id,image_url,caption,target_platforms,scheduled_at,status")
      .in("status", ["approved", "scheduled"])
      .or(`scheduled_at.is.null,scheduled_at.lte.${nowIso}`)
      .order("scheduled_at", { ascending: true, nullsFirst: true });
    if (error) throw new Error(error.message);

    const due = (data || []) as SocialPostRow[];

    // ── LIVE-POSTING GATE ──────────────────────────────────────────────
    // Live posting requires the master flag AND every required token to be present.
    // All are intentionally absent until Meta App Review is approved, so by default
    // this branch is never taken — the function only validates and reports.
    const flagOn = Deno.env.get("SOCIAL_PUBLISH_ENABLED") === "true";
    const igToken = Deno.env.get("IG_ACCESS_TOKEN");
    const fbPageId = Deno.env.get("FB_PAGE_ID");
    const liveEnabled = flagOn && !!igToken && !!fbPageId;

    if (!liveEnabled) {
      // Disabled: do a dry-run validation pass and leave every row's status UNCHANGED.
      // We never mark anything 'posted' or 'failed' here — that would imply a real send.
      const report = due.map((p) => {
        const problem = validate(p);
        return { id: p.id, ready: problem === null, reason: problem };
      });
      const readyCount = report.filter((r) => r.ready).length;
      console.log(
        `[social-publish] DISABLED (flag=${flagOn}, ig=${!!igToken}, fb=${!!fbPageId}). ` +
          `${due.length} due, ${readyCount} would post. No posts sent. Statuses unchanged.`
      );
      return json({
        enabled: false,
        message:
          "Live posting is disabled. Set SOCIAL_PUBLISH_ENABLED=true and provide IG_ACCESS_TOKEN + FB_PAGE_ID (after Meta App Review) to go live.",
        due: due.length,
        ready: readyCount,
        report,
      });
    }

    // ── LIVE PATH (unreachable until the gate above opens) ──────────────
    // Real Graph API calls are documented in the header comment and wired here once
    // App Review is approved. Until then we never reach this branch, so we keep the
    // table untouched: validate and report, deferring the actual container→publish
    // calls to the implementation that ships with the approved tokens.
    const results: { id: number; status: string; reason?: string }[] = [];
    for (const post of due) {
      const problem = validate(post);
      if (problem) {
        await admin.from("social_posts").update({ status: "failed", error: problem }).eq("id", post.id);
        results.push({ id: post.id, status: "failed", reason: problem });
        continue;
      }
      // NOTE: real per-platform container→publish calls go here. They are deliberately
      // not implemented yet — shipping them requires the approved Meta app + reviewed
      // permissions (instagram_content_publish, pages_manage_posts). Leave validated
      // rows 'approved' so a future, complete implementation can pick them up safely.
      results.push({ id: post.id, status: "approved", reason: "Publisher not yet implemented; awaiting Meta App Review." });
    }

    return json({ enabled: true, due: due.length, results });
  } catch (error) {
    console.error("social-publish error:", error);
    return json({ error: "Could not run the social publisher" }, 500);
  }
});
