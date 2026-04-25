-- 0011_residences_demand_building_check.sql
--
-- Residence-side counterpart of migration 0010.
--
-- Background
-- ----------
-- Migration 0010 installs a BEFORE INSERT/UPDATE trigger on `demands`
-- that rejects a row whose `residence_id` points at a residence in a
-- different building (and therefore — in our model — a different
-- organisation). That trigger only fires when a `demands` row is
-- inserted or its residence_id/building_id changes; it cannot detect
-- the symmetrical breakage where the *residence* is moved to another
-- building while a demand is still linked to it. Without a guard on
-- the residence side, an UPDATE such as
--
--     UPDATE residences SET building_id = '<other>' WHERE id = '<R>';
--
-- would silently leave every demand row with `residence_id = R` in a
-- cross-building (and possibly cross-organisation) state, because
-- nothing on `demands` was modified and the demands-side trigger
-- never re-checked the row.
--
-- This migration installs the complementary BEFORE UPDATE trigger on
-- `residences` (fires only when `building_id` is in the SET list).
-- It short-circuits when the building_id is unchanged. Otherwise it
-- looks for any `demands` row that still references the residence
-- with the *old* `building_id` (i.e. a row whose `building_id` no
-- longer matches the new residence.building_id) and aborts the UPDATE
-- with `check_violation` (SQLSTATE 23514). The error message names a
-- conflicting demand id so the operator can locate and re-target or
-- NULL the linked demand(s) before retrying the move.
--
-- Idempotent: uses CREATE OR REPLACE FUNCTION + DROP TRIGGER IF
-- EXISTS, so the migration can be safely re-run (the server's
-- ensureTriggerOnlyMigrations() helper invokes it on every boot).

CREATE OR REPLACE FUNCTION residences_check_demand_building()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  conflicting_demand_id varchar;
BEGIN
  -- No-op when building_id is unchanged. Catches both literal
  -- no-op updates and updates that touch other columns only.
  IF NEW.building_id IS NOT DISTINCT FROM OLD.building_id THEN
    RETURN NEW;
  END IF;

  -- Look for any demand row that still links to this residence with
  -- a building_id that does not match the new residence.building_id.
  -- The demand's building_id was correct under the OLD residence and
  -- would become stale (cross-building / possibly cross-org) once
  -- the residence is moved.
  SELECT d.id
    INTO conflicting_demand_id
    FROM demands d
   WHERE d.residence_id = NEW.id
     AND d.building_id <> NEW.building_id
   LIMIT 1;

  IF conflicting_demand_id IS NOT NULL THEN
    RAISE EXCEPTION
      'Cross-organisation demand link rejected: residence % cannot be '
      'moved to building % while demand % still links here with the '
      'previous building. Re-target or NULL the demand''s residence_id '
      'first.',
      NEW.id, NEW.building_id, conflicting_demand_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS residences_demand_building_check ON residences;

CREATE TRIGGER residences_demand_building_check
  BEFORE UPDATE OF building_id
  ON residences
  FOR EACH ROW
  EXECUTE FUNCTION residences_check_demand_building();
