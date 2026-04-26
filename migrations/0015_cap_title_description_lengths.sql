-- 0015_cap_title_description_lengths.sql
--
-- Enforces maximum lengths on title/description columns for
-- maintenance_requests and demands as a database-level defence in depth
-- to complement the Zod-layer caps in insertMaintenanceRequestSchema and
-- insertDemandSchema (both capped at 200 / 5000 characters respectively).
--
-- general_communications.title (varchar(200)) and
-- general_communications.content (varchar(5000)) already carry database-level
-- length enforcement via the column type, so no changes are needed there.
--
-- maintenance_requests.title
-- --------------------------
-- The column is currently TEXT (unbounded). We alter it to VARCHAR(200).
-- We deliberately omit the USING clause so PostgreSQL applies its implicit
-- assignment cast (text → varchar(200)), which raises "value too long for
-- type character varying(200)" (SQLSTATE 22001) if any existing row already
-- exceeds 200 characters. This fails loudly rather than silently truncating
-- user data, so the team can decide on a backfill if drift is found.
--
-- maintenance_requests.description and demands.description
-- --------------------------------------------------------
-- Both remain TEXT columns (enforced only at the Zod layer). We add CHECK
-- constraints that mirror the Zod cap (char_length(btrim(col)) <= 5000).
-- Drizzle does not model CHECK constraints so they will not be dropped by
-- drizzle-kit push, matching the pattern documented above demands for the
-- existing trigger-based constraints in earlier migrations.

ALTER TABLE maintenance_requests
  ALTER COLUMN title TYPE varchar(200);

ALTER TABLE maintenance_requests
  ADD CONSTRAINT maintenance_requests_description_length_check
  CHECK (char_length(btrim(description)) <= 5000);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'demands'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'demands_description_length_check'
    ) THEN
      ALTER TABLE demands
        ADD CONSTRAINT demands_description_length_check
        CHECK (char_length(btrim(description)) <= 5000);
    END IF;
  END IF;
END $$;
