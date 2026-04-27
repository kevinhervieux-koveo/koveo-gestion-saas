-- 0032_invoices_residence_building_check.sql
--
-- Database-level guard preventing cross-organisation invoice links.
--
-- Background
-- ----------
-- An `invoices` row may carry both `building_id` and an optional
-- `residence_id`. When both are set the residence must belong to the
-- same building (and therefore the same organisation) as the invoice.
-- Until now the invariant was only enforced at the application layer
-- and by the FK added in migration `0021_invoices_residence_id_fk.sql`.
-- The FK prevents orphan pointers but cannot prevent a valid pointer
-- that crosses organisations (both IDs exist as real rows, but in
-- different buildings). This trigger closes that gap.
--
-- The `backfill:cross-residence-invoices` script cleans up legacy rows
-- by NULLing `residence_id` on every offending row, after which this
-- trigger can be installed without conflict.
--
-- Implementation note
-- -------------------
-- A plain CHECK constraint cannot cross to another table, so the
-- invariant is enforced via a BEFORE INSERT/UPDATE trigger that looks
-- up `residences.building_id` for the candidate row and aborts the
-- statement with `check_violation` (SQLSTATE 23514) on mismatch. The
-- trigger only fires when `residence_id` or `building_id` changes (or
-- on INSERT), and short-circuits when `residence_id` is NULL
-- (building-only invoices cannot mismatch a column they do not carry).
--
-- Idempotent: drops + recreates the trigger and uses CREATE OR REPLACE
-- for the function, so the migration can be safely re-run on every
-- boot via `ensureTriggerOnlyMigrations()`.

CREATE OR REPLACE FUNCTION invoices_check_residence_building()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  res_building_id varchar;
BEGIN
  -- Building-level invoices (no residence link) are always allowed.
  IF NEW.residence_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- When building_id is also NULL (an unusual state; invoices are
  -- typically pinned to a building) there is nothing to compare
  -- against. Allow it and rely on the application layer.
  IF NEW.building_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT building_id
    INTO res_building_id
    FROM residences
   WHERE id = NEW.residence_id;

  -- If the residence does not exist, let the FK constraint (added by
  -- migration 0021) raise the foreign-key violation rather than
  -- masking it with our cross-org error.
  IF res_building_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF res_building_id <> NEW.building_id THEN
    RAISE EXCEPTION
      'Cross-organisation invoice rejected: invoices.building_id (%) '
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
    WHERE table_schema = 'public' AND table_name = 'invoices'
  ) THEN
    DROP TRIGGER IF EXISTS invoices_residence_building_check ON invoices;

    CREATE TRIGGER invoices_residence_building_check
      BEFORE INSERT OR UPDATE OF residence_id, building_id
      ON invoices
      FOR EACH ROW
      EXECUTE FUNCTION invoices_check_residence_building();
  END IF;
END $$;
