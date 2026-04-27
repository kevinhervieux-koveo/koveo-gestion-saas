-- 0022_invitations_residence_id_fk.sql
--
-- Promotes invitations.residence_id to a real foreign key (Task #1271).
--
-- Background
-- ----------
-- `invitations.residence_id` was a plain `text` column with no FK to
-- `residences(id)` (Task #810/#945 added a cross-residence trigger but
-- intentionally avoided the FK because callers sometimes invited
-- residents before the residence row existed). The cross-org guard
-- short-circuits when the residence lookup misses, so any orphan or
-- typo'd `residence_id` quietly survives.
--
-- This migration mirrors `0012_building_elements_residence_id_fk.sql`
-- for the `invitations` table.
--
-- Behaviour
-- ---------
-- 1. Sever orphan residence_id pointers by setting them to NULL on
--    invitation rows whose residence does not exist. The invitation
--    survives at its building (or org) scope so the invitee can still
--    accept it; it just no longer claims to point at a non-existent
--    residence.
-- 2. Adds the foreign key
--    `invitations_residence_id_residences_id_fk`
--    with `ON DELETE SET NULL`, so deleting a residence demotes any
--    pending invitations rather than cascading them away.
--
-- Idempotent — safe to re-apply on every boot via
-- `ensureTriggerOnlyMigrations()`.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'invitations'
  ) THEN
    -- Step 1: Sever orphan residence_id pointers so the FK can be added.
    UPDATE invitations
    SET    residence_id = NULL
    WHERE  residence_id IS NOT NULL
      AND  NOT EXISTS (
        SELECT 1 FROM residences r WHERE r.id = invitations.residence_id
      );

    -- Step 2: Add the FK constraint if it isn't already present.
    IF NOT EXISTS (
      SELECT 1
      FROM   pg_constraint c
      JOIN   pg_class t ON t.oid = c.conrelid
      WHERE  t.relname = 'invitations'
        AND  c.conname = 'invitations_residence_id_residences_id_fk'
    ) THEN
      ALTER TABLE invitations
        ADD CONSTRAINT invitations_residence_id_residences_id_fk
        FOREIGN KEY (residence_id)
        REFERENCES residences (id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END;
$$;
