-- 0016_bills_schema_drift.sql
--
-- Closes the schema drift between the Drizzle TypeScript schema and the
-- numbered SQL migrations for the `bills` table, `bill_type` enum,
-- `bill_category` enum, `payment_structure` enum, `payment_type` enum,
-- and `schedule_payment` enum.
--
-- Background
-- ----------
-- The bills table was heavily evolved via `drizzle-kit push` without
-- corresponding numbered SQL migrations.  As a result, `list_bills` crashes
-- on production/fresh-deploy databases with a DrizzleQueryError on columns
-- that Drizzle expects (e.g. `original_file_name`, `file_name`, `file_size`)
-- but that were never added by any numbered migration.
--
-- This migration is the remediation required by Task #977 (regression of
-- Tasks #626 + #652).  It is fully idempotent:
--   * Enums are created only if they do not already exist.
--   * New enum values are added with ALTER TYPE ... ADD VALUE IF NOT EXISTS
--     (standalone statements only — ALTER TYPE ADD VALUE cannot run inside
--     a PL/pgSQL DO block due to PostgreSQL transaction restrictions).
--   * Columns are added with ADD COLUMN IF NOT EXISTS, so re-running against
--     an already-updated production database is safe.
--
-- Affected objects
-- ----------------
-- * New enums : bill_category, payment_type, payment_structure, schedule_payment
-- * Updated   : bill_type  (add 'unique' / 'recurrent' values)
-- * Missing columns on `bills`:
--     building_id, title, category, vendor, bill_type, payment_structure,
--     payment_type, vendor_invoice_number, schedule_payment, year_interval,
--     schedule_custom, costs, total_amount, start_date, end_date,
--     file_path, file_name, original_file_name, file_size,
--     is_ai_analyzed, ai_analysis_data, is_auto_generated,
--     auto_generate_next_year, source_template_id, auto_generated_label
-- * parent_bill_id and source already exist (migrations 0004 and 0008).

-- ---------------------------------------------------------------------------
-- Step 1: Create enums that do not yet exist
-- Each DO block issues a single CREATE TYPE when the enum is absent.
-- After each block, standalone ALTER TYPE ... ADD VALUE IF NOT EXISTS
-- statements add any values that are in the current schema but missing from
-- an enum that was already present (e.g. created by drizzle-kit push with a
-- different value set).
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bill_category') THEN
    CREATE TYPE bill_category AS ENUM (
      'administration', 'cleaning', 'construction', 'consulting',
      'equipment_rental', 'insurance', 'landscaping', 'legal_services',
      'maintenance', 'professional_services', 'repairs', 'reserves',
      'salary', 'security', 'supplies', 'taxes', 'technology',
      'utilities', 'other'
    );
  END IF;
END $$;

-- Ensure all current bill_category values exist (no-op when just created above).
ALTER TYPE bill_category ADD VALUE IF NOT EXISTS 'administration';
ALTER TYPE bill_category ADD VALUE IF NOT EXISTS 'cleaning';
ALTER TYPE bill_category ADD VALUE IF NOT EXISTS 'construction';
ALTER TYPE bill_category ADD VALUE IF NOT EXISTS 'consulting';
ALTER TYPE bill_category ADD VALUE IF NOT EXISTS 'equipment_rental';
ALTER TYPE bill_category ADD VALUE IF NOT EXISTS 'insurance';
ALTER TYPE bill_category ADD VALUE IF NOT EXISTS 'landscaping';
ALTER TYPE bill_category ADD VALUE IF NOT EXISTS 'legal_services';
ALTER TYPE bill_category ADD VALUE IF NOT EXISTS 'maintenance';
ALTER TYPE bill_category ADD VALUE IF NOT EXISTS 'professional_services';
ALTER TYPE bill_category ADD VALUE IF NOT EXISTS 'repairs';
ALTER TYPE bill_category ADD VALUE IF NOT EXISTS 'reserves';
ALTER TYPE bill_category ADD VALUE IF NOT EXISTS 'salary';
ALTER TYPE bill_category ADD VALUE IF NOT EXISTS 'security';
ALTER TYPE bill_category ADD VALUE IF NOT EXISTS 'supplies';
ALTER TYPE bill_category ADD VALUE IF NOT EXISTS 'taxes';
ALTER TYPE bill_category ADD VALUE IF NOT EXISTS 'technology';
ALTER TYPE bill_category ADD VALUE IF NOT EXISTS 'utilities';
ALTER TYPE bill_category ADD VALUE IF NOT EXISTS 'other';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_type') THEN
    CREATE TYPE payment_type AS ENUM ('unique', 'recurrent');
  END IF;
END $$;

ALTER TYPE payment_type ADD VALUE IF NOT EXISTS 'unique';
ALTER TYPE payment_type ADD VALUE IF NOT EXISTS 'recurrent';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_structure') THEN
    CREATE TYPE payment_structure AS ENUM ('single', 'installment');
  END IF;
END $$;

ALTER TYPE payment_structure ADD VALUE IF NOT EXISTS 'single';
ALTER TYPE payment_structure ADD VALUE IF NOT EXISTS 'installment';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'schedule_payment') THEN
    CREATE TYPE schedule_payment AS ENUM (
      'weekly', 'monthly', 'quarterly', 'yearly', 'custom'
    );
  END IF;
END $$;

ALTER TYPE schedule_payment ADD VALUE IF NOT EXISTS 'weekly';
ALTER TYPE schedule_payment ADD VALUE IF NOT EXISTS 'monthly';
ALTER TYPE schedule_payment ADD VALUE IF NOT EXISTS 'quarterly';
ALTER TYPE schedule_payment ADD VALUE IF NOT EXISTS 'yearly';
ALTER TYPE schedule_payment ADD VALUE IF NOT EXISTS 'custom';

-- bill_type already exists (migration 0000) with legacy values.
-- Add 'unique' and 'recurrent' which the current schema requires.
ALTER TYPE bill_type ADD VALUE IF NOT EXISTS 'unique';
ALTER TYPE bill_type ADD VALUE IF NOT EXISTS 'recurrent';

-- ---------------------------------------------------------------------------
-- Step 2: Missing columns on `bills`
-- All are added as nullable (or with a safe DEFAULT) so the statement is
-- safe against a table that already contains rows.
-- ---------------------------------------------------------------------------

-- NOTE: FK constraints (building_id → buildings.id, source_template_id → bills.id)
-- are intentionally omitted here because the historical migration chain defines
-- buildings.id as uuid while the current Drizzle schema uses text, causing a
-- type mismatch that prevents the FK from being created in fresh-migration
-- environments.  The FK constraints are part of the follow-up cleanup task
-- (#1004) that will reconcile all type mismatches in the bills migration chain.
-- The columns below are added as plain varchar/text; the application layer and
-- the current live-database FK (created by drizzle-kit push) enforce the
-- referential relationship on production.

ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS building_id varchar,
  ADD COLUMN IF NOT EXISTS title varchar(200),
  ADD COLUMN IF NOT EXISTS category bill_category,
  ADD COLUMN IF NOT EXISTS vendor varchar(200),
  ADD COLUMN IF NOT EXISTS bill_type bill_type,
  ADD COLUMN IF NOT EXISTS payment_structure payment_structure,
  ADD COLUMN IF NOT EXISTS payment_type payment_type,
  ADD COLUMN IF NOT EXISTS vendor_invoice_number varchar(100),
  ADD COLUMN IF NOT EXISTS schedule_payment schedule_payment,
  ADD COLUMN IF NOT EXISTS year_interval integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS schedule_custom date[],
  ADD COLUMN IF NOT EXISTS costs numeric(10, 2)[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS total_amount numeric(10, 2),
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS original_file_name text,
  ADD COLUMN IF NOT EXISTS file_size integer,
  ADD COLUMN IF NOT EXISTS is_ai_analyzed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_analysis_data jsonb,
  ADD COLUMN IF NOT EXISTS is_auto_generated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_generate_next_year boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_template_id varchar,
  ADD COLUMN IF NOT EXISTS auto_generated_label varchar;

-- ---------------------------------------------------------------------------
-- Step 3: Indexes (idempotent via IF NOT EXISTS)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS bills_building_id_idx        ON bills(building_id);
CREATE INDEX IF NOT EXISTS bills_created_by_idx         ON bills(created_by);
CREATE INDEX IF NOT EXISTS bills_source_template_id_idx ON bills(source_template_id);
CREATE INDEX IF NOT EXISTS bills_parent_bill_id_idx     ON bills(parent_bill_id);
CREATE INDEX IF NOT EXISTS bills_status_idx             ON bills(status);
CREATE INDEX IF NOT EXISTS bills_category_idx           ON bills(category);
CREATE INDEX IF NOT EXISTS bills_start_date_idx         ON bills(start_date);
CREATE INDEX IF NOT EXISTS bills_end_date_idx           ON bills(end_date);
CREATE INDEX IF NOT EXISTS bills_created_at_idx         ON bills(created_at);
CREATE INDEX IF NOT EXISTS bills_updated_at_idx         ON bills(updated_at);
