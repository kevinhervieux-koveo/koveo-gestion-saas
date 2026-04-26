-- 0010_demands_residence_building_check.sql
--
-- Database-level guard preventing cross-organisation demand links.
--
-- Background
-- ----------
-- A demand row carries both `building_id` (NOT NULL) and an optional
-- `residence_id`. The two columns must agree: the residence must belong
-- to the same building (and therefore the same organisation) as the
-- demand. Until now the invariant was only enforced by the runtime
-- validation in `server/api/demands.ts` (Q8 logic), so any code path
-- that bypassed the API — MCP write tools, ad-hoc SQL, future
-- migrations — could silently re-introduce cross-org rows. The
-- `backfill:cross-residence-demands` script cleans up legacy rows by
-- NULLing `residence_id` on every offending row, after which this
-- trigger can be installed without conflict.
--
-- Implementation note
-- -------------------
-- A plain CHECK constraint cannot cross to another table, so the
-- invariant is enforced via a BEFORE INSERT/UPDATE trigger that looks
-- up `residences.building_id` for the candidate row and aborts the
-- statement with `check_violation` (SQLSTATE 23514) on mismatch. The
-- trigger only fires when `residence_id` is non-NULL or `building_id`
-- changes, so building-only demands incur no extra lookup.
--
-- Idempotent: drops + recreates the trigger and uses CREATE OR REPLACE
-- for the function, so the migration can be safely re-run.

CREATE OR REPLACE FUNCTION demands_check_residence_building()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  res_building_id varchar;
BEGIN
  -- Building-level demands (no residence link) are always allowed.
  IF NEW.residence_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT building_id
    INTO res_building_id
    FROM residences
   WHERE id = NEW.residence_id;

  -- If the residence does not exist, let the existing FK constraint
  -- raise the (more informative) foreign-key violation rather than
  -- masking it with our cross-org error.
  IF res_building_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF res_building_id <> NEW.building_id THEN
    RAISE EXCEPTION
      'Cross-organisation demand rejected: demand.building_id (%) '
      'does not match residence.building_id (%) for residence_id %',
      NEW.building_id, res_building_id, NEW.residence_id
      USING ERRCODE = 'check_violation';
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
    DROP TRIGGER IF EXISTS demands_residence_building_check ON demands;

    CREATE TRIGGER demands_residence_building_check
      BEFORE INSERT OR UPDATE OF residence_id, building_id
      ON demands
      FOR EACH ROW
      EXECUTE FUNCTION demands_check_residence_building();
  END IF;
END $$;
