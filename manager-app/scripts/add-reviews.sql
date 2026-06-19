-- ============================================================
-- Iggy's — REPUTATION (reviews inbox) + table-side FEEDBACK QR
-- Tables: review_sources, reviews, feedback
--
-- Two complementary surfaces:
--  1. reviews        — public reviews ingested from external platforms
--                      (Google Business Profile / Yelp / Facebook). Surfaced
--                      in the manager Reputation page as a stream the owner
--                      can reply to and mark-replied. Ingest is handled by the
--                      reviews-sync edge function (a SAFE STUB until GBP creds
--                      land — see supabase/functions/reviews-sync/index.ts).
--  2. feedback       — PRIVATE table-side feedback. A QR at each table opens
--                      the public /feedback page; the FTC-safe form always
--                      shows BOTH "leave a public review" AND a private box.
--                      Posts land here via the submit-feedback edge function.
--  review_sources    — small lookup of where reviews can come from + the
--                      public review URL the /feedback page links out to.
--
-- Run in: Supabase Dashboard > SQL Editor (test on a branch first).
-- CREATE-only & idempotent (re-runnable). Follows new-table-template.sql:
-- post-Oct-2026 Supabase no longer auto-exposes new public tables, so the
-- explicit GRANTs below are REQUIRED or supabase-js can't see the table.
--
-- COMPLIANCE NOTE: `reviews` and `feedback` are append-only in spirit — they
-- are an audit record of what guests said. Replies are recorded on the review
-- row (reply_text/replied) rather than mutating the original body.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- review_sources — lookup: a platform we ingest reviews from / link out to.
--   key             stable slug ('google' | 'yelp' | 'facebook' | 'manual')
--   label           human label for the badge ('Google', 'Yelp', …)
--   review_url      the public "leave a review" deep link (the /feedback CTA
--                   links to the Google one). null = no outbound link.
--   active          whether this source is shown / ingested
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.review_sources (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT now(),
  key         TEXT NOT NULL UNIQUE,          -- 'google' | 'yelp' | 'facebook' | 'manual'
  label       TEXT NOT NULL,
  review_url  TEXT,                          -- public "write a review" link (anon reads this)
  active      BOOLEAN NOT NULL DEFAULT true
);

-- ─────────────────────────────────────────────────────────────
-- reviews — one public review from an external platform.
--   source          which platform (matches review_sources.key)
--   author          reviewer display name (may be null/anonymous)
--   rating          1–5 stars
--   body            the review text
--   url             deep link back to the review on the platform
--   replied         has the owner responded?
--   reply_text      the owner's drafted/sent response (recorded here)
--   sentiment       'positive' | 'neutral' | 'negative' — derived from rating
--                   at ingest; lets the inbox flag low scores fast.
--   external_id     platform's review id — dedupe key for re-syncs
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at   TIMESTAMPTZ DEFAULT now(),
  source       TEXT NOT NULL DEFAULT 'manual',  -- review_sources.key
  author       TEXT,
  rating       INT NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  body         TEXT,
  url          TEXT,
  replied      BOOLEAN NOT NULL DEFAULT false,
  reply_text   TEXT,
  sentiment    TEXT,                            -- 'positive' | 'neutral' | 'negative'
  external_id  TEXT                             -- platform review id (dedupe)
);

-- Dedupe across re-syncs: at most one row per (source, external_id) when set.
CREATE UNIQUE INDEX IF NOT EXISTS reviews_source_external_idx
  ON public.reviews (source, external_id)
  WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS reviews_created_idx ON public.reviews (created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_rating_idx  ON public.reviews (rating);

-- ─────────────────────────────────────────────────────────────
-- feedback — private table-side feedback from the /feedback QR page.
--   area                  which part of the visit ('food' | 'drinks' |
--                         'service' | 'atmosphere' | 'other')
--   rating                1–5 stars
--   comment               the guest's free-text note
--   contact_email         optional — so the owner can follow up
--   public_review_clicked whether the guest also tapped "leave a public review"
--                         (FTC-safe: we never gate the public link on sentiment —
--                         this is just analytics on the funnel)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feedback (
  id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at             TIMESTAMPTZ DEFAULT now(),
  area                   TEXT,
  rating                 INT CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  comment                TEXT,
  contact_email          TEXT,
  public_review_clicked  BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS feedback_created_idx ON public.feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_rating_idx  ON public.feedback (rating);

-- ============================================================
-- GRANTS (required — without these the tables are invisible to the Data API)
-- ============================================================
-- review_sources: the public /feedback page reads the outbound review_url (anon).
GRANT SELECT                         ON public.review_sources TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_sources TO authenticated;

-- reviews: manager-only inbox. No anon grant (public never reads competitors' words).
-- Ingest writes happen with the SERVICE ROLE (reviews-sync), which bypasses RLS.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;

-- feedback: manager reads it; the public WRITER is the submit-feedback edge
-- function (service role), so anon needs NO direct grant — keeps the table
-- unreadable to the public while still accepting their submissions server-side.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback TO authenticated;

-- ============================================================
-- Row Level Security + policies
-- ============================================================

-- ---- review_sources ----
ALTER TABLE public.review_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read" ON public.review_sources;
CREATE POLICY "Public read" ON public.review_sources
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth insert" ON public.review_sources;
CREATE POLICY "Auth insert" ON public.review_sources
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Auth update" ON public.review_sources;
CREATE POLICY "Auth update" ON public.review_sources
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth delete" ON public.review_sources;
CREATE POLICY "Auth delete" ON public.review_sources
  FOR DELETE TO authenticated USING (true);

-- ---- reviews (manager-only; service role ingests, bypassing RLS) ----
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read" ON public.reviews;
CREATE POLICY "Auth read" ON public.reviews
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth insert" ON public.reviews;
CREATE POLICY "Auth insert" ON public.reviews
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Auth update" ON public.reviews;
CREATE POLICY "Auth update" ON public.reviews
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth delete" ON public.reviews;
CREATE POLICY "Auth delete" ON public.reviews
  FOR DELETE TO authenticated USING (true);

-- ---- feedback (manager reads; public writes ONLY via the service-role fn) ----
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read" ON public.feedback;
CREATE POLICY "Auth read" ON public.feedback
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth update" ON public.feedback;
CREATE POLICY "Auth update" ON public.feedback
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth delete" ON public.feedback;
CREATE POLICY "Auth delete" ON public.feedback
  FOR DELETE TO authenticated USING (true);
-- NOTE: deliberately NO anon/authenticated INSERT policy — the public form
-- writes through submit-feedback (service role) which bypasses RLS. This keeps
-- the table tamper-resistant while still capturing every guest submission.

-- ============================================================
-- Realtime — the Reputation inbox updates live as reviews/feedback land.
-- ============================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reviews;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ============================================================
-- Seed the sources lookup (idempotent). Replace the Google review_url with the
-- bar's real Google "write a review" link once the Place ID is known:
--   https://search.google.com/local/writereview?placeid=<PLACE_ID>
-- ============================================================
INSERT INTO public.review_sources (key, label, review_url, active) VALUES
  ('google',   'Google',   'https://search.google.com/local/writereview?placeid=REPLACE_WITH_PLACE_ID', true),
  ('yelp',     'Yelp',     NULL, true),
  ('facebook', 'Facebook', NULL, true),
  ('manual',   'Manual',   NULL, true)
ON CONFLICT (key) DO NOTHING;
