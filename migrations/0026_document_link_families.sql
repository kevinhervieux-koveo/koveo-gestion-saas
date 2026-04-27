-- 0026_document_link_families.sql
--
-- Introduces document link "families": named groupings that give independent
-- before/after chains to a single document. Replaces the global single-chain
-- model with a per-family chain model.
--
-- Steps:
--  1. Wipe all existing document_links rows (task spec: no preservation needed).
--  2. Drop the old per-document unique indexes on document_links.
--  3. Create the document_link_families table.
--  4. Seed the Koveo system families.
--  5. Add family_id column to document_links (NOT NULL, FK to the new table).
--  6. Re-add unique indexes scoped per (document, position, family).

-- ---------------------------------------------------------------------------
-- 1. Wipe existing link data
-- ---------------------------------------------------------------------------
DELETE FROM document_links;

-- ---------------------------------------------------------------------------
-- 2. Drop old unique indexes that are now too broad
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS document_links_from_position_uniq;
DROP INDEX IF EXISTS document_links_to_position_uniq;
DROP INDEX IF EXISTS document_links_edge_uniq;

-- ---------------------------------------------------------------------------
-- 3. Create document_link_families
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_link_families (
  id              text        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id varchar     REFERENCES organizations(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  description     text,
  is_system       boolean     NOT NULL DEFAULT false,
  source          text,
  created_at      timestamp   NOT NULL DEFAULT now(),
  updated_at      timestamp   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_link_families_organization_id_idx
  ON document_link_families(organization_id);

CREATE INDEX IF NOT EXISTS document_link_families_is_system_idx
  ON document_link_families(is_system);

CREATE UNIQUE INDEX IF NOT EXISTS document_link_families_org_name_uniq
  ON document_link_families(organization_id, name);

-- ---------------------------------------------------------------------------
-- 4. Seed Koveo system families
-- ---------------------------------------------------------------------------
INSERT INTO document_link_families (organization_id, name, description, is_system, source)
VALUES
  (NULL, 'Sequence',        'General sequential order (e.g. version history or reading order)',          true, 'koveo'),
  (NULL, 'Financial',       'Financial documents linked in chronological order (budgets, statements)',   true, 'koveo'),
  (NULL, 'Meetings (AGA)',  'Annual general assembly minutes and related documents',                     true, 'koveo'),
  (NULL, 'Contracts',       'Contracts and amendments linked across versions or renewals',               true, 'koveo'),
  (NULL, 'Maintenance',     'Maintenance reports, inspections, and follow-up documents',                 true, 'koveo')
ON CONFLICT (organization_id, name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Add family_id column to document_links
--    (table is empty so NOT NULL is safe without a DEFAULT)
-- ---------------------------------------------------------------------------
ALTER TABLE document_links
  ADD COLUMN IF NOT EXISTS family_id text
    NOT NULL
    REFERENCES document_link_families(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- 6. New per-family unique indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS document_links_family_id_idx
  ON document_links(family_id);

CREATE UNIQUE INDEX IF NOT EXISTS document_links_from_position_family_uniq
  ON document_links(from_document_id, position, family_id);

CREATE UNIQUE INDEX IF NOT EXISTS document_links_to_position_family_uniq
  ON document_links(to_document_id, position, family_id);

CREATE UNIQUE INDEX IF NOT EXISTS document_links_edge_family_uniq
  ON document_links(from_document_id, to_document_id, position, family_id);
