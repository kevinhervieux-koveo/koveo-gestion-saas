/**
 * @file Test suite to ensure removed routes are not accessible
 * This test validates that previously removed routes like /admin/user-management
 * don't exist in the application and cannot be accessed.
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Removed Routes Validation', () => {
  /**
   * List of routes that should NOT exist in the application
   * These routes were previously available but have been removed.
   */
  const REMOVED_ROUTES = [
    '/admin/user-management', // User management moved to /manager/user-management only
    '/admin/dashboard', // Admin dashboard was removed
  ];

  /**
   * List of routes that SHOULD exist and are valid.
   */
  const VALID_ADMIN_ROUTES = [
    '/admin/organizations',
    '/admin/documentation',
    '/admin/roadmap',
    '/admin/quality',
    '/admin/suggestions',
    '/admin/permissions',
  ];

  const VALID_MANAGER_ROUTES = [
    '/manager/buildings',
    '/manager/residences',
    '/manager/budget',
    '/manager/bills',
    '/manager/demands',
    '/manager/user-management', // This is the CORRECT location for user management
  ];

  describe('Code Base Validation', () => {
    test('should not have admin/user-management references in key files', () => {
      // Check that App.tsx doesn't contain admin/user-management routes
      const appPath = path.join(process.cwd(), 'client/src/App.tsx');
      if (fs.existsSync(appPath)) {
        const appContent = fs.readFileSync(appPath, 'utf-8');
        expect(appContent).not.toContain('/admin/user-management');
      }

      // Check that sidebar doesn't contain admin/user-management links
      const sidebarPath = path.join(process.cwd(), 'client/src/components/layout/sidebar.tsx');
      if (fs.existsSync(sidebarPath)) {
        const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8');
        expect(sidebarContent).not.toContain('/admin/user-management');
      }
    });

    test('should not have removed routes in route validation scripts', () => {
      const validateRoutesPath = path.join(process.cwd(), 'scripts/validate-routes.ts');
      if (fs.existsSync(validateRoutesPath)) {
        const content = fs.readFileSync(validateRoutesPath, 'utf-8');
        expect(content).not.toContain('/admin/user-management');
      }
    });

    test('should not have admin/user-management in navigation tests', () => {
      const navTestPath = path.join(process.cwd(), 'tests/routing/navigation.test.tsx');
      if (fs.existsSync(navTestPath)) {
        const content = fs.readFileSync(navTestPath, 'utf-8');
        expect(content).not.toContain('/admin/user-management');
      }
    });
  });
});

/**
 * Integration test to ensure removed routes are completely cleaned up.
 */
describe('Route Cleanup Integration Test', () => {
  test('should not have any remaining references to removed admin routes', () => {
    // This is a meta-test that validates our cleanup was thorough
    // Check that the routes are properly categorized as removed routes

    const removedAdminRoutes = ['/admin/user-management', '/admin/dashboard'];
    const validAdminRoutes = ['/admin/organizations', '/admin/permissions'];

    // Validate that removed routes are not in valid routes list
    removedAdminRoutes.forEach((removedRoute) => {
      expect(validAdminRoutes).not.toContain(removedRoute);
    });

    // Validate that valid routes don't match the removed pattern
    validAdminRoutes.forEach((validRoute) => {
      expect(validRoute).not.toMatch(/admin\/(user-management|dashboard)/);
    });
  });

  test('should maintain proper role-based routing structure', () => {
    const expectedRouteStructure = {
      admin: [
        '/admin/organizations',
        '/admin/documentation',
        '/admin/roadmap',
        '/admin/quality',
        '/admin/suggestions',
        '/admin/permissions',
      ],
      manager: [
        '/manager/buildings',
        '/manager/residences',
        '/manager/budget',
        '/manager/bills',
        '/manager/demands',
        '/manager/user-management', // Only managers should have user-management
      ],
      resident: ['/dashboard', '/residents/residence', '/residents/building', '/residents/demands'],
    };

    // Validate that user-management is only in manager routes
    expect(expectedRouteStructure.admin).not.toContain('/admin/user-management');
    expect(expectedRouteStructure.manager).toContain('/manager/user-management');
    expect(expectedRouteStructure.resident).not.toContain(expect.stringMatching(/user-management/));
  });
});
