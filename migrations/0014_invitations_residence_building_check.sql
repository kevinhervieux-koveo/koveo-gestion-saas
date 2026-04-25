-- 0014_invitations_residence_building_check.sql
--
-- Database-level guard preventing cross-organisation invitation links.
--
-- Background
-- ----------
-- An `invitations` row may carry an organisation-only target
-- (`organization_id` set, `building_id` and `residence_id` NULL), a
-- building-only target (`building_id` set, `residence_id` NULL), or a
-- residence-level target (`building_id` AND `residence_id` both set).
-- When both `building_id` and `residence_id` are populated they must
-- agree: the residence has to live in that exact building (and
-- therefore the same organisation). Until now that invariant was only
-- enforced by the runtime validation in the invitation creation API,
-- so any code path that bypassed the API — MCP write tools, ad-hoc
-- SQL, future migrations — could silently re-introduce a cross-org
-- invitation row pointing at a residence in a different building /
-- organisation.
--
-- This migration is the invitations-side counterpart to migration
-- 0010 (`demands`), 0011 (`documents` cross-org guard), 0012
-- (`invoices`) and 0013 (`building_elements`). All five guards share
-- the same shape: a BEFORE INSERT/UPDATE trigger on the dependent
-- table that looks up `residences.building_id` for the candidate row
-- and aborts the statement with `check_violation` (SQLSTATE 23514) on
-- mismatch.
--
-- Implementation note
-- -------------------
-- A plain CHECK constraint cannot cross to another table, so the
-- invariant is enforced via a BEFORE INSERT/UPDATE trigger that fires
-- only when `residence_id` or `building_id` are in the SET list.
-- The trigger short-circuits when either column is NULL (org-only
-- and building-only invitations cannot mismatch a column they do not
-- carry) and when the residence row cannot be resolved (the
-- `residence_id` column is text-typed and intentionally has no FK;
-- the application layer is expected to validate residence existence).
--
-- Idempotent: drops + recreates the trigger and uses CREATE OR
-- REPLACE for the function, so the migration can be safely re-run
-- (the server's ensureTriggerOnlyMigrations() helper invokes it on
-- every boot).

CREATE OR REPLACE FUNCTION invitations_check_residence_building()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  res_building_id varchar;
BEGIN
  -- Org-only or building-only invitations cannot mismatch a column they
  -- do not carry. The cross-org leak only materialises when both
  -- `residence_id` and `building_id` are populated.
  IF NEW.residence_id IS NULL OR NEW.building_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT building_id
    INTO res_building_id
    FROM residences
   WHERE id = NEW.residence_id;

  -- The column has no FK; if the residence does not exist there is
  -- nothing to compare against and we let the row through. The
  -- application layer is expected to validate residence existence.
  IF res_building_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF res_building_id <> NEW.building_id THEN
    RAISE EXCEPTION
      'Cross-organisation invitation rejected: invitations.building_id (%) '
      'does not match residence.building_id (%) for residence_id %',
      NEW.building_id, res_building_id, NEW.residence_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invitations_residence_building_check ON invitations;

CREATE TRIGGER invitations_residence_building_check
  BEFORE INSERT OR UPDATE OF residence_id, building_id
  ON invitations
  FOR EACH ROW
  EXECUTE FUNCTION invitations_check_residence_building();
