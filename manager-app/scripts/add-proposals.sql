-- ============================================================
-- Iggy's — ONE-LINK PROPOSAL + E-SIGN + DEPOSIT PORTAL
-- Table: proposals
--
-- Backs the tokenized, NO-LOGIN public proposal page (/p/:token) where a
-- client views their private-event quote, e-signs, and pays the deposit.
--
-- The manager creates a proposals row and shares the public URL. The public
-- site reads the single proposal by its token (anon SELECT). All WRITES that
-- stamp viewed_at / signed_at / signer_name / signer_ip go through the
-- `proposal-sign` edge function (SERVICE ROLE) — anon never writes directly,
-- so a stranger with a token can read their proposal but cannot forge a
-- signature or tamper with status.
--
-- Run in: Supabase Dashboard > SQL Editor (test on a branch first).
-- CREATE-only & idempotent (re-runnable). Follows new-table-template.sql:
-- post-Oct-2026 Supabase no longer auto-exposes new public tables, so the
-- explicit GRANTs below are REQUIRED or supabase-js can't see the table.
-- ============================================================

-- ---- 1. Create the table -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.proposals (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now(),
  token           TEXT NOT NULL UNIQUE,                     -- crypto.randomUUID() — the only public handle
  party_id        BIGINT NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'draft',            -- draft | sent | viewed | signed | deposit_paid
  sent_at         TIMESTAMPTZ,                              -- stamped when the manager shares the link
  viewed_at       TIMESTAMPTZ,                              -- first public view (set by proposal-sign)
  signed_at       TIMESTAMPTZ,                              -- e-signature timestamp (set by proposal-sign)
  signer_name     TEXT,                                     -- typed-name signature (set by proposal-sign)
  signer_ip       TEXT,                                     -- captured at sign time (set by proposal-sign)
  deposit_paid_at TIMESTAMPTZ                               -- stamped by stripe-webhook on deposit payment
);
CREATE INDEX IF NOT EXISTS proposals_token_idx  ON public.proposals (token);
CREATE INDEX IF NOT EXISTS proposals_party_idx  ON public.proposals (party_id);
CREATE INDEX IF NOT EXISTS proposals_status_idx ON public.proposals (status);

-- ---- 2. GRANTS (required — without these the table is invisible) -------
-- anon: read-only (the public proposal page fetches one row by token).
--   No anon INSERT/UPDATE/DELETE — every public write goes through the
--   service-role proposal-sign function, which bypasses RLS.
GRANT SELECT                         ON public.proposals TO anon;          -- public site: read one proposal by token
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposals TO authenticated; -- manager dashboard: full CRUD

-- ---- 3. Row Level Security + policies ----------------------------------
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

-- NOTE: Postgres has no `CREATE POLICY IF NOT EXISTS`, so drop-then-create
-- to stay idempotent (re-runnable without errors).

-- Public (anon) read. The token is an unguessable UUID, so SELECT is open;
-- the row exposes only this proposal's own quote/signature state, nothing else.
DROP POLICY IF EXISTS "Public read by token" ON public.proposals;
CREATE POLICY "Public read by token" ON public.proposals
  FOR SELECT USING (true);

-- Manager (authenticated) full CRUD — creates/sends/lists proposals.
DROP POLICY IF EXISTS "Auth insert" ON public.proposals;
CREATE POLICY "Auth insert" ON public.proposals
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Auth update" ON public.proposals;
CREATE POLICY "Auth update" ON public.proposals
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth delete" ON public.proposals;
CREATE POLICY "Auth delete" ON public.proposals
  FOR DELETE TO authenticated USING (true);

-- NOTE: anon has NO insert/update/delete policy on purpose. Public writes
-- (viewed_at / signed_at / signer_name / signer_ip) are performed by the
-- proposal-sign edge function under the SERVICE ROLE, which bypasses RLS.

-- ---- 4. Realtime — status chips update live on the manager side --------
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.proposals';
  EXCEPTION WHEN duplicate_object THEN
    NULL; -- already in the publication
  END;
END $$;
