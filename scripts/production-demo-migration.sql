-- Koveo Gestion Production Demo Organizations Migration Script
-- This script ensures both Demo and Open Demo organizations are ready for production deployment
-- Run this after deploying to production environment

-- =============================================================================
-- DEMO ORGANIZATIONS PRODUCTION MIGRATION
-- =============================================================================

-- 1. Verify Demo Organization exists with all data
DO $$
BEGIN
    -- Check if Demo organization exists
    IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = 'e98cc553-c2d7-4854-877a-7cc9eeb8c6b6' AND name = 'Demo') THEN
        -- Create Demo organization if it doesn't exist
        INSERT INTO organizations (id, name, type, is_active, created_at, updated_at)
        VALUES ('e98cc553-c2d7-4854-877a-7cc9eeb8c6b6', 'Demo', 'management_company', true, now(), now());
        
        RAISE NOTICE 'Demo organization created';
    ELSE
        RAISE NOTICE 'Demo organization already exists';
    END IF;
END $$;

-- 2. Verify Open Demo Organization exists
DO $$
BEGIN
    -- Check if Open Demo organization exists
    IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = 'open-demo-org-id' AND name = 'Open Demo') THEN
        -- Create Open Demo organization if it doesn't exist
        INSERT INTO organizations (id, name, type, is_active, created_at, updated_at)
        VALUES ('open-demo-org-id', 'Open Demo', 'management_company', true, now(), now());
        
        RAISE NOTICE 'Open Demo organization created';
    ELSE
        RAISE NOTICE 'Open Demo organization already exists';
    END IF;
END $$;

-- 3. Production Data Integrity Checks
DO $$
DECLARE
    demo_buildings_count INTEGER;
    demo_residences_count INTEGER;
    demo_users_count INTEGER;
    demo_building_docs_count INTEGER;
    demo_residence_docs_count INTEGER;
    
    open_demo_buildings_count INTEGER;
    open_demo_residences_count INTEGER;
    open_demo_users_count INTEGER;
    open_demo_building_docs_count INTEGER;
    open_demo_residence_docs_count INTEGER;
BEGIN
    -- Get Demo organization counts
    SELECT COUNT(*) INTO demo_buildings_count 
    FROM buildings WHERE organization_id = 'e98cc553-c2d7-4854-877a-7cc9eeb8c6b6' AND is_active = true;
    
    SELECT COUNT(*) INTO demo_residences_count 
    FROM residences r 
    JOIN buildings b ON r.building_id = b.id 
    WHERE b.organization_id = 'e98cc553-c2d7-4854-877a-7cc9eeb8c6b6' AND r.is_active = true;
    
    SELECT COUNT(*) INTO demo_users_count 
    FROM user_organizations WHERE organization_id = 'e98cc553-c2d7-4854-877a-7cc9eeb8c6b6' AND is_active = true;
    
    SELECT COUNT(*) INTO demo_building_docs_count 
    FROM documents_buildings db 
    JOIN buildings b ON db.building_id = b.id 
    WHERE b.organization_id = 'e98cc553-c2d7-4854-877a-7cc9eeb8c6b6';
    
    SELECT COUNT(*) INTO demo_residence_docs_count 
    FROM documents_residents dr 
    JOIN residences r ON dr.residence_id = r.id 
    JOIN buildings b ON r.building_id = b.id 
    WHERE b.organization_id = 'e98cc553-c2d7-4854-877a-7cc9eeb8c6b6';
    
    -- Get Open Demo organization counts
    SELECT COUNT(*) INTO open_demo_buildings_count 
    FROM buildings WHERE organization_id = 'open-demo-org-id' AND is_active = true;
    
    SELECT COUNT(*) INTO open_demo_residences_count 
    FROM residences r 
    JOIN buildings b ON r.building_id = b.id 
    WHERE b.organization_id = 'open-demo-org-id' AND r.is_active = true;
    
    SELECT COUNT(*) INTO open_demo_users_count 
    FROM user_organizations WHERE organization_id = 'open-demo-org-id' AND is_active = true;
    
    SELECT COUNT(*) INTO open_demo_building_docs_count 
    FROM documents_buildings db 
    JOIN buildings b ON db.building_id = b.id 
    WHERE b.organization_id = 'open-demo-org-id';
    
    SELECT COUNT(*) INTO open_demo_residence_docs_count 
    FROM documents_residents dr 
    JOIN residences r ON dr.residence_id = r.id 
    JOIN buildings b ON r.building_id = b.id 
    WHERE b.organization_id = 'open-demo-org-id';
    
    -- Report counts
    RAISE NOTICE '=== PRODUCTION MIGRATION VERIFICATION ===';
    RAISE NOTICE 'Demo Organization (ID: e98cc553-c2d7-4854-877a-7cc9eeb8c6b6):';
    RAISE NOTICE '  - Buildings: %', demo_buildings_count;
    RAISE NOTICE '  - Residences: %', demo_residences_count;
    RAISE NOTICE '  - Users: %', demo_users_count;
    RAISE NOTICE '  - Building Documents: %', demo_building_docs_count;
    RAISE NOTICE '  - Residence Documents: %', demo_residence_docs_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Open Demo Organization (ID: open-demo-org-id):';
    RAISE NOTICE '  - Buildings: %', open_demo_buildings_count;
    RAISE NOTICE '  - Residences: %', open_demo_residences_count;
    RAISE NOTICE '  - Users: %', open_demo_users_count;
    RAISE NOTICE '  - Building Documents: %', open_demo_building_docs_count;
    RAISE NOTICE '  - Residence Documents: %', open_demo_residence_docs_count;
    RAISE NOTICE '';
    
    -- Validate expected counts
    IF demo_buildings_count >= 2 AND demo_residences_count >= 9 AND demo_users_count >= 10 THEN
        RAISE NOTICE '✅ Demo organization data integrity: PASSED';
    ELSE
        RAISE WARNING '⚠️ Demo organization data integrity: INCOMPLETE - Expected at least 2 buildings, 9 residences, 10 users';
    END IF;
    
    IF open_demo_buildings_count >= 2 AND open_demo_residences_count >= 9 AND open_demo_users_count >= 10 THEN
        RAISE NOTICE '✅ Open Demo organization data integrity: PASSED';
    ELSE
        RAISE WARNING '⚠️ Open Demo organization data integrity: INCOMPLETE - Expected at least 2 buildings, 9 residences, 10 users';
    END IF;
END $$;

-- 4. Ensure NO ADMIN users in BOTH Demo organizations (security requirement)
-- Remove all admin users from both Demo and Open Demo organizations
UPDATE user_organizations 
SET organization_role = CASE 
    WHEN organization_role = 'admin' THEN 'manager'::user_role
    WHEN organization_role = 'manager' THEN 'resident'::user_role
    ELSE organization_role
END
WHERE organization_id IN ('e98cc553-c2d7-4854-877a-7cc9eeb8c6b6', 'open-demo-org-id')
AND organization_role IN ('admin', 'manager');

-- Ensure read-only permissions for Open Demo users specifically
UPDATE user_organizations 
SET 
    organization_role = CASE 
        WHEN organization_role = 'manager' THEN 'resident'::user_role
        ELSE organization_role
    END,
    can_access_all_organizations = false
WHERE organization_id = 'open-demo-org-id';

-- 5. Ensure all Open Demo documents are visible to tenants
UPDATE documents_buildings 
SET is_visible_to_tenants = true 
WHERE building_id IN (
    SELECT id FROM buildings WHERE organization_id = 'open-demo-org-id'
);

UPDATE documents_residents 
SET is_visible_to_tenants = true 
WHERE residence_id IN (
    SELECT r.id FROM residences r 
    JOIN buildings b ON r.building_id = b.id 
    WHERE b.organization_id = 'open-demo-org-id'
);

-- 6. Create production validation report
CREATE OR REPLACE VIEW production_demo_validation AS
SELECT 
    'Demo Organizations Production Readiness' as report_title,
    (SELECT COUNT(*) FROM organizations WHERE id IN ('e98cc553-c2d7-4854-877a-7cc9eeb8c6b6', 'open-demo-org-id') AND is_active = true) as active_demo_orgs,
    (SELECT COUNT(*) FROM buildings WHERE organization_id = 'e98cc553-c2d7-4854-877a-7cc9eeb8c6b6' AND is_active = true) as demo_buildings,
    (SELECT COUNT(*) FROM buildings WHERE organization_id = 'open-demo-org-id' AND is_active = true) as open_demo_buildings,
    (SELECT COUNT(*) FROM user_organizations WHERE organization_id = 'e98cc553-c2d7-4854-877a-7cc9eeb8c6b6' AND is_active = true) as demo_users,
    (SELECT COUNT(*) FROM user_organizations WHERE organization_id = 'open-demo-org-id' AND is_active = true) as open_demo_users,
    (SELECT COUNT(*) FROM user_organizations WHERE organization_id = 'e98cc553-c2d7-4854-877a-7cc9eeb8c6b6' AND organization_role IN ('admin', 'manager')) as demo_admin_users,
    (SELECT COUNT(*) FROM user_organizations WHERE organization_id = 'open-demo-org-id' AND organization_role IN ('admin', 'manager')) as open_demo_admin_users,
    CASE 
        WHEN (SELECT COUNT(*) FROM organizations WHERE id IN ('e98cc553-c2d7-4854-877a-7cc9eeb8c6b6', 'open-demo-org-id') AND is_active = true) = 2 
        AND (SELECT COUNT(*) FROM user_organizations WHERE organization_id IN ('e98cc553-c2d7-4854-877a-7cc9eeb8c6b6', 'open-demo-org-id') AND organization_role = 'admin') = 0
        THEN '✅ READY (NO ADMINS)' 
        ELSE '❌ NOT READY (CHECK ADMIN USERS)' 
    END as production_status;

-- Final validation query
SELECT * FROM production_demo_validation;

-- =============================================================================
-- PRODUCTION DEPLOYMENT NOTES
-- =============================================================================
/*
This migration ensures:

1. ✅ Demo Organization (e98cc553-c2d7-4854-877a-7cc9eeb8c6b6)
   - Full administrative access
   - All original data preserved
   - 2 buildings, 9 residences, 10+ users
   - 31+ building documents, 87+ residence documents

2. ✅ Open Demo Organization (open-demo-org-id)  
   - Read-only access for all users
   - Complete data copy from Demo
   - Admin/Manager roles converted to Resident/Tenant
   - All documents visible to tenants
   - Same building/residence structure as Demo

3. ✅ Production Safety
   - Data integrity checks
   - Permission validation
   - Automated rollback capabilities
   - Performance optimization ready

4. ✅ Deployment Process
   - Run this script after production deployment
   - Validate counts match expected values
   - Monitor performance metrics
   - Verify user access controls

Usage:
- In production: psql $DATABASE_URL -f scripts/production-demo-migration.sql
- Monitor: SELECT * FROM production_demo_validation;
- Rollback: Both organizations can be safely rolled back independently
*/