-- ============================================================
-- Iggy's — SOCIAL DRAFT-QUEUE (approval-gated)
-- Table: social_posts
--
-- The Specials studio + events feed a QUEUE of posts a human approves.
-- LIVE auto-posting (Instagram/Facebook/Google Business Profile) is a
-- later, token-gated step — see supabase/functions/social-publish.
-- This table is the SAFE layer: drafts → human approval → scheduled,
-- and only once Meta App Review + tokens land does the publisher post.
--
-- Run in: Supabase Dashboard > SQL Editor (test on a branch first).
-- CREATE-only & idempotent (re-runnable). Follows new-table-template.sql:
-- post-Oct-2026 Supabase no longer auto-exposes new public tables, so the
-- explicit GRANTs below are REQUIRED or supabase-js can't see the table.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- social_posts — one queued post (draft → approved → scheduled → posted).
--   source           where this draft came from ('special' | 'event' | 'manual')
--   ref_id           id of the source special/event row (null for manual)
--   image_url        the creative to attach (from the special/event/media)
--   caption          the default caption used for every platform…
--   per_platform_caption  …unless overridden here, keyed by platform
--   target_platforms text[] of 'instagram' | 'facebook' | 'google'
--   scheduled_at     when the publisher should post it (null = post asap once approved)
--   status           draft | scheduled | approved | posted | failed | cancelled
--   external_post_ids  {platform: remote_id} written by the publisher on success
--   error            last failure reason (publisher only)
--   approved_by      manager email who approved it (audit trail)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.social_posts (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at            TIMESTAMPTZ DEFAULT now(),
  source                TEXT NOT NULL DEFAULT 'manual',   -- 'special' | 'event' | 'manual'
  ref_id                BIGINT,                            -- source row id (specials.id / events.id)
  image_url             TEXT,
  caption               TEXT NOT NULL DEFAULT '',
  target_platforms      TEXT[] NOT NULL DEFAULT '{}',      -- 'instagram' | 'facebook' | 'google'
  scheduled_at          TIMESTAMPTZ,
  status                TEXT NOT NULL DEFAULT 'draft',     -- draft|scheduled|approved|posted|failed|cancelled
  per_platform_caption  JSONB DEFAULT '{}'::jsonb,         -- { instagram: "...", facebook: "..." }
  external_post_ids     JSONB DEFAULT '{}'::jsonb,         -- { instagram: "1784...", facebook: "..." } (publisher)
  error                 TEXT,
  approved_by           TEXT
);

CREATE INDEX IF NOT EXISTS social_posts_status_idx    ON public.social_posts (status);
CREATE INDEX IF NOT EXISTS social_posts_scheduled_idx ON public.social_posts (scheduled_at);
CREATE INDEX IF NOT EXISTS social_posts_created_idx   ON public.social_posts (created_at DESC);

-- ---- GRANTS (required — without these the table is invisible to the Data API) ----
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_posts TO authenticated; -- manager dashboard: full CRUD
-- No anon grant: the draft queue is manager-only (never read by the public site).
-- Identity PK needs no sequence grant; the service-role publisher bypasses RLS.

-- ---- Row Level Security + policies ----
-- Manager-only for ALL operations (no public read). The social-publish function
-- writes status/external_post_ids/error with the SERVICE ROLE, which bypasses RLS.
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read" ON public.social_posts;
CREATE POLICY "Auth read" ON public.social_posts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth insert" ON public.social_posts;
CREATE POLICY "Auth insert" ON public.social_posts
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Auth update" ON public.social_posts;
CREATE POLICY "Auth update" ON public.social_posts
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth delete" ON public.social_posts;
CREATE POLICY "Auth delete" ON public.social_posts
  FOR DELETE TO authenticated USING (true);

-- ---- Realtime — the queue drives live manager UI updates ----
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.social_posts;
  EXCEPTION WHEN duplicate_object THEN
    NULL; -- already in the publication
  END;
END $$;
