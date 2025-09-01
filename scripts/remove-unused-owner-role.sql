-- Safe script to remove unused 'owner' role from production
-- Since there are 0 users with 'owner' role, this is completely safe

-- Step 1: Verify no users have 'owner' role (should return 0)
SELECT COUNT(*) as owner_users FROM users WHERE role = 'owner';

-- Step 2: Create new enum without 'owner' role
CREATE TYPE user_role_new AS ENUM (
  'admin',
  'manager', 
  'resident',
  'tenant',
  'demo_manager',
  'demo_tenant',
  'demo_resident'
);

-- Step 3: Update all tables to use new enum
ALTER TABLE users ALTER COLUMN role TYPE user_role_new USING role::text::user_role_new;
ALTER TABLE user_organizations ALTER COLUMN organization_role TYPE user_role_new USING organization_role::text::user_role_new;
ALTER TABLE invitations ALTER COLUMN role TYPE user_role_new USING role::text::user_role_new;
ALTER TABLE role_permissions ALTER COLUMN role TYPE user_role_new USING role::text::user_role_new;

-- Step 4: Drop old enum and rename new one
DROP TYPE user_role;
ALTER TYPE user_role_new RENAME TO user_role;

-- Step 5: Verify the update
SELECT enumlabel as role_value 
FROM pg_enum pe 
JOIN pg_type pt ON pe.enumtypid = pt.oid 
WHERE pt.typname = 'user_role' 
ORDER BY enumlabel;