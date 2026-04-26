-- 0018_buildings_financial_year_start_backfill.sql
--
-- Defensive re-backfill of buildings.financial_year_start.
--
-- Background
-- ----------
-- Migration 0016_buildings_financial_year_start_not_null.sql was supposed to
-- eliminate all NULL rows, but on some environments it did not fully apply.
-- This migration is idempotent and re-runs the backfill using the current
-- calendar year's January 1st (resolved at migration runtime, not hard-coded),
-- then re-asserts the DEFAULT and NOT NULL constraints so they are guaranteed
-- regardless of migration ordering.
--
-- The column DEFAULT stays fixed at '2026-01-01' (matching the Drizzle schema)
-- so INSERT statements that omit the column get the canonical default.
-- Only NULL rows that somehow survived 0016 are backfilled to the dynamic value.

UPDATE buildings
   SET financial_year_start = make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 1, 1)
 WHERE financial_year_start IS NULL;

ALTER TABLE buildings
  ALTER COLUMN financial_year_start SET DEFAULT '2026-01-01';

ALTER TABLE buildings
  ALTER COLUMN financial_year_start SET NOT NULL;
