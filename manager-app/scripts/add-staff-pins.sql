-- ============================================================
-- Iggy's — 4-digit PIN login (POS-style)
-- staff_pins: per-user hashed PIN + brute-force lockout state.
--
-- WHY a separate table (not manager_allowlist): the pin_hash must NEVER reach a
-- client. This table has RLS enabled with NO policies, so anon/authenticated get
-- ZERO access — only the SERVICE ROLE (the pin-login / manage-users edge fns,
-- which bypass RLS) can read/write it. Clients never see hashes, emails, or
-- lockout state; the name-picker is served by the edge fn, which returns only
-- {id, name} for staff who have a PIN.
--
-- A 4-digit PIN is low-entropy (10k combos), so the REAL defense is server-side
-- rate-limiting: failed_attempts + locked_until enforced in pin-login. The hash
-- (PBKDF2-SHA256, per-row salt) is the secondary defense if the DB ever leaks.
-- Idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.staff_pins (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email           TEXT UNIQUE NOT NULL,          -- the auth.users email this PIN signs into
  name            TEXT,                          -- display name for the picker
  pin_hash        TEXT NOT NULL,                 -- pbkdf2$iters$salt_b64$hash_b64
  failed_attempts INT  NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_pins_email_idx ON public.staff_pins (lower(email));

-- RLS ON, NO policies → anon/authenticated cannot touch it; service role bypasses.
ALTER TABLE public.staff_pins ENABLE ROW LEVEL SECURITY;

-- Defensive: explicitly REVOKE so the table is never exposed via the Data API.
REVOKE ALL ON public.staff_pins FROM anon, authenticated;
