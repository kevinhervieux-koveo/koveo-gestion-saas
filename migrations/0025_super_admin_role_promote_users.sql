-- 0025_super_admin_role_promote_users.sql
--
-- Introduces the `super_admin` role (Task #1326), part 2 of 2.
--
-- See `migrations/0024_super_admin_role_add_enum.sql` for the
-- accompanying enum addition and an explanation of why this work is
-- split across two migration files.
--
-- This file promotes every existing `admin` whose email ends in
-- `@koveo-gestion.com` to the new `super_admin` role. It must run in a
-- separate transaction from the ALTER TYPE so PostgreSQL allows the
-- new enum value to be referenced.
--
-- Idempotent — safe to re-apply (the WHERE clause matches no rows once
-- the promotion has happened).

UPDATE users
SET    role = 'super_admin'
WHERE  role = 'admin'
  AND  lower(email) LIKE '%@koveo-gestion.com';
