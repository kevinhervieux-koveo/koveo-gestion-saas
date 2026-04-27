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
-- Steady-state behaviour (Task #1453)
-- -----------------------------------
-- The UPDATE is now gated behind an EXISTS probe.  Once the table is
-- clean, the structural triggers from migrations 0010 (demands-side),
-- 0011 (residences-side) and 0012 (assignation-side) keep it that way:
--
--   • 0010 blocks any INSERT or UPDATE on `demands` that would cross
--     organisations via residence_id / building_id.
--   • 0011 blocks moving a residence to a different building while a
--     demand still links to it (the symmetrical breakage 0010 cannot
--     see, because nothing on `demands` changes).
--   • 0012 enforces the same invariant on the assignation_residence_id /
--     assignation_building_id pair.
--
-- With those triggers in place, no new cross-org rows can appear, and
-- the EXISTS probe returns FALSE on every steady-state boot.  The
-- migration therefore issues a single read-only SELECT against `demands`
-- and never takes the RowExclusiveLock that previously collided with
-- the trigger DDL during concurrent-container boots (the 5:11 AM
-- incident addressed by Task #1443).  If, for any reason, a cross-org
-- row ever does reappear (e.g. a future bulk import bypasses the
-- triggers), the gate flips, the cleanup UPDATE runs, and the
-- post-condition DO block raises check_violation if anything is still
-- broken — preserving the original drift-guard behaviour as a
-- self-healing fallback.
--
-- Idempotency
-- -----------
-- Both branches are no-ops when there are no offending rows, so this
-- migration is safe to re-run on every boot via the server's
-- ensureTriggerOnlyMigrations() helper.
--
-- The post-condition DO block runs after the (possibly skipped) UPDATE
-- and raises an exception (SQLSTATE 23514) if any cross-org rows still
-- exist, turning the migration into a loud, boot-time alarm rather
-- than a silent failure.
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
  remaining       int;
  has_violations  boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'demands'
  ) THEN
    RETURN;
  END IF;

  -- Probe: only run the UPDATE when the cleanup is actually needed.
  -- In steady state the structural triggers (0010 / 0011 / 0012) keep
  -- `demands` clean, so this SELECT returns FALSE and no write — and
  -- therefore no RowExclusiveLock — is ever taken on the table at
  -- boot.  See the "Steady-state behaviour" note above.
  SELECT EXISTS (
    SELECT 1
      FROM demands d
      JOIN residences r ON r.id = d.residence_id
     WHERE r.building_id <> d.building_id
  ) INTO has_violations;

  IF has_violations THEN
    UPDATE demands
    SET    residence_id = NULL
    WHERE  residence_id IS NOT NULL
      AND  building_id <> (
             SELECT r.building_id
             FROM   residences r
             WHERE  r.id = demands.residence_id
           );
  END IF;

  -- Post-condition: assert no cross-org demand rows remain.  This runs
  -- on every boot regardless of whether the gate fired, so the loud
  -- drift alarm is preserved.
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
