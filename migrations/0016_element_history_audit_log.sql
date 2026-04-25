-- 0016_element_history_audit_log.sql
--
-- Adds first-class edit-tracking to the element_history table (Task #987).
--
-- 1. Two new columns on element_history:
--    - updated_at (nullable timestamptz) — stamped on every successful edit.
--    - updated_by (nullable text FK → users.id ON DELETE SET NULL) — the user
--      who performed the edit; NULL for legacy MCP_API_KEY sessions that have
--      no bound user account.
--    Both columns are NULL for rows that have never been edited, which keeps
--    the "edited" indicator absent for pristine history events.
--
-- 2. New table element_history_audit_log:
--    One row per successful edit to element_history.  Stores a structured
--    before/after diff as JSONB so the full edit history is preserved
--    even when subsequent edits overwrite the same field.  An optional
--    `meta` key in `changes` carries out-of-band metadata (e.g. the
--    system marker for MCP_API_KEY sessions).
--
-- Both changes land in a single migration transaction so the schema is
-- always consistent.

-- 1a. Add updated_at column to element_history (nullable = never-edited rows stay NULL)
ALTER TABLE element_history
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- 1b. Add updated_by FK to element_history
ALTER TABLE element_history
  ADD COLUMN IF NOT EXISTS updated_by text REFERENCES users(id) ON DELETE SET NULL;

-- 2. Create the audit log table
CREATE TABLE IF NOT EXISTS element_history_audit_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  history_id    uuid        NOT NULL REFERENCES element_history(id) ON DELETE CASCADE,
  -- NULL when the edit was made via a legacy MCP_API_KEY session (no bound user).
  performed_by  text        REFERENCES users(id) ON DELETE SET NULL,
  -- Structured diff: { "fieldName": { "before": ..., "after": ... }, ... }
  -- May also carry a top-level "meta" key for non-field audit metadata.
  changes       jsonb       NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS element_history_audit_log_history_id_idx
  ON element_history_audit_log(history_id);

CREATE INDEX IF NOT EXISTS element_history_audit_log_performed_by_idx
  ON element_history_audit_log(performed_by);
