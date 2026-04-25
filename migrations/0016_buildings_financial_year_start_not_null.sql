-- 0016_buildings_financial_year_start_not_null.sql
--
-- Ensures every building has a non-null financial_year_start.
--
-- Background
-- ----------
-- The `buildings.financial_year_start` column was added as nullable.
-- Many older rows were never given a value, so `get_budget_settings`
-- returned NULL for those buildings and downstream forecast / inflation
-- logic fell back to ad-hoc defaults, producing inconsistent budgets.
--
-- This migration:
--   1. Back-fills every NULL row with '2026-01-01' (calendar year at
--      the time this migration was authored; hard-coded so the migration
--      is deterministic and reproducible regardless of when it runs).
--   2. Sets a column DEFAULT of '2026-01-01' so INSERT statements that
--      omit the column (e.g. existing test fixtures) continue to work
--      without modification.
--   3. Adds a NOT NULL constraint so UPDATE/INSERT statements that
--      explicitly supply NULL are rejected at the database level.

UPDATE buildings
   SET financial_year_start = '2026-01-01'
 WHERE financial_year_start IS NULL;

ALTER TABLE buildings
  ALTER COLUMN financial_year_start SET DEFAULT '2026-01-01';

ALTER TABLE buildings
  ALTER COLUMN financial_year_start SET NOT NULL;
