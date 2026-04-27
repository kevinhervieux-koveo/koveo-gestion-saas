-- 0024_super_admin_role_add_enum.sql
--
-- Introduces the `super_admin` role (Task #1326), part 1 of 2.
--
-- Background
-- ----------
-- Previously "super admin" was inferred at runtime from an `admin` role +
-- `@koveo-gestion.com` email domain.  This migration makes `super_admin` a
-- first-class value in the `user_role` enum.
--
-- Why split into two migrations:
-- ------------------------------
-- The numbered migration runner wraps each file in a single
-- `BEGIN/COMMIT` transaction. PostgreSQL refuses to use a freshly added
-- enum value within the same transaction that introduced it ("unsafe use
-- of new value … of enum type user_role"). The promotion `UPDATE` lives
-- in `0025_super_admin_role_promote_users.sql` so it runs in a
-- subsequent transaction, after this one commits.
--
-- The previous attempt at this change (`migrations/0023_super_admin_role.sql`,
-- now removed) put the ALTER TYPE and the UPDATE in the same file and
-- failed to apply against every database. It also collided on number
-- 0023 with `0023_drop_bug_reports_idea_box.sql` from a concurrent
-- merge. This pair of files (0024 + 0025) supersedes it.
--
-- Idempotent — safe to re-apply on every boot.

DO $$
BEGIN
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
