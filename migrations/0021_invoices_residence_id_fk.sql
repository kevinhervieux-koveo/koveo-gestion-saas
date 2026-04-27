-- 0021_invoices_residence_id_fk.sql
--
-- Promotes invoices.residence_id to a real foreign key (Task #1271).
--
-- Background
-- ----------
-- `invoices.residence_id` was modelled with `.references()` in Drizzle
-- but the live column is a plain `varchar` without a FK. The existing
-- cross-residence trigger on `invoices` enforces the building-match
-- invariant whenever both `residence_id` and `building_id` are set, but
-- it does not stop a typo or a since-deleted residence id from
-- lingering as an orphan pointer.
--
-- Mirrors `0012_building_elements_residence_id_fk.sql` for invoices.
--
-- Behaviour
-- ---------
-- 1. NULLs `residence_id` on rows whose linked residence does not
--    exist. Invoices stay attached at their building level (or stay
--    org-scoped if `building_id` is also NULL).
-- 2. Adds the foreign key
--    `invoices_residence_id_residences_id_fk`
--    with `ON DELETE SET NULL`, matching the pattern used by other
--    residence-scoped tables (deleting a residence demotes invoices
--    rather than cascading them away).
--
-- Idempotent — safe to re-apply on every boot via
-- `ensureTriggerOnlyMigrations()`.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'invoices'
  ) THEN
    -- Step 1: Sever orphan residence_id pointers so the FK can be added.
    UPDATE invoices
    SET    residence_id = NULL
    WHERE  residence_id IS NOT NULL
      AND  NOT EXISTS (
        SELECT 1 FROM residences r WHERE r.id = invoices.residence_id
      );

    -- Step 2: Add the FK constraint if it isn't already present.
    IF NOT EXISTS (
      SELECT 1
      FROM   pg_constraint c
      JOIN   pg_class t ON t.oid = c.conrelid
      WHERE  t.relname = 'invoices'
        AND  c.conname = 'invoices_residence_id_residences_id_fk'
    ) THEN
      ALTER TABLE invoices
        ADD CONSTRAINT invoices_residence_id_residences_id_fk
        FOREIGN KEY (residence_id)
        REFERENCES residences (id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END;
$$;
