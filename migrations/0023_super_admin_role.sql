-- 0023_super_admin_role.sql
--
-- Introduces the `super_admin` role (Task #1326).
--
-- Background
-- ----------
-- Previously "super admin" was inferred at runtime from an `admin` role +
-- `@koveo-gestion.com` email domain.  This migration makes `super_admin` a
-- first-class value in the `user_role` enum and promotes every existing
-- `admin` whose email ends in `@koveo-gestion.com` to the new role.
--
-- Idempotent — safe to re-apply on every boot via
-- `ensureTriggerOnlyMigrations()`.

DO $$
BEGIN
  -- Step 1: Add the enum value if it doesn't exist yet.
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_enum e
    JOIN   pg_type t ON t.oid = e.enumtypid
    WHERE  t.typname = 'user_role'
      AND  e.enumlabel = 'super_admin'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'super_admin' BEFORE 'admin';
  END IF;
END;
$$;

-- Step 2: Promote existing Koveo internal admins to super_admin.
-- We do this in a plain UPDATE (outside the DO block) because ALTER TYPE
-- commits the enum change first, making the new value available.
UPDATE users
SET    role = 'super_admin'
WHERE  role = 'admin'
  AND  lower(email) LIKE '%@koveo-gestion.com';
