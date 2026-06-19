-- ============================================================
-- add-invoice-fields.sql — invoice lifecycle columns on parties
-- Run in: Supabase Dashboard > SQL Editor (or via the Supabase MCP apply_migration).
-- Idempotent: safe to re-run (ADD COLUMN IF NOT EXISTS).
-- ============================================================
--
-- THE PARTY IS THE INVOICE
-- ------------------------
-- There is deliberately NO separate invoices table. A party row already carries
-- everything an invoice needs (room/food/drink totals, gratuity, the
-- party_packages line items, deposit + payment status). These two columns add the
-- only lifecycle facts the party didn't already track:
--
--   invoice_number   text         A human-facing invoice id, generated lazily the
--                                 first time the invoice is "issued" / sent.
--                                 Convention (built in app code): INV-{id}-{yymm},
--                                 e.g. party #42 issued June 2026 -> "INV-42-2606".
--                                 Stored once written so it never changes after.
--
--   invoice_sent_at  timestamptz  When the invoice was last emailed/marked sent.
--                                 NULL = never sent (draft). Surfaced on the
--                                 Invoices list as a "Sent" badge.
--
-- "Paid" status is NOT stored here — it is derived from the existing
-- parties.payment_status / balance_due columns, so there is no second source of
-- truth for money.
-- ============================================================

ALTER TABLE parties ADD COLUMN IF NOT EXISTS invoice_number text;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS invoice_sent_at timestamptz;

COMMENT ON COLUMN parties.invoice_number IS
  'Human-facing invoice id, generated lazily as INV-{id}-{yymm} when first issued; stable once set. NULL = not yet issued.';
COMMENT ON COLUMN parties.invoice_sent_at IS
  'Timestamp the invoice was last emailed/marked sent. NULL = draft (never sent). Paid status is derived from payment_status, not stored here.';
