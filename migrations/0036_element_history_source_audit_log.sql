-- 0036_element_history_source_audit_log.sql
--
-- W37 + W38 (QA Pass #27): source discriminator on element_history plus
-- full before/after audit capture on element_history_audit_log.
--
-- 1. Three new PostgreSQL enum types:
--      element_history_source        → discriminator on element_history rows
--      element_history_audit_action  → action column on the audit log
--      element_history_audit_source  → mechanism that triggered the write
--
-- 2. New column element_history.source (immutable after insert, default 'manual').
--
-- 3. Extend element_history_audit_log:
--      - Add action, audit_source, performed_at, previous_values, new_values.
--      - Backfill existing rows: action = 'updated', audit_source = 'rest_api',
--        performed_at = created_at.
--      - Drop the old NOT NULL constraint on `changes` (new rows use
--        previous_values / new_values instead).
--      - Replace ON DELETE CASCADE on history_id with ON DELETE SET NULL and
--        make the column nullable so 'deleted'-action audit rows survive the
--        element_history deletion that triggered them.
--
-- Runs inside a single transaction; any failure rolls back the whole migration.
--

BEGIN;

-- ─── 1. New enum types ────────────────────────────────────────────────────────

CREATE TYPE element_history_source AS ENUM (
  'manual',
  'project',
  'import',
  'system'
);

CREATE TYPE element_history_audit_action AS ENUM (
  'created',
  'updated',
  'deleted'
);

CREATE TYPE element_history_audit_source AS ENUM (
  'rest_api',
  'mcp',
  'project_workflow',
  'import',
  'system'
);

-- ─── 2. source column on element_history ─────────────────────────────────────

ALTER TABLE element_history
  ADD COLUMN IF NOT EXISTS source element_history_source
    NOT NULL DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS element_history_source_idx
  ON element_history(source);

-- ─── 3a. New columns on element_history_audit_log ────────────────────────────

ALTER TABLE element_history_audit_log
  ADD COLUMN IF NOT EXISTS action        element_history_audit_action
    NOT NULL DEFAULT 'updated',
  ADD COLUMN IF NOT EXISTS audit_source  element_history_audit_source
    NOT NULL DEFAULT 'rest_api',
  ADD COLUMN IF NOT EXISTS performed_at  timestamp DEFAULT now(),
  ADD COLUMN IF NOT EXISTS previous_values jsonb,
  ADD COLUMN IF NOT EXISTS new_values    jsonb;

-- ─── 3b. Backfill performed_at from created_at for existing rows ──────────────

UPDATE element_history_audit_log
SET performed_at = created_at
WHERE performed_at IS NULL AND created_at IS NOT NULL;

-- ─── 3c. Drop NOT NULL on `changes` (new rows use previous/new_values) ────────

ALTER TABLE element_history_audit_log
  ALTER COLUMN changes DROP NOT NULL;

-- ─── 3d. Swap FK: CASCADE → SET NULL, make column nullable ───────────────────
--
-- history_id must be nullable because 'deleted'-action audit rows survive
-- the element_history deletion: Postgres sets the column to NULL via the
-- SET NULL rule, letting the audit row persist as a tombstone.

-- Drop the old NOT NULL constraint first (Postgres doesn't allow renaming
-- constraints portably, so we drop + re-add).
ALTER TABLE element_history_audit_log
  ALTER COLUMN history_id DROP NOT NULL;

-- Drop the old ON DELETE CASCADE FK.
DO $$
DECLARE
  _constraint TEXT;
BEGIN
  SELECT conname INTO _constraint
  FROM pg_constraint
  WHERE conrelid = 'element_history_audit_log'::regclass
    AND contype = 'f'
    AND conkey = ARRAY(
      SELECT attnum FROM pg_attribute
      WHERE attrelid = 'element_history_audit_log'::regclass
        AND attname = 'history_id'
    )::smallint[];
  IF _constraint IS NOT NULL THEN
    EXECUTE 'ALTER TABLE element_history_audit_log DROP CONSTRAINT ' || quote_ident(_constraint);
  END IF;
END $$;

-- Add the replacement FK with ON DELETE SET NULL.
ALTER TABLE element_history_audit_log
  ADD CONSTRAINT element_history_audit_log_history_id_fk
    FOREIGN KEY (history_id)
    REFERENCES element_history(id)
    ON DELETE SET NULL;

-- ─── 3e. New indexes ──────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS element_history_audit_log_action_idx
  ON element_history_audit_log(action);

CREATE INDEX IF NOT EXISTS element_history_audit_log_performed_at_idx
  ON element_history_audit_log(performed_at);

COMMIT;
