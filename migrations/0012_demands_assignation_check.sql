-- 0012_demands_assignation_check.sql
--
-- Database-level guard preventing cross-organisation links on the
-- secondary `assignation_residence_id` / `assignation_building_id`
-- pair on the `demands` table.
--
-- Background
-- ----------
-- Migrations 0010 and 0011 protected the primary
-- `demands.residence_id` / `demands.building_id` pair. The demand
-- table also carries an *assignment* side: `assignation_residence_id`
-- and `assignation_building_id` describe the residence/building the
-- demand is being routed *out to* (e.g. to a different unit or
-- building inside the same organisation). Until now nothing
-- guaranteed:
--
--   1. that `assignation_residence_id` belongs to
--      `assignation_building_id` (when both are set), or
--   2. that `assignation_building_id` is in the same organisation as
--      the demand's own `building_id` — i.e. that the demand is not
--      being assigned across organisation boundaries.
--
-- The cross-assignation backfill in
-- `server/scripts/backfill-cross-assignation-demands-lib.ts` cleans
-- up legacy mismatches, after which this trigger can be installed
-- without conflict.
--
-- Implementation note
-- -------------------
-- A plain CHECK constraint cannot cross to another table, so the
-- invariant is enforced via a BEFORE INSERT/UPDATE trigger that
-- inspects `residences.building_id` and `buildings.organization_id`
-- for the candidate row and aborts the statement with
-- `check_violation` (SQLSTATE 23514) on mismatch. The trigger only
-- fires on INSERT and on UPDATE of the columns that can affect the
-- invariant (the assignation pair plus the originating
-- `building_id`), so demand updates that touch other columns incur
-- no extra lookup. When the FK targets do not exist the trigger
-- short-circuits and lets the existing FK constraint surface the
-- (more informative) foreign-key violation rather than masking it
-- with our cross-org error.
--
-- Idempotent: drops + recreates the trigger and uses CREATE OR
-- REPLACE for the function, so the migration can be safely re-run
-- (the server's ensureTriggerOnlyMigrations() helper invokes it on
-- every boot).

CREATE OR REPLACE FUNCTION demands_check_assignation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  assignation_res_building_id varchar;
  main_org_id                 varchar;
  assignation_org_id          varchar;
  effective_assignation_bid   varchar;
BEGIN
  -- Fast path: nothing to check when both assignation pointers are NULL.
  IF NEW.assignation_residence_id IS NULL
     AND NEW.assignation_building_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check 1: assignation_residence_id ↔ assignation_building_id
  -- consistency. When both are set, the residence's building must
  -- match the assignation_building_id.
  IF NEW.assignation_residence_id IS NOT NULL THEN
    SELECT building_id
      INTO assignation_res_building_id
      FROM residences
     WHERE id = NEW.assignation_residence_id;

    -- If the residence does not exist, defer to the FK constraint.
    IF assignation_res_building_id IS NOT NULL
       AND NEW.assignation_building_id IS NOT NULL
       AND assignation_res_building_id <> NEW.assignation_building_id THEN
      RAISE EXCEPTION
        'Cross-organisation demand assignation rejected: '
        'demand.assignation_building_id (%) does not match '
        'residence.building_id (%) for assignation_residence_id %',
        NEW.assignation_building_id,
        assignation_res_building_id,
        NEW.assignation_residence_id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Check 2: assignation must not cross organisations relative to
  -- the demand's own `building_id`. Resolve the effective
  -- assignation building id: explicit `assignation_building_id` if
  -- set, otherwise inferred from `assignation_residence_id` via
  -- `residences.building_id` (computed above).
  effective_assignation_bid := COALESCE(
    NEW.assignation_building_id,
    assignation_res_building_id
  );

  IF effective_assignation_bid IS NOT NULL THEN
    SELECT organization_id
      INTO main_org_id
      FROM buildings
     WHERE id = NEW.building_id;

    SELECT organization_id
      INTO assignation_org_id
      FROM buildings
     WHERE id = effective_assignation_bid;

    -- If either lookup misses, defer to the FK constraint.
    IF main_org_id IS NOT NULL
       AND assignation_org_id IS NOT NULL
       AND main_org_id <> assignation_org_id THEN
      RAISE EXCEPTION
        'Cross-organisation demand assignation rejected: '
        'assignation_building_id (%) belongs to organisation %, '
        'but demand.building_id (%) belongs to organisation %',
        effective_assignation_bid, assignation_org_id,
        NEW.building_id, main_org_id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'demands'
  ) THEN
    DROP TRIGGER IF EXISTS demands_assignation_check ON demands;

    CREATE TRIGGER demands_assignation_check
      BEFORE INSERT OR UPDATE OF
        assignation_residence_id,
        assignation_building_id,
        building_id
      ON demands
      FOR EACH ROW
      EXECUTE FUNCTION demands_check_assignation();
  END IF;
END $$;
