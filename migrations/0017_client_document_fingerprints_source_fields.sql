-- Task #1002: Extend client_document_fingerprints with source file metadata.
-- Adds two nullable columns so the commit endpoint can record the original
-- source filename and the bulk-import session that committed the document.
-- Both columns are nullable so older rows (committed before this migration)
-- and concurrent commits from sessions that predate the change remain valid.

ALTER TABLE client_document_fingerprints
  ADD COLUMN IF NOT EXISTS source_file_name text,
  ADD COLUMN IF NOT EXISTS source_session_id text
    REFERENCES bulk_import_sessions(id) ON DELETE SET NULL;
