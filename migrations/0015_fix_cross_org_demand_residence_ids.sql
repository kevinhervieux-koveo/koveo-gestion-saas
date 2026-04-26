-- 0015_fix_cross_org_demand_residence_ids.sql
--
-- Auto-fix legacy cross-org demand rows.
--
-- Background
-- ----------
-- Migration 0010 installed a BEFORE INSERT/UPDATE trigger
-- (`demands_residence_building_check`) that prevents new cross-org demand
-- rows from being written.  However, a small number of rows that existed
-- *before* the trigger was deployed escaped the guard and still carry a
-- `residence_id` that belongs to a different building (and therefore a
-- different organisation) than the demand's own `building_id`.
--
-- This migration repairs those legacy rows by NULLing `residence_id` on
-- every offending demand.  The demand's `building_id` is intentionally
-- preserved — only the cross-org residence link is removed.
--
-- Idempotency
-- -----------
-- The UPDATE is a no-op when there are no offending rows (second run,
-- already-clean database, etc.), so this migration is safe to re-run on
-- every boot via the server's ensureTriggerOnlyMigrations() helper.
--
-- The post-condition DO block runs after the UPDATE and raises an
-- exception (SQLSTATE 23514) if any cross-org rows still exist, turning
-- the migration into a loud, boot-time alarm rather than a silent failure.
--
-- Out of scope
-- ------------
-- • Assignation-side cleanup (assignation_residence_id /
--   assignation_building_id) — handled by existing triggers.
-- • Hard-deleting rows — the demand is preserved with its original
--   building_id; only the dangling residence pointer is removed.
-- • Modifying existing triggers — 0010 is left unchanged.

-- Entire migration is conditional on demands existing in this DB state.
DO $$
DECLARE
  remaining int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'demands'
  ) THEN
    RETURN;
  END IF;

  UPDATE demands
  SET    residence_id = NULL
  WHERE  residence_id IS NOT NULL
    AND  building_id <> (
           SELECT r.building_id
           FROM   residences r
           WHERE  r.id = demands.residence_id
         );

  -- Post-condition: assert no cross-org demand rows remain.
  SELECT count(*)::int
    INTO remaining
    FROM demands d
    JOIN residences r ON r.id = d.residence_id
   WHERE r.building_id <> d.building_id;

  IF remaining <> 0 THEN
    RAISE EXCEPTION
      'Migration 0015 post-condition FAILED: % cross-org demand row(s) still exist after fix',
      remaining
      USING ERRCODE = 'check_violation';
  END IF;
END;
$$;
