-- Production Demo Organization Setup Script
-- Copy Demo organization from development to production
-- Run this script in your production database

-- 1. Create Demo Organization
INSERT INTO organizations (id, name, type, address, city, province, postal_code, phone, email, website, registration_number, is_active, created_at, updated_at) VALUES
('8c6de72f-057c-4ac5-9372-dd7bc74e32f4', 'Demo', 'management_company', '123 Demo Street', 'Montreal', 'QC', 'H1A 1A1', '514-555-0100', 'demo@example.com', 'https://demo.example.com', 'DEMO-001', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 2. Create Demo Users
INSERT INTO users (id, username, email, password, first_name, last_name, phone, profile_image, language, role, is_active, last_login_at, created_at, updated_at) VALUES
('39e26638-44c4-4f58-9df8-a3a25db93a9d', 'demo.manager@example.com', 'demo.manager@example.com', '$2b$12$sAJXEcITZg5ItQou312JsucLyzByPC6lF7CLvrrLkhxKd1EyfSxda', 'Demo', 'Manager', '', '', 'fr', 'manager', true, NULL, NOW(), NOW()),
('7a1cf13c-74eb-432b-830b-ed8364f6123d', 'demo.resident@example.com', 'demo.resident@example.com', '$2b$12$sAJXEcITZg5ItQou312JsucLyzByPC6lF7CLvrrLkhxKd1EyfSxda', 'Demo', 'Resident', '', '', 'fr', 'resident', true, NULL, NOW(), NOW()),
('dc90f1da-431c-404e-b49a-60ebc78618c1', 'demo.tenant@example.com', 'demo.tenant@example.com', '$2b$12$sAJXEcITZg5ItQou312JsucLyzByPC6lF7CLvrrLkhxKd1EyfSxda', 'Demo', 'Tenant', '', '', 'fr', 'tenant', true, NULL, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 3. Create Demo Building
INSERT INTO buildings (id, organization_id, name, address, city, province, postal_code, building_type, year_built, total_units, total_floors, parking_spaces, storage_spaces, amenities, is_active, created_at, updated_at) VALUES
('e55c083e-a5c4-4371-9aaa-a2204f23e679', '8c6de72f-057c-4ac5-9372-dd7bc74e32f4', 'Demo Building', '123 Demo Street', 'Montreal', 'QC', 'H1A 1A1', 'condo', 2020, 10, 3, 10, 5, '{"gym": true, "pool": false, "parking": true, "storage": true}', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 4. Create Demo Residences
INSERT INTO residences (id, building_id, unit_number, floor, square_footage, bedrooms, bathrooms, balcony, monthly_fees, is_active, created_at, updated_at) VALUES
(gen_random_uuid(), 'e55c083e-a5c4-4371-9aaa-a2204f23e679', '101', 1, 850, 2, 1, true, 1200.00, true, NOW(), NOW()),
(gen_random_uuid(), 'e55c083e-a5c4-4371-9aaa-a2204f23e679', '102', 1, 900, 2, 1, true, 1200.00, true, NOW(), NOW()),
(gen_random_uuid(), 'e55c083e-a5c4-4371-9aaa-a2204f23e679', '103', 1, 950, 2, 1, true, 1200.00, true, NOW(), NOW()),
(gen_random_uuid(), 'e55c083e-a5c4-4371-9aaa-a2204f23e679', '201', 2, 1000, 2, 1, true, 1200.00, true, NOW(), NOW()),
(gen_random_uuid(), 'e55c083e-a5c4-4371-9aaa-a2204f23e679', '202', 2, 1050, 2, 1, true, 1200.00, true, NOW(), NOW());

-- 5. Create User-Organization Relationships
INSERT INTO user_organizations (id, user_id, organization_id, organization_role, is_active, created_at, updated_at) VALUES
(gen_random_uuid(), '39e26638-44c4-4f58-9df8-a3a25db93a9d', '8c6de72f-057c-4ac5-9372-dd7bc74e32f4', 'manager', true, NOW(), NOW()),
(gen_random_uuid(), '7a1cf13c-74eb-432b-830b-ed8364f6123d', '8c6de72f-057c-4ac5-9372-dd7bc74e32f4', 'resident', true, NOW(), NOW()),
(gen_random_uuid(), 'dc90f1da-431c-404e-b49a-60ebc78618c1', '8c6de72f-057c-4ac5-9372-dd7bc74e32f4', 'tenant', true, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 6. Ensure permissions exist (if not already set up)
INSERT INTO permissions (id, name, display_name, description, resource_type, action, conditions, is_active, created_at, updated_at) VALUES
(gen_random_uuid(), 'read:user', 'Read Users', 'Permission to read user data', 'user', 'read', '{}', true, NOW(), NOW()),
(gen_random_uuid(), 'read:users', 'Read Users (plural)', 'Permission to read users data', 'user', 'read', '{}', true, NOW(), NOW()),
(gen_random_uuid(), 'read:organization', 'Read Organizations', 'Permission to read organization data', 'organization', 'read', '{}', true, NOW(), NOW()),
(gen_random_uuid(), 'read:building', 'Read Buildings', 'Permission to read building data', 'building', 'read', '{}', true, NOW(), NOW()),
(gen_random_uuid(), 'read:residence', 'Read Residences', 'Permission to read residence data', 'residence', 'read', '{}', true, NOW(), NOW()),
(gen_random_uuid(), 'read:document', 'Read Documents', 'Permission to read document data', 'document', 'read', '{}', true, NOW(), NOW()),
(gen_random_uuid(), 'read:improvement_suggestion', 'Read Suggestions', 'Permission to read improvement suggestions', 'improvement_suggestion', 'read', '{}', true, NOW(), NOW()),
(gen_random_uuid(), 'manage:user', 'Manage Users', 'Permission to fully manage users', 'user', 'manage', '{}', true, NOW(), NOW()),
(gen_random_uuid(), 'manage:organization', 'Manage Organizations', 'Permission to fully manage organizations', 'organization', 'manage', '{}', true, NOW(), NOW()),
(gen_random_uuid(), 'manage:building', 'Manage Buildings', 'Permission to fully manage buildings', 'building', 'manage', '{}', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- 7. Assign all permissions to admin and manager roles
INSERT INTO role_permissions (id, role, permission_id, created_at)
SELECT 
  gen_random_uuid(),
  'admin'::user_role,
  p.id,
  NOW()
FROM permissions p
WHERE p.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (id, role, permission_id, created_at)
SELECT 
  gen_random_uuid(),
  'manager'::user_role,
  p.id,
  NOW()
FROM permissions p
WHERE p.is_active = true
ON CONFLICT DO NOTHING;

-- 8. Create your admin user (replace with your actual details)
INSERT INTO users (id, username, email, password, first_name, last_name, phone, profile_image, language, role, is_active, last_login_at, created_at, updated_at) VALUES
('f35647de-5f16-46f2-b30b-09e0469356b1', 'kevin.hervieux', 'kevin.hervieux@koveo-gestion.com', '$2b$12$sAJXEcITZg5ItQou312JsucLyzByPC6lF7CLvrrLkhxKd1EyfSxda', 'Kevin', 'Hervieux', '', '', 'fr', 'admin', true, NULL, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Success message
SELECT 'Demo organization setup completed successfully!' as status;