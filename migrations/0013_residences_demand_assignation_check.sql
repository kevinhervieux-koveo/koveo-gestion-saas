-- 0013_residences_demand_assignation_check.sql
--
-- Residence-side counterpart of migration 0012. Mirrors the
-- residence-side guard installed by 0011 for the primary
-- residence_id/building_id pair, but targets the secondary
-- assignation_residence_id/assignation_building_id pair on `demands`.
--
-- Background
-- ----------
-- Migration 0012 installs a BEFORE INSERT/UPDATE trigger on
-- `demands` that rejects rows whose `assignation_residence_id` /
-- `assignation_building_id` would cross organisations. That trigger
-- only fires when a `demands` row is inserted or its assignation /
-- building columns change; it cannot detect the symmetrical
-- breakage where the *residence* is moved to another building while
-- a demand is still linked to it via `assignation_residence_id`.
-- Without a guard on the residence side, an UPDATE such as
--
--     UPDATE residences SET building_id = '<other>' WHERE id = '<R>';
--
-- would silently leave every demand row whose
-- `assignation_residence_id = R` in a cross-building (and possibly
-- cross-organisation) state, because nothing on `demands` was
-- modified and the demand-side trigger never re-checked the row.
--
-- This migration installs the complementary BEFORE UPDATE trigger
-- on `residences` (fires only when `building_id` is in the SET
-- list). It short-circuits when the building_id is unchanged.
-- Otherwise it looks for any `demands` row that still references
-- the residence via `assignation_residence_id` in either of the
-- two ways 0012 already protects:
--
--   Case A — explicit assignation_building_id set:
--     The demand declared `assignation_building_id` directly. After
--     the move, that explicit pointer would no longer match
--     `residences.building_id`, leaving the assignation pair
--     internally inconsistent (and, transitively, possibly
--     cross-organisation).
--
--   Case B — assignation_building_id IS NULL:
--     The 0012 trigger infers the effective assignation building
--     from the residence's `building_id` and rejects the row if
--     that inferred building is in a different organisation than
--     the demand's own `building_id`. Moving the residence to a
--     building in a different organisation than the demand's
--     `building_id` would silently re-introduce the same cross-org
--     drift on rows where `assignation_building_id` is NULL,
--     bypassing 0012 entirely. So we re-evaluate the same org
--     check on the residence's *new* building here.
--
-- If any conflicting demand row is found, the UPDATE is aborted
-- with `check_violation` (SQLSTATE 23514). The error message names
-- a conflicting demand id so the operator can locate and re-target
-- or NULL the linked demand(s) before retrying the move.
--
-- Idempotent: uses CREATE OR REPLACE FUNCTION + DROP TRIGGER IF
-- EXISTS, so the migration can be safely re-run (the server's
-- ensureTriggerOnlyMigrations() helper invokes it on every boot).

CREATE OR REPLACE FUNCTION residences_check_demand_assignation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  conflicting_demand_id varchar;
  new_building_org_id   varchar;
BEGIN
  -- No-op when building_id is unchanged. Catches both literal
  -- no-op updates and updates that touch other columns only.
  IF NEW.building_id IS NOT DISTINCT FROM OLD.building_id THEN
    RETURN NEW;
  END IF;

  -- Resolve the new building's organisation once; reused below for
  -- the Case-B (NULL assignation_building_id) per-row check.
  SELECT organization_id
    INTO new_building_org_id
    FROM buildings
   WHERE id = NEW.building_id;

  -- Search for any demand row that links to this residence via
  -- `assignation_residence_id` and that would be left in a
  -- post-move state the 0012 trigger would have rejected on
  -- insert. Two disjoint cases mirror 0012's two enforcement
  -- branches:
  --
  --   Case A: explicit assignation_building_id is now stale.
  --   Case B: implicit assignation_building (= NEW.building_id)
  --           is in a different org than demands.building_id.
  --
  -- Building-level demands without an explicit
  -- assignation_building_id and whose own `building_id` is in the
  -- *same* org as `NEW.building_id` are allowed (the move is a
  -- legitimate intra-org relocation that 0012 would also have
  -- accepted).
  SELECT d.id
    INTO conflicting_demand_id
    FROM demands d
   WHERE d.assignation_residence_id = NEW.id
     AND (
       -- Case A: explicit pointer no longer matches the residence.
       (d.assignation_building_id IS NOT NULL
        AND d.assignation_building_id <> NEW.building_id)
       OR
       -- Case B: implicit assignation building (= NEW.building_id)
       -- crosses organisations relative to demand.building_id.
       (d.assignation_building_id IS NULL
        AND new_building_org_id IS NOT NULL
        AND (SELECT b.organization_id
               FROM buildings b
              WHERE b.id = d.building_id) IS DISTINCT FROM new_building_org_id)
     )
   LIMIT 1;

  IF conflicting_demand_id IS NOT NULL THEN
    RAISE EXCEPTION
      'Cross-organisation demand assignation link rejected: '
      'residence % cannot be moved to building % while demand % '
      'still links here via assignation_residence_id with the '
      'previous building. Re-target or NULL the demand''s '
      'assignation_residence_id first.',
      NEW.id, NEW.building_id, conflicting_demand_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS residences_demand_assignation_check ON residences;

CREATE TRIGGER residences_demand_assignation_check
  BEFORE UPDATE OF building_id
  ON residences
  FOR EACH ROW
  EXECUTE FUNCTION residences_check_demand_assignation();
