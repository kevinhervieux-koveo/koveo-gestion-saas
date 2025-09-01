-- Safe production database update script
-- Adds missing demo roles without touching existing data

-- Add missing demo roles to user_role enum (safe operation)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'demo_manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'demo_tenant';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'demo_resident';

-- Verify the changes
SELECT enumlabel as role_value 
FROM pg_enum pe 
JOIN pg_type pt ON pe.enumtypid = pt.oid 
WHERE pt.typname = 'user_role' 
ORDER BY enumlabel;