/**
 * Database-Only Permissions System Tests
 * 
 * These tests ensure that the permissions system relies ONLY on the database
 * and that no config files or hardcoded permissions are used.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq, and } from 'drizzle-orm';
import * as schema from '../../shared/schema';
import { OptimizedDatabaseStorage } from '../../server/optimized-db-storage';

const testDatabaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set for tests');
}

const pool = new Pool({ connectionString: testDatabaseUrl });
const db = drizzle({ client: pool, schema });
const storage = new OptimizedDatabaseStorage();

describe('Database-Only Permissions System', () => {
  let testUserId: string;
  let testPermissionId: string;

  beforeAll(async () => {
    // Clean up any test data
    await db.delete(schema.userPermissions);
    await db.delete(schema.rolePermissions);
    await db.delete(schema.permissions);
  });

  beforeEach(async () => {
    // Create test permission with unique name
    const uniqueName = `test:permission:${Date.now()}`;
    const [permission] = await db.insert(schema.permissions).values({
      name: uniqueName,
      displayName: 'Test Permission',
      description: 'Test permission for database-only validation',
      resourceType: 'users',
      action: 'read',
      isActive: true
    }).returning();
    testPermissionId = permission.id;

    // Create test role permission
    await db.insert(schema.rolePermissions).values({
      role: 'admin',
      permissionId: testPermissionId,
      grantedBy: 'system',
      grantedAt: new Date(),
      createdAt: new Date()
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('Permission Storage Operations', () => {
    it('should retrieve all permissions from database only', async () => {
      const permissions = await storage.getPermissions();
      
      expect(permissions).toBeDefined();
      expect(Array.isArray(permissions)).toBe(true);
      expect(permissions.length).toBeGreaterThan(0);
      
      // Verify all permissions have database structure
      permissions.forEach(permission => {
        expect(permission).toHaveProperty('id');
        expect(permission).toHaveProperty('name');
        expect(permission).toHaveProperty('displayName');
        expect(permission).toHaveProperty('resourceType');
        expect(permission).toHaveProperty('action');
        expect(permission).toHaveProperty('isActive');
      });
    });

    it('should retrieve role permissions from database only', async () => {
      const rolePermissions = await storage.getRolePermissions();
      
      expect(rolePermissions).toBeDefined();
      expect(Array.isArray(rolePermissions)).toBe(true);
      expect(rolePermissions.length).toBeGreaterThan(0);
      
      // Verify role permissions have database structure
      rolePermissions.forEach(rp => {
        expect(rp).toHaveProperty('role');
        expect(rp).toHaveProperty('permissionId');
        expect(['admin', 'manager', 'tenant', 'resident']).toContain(rp.role);
      });
    });

    it('should retrieve user permissions from database only', async () => {
      const userPermissions = await storage.getUserPermissions();
      
      expect(userPermissions).toBeDefined();
      expect(Array.isArray(userPermissions)).toBe(true);
      
      // Even if empty, should be an array from database query
      userPermissions.forEach(up => {
        expect(up).toHaveProperty('userId');
        expect(up).toHaveProperty('permissionId');
        expect(up).toHaveProperty('granted');
      });
    });
  });

  describe('Role-Based Permission Validation', () => {
    it('should validate admin role has comprehensive permissions', async () => {
      const rolePermissions = await storage.getRolePermissions();
      const adminPermissions = rolePermissions.filter(rp => rp.role === 'admin');
      
      expect(adminPermissions.length).toBeGreaterThan(50); // Admin should have many permissions
      
      // Admin should have permissions across all resource types
      const resourceTypes = new Set(adminPermissions.map(ap => ap.permission?.resourceType).filter(Boolean));
      expect(resourceTypes.size).toBeGreaterThan(5); // Multiple resource types
    });

    it('should validate manager role has limited permissions', async () => {
      const rolePermissions = await storage.getRolePermissions();
      const adminPermissions = rolePermissions.filter(rp => rp.role === 'admin');
      const managerPermissions = rolePermissions.filter(rp => rp.role === 'manager');
      
      // Manager should have fewer permissions than admin
      expect(managerPermissions.length).toBeLessThan(adminPermissions.length);
      expect(managerPermissions.length).toBeGreaterThan(20); // But still substantial
    });

    it('should validate tenant/resident roles have minimal permissions', async () => {
      const rolePermissions = await storage.getRolePermissions();
      const tenantPermissions = rolePermissions.filter(rp => rp.role === 'tenant');
      const residentPermissions = rolePermissions.filter(rp => rp.role === 'resident');
      
      // Tenant and resident should have minimal permissions
      expect(tenantPermissions.length).toBeLessThan(15);
      expect(residentPermissions.length).toBeLessThan(15);
      
      // They should have same permissions
      expect(tenantPermissions.length).toBe(residentPermissions.length);
    });
  });

  describe('Permission Uniqueness and Integrity', () => {
    it('should ensure all permissions have unique names', async () => {
      const permissions = await storage.getPermissions();
      const permissionNames = permissions.map(p => p.name);
      const uniqueNames = new Set(permissionNames);
      
      expect(permissionNames.length).toBe(uniqueNames.size);
    });

    it('should ensure all role permissions reference valid permissions', async () => {
      const [permissions, rolePermissions] = await Promise.all([
        storage.getPermissions(),
        storage.getRolePermissions()
      ]);
      
      const validPermissionIds = new Set(permissions.map(p => p.id));
      
      rolePermissions.forEach(rp => {
        expect(validPermissionIds.has(rp.permissionId)).toBe(true);
      });
    });

    it('should ensure all user permissions reference valid permissions', async () => {
      const [permissions, userPermissions] = await Promise.all([
        storage.getPermissions(),
        storage.getUserPermissions()
      ]);
      
      const validPermissionIds = new Set(permissions.map(p => p.id));
      
      userPermissions.forEach(up => {
        expect(validPermissionIds.has(up.permissionId)).toBe(true);
      });
    });
  });

  describe('No Config File Dependencies', () => {
    it('should not import permissions from config files', () => {
      // Check that our storage functions don't reference config
      const storageClass = OptimizedDatabaseStorage;
      const storageCode = storageClass.toString();
      
      // Should not contain references to config permissions
      expect(storageCode).not.toContain('permissions.json');
      expect(storageCode).not.toContain('../config');
      expect(storageCode).not.toContain('permissionsConfig');
    });

    it('should ensure permissions come only from database queries', async () => {
      // Mock the database to verify actual database calls
      const originalSelect = db.select;
      let databaseCalled = false;
      
      db.select = jest.fn().mockImplementation((...args) => {
        databaseCalled = true;
        return originalSelect.apply(db, args);
      });
      
      await storage.getPermissions();
      
      expect(databaseCalled).toBe(true);
      
      // Restore original method
      db.select = originalSelect;
    });
  });

  describe('Permission Categories and Organization', () => {
    it('should organize permissions by resource types', async () => {
      const permissions = await storage.getPermissions();
      
      const expectedResourceTypes = [
        'users', 'organizations', 'buildings', 'residences',
        'bills', 'budgets', 'maintenance_requests', 'documents',
        'notifications', 'features', 'reports'
      ];
      
      const actualResourceTypes = new Set(permissions.map(p => p.resourceType));
      
      expectedResourceTypes.forEach(resourceType => {
        expect(actualResourceTypes.has(resourceType)).toBe(true);
      });
    });

    it('should have permissions for all CRUD operations where applicable', async () => {
      const permissions = await storage.getPermissions();
      
      const crudActions = ['create', 'read', 'update', 'delete'];
      const permissionsByResource = permissions.reduce((acc: any, p) => {
        if (!acc[p.resourceType]) acc[p.resourceType] = [];
        acc[p.resourceType].push(p.action);
        return acc;
      }, {});
      
      // Most resources should have at least read permissions
      Object.keys(permissionsByResource).forEach(resourceType => {
        const actions = permissionsByResource[resourceType];
        expect(actions).toContain('read');
      });
    });
  });

  describe('User Permission Overrides', () => {
    it('should support user-specific permission grants', async () => {
      // This tests the user_permissions table functionality
      const userPermissions = await storage.getUserPermissions();
      
      // Should be able to query user permissions without errors
      expect(Array.isArray(userPermissions)).toBe(true);
      
      // Each user permission should have proper structure
      userPermissions.forEach(up => {
        expect(up).toHaveProperty('userId');
        expect(up).toHaveProperty('permissionId');
        expect(up).toHaveProperty('granted');
        expect(typeof up.granted).toBe('boolean');
      });
    });
  });

  describe('Database Schema Validation', () => {
    it('should have proper foreign key relationships', async () => {
      // Test that role_permissions.permission_id references permissions.id
      const rolePermissions = await db.select().from(schema.rolePermissions).limit(1);
      
      if (rolePermissions.length > 0) {
        const permission = await db.select()
          .from(schema.permissions)
          .where(eq(schema.permissions.id, rolePermissions[0].permissionId))
          .limit(1);
        
        expect(permission.length).toBe(1);
      }
    });

    it('should enforce role enum constraints', async () => {
      const rolePermissions = await storage.getRolePermissions();
      const validRoles = ['admin', 'manager', 'tenant', 'resident'];
      
      rolePermissions.forEach(rp => {
        expect(validRoles).toContain(rp.role);
      });
    });

    it('should enforce action enum constraints', async () => {
      const permissions = await storage.getPermissions();
      const validActions = [
        'create', 'read', 'update', 'delete', 'approve', 'assign',
        'manage_permissions', 'generate_reports', 'export_data', 'manage_users'
      ];
      
      permissions.forEach(p => {
        expect(validActions).toContain(p.action);
      });
    });
  });
});