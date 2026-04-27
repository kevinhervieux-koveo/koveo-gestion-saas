-- 0027_document_link_families_system_name_uniq.sql
--
-- Adds a partial unique index on document_link_families(name)
-- WHERE organization_id IS NULL, so system families cannot have duplicate names.
-- The existing composite index (organization_id, name) does not enforce uniqueness
-- for NULL organization_id values due to Postgres NULL semantics.

CREATE UNIQUE INDEX IF NOT EXISTS document_link_families_system_name_uniq
  ON document_link_families(name)
  WHERE organization_id IS NULL;
