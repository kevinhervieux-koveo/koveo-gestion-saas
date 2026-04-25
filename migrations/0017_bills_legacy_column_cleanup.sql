-- 0017_bills_legacy_column_cleanup.sql
--
-- Cleans up the legacy `bills` columns that were defined in migration 0000
-- but were removed from the Drizzle schema during the bills redesign.
-- Migration 0016 (Task #977) added the *new* columns to the migration
-- chain, but did not remove the obsolete ones, leaving fresh-migration
-- databases with BOTH the old and new column sets and triggering
-- `scripts/check-migration-coverage.ts` drift on:
--   * extraColumns           : bills.residence_id, bills.type, bills.amount,
--                              bills.due_date, bills.late_fee_amount,
--                              bills.discount_amount, bills.final_amount,
--                              bills.payment_received_date
--   * nullability mismatches : bills.building_id, bills.title, bills.category,
--                              bills.payment_type, bills.total_amount,
--                              bills.start_date  (must be NOT NULL)
--                              bills.description, bills.issue_date
--                              (must be nullable)
--   * enum value drift       : bill_type carries the legacy values
--                              ('condo_fees', 'special_assessment', 'utility',
--                              'maintenance', 'other') that the current
--                              schema no longer references.
--
-- This migration is the cleanup follow-up promised in 0016's header comment.
-- Every statement is idempotent so it is safe to re-run against any
-- environment (dev, drizzle-kit-pushed prod, or fresh PGlite).
--
-- Also reconciles the long-standing column-type drifts on
--   * bills.id          : uuid -> text
--   * bills.bill_number : text -> varchar
--   * bills.created_by  : uuid -> varchar
-- so that `bills` reports zero drift end-to-end. The bills_created_by_users_id_fk
-- foreign key is dropped before the type change because users.id remains
-- uuid in the migration chain (a separate cleanup task will align users.id
-- with the schema's text type and re-add the FK).

-- ---------------------------------------------------------------------------
-- Step 1: Drop the legacy bills columns
-- ---------------------------------------------------------------------------
-- Drop the residence_id FK explicitly first. Postgres will also drop it
-- automatically when the column goes away, but naming the constraint here
-- makes the intent obvious and keeps the migration self-documenting.
ALTER TABLE bills DROP CONSTRAINT IF EXISTS bills_residence_id_residences_id_fk;

ALTER TABLE bills DROP COLUMN IF EXISTS residence_id;
ALTER TABLE bills DROP COLUMN IF EXISTS type;
ALTER TABLE bills DROP COLUMN IF EXISTS amount;
ALTER TABLE bills DROP COLUMN IF EXISTS due_date;
ALTER TABLE bills DROP COLUMN IF EXISTS late_fee_amount;
ALTER TABLE bills DROP COLUMN IF EXISTS discount_amount;
ALTER TABLE bills DROP COLUMN IF EXISTS final_amount;
ALTER TABLE bills DROP COLUMN IF EXISTS payment_received_date;

-- ---------------------------------------------------------------------------
-- Step 2: Reconcile NOT NULL constraints with the Drizzle schema
-- ---------------------------------------------------------------------------
-- ALTER COLUMN ... DROP NOT NULL is idempotent (no error when already
-- nullable). ALTER COLUMN ... SET NOT NULL is idempotent on column state
-- but will fail if any row has NULL. None of the SET NOT NULL targets can
-- contain NULL in the wild because the application has been writing them
-- under drizzle-kit push (which already enforces NOT NULL); on a fresh
-- migration database the table is empty.
ALTER TABLE bills ALTER COLUMN description DROP NOT NULL;
ALTER TABLE bills ALTER COLUMN issue_date DROP NOT NULL;

ALTER TABLE bills ALTER COLUMN building_id   SET NOT NULL;
ALTER TABLE bills ALTER COLUMN title         SET NOT NULL;
ALTER TABLE bills ALTER COLUMN category      SET NOT NULL;
ALTER TABLE bills ALTER COLUMN payment_type  SET NOT NULL;
ALTER TABLE bills ALTER COLUMN total_amount  SET NOT NULL;
ALTER TABLE bills ALTER COLUMN start_date    SET NOT NULL;

-- ---------------------------------------------------------------------------
-- Step 3: Strip legacy values from the bill_type enum
-- ---------------------------------------------------------------------------
-- Postgres has no `ALTER TYPE ... DROP VALUE`. The standard recipe is to
-- recreate the enum and rebind every column that uses it. With the legacy
-- `bills.type` column dropped above, the only remaining consumer is the
-- new `bills.bill_type` column (added by 0016), whose values are already
-- restricted to 'unique' / 'recurrent'.
--
-- The DO block guards on the presence of the 'condo_fees' label so the
-- migration is a no-op once the cleanup has been applied.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'bill_type'
      AND e.enumlabel = 'condo_fees'
  ) THEN
    ALTER TYPE bill_type RENAME TO bill_type_legacy;
    CREATE TYPE bill_type AS ENUM ('unique', 'recurrent');
    ALTER TABLE bills
      ALTER COLUMN bill_type TYPE bill_type
      USING bill_type::text::bill_type;
    DROP TYPE bill_type_legacy;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Step 4: Reconcile column-type drifts with the Drizzle schema
-- ---------------------------------------------------------------------------
-- Each block is gated by an information_schema lookup so re-running the
-- migration against an already-migrated DB is a no-op.

-- bills.id : uuid -> text  (drop & restore the gen_random_uuid() default
-- because the default expression is bound to the column's current type)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bills'
      AND column_name = 'id'
      AND udt_name = 'uuid'
  ) THEN
    ALTER TABLE bills ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE bills ALTER COLUMN id TYPE text USING id::text;
    ALTER TABLE bills ALTER COLUMN id SET DEFAULT gen_random_uuid();
  END IF;
END $$;

-- bills.bill_number : text -> varchar(50)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bills'
      AND column_name = 'bill_number'
      AND udt_name = 'text'
  ) THEN
    ALTER TABLE bills
      ALTER COLUMN bill_number TYPE varchar(50) USING bill_number::varchar(50);
  END IF;
END $$;

-- bills.created_by : uuid -> varchar
-- The FK to users.id (still uuid in the migration chain) must be dropped
-- first; a follow-up migration will reinstate it once users.id is aligned
-- with the schema's text/varchar type.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bills'
      AND column_name = 'created_by'
      AND udt_name = 'uuid'
  ) THEN
    ALTER TABLE bills DROP CONSTRAINT IF EXISTS bills_created_by_users_id_fk;
    ALTER TABLE bills
      ALTER COLUMN created_by TYPE varchar USING created_by::text;
  END IF;
END $$;
