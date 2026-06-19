-- ============================================================
-- add-funnel-events.sql — booking-flow funnel analytics
-- One row per tracked event from the public site via the service-role
-- track-event edge function. Managers read it; the public never writes directly.
-- Idempotent. Already applied to prod 2026-06-13 (migration anton_funnel_events).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.funnel_events (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_id  TEXT,
  event       TEXT NOT NULL,
  props       JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS funnel_events_event_idx   ON public.funnel_events (event);
CREATE INDEX IF NOT EXISTS funnel_events_created_idx ON public.funnel_events (created_at DESC);
CREATE INDEX IF NOT EXISTS funnel_events_session_idx ON public.funnel_events (session_id);
GRANT SELECT ON public.funnel_events TO authenticated;
ALTER TABLE public.funnel_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth read" ON public.funnel_events;
CREATE POLICY "Auth read" ON public.funnel_events FOR SELECT TO authenticated USING (true);
