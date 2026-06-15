-- Forecaster learning loop: store the RAW (pre-calibration) pulse score so the
-- learning loop can learn a STABLE bias from base_score vs actual_band — if it
-- learned from the already-corrected predicted_score, the correction would feed
-- back on itself and oscillate.
--
-- Applied to prod 2026-06-15 via Supabase migration `demand_log_add_base_score`.
-- The luna_bridge role's INSERT/UPDATE/SELECT grant on demand_log is table-level,
-- so it already covers this new column (verified post-add).

ALTER TABLE demand_log ADD COLUMN IF NOT EXISTS base_score integer;

COMMENT ON COLUMN demand_log.base_score IS
  'Pre-calibration model score. The pulse learning loop learns a STABLE bias from base_score vs actual_band, so applied corrections never feed back on themselves.';
