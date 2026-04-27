-- 0030_documents_residence_building_check.sql
--
-- Database-level guard preventing cross-organisation document links.
--
-- Background
-- ----------
-- A document row may carry both `building_id` and an optional
-- `residence_id`. When both are set the residence must belong to the
-- same building (and therefore the same organisation) as the document.
-- Until now the invariant was only enforced at the application layer
-- (`server/api/documents.ts`), so any code path that bypassed the API
-- — MCP write tools, ad-hoc SQL, future migrations — could silently
-- re-introduce cross-org rows.
--
-- The `backfill:cross-residence-documents` script cleans up legacy
-- rows by NULLing `residence_id` on every offending row, after which
-- this trigger can be installed without conflict. The backfill scripts
-- (`server/scripts/backfill-cross-residence-documents*.ts`) are the
-- recommended way to pre-clean production before this migration.
--
-- Implementation note
-- -------------------
-- A plain CHECK constraint cannot cross to another table, so the
-- invariant is enforced via a BEFORE INSERT/UPDATE trigger that looks
-- up `residences.building_id` for the candidate row and aborts the
-- statement with `check_violation` (SQLSTATE 23514) on mismatch. The
-- trigger only fires when `residence_id` or `building_id` changes (or
-- on INSERT), and short-circuits when `residence_id` is NULL
-- (building-only documents cannot mismatch a column they do not carry)
-- or when both columns are NULL (org-scoped-only documents).
--
-- Idempotent: drops + recreates the trigger and uses CREATE OR REPLACE
-- for the function, so the migration can be safely re-run on every
-- boot via `ensureTriggerOnlyMigrations()`.

CREATE OR REPLACE FUNCTION documents_check_residence_building()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  res_building_id varchar;
BEGIN
  -- When residence_id is NULL the document is building-wide or
  -- org-scoped and cannot produce a cross-org link. Allow it.
  IF NEW.residence_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- When building_id is also NULL (org-scoped document with a
  -- residence pointer) there is nothing to compare against. Allow it
  -- and rely on the application layer to enforce consistency.
  IF NEW.building_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT building_id
    INTO res_building_id
    FROM residences
   WHERE id = NEW.residence_id;

  -- If the residence does not exist, let the FK constraint (added by
  -- migration 0020) raise the foreign-key violation rather than
  -- masking it with our cross-org error.
  IF res_building_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF res_building_id <> NEW.building_id THEN
    RAISE EXCEPTION
      'Cross-organisation document rejected: document.building_id (%) '
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
    WHERE table_schema = 'public' AND table_name = 'documents'
  ) THEN
    DROP TRIGGER IF EXISTS documents_residence_building_check ON documents;

    CREATE TRIGGER documents_residence_building_check
      BEFORE INSERT OR UPDATE OF residence_id, building_id
      ON documents
      FOR EACH ROW
      EXECUTE FUNCTION documents_check_residence_building();
  END IF;
END $$;
