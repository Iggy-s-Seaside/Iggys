-- ============================================================================
-- grant-luna-bridge-reads.sql
-- Extend the least-privilege luna_bridge role so the UPGRADED bridge's
-- gather_context() can actually read the new context tables.
--
-- The bridge daemon (manager-app/bridge/luna_iggys_bridge.py) now also SELECTs
-- inventory_items, specials, happy_hour, and todos for its expert context.
-- Its _query() is defensive (a missing grant is logged and skipped, never a
-- crash) — so until you run this, those sections of Luna's context stay empty.
--
-- Run in Supabase SQL Editor as an admin/owner role. SELECT-only, no writes.
-- parties + events + messages were already granted at bridge setup.
-- ============================================================================

GRANT SELECT ON inventory_items TO luna_bridge;
GRANT SELECT ON specials        TO luna_bridge;
GRANT SELECT ON happy_hour      TO luna_bridge;
GRANT SELECT ON todos           TO luna_bridge;

-- (Optional, if you later want Luna to read these directly rather than via the
--  dashboard: contacts, packages, party_packages, inventory_logs, menu tables.)
-- GRANT SELECT ON contacts, packages, party_packages, inventory_logs TO luna_bridge;
