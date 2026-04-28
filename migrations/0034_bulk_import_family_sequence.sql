-- Task #1589 — Add sequence column to bulk_import_item_family_memberships.
-- Drives the visual order of in-session items inside a family group in the
-- Linking step and determines the commit-time neighbor for empty-family items.

ALTER TABLE "bulk_import_item_family_memberships"
  ADD COLUMN IF NOT EXISTS "sequence" integer;
