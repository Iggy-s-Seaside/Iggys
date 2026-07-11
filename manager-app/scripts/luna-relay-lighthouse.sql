-- Lighthouse — always-on cloud relay for Luna-at-work.
-- When PC1 (home) is down or a question sits unanswered too long, a Supabase
-- Edge Function (luna-relay) answers it from DeepSeek + cached facts so the app
-- never shows "Luna offline". Idempotent + additive — safe to re-run.
--
-- Apply: Supabase SQL Editor, `supabase db execute --file`, or apply_migration.

-- 1. luna_messages: origin tag + relay claim timestamp + a 'relaying' status.
ALTER TABLE public.luna_messages ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'bridge';
ALTER TABLE public.luna_messages ADD COLUMN IF NOT EXISTS relay_claimed_at timestamptz;

-- Widen the status CHECK so the relay can hold a row in-flight without the
-- bridge (which only claims 'pending') touching it.
ALTER TABLE public.luna_messages DROP CONSTRAINT IF EXISTS luna_messages_status_check;
ALTER TABLE public.luna_messages ADD CONSTRAINT luna_messages_status_check
  CHECK (status = ANY (ARRAY['pending','processing','answered','error','relaying']));

-- 2. Bridge heartbeat (single row). The PC1 bridge upserts last_seen every loop;
--    the relay reads it to tell "home is alive but slow" from "home is down".
CREATE TABLE IF NOT EXISTS public.luna_bridge_health (
  id smallint PRIMARY KEY DEFAULT 1,
  last_seen timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT luna_bridge_health_singleton CHECK (id = 1)
);
INSERT INTO public.luna_bridge_health (id, last_seen)
  VALUES (1, now() - interval '1 hour') ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.luna_bridge_health ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Bridge full access luna_bridge_health" ON public.luna_bridge_health;
CREATE POLICY "Bridge full access luna_bridge_health" ON public.luna_bridge_health
  TO luna_bridge USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Managers read luna_bridge_health" ON public.luna_bridge_health;
CREATE POLICY "Managers read luna_bridge_health" ON public.luna_bridge_health
  FOR SELECT TO authenticated USING (true);

-- 3. RPCs — SECURITY DEFINER so the transactional logic runs with owner rights;
--    the relay calls them as service_role, the bridge only needs the heartbeat.

-- Atomically claim eligible stale pending questions -> 'relaying'.
-- Eligible: role='user', status='pending', pending longer than p_after_secs,
-- AND (the bridge heartbeat is stale  OR  the row is older than p_hard_secs).
-- The outer status='pending' guard + FOR UPDATE SKIP LOCKED make this safe
-- against the home bridge claiming the same row concurrently.
CREATE OR REPLACE FUNCTION public.relay_claim_questions(
  p_after_secs int, p_hard_secs int, p_bridge_stale_secs int, p_limit int
) RETURNS TABLE (id bigint, content text, author_email text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE bridge_alive boolean;
BEGIN
  SELECT (now() - last_seen) < make_interval(secs => p_bridge_stale_secs)
    INTO bridge_alive FROM luna_bridge_health WHERE id = 1;
  bridge_alive := COALESCE(bridge_alive, false);

  RETURN QUERY
  UPDATE luna_messages m
     SET status = 'relaying', source = 'relay', relay_claimed_at = now()
   WHERE m.status = 'pending'
     AND m.id IN (
       SELECT m2.id FROM luna_messages m2
        WHERE m2.role = 'user' AND m2.status = 'pending'
          AND m2.created_at < now() - make_interval(secs => p_after_secs)
          AND ( NOT bridge_alive
                OR m2.created_at < now() - make_interval(secs => p_hard_secs) )
        ORDER BY m2.id
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
     )
  RETURNING m.id, m.content, m.author_email;
END $$;

-- Finish: insert Luna's reply + flip the question to answered, in one txn.
CREATE OR REPLACE FUNCTION public.relay_finish_answer(p_qid bigint, p_content text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO luna_messages (role, content, reply_to, status, source)
    VALUES ('luna', p_content, p_qid, 'answered', 'relay');
  UPDATE luna_messages SET status = 'answered' WHERE id = p_qid;
END $$;

-- Release one row back to the queue (used when DeepSeek is unavailable) so the
-- bridge or the next tick retries it instead of stranding it.
CREATE OR REPLACE FUNCTION public.relay_release(p_qid bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE luna_messages
     SET status = 'pending', relay_claimed_at = NULL, source = 'bridge'
   WHERE id = p_qid AND status = 'relaying';
END $$;

-- Recovery sweep: a row claimed 'relaying' but never finished (function crash).
-- Idempotent: if a reply already exists, just flip it answered; else re-queue.
CREATE OR REPLACE FUNCTION public.relay_sweep(p_stale_secs int)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n_finished int; n_requeued int;
BEGIN
  WITH stale AS (
    SELECT id FROM luna_messages
     WHERE status = 'relaying'
       AND relay_claimed_at < now() - make_interval(secs => p_stale_secs)
  )
  UPDATE luna_messages SET status = 'answered'
   WHERE id IN (SELECT id FROM stale)
     AND EXISTS (SELECT 1 FROM luna_messages r WHERE r.reply_to = luna_messages.id);
  GET DIAGNOSTICS n_finished = ROW_COUNT;

  UPDATE luna_messages
     SET status = 'pending', relay_claimed_at = NULL, source = 'bridge'
   WHERE status = 'relaying'
     AND relay_claimed_at < now() - make_interval(secs => p_stale_secs)
     AND NOT EXISTS (SELECT 1 FROM luna_messages r WHERE r.reply_to = luna_messages.id);
  GET DIAGNOSTICS n_requeued = ROW_COUNT;

  RETURN n_finished + n_requeued;
END $$;

-- Heartbeat helper for the bridge (SECURITY DEFINER → no direct table grants
-- needed for the least-privilege luna_bridge role).
CREATE OR REPLACE FUNCTION public.luna_bridge_heartbeat()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO luna_bridge_health (id, last_seen) VALUES (1, now())
  ON CONFLICT (id) DO UPDATE SET last_seen = now();
END $$;

GRANT EXECUTE ON FUNCTION public.relay_claim_questions(int,int,int,int) TO service_role;
GRANT EXECUTE ON FUNCTION public.relay_finish_answer(bigint,text)       TO service_role;
GRANT EXECUTE ON FUNCTION public.relay_release(bigint)                  TO service_role;
GRANT EXECUTE ON FUNCTION public.relay_sweep(int)                       TO service_role;
GRANT EXECUTE ON FUNCTION public.luna_bridge_heartbeat()                TO luna_bridge, service_role;

-- 4. pg_cron tick (run separately; needs the real LUNA_RELAY_SECRET value, which
--    is NOT committed here). Fires every 30s; the function is a no-op unless a
--    question is stale AND the bridge heartbeat says home is down.
--
--   SELECT cron.schedule('luna-relay-tick', '30 seconds', $cron$
--     SELECT net.http_post(
--       url := 'https://nouxyrqpulkbjusriugx.supabase.co/functions/v1/luna-relay',
--       headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<LUNA_RELAY_SECRET>'),
--       body := '{}'::jsonb
--     );
--   $cron$);
--
-- Unschedule with: SELECT cron.unschedule('luna-relay-tick');
