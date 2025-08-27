-- Production Organization Cleanup Script
-- Run this script on the production database to fix the organization duplicates
-- This will remove duplicate "Koveo Gestion" organizations and create the correct 4 organizations

-- =============================================================================
-- PRODUCTION ORGANIZATION CLEANUP
-- =============================================================================

BEGIN;

-- Step 1: Remove user organization relationships for "Koveo Gestion" duplicates
DELETE FROM user_organizations WHERE organization_id IN (
    SELECT id FROM organizations WHERE name = 'Koveo Gestion'
);

-- Step 2: Delete duplicate "Koveo Gestion" organizations
DELETE FROM organizations WHERE name = 'Koveo Gestion';

-- Step 3: Create the 4 correct organizations
-- Create Koveo organization
INSERT INTO organizations (name, type, address, city, province, postal_code, phone, email, website, registration_number, is_active) 
VALUES (
    'Koveo', 
    'management_company',
    '456 Business Avenue',
    'Montreal',
    'QC',
    'H2B 2B2',
    '514-555-0200',
    'info@koveo.com',
    'https://koveo.com',
    'KOVEO-001',
    true
) ON CONFLICT (name) DO NOTHING;

-- Create Demo organization
INSERT INTO organizations (name, type, address, city, province, postal_code, phone, email, website, registration_number, is_active) 
VALUES (
    'Demo', 
    'management_company',
    '123 Demo Street',
    'Montreal',
    'QC',
    'H1A 1A1',
    '514-555-0100',
    'demo@example.com',
    'https://demo.example.com',
    'DEMO-001',
    true
) ON CONFLICT (name) DO NOTHING;

-- Create open demo organization
INSERT INTO organizations (name, type, address, city, province, postal_code, phone, email, website, registration_number, is_active) 
VALUES (
    'open demo', 
    'management_company',
    '123 Open Demo Street',
    'Montreal',
    'QC',
    'H1B 1B1',
    '514-555-0150',
    'opendemo@example.com',
    'https://opendemo.example.com',
    'OPENDEMO-001',
    true
) ON CONFLICT (name) DO NOTHING;

-- Create 563 montée des pionniers organization
INSERT INTO organizations (name, type, address, city, province, postal_code, phone, email, website, registration_number, is_active) 
VALUES (
    '563 montée des pionniers', 
    'syndicate',
    '563 montée des pionniers',
    'Terrebonne',
    'QC',
    'J6W 1N5',
    '450-555-0300',
    'syndic@563montee.com',
    'https://563montee.com',
    'SYNDIC-563',
    true
) ON CONFLICT (name) DO NOTHING;

-- Step 4: Reassign admin user to correct organizations
-- Get the Koveo organization ID
WITH koveo_org AS (
    SELECT id FROM organizations WHERE name = 'Koveo' LIMIT 1
),
montee_org AS (
    SELECT id FROM organizations WHERE name = '563 montée des pionniers' LIMIT 1
),
admin_user AS (
    SELECT id FROM users WHERE email = 'kevin.hervieux@koveo-gestion.com' LIMIT 1
)

-- Insert user organization relationships
INSERT INTO user_organizations (user_id, organization_id, organization_role, can_access_all_organizations) 
SELECT admin_user.id, koveo_org.id, 'admin', true
FROM admin_user, koveo_org
ON CONFLICT (user_id, organization_id) DO UPDATE SET
    organization_role = 'admin',
    can_access_all_organizations = true;

WITH montee_org AS (
    SELECT id FROM organizations WHERE name = '563 montée des pionniers' LIMIT 1
),
admin_user AS (
    SELECT id FROM users WHERE email = 'kevin.hervieux@koveo-gestion.com' LIMIT 1
)

INSERT INTO user_organizations (user_id, organization_id, organization_role, can_access_all_organizations) 
SELECT admin_user.id, montee_org.id, 'admin', true
FROM admin_user, montee_org
ON CONFLICT (user_id, organization_id) DO UPDATE SET
    organization_role = 'admin',
    can_access_all_organizations = true;

-- Step 5: Verify the cleanup
SELECT 'Organizations after cleanup:' as status;
SELECT id, name, type, city, is_active FROM organizations ORDER BY name;

SELECT 'User organization relationships:' as status;
SELECT u.email, o.name as organization_name, uo.organization_role, uo.can_access_all_organizations
FROM user_organizations uo
JOIN users u ON uo.user_id = u.id
JOIN organizations o ON uo.organization_id = o.id
WHERE u.email = 'kevin.hervieux@koveo-gestion.com'
ORDER BY o.name;

COMMIT;

-- =============================================================================
-- Summary:
-- ✅ Removed duplicate "Koveo Gestion" organizations
-- ✅ Created exactly 4 organizations: Koveo, Demo, open demo, 563 montée des pionniers
-- ✅ Reassigned admin user to correct organizations with full access
-- =============================================================================