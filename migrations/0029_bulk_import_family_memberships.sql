-- 0029_bulk_import_family_memberships.sql
--
-- Task #1425: Group bulk-import linking by family.
--
-- Introduces the `bulk_import_item_family_memberships` table that replaces
-- the single-family JSONB fields (linkDecisions.familyId / beforeDocumentId /
-- afterDocumentId) with a proper many-to-many relation so one import item
-- can belong to multiple families simultaneously.
--
-- Steps:
--  1. Create the table.
--  2. Add indexes (unique item+family, item lookup, family+neighbor composite).
--  3. Back-fill existing linkDecisions that already have a familyId so live
--     sessions do not lose their linking decisions after the upgrade.
--
-- The old JSONB columns are kept as-is (they remain the authoritative store
-- for the legacy single-membership read path during the transition window
-- described in the task spec). New code writes to both; the commit path
-- reads from `bulk_import_item_family_memberships` first and falls back to
-- the JSONB columns for items that pre-date this migration.

-- ---------------------------------------------------------------------------
-- 1. Create the memberships table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bulk_import_item_family_memberships (
  id                    text        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id               text        NOT NULL
                                    REFERENCES bulk_import_items(id) ON DELETE CASCADE,
  family_id             text        REFERENCES document_link_families(id) ON DELETE SET NULL,
  neighbor_document_id  text        REFERENCES documents(id) ON DELETE SET NULL,
  position              text        CHECK (position IN ('before', 'after')),
  source                text        NOT NULL DEFAULT 'manual'
                                    CHECK (source IN ('ai', 'manual')),
  ai_confidence         real        CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
  manual_override       boolean     NOT NULL DEFAULT false,
  reason                text,
  created_at            timestamp   NOT NULL DEFAULT now(),
  updated_at            timestamp   NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS bulk_import_item_family_memberships_item_family_uniq
  ON bulk_import_item_family_memberships (item_id, family_id);

CREATE INDEX IF NOT EXISTS bulk_import_item_family_memberships_item_idx
  ON bulk_import_item_family_memberships (item_id);

CREATE INDEX IF NOT EXISTS bulk_import_item_family_memberships_family_neighbor_idx
  ON bulk_import_item_family_memberships (family_id, neighbor_document_id, position);

-- ---------------------------------------------------------------------------
-- 3. Back-fill from existing linkDecisions JSONB
-- ---------------------------------------------------------------------------
-- For every item whose linkDecisions JSON blob has a non-null familyId,
-- insert a corresponding membership row (source='ai', manualOverride maps
-- from manualOverride field). Rows that already exist (re-run safety) are
-- skipped via ON CONFLICT DO NOTHING.
INSERT INTO bulk_import_item_family_memberships
  (item_id, family_id, neighbor_document_id, position, source, ai_confidence, manual_override, reason)
SELECT
  bi.id                                     AS item_id,
  (bi.link_decisions->>'familyId')          AS family_id,
  COALESCE(
    (bi.link_decisions->>'beforeDocumentId'),
    (bi.link_decisions->>'afterDocumentId')
  )                                         AS neighbor_document_id,
  CASE
    WHEN bi.link_decisions->>'beforeDocumentId' IS NOT NULL THEN 'before'
    WHEN bi.link_decisions->>'afterDocumentId'  IS NOT NULL THEN 'after'
    ELSE NULL
  END                                       AS position,
  CASE
    WHEN (bi.link_decisions->>'manualOverride')::boolean IS TRUE THEN 'manual'
    ELSE 'ai'
  END                                       AS source,
  CASE
    WHEN (bi.link_decisions->>'confidence') IS NOT NULL
    THEN (bi.link_decisions->>'confidence')::real
    ELSE NULL
  END                                       AS ai_confidence,
  COALESCE(
    (bi.link_decisions->>'manualOverride')::boolean,
    false
  )                                         AS manual_override,
  (bi.link_decisions->>'reason')            AS reason
FROM bulk_import_items bi
WHERE
  bi.link_decisions IS NOT NULL
  AND bi.link_decisions->>'familyId' IS NOT NULL
  AND bi.link_decisions->>'familyId' != 'null'
  -- Only back-fill when the referenced family actually still exists.
  AND EXISTS (
    SELECT 1 FROM document_link_families dlf
    WHERE dlf.id = bi.link_decisions->>'familyId'
  )
ON CONFLICT (item_id, family_id) DO NOTHING;
