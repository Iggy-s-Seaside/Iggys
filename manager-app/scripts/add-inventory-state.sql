-- ── Inventory "mark, don't count" — qualitative stock state + count safety net ──
-- Counting bottles mid-shift is impossible, so current_quantity is fiction and
-- low-stock never fires. This makes the day-to-day signal QUALITATIVE and
-- one-tap (stock_state), keeps current_quantity + par_level untouched for the
-- on-hand target / reorder math, and adds a staleness safety net for items
-- nobody bothered to mark. Idempotent + additive — safe to re-run.

-- Qualitative one-tap state. Default 'ok' so existing rows read as fine until
-- someone marks them. CHECK is added separately (and idempotently) below so a
-- re-run on a column that already exists doesn't error.
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS stock_state TEXT NOT NULL DEFAULT 'ok';

-- When / who last set the qualitative state (drives the "marked" board + staleness).
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS state_set_at TIMESTAMPTZ;
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS state_set_by TEXT;

-- Last time the item was actually counted / ground-truthed (delivery scan stamps this).
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS last_counted_at TIMESTAMPTZ;

-- Optional explicit reorder threshold for the count-based fallback trigger.
-- Falls back to par_level when null (handled in app code).
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS reorder_point NUMERIC(10,2);

-- How long an item can go untouched before it's "stale" and needs a look. The
-- staleness safety net is the real backstop for items nobody marks.
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS count_interval_days INT NOT NULL DEFAULT 7;

-- Constrain stock_state to the allowed qualitative chips. Added defensively so a
-- re-run (or a pre-existing column) never double-creates the constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_items_stock_state_check'
      AND conrelid = 'inventory_items'::regclass
  ) THEN
    ALTER TABLE inventory_items
      ADD CONSTRAINT inventory_items_stock_state_check
      CHECK (stock_state IN ('ok', 'low', 'half', 'one_left', 'out'));
  END IF;
END $$;
