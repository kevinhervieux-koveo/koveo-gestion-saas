-- 0020_documents_residence_id_fk.sql
--
-- Promotes documents.residence_id to a real foreign key (Task #1271).
--
-- Background
-- ----------
-- `documents.residence_id` was modelled in Drizzle with `.references()`
-- but the actual database column was created as a plain `varchar`
-- without a real FK constraint (drizzle-kit push elided the constraint
-- on the existing column for at least one historical schema state).
-- The cross-residence trigger added in `0011_documents_residence_…`
-- enforces that, when both `residence_id` and `building_id` are set,
-- the residence belongs to the same building. It does not, however,
-- prevent a typo or a since-deleted residence id from lingering as an
-- orphan pointer; those rows silently disappear from the UI because
-- residence-scoped joins drop them.
--
-- This migration mirrors `0012_building_elements_residence_id_fk.sql`
-- for the `documents` table.
--
-- Behaviour
-- ---------
-- 1. Cleans up any pre-existing orphan rows by NULLing `residence_id`
--    where the residence does not exist. Documents stay attached at
--    their building level (or stay org-scoped if `building_id` is also
--    NULL).
-- 2. Adds the foreign key
--    `documents_residence_id_residences_id_fk`
--    with `ON DELETE SET NULL`, matching the semantics already used by
--    other residence-scoped tables: deleting a residence demotes its
--    documents rather than cascading them away.
--
-- Idempotent: the cleanup UPDATE is naturally a no-op once orphans are
-- gone, and the constraint is only added when it does not already
-- exist. Safe to re-apply on every boot via
-- `ensureTriggerOnlyMigrations()`.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'documents'
  ) THEN
    -- Step 1: Sever orphan residence_id pointers so the FK can be added.
    UPDATE documents
    SET    residence_id = NULL
    WHERE  residence_id IS NOT NULL
      AND  NOT EXISTS (
        SELECT 1 FROM residences r WHERE r.id = documents.residence_id
      );

    -- Step 2: Add the FK constraint if it isn't already present.
    IF NOT EXISTS (
      SELECT 1
      FROM   pg_constraint c
      JOIN   pg_class t ON t.oid = c.conrelid
      WHERE  t.relname = 'documents'
        AND  c.conname = 'documents_residence_id_residences_id_fk'
    ) THEN
      ALTER TABLE documents
        ADD CONSTRAINT documents_residence_id_residences_id_fk
        FOREIGN KEY (residence_id)
        REFERENCES residences (id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END;
$$;
