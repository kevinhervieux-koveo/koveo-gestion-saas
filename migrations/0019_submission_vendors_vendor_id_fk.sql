-- 0019_submission_vendors_vendor_id_fk.sql
--
-- Promotes submission_vendors.vendor_name (varchar 255) to a real
-- foreign key submission_vendors.vendor_id -> vendors(id) (Task #1154).
--
-- Background
-- ----------
-- Until now, submission_vendors used a varchar(255) `vendor_name`
-- column that stored a vendor UUID as text. The GET
-- /api/maintenance/projects/:id/vendors join had to coerce the
-- varchar side with `::uuid` on every read, and a deleted vendor
-- left a dangling text reference that silently dropped out of the
-- joined response (the inner join returned zero rows). There was no
-- referential integrity, so any string at all could be inserted —
-- including a vendor UUID from a *different* organization.
--
-- Behaviour
-- ---------
-- 1. Adds a nullable `vendor_id uuid` column if it does not already
--    exist.
-- 2. Backfills `vendor_id` from the legacy `vendor_name` column
--    using two passes (the second pass only touches rows the first
--    pass could not match):
--      a. UUID-shaped values that match an existing vendor.id.
--      b. Free-text values that match a vendor.name within the same
--         organization as the project's building, case-insensitively.
--    Rows that match neither keep `vendor_id = NULL`, mirroring the
--    "demote, don't delete" policy used for residence FKs (Task
--    #849). The existing payment plan and notes survive the rename.
-- 3. Drops the legacy `submission_vendors_vendor_name_idx` index.
-- 4. Drops the legacy `vendor_name` column once the backfill is
--    complete.
-- 5. Adds the foreign key constraint
--    `submission_vendors_vendor_id_vendors_id_fk` with
--    `ON DELETE SET NULL` so deleting a vendor demotes its
--    submissions to "vendor unknown" rather than cascading away the
--    entire quote/payment plan history.
-- 6. Adds the new `submission_vendors_vendor_id_idx` index for the
--    join used by the project-vendors read endpoint.
--
-- Idempotent: every step is guarded with IF (NOT) EXISTS / pg_attribute
-- and pg_constraint lookups so the migration can be safely re-applied
-- on every boot via `ensureTriggerOnlyMigrations()`.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'submission_vendors'
  ) THEN
    RETURN;
  END IF;

  -- Step 1: add vendor_id column if missing.
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_schema = 'public'
      AND  table_name   = 'submission_vendors'
      AND  column_name  = 'vendor_id'
  ) THEN
    ALTER TABLE "submission_vendors"
      ADD COLUMN "vendor_id" uuid;
  END IF;

  -- Step 2: backfill vendor_id from the legacy vendor_name column,
  -- but only if vendor_name still exists (so a re-run after the
  -- column has been dropped is a no-op).
  IF EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_schema = 'public'
      AND  table_name   = 'submission_vendors'
      AND  column_name  = 'vendor_name'
  ) THEN
    -- Pass (a): vendor_name parses as a UUID that exists in vendors.
    UPDATE "submission_vendors" sv
    SET    vendor_id = v.id
    FROM   "vendors" v
    WHERE  sv.vendor_id IS NULL
      AND  sv.vendor_name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND  v.id::text = sv.vendor_name;

    -- Pass (b): vendor_name matches a vendor.name within the same
    -- organization as the project's building (case-insensitive,
    -- whitespace-trimmed). This recovers the "free-text vendor
    -- name" rows that were never UUIDs in the first place.
    UPDATE "submission_vendors" sv
    SET    vendor_id = v.id
    FROM   "maintenance_projects" mp
    JOIN   "buildings" b ON b.id = mp.building_id
    JOIN   "vendors"   v ON v.organization_id = b.organization_id
    WHERE  sv.vendor_id IS NULL
      AND  sv.vendor_name IS NOT NULL
      AND  mp.id = sv.project_id
      AND  lower(btrim(v.name)) = lower(btrim(sv.vendor_name));
  END IF;

  -- Step 3: drop the legacy vendor_name index if present (must
  -- happen before dropping the underlying column).
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname  = 'submission_vendors_vendor_name_idx'
  ) THEN
    DROP INDEX "submission_vendors_vendor_name_idx";
  END IF;

  -- Step 4: drop the legacy vendor_name column.
  IF EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_schema = 'public'
      AND  table_name   = 'submission_vendors'
      AND  column_name  = 'vendor_name'
  ) THEN
    ALTER TABLE "submission_vendors"
      DROP COLUMN "vendor_name";
  END IF;

  -- Step 5: add the FK constraint if not already present.
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint c
    JOIN   pg_class t ON t.oid = c.conrelid
    WHERE  t.relname = 'submission_vendors'
      AND  c.conname = 'submission_vendors_vendor_id_vendors_id_fk'
  ) THEN
    ALTER TABLE "submission_vendors"
      ADD CONSTRAINT "submission_vendors_vendor_id_vendors_id_fk"
      FOREIGN KEY ("vendor_id")
      REFERENCES  "vendors" ("id")
      ON DELETE SET NULL;
  END IF;

  -- Step 6: add the new vendor_id index if not already present.
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname  = 'submission_vendors_vendor_id_idx'
  ) THEN
    CREATE INDEX "submission_vendors_vendor_id_idx"
      ON "submission_vendors" ("vendor_id");
  END IF;
END;
$$;
