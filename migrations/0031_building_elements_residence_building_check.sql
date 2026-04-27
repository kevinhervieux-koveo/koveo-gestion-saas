-- 0031_building_elements_residence_building_check.sql
--
-- Database-level guard preventing cross-organisation building_element links.
--
-- Background
-- ----------
-- A `building_elements` row carries `building_id` (NOT NULL) and an
-- optional `residence_id`. When `residence_id` is set the residence
-- must belong to the same building (and therefore the same
-- organisation) as the element. Until now the invariant was only
-- enforced at the application layer and by the FK added in
-- migration `0012_building_elements_residence_id_fk.sql`. The FK
-- prevents orphan pointers but cannot prevent a valid pointer that
-- crosses organisations (both IDs exist as real rows, but in different
-- buildings). This trigger closes that gap.
--
-- The `backfill:cross-residence-building-elements` script cleans up
-- legacy rows by NULLing `residence_id` on every offending row, after
-- which this trigger can be installed without conflict.
--
-- Implementation note
-- -------------------
-- A plain CHECK constraint cannot cross to another table, so the
-- invariant is enforced via a BEFORE INSERT/UPDATE trigger that looks
-- up `residences.building_id` for the candidate row and aborts the
-- statement with `check_violation` (SQLSTATE 23514) on mismatch. The
-- trigger only fires when `residence_id` or `building_id` changes (or
-- on INSERT), and short-circuits when `residence_id` is NULL
-- (building-wide elements cannot mismatch a column they do not carry).
--
-- Idempotent: drops + recreates the trigger and uses CREATE OR REPLACE
-- for the function, so the migration can be safely re-run on every
-- boot via `ensureTriggerOnlyMigrations()`.

CREATE OR REPLACE FUNCTION building_elements_check_residence_building()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  res_building_id varchar;
BEGIN
  -- Building-wide elements (no residence link) are always allowed.
  IF NEW.residence_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT building_id
    INTO res_building_id
    FROM residences
   WHERE id = NEW.residence_id;

  -- If the residence does not exist, let the FK constraint (added by
  -- migration 0012) raise the foreign-key violation rather than
  -- masking it with our cross-org error.
  IF res_building_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF res_building_id <> NEW.building_id THEN
    RAISE EXCEPTION
      'Cross-organisation building_element rejected: building_elements.building_id (%) '
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
    WHERE table_schema = 'public' AND table_name = 'building_elements'
  ) THEN
    DROP TRIGGER IF EXISTS building_elements_residence_building_check ON building_elements;

    CREATE TRIGGER building_elements_residence_building_check
      BEFORE INSERT OR UPDATE OF residence_id, building_id
      ON building_elements
      FOR EACH ROW
      EXECUTE FUNCTION building_elements_check_residence_building();
  END IF;
END $$;
