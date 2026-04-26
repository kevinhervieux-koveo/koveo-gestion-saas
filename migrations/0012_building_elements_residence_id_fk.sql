-- 0012_building_elements_residence_id_fk.sql
--
-- Promotes building_elements.residence_id to a real foreign key
-- (Task #849).
--
-- Background
-- ----------
-- Until now, `building_elements.residence_id` was a plain `text` column
-- with no FK to `residences(id)`. The cross-residence trigger added in
-- Task #811 (`building_elements_residence_building_check`) only enforces
-- the building-match invariant when the linked residence actually
-- exists; rows whose `residence_id` was a typo or pointed at a
-- since-deleted residence slipped through and became invisible orphan
-- elements (the UI joins through `residences` and silently filters them
-- out). This migration closes that gap by adding the FK constraint that
-- should have existed from day one.
--
-- Behaviour
-- ---------
-- 1. Cleans up any pre-existing orphan rows by NULLing `residence_id`
--    where the residence does not exist. This preserves the element at
--    its building level (it still has a valid `building_id`) while
--    severing the dangling pointer so the FK can be added without a
--    constraint violation. The same cleanup is exposed as a standalone
--    backfill script (see
--    `server/scripts/backfill-orphan-building-element-residence-ids.ts`)
--    so operators can run it ahead of time on production.
-- 2. Adds the foreign key
--    `building_elements_residence_id_residences_id_fk`
--    with `ON DELETE SET NULL`, matching the semantics already used by
--    other residence-scoped tables: deleting a residence demotes its
--    elements to building-wide rather than cascading them away.
--
-- Idempotent: the cleanup UPDATE is naturally a no-op once orphans are
-- gone, and the constraint is only added when it does not already
-- exist. The migration can therefore be safely re-applied on every
-- boot via `ensureTriggerOnlyMigrations()`.

-- Entire migration is conditional on building_elements existing in this DB state.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'building_elements'
  ) THEN
    -- Step 1: Sever orphan residence_id pointers so the FK can be added.
    UPDATE building_elements
    SET    residence_id = NULL
    WHERE  residence_id IS NOT NULL
      AND  NOT EXISTS (
        SELECT 1 FROM residences r WHERE r.id = building_elements.residence_id
      );

    -- Step 2: Add the FK constraint if it isn't already present.
    IF NOT EXISTS (
      SELECT 1
      FROM   pg_constraint c
      JOIN   pg_class t ON t.oid = c.conrelid
      WHERE  t.relname = 'building_elements'
        AND  c.conname = 'building_elements_residence_id_residences_id_fk'
    ) THEN
      ALTER TABLE building_elements
        ADD CONSTRAINT building_elements_residence_id_residences_id_fk
        FOREIGN KEY (residence_id)
        REFERENCES residences (id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END;
$$;
