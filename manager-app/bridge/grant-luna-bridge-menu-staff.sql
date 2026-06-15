-- grant-luna-bridge-menu-staff.sql
-- Read access for the bridge to (a) the live menu — so Luna answers from real
-- data instead of inventing — and (b) the staff roster — so she greets the
-- logged-in employee by name (shared work tool, not Bradley's personal one).
-- Applied to prod 2026-06-15 (Supabase migration `luna_bridge_read_menu_staff`).
-- Reminder: a table GRANT alone is filtered by RLS; each needs a read policy.
-- staff_pins is COLUMN-restricted (name/email only) so the bridge never sees pin_hash.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'luna_bridge') THEN
    GRANT SELECT ON public.cocktails TO luna_bridge;
    GRANT SELECT ON public.menu_items TO luna_bridge;
    GRANT SELECT ON public.menu_categories TO luna_bridge;
    GRANT SELECT ON public.staff TO luna_bridge;
    GRANT SELECT (id, email, name) ON public.staff_pins TO luna_bridge;

    DROP POLICY IF EXISTS "Bridge read cocktails" ON public.cocktails;
    CREATE POLICY "Bridge read cocktails" ON public.cocktails FOR SELECT TO luna_bridge USING (true);
    DROP POLICY IF EXISTS "Bridge read menu_items" ON public.menu_items;
    CREATE POLICY "Bridge read menu_items" ON public.menu_items FOR SELECT TO luna_bridge USING (true);
    DROP POLICY IF EXISTS "Bridge read menu_categories" ON public.menu_categories;
    CREATE POLICY "Bridge read menu_categories" ON public.menu_categories FOR SELECT TO luna_bridge USING (true);
    DROP POLICY IF EXISTS "Bridge read staff" ON public.staff;
    CREATE POLICY "Bridge read staff" ON public.staff FOR SELECT TO luna_bridge USING (true);
    DROP POLICY IF EXISTS "Bridge read staff_pins" ON public.staff_pins;
    CREATE POLICY "Bridge read staff_pins" ON public.staff_pins FOR SELECT TO luna_bridge USING (true);
  END IF;
END $$;
