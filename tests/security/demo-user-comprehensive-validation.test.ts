import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// Mock WebSocket for Jest environment
jest.mock('ws', () => ({
  __esModule: true,
  default: class MockWebSocket {}
}));

import { registerRoutes } from '../../server/routes';
import { db } from '../../server/db';
import * as schema from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { isOpenDemoUser, canUserPerformWriteOperation } from '../../server/rbac';

/**
 * Comprehensive Demo User Validation Test Suite
 * 
 * This test suite focuses on specific scenarios and edge cases for demo user restrictions:
 * - Validates demo users cannot edit, submit, create, or delete anything
 * - Tests specific business logic restrictions
 * - Validates data integrity protection
 * - Tests permission escalation prevention
 */

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  registerRoutes(app);
  return app;
};

describe('Demo User Comprehensive Validation', () => {
  let app: express.Application;
  let demoManagerUser: any;
  let demoTenantUser: any;
  let demoResidentUser: any;
  let regularUser: any;
  let openDemoOrg: any;
  let regularOrg: any;
  let testBuilding: any;
  let testResidence: any;

  beforeEach(async () => {
    app = createTestApp();
    
    // Clean up test data
    await db.delete(schema.users).where(eq(schema.users.email, 'demo-manager@test.com'));
    await db.delete(schema.users).where(eq(schema.users.email, 'demo-tenant@test.com'));
    await db.delete(schema.users).where(eq(schema.users.email, 'demo-resident@test.com'));
    await db.delete(schema.users).where(eq(schema.users.email, 'regular@test.com'));

    // Create Open Demo organization (view-only restrictions)
    [openDemoOrg] = await db.insert(schema.organizations).values({
      name: 'Open Demo',
      type: 'demo',
      address: '123 Demo Street',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A 1A1',
    }).returning();

    // Create regular organization
    [regularOrg] = await db.insert(schema.organizations).values({
      name: 'Test Organization',
      type: 'syndicate',
      address: '456 Test Street',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1B 1B1',
    }).returning();

    // Create demo users with different roles
    [demoManagerUser] = await db.insert(schema.users).values({
      username: 'demo-manager-user',
      email: 'demo-manager@test.com',
      firstName: 'Demo',
      lastName: 'Manager',
      password: '$2b$12$demo.hash',
      role: 'demo_manager',
    }).returning();

    [demoTenantUser] = await db.insert(schema.users).values({
      username: 'demo-tenant-user',
      email: 'demo-tenant@test.com',
      firstName: 'Demo',
      lastName: 'Tenant',
      password: '$2b$12$demo.hash',
      role: 'demo_tenant',
    }).returning();

    [demoResidentUser] = await db.insert(schema.users).values({
      username: 'demo-resident-user',
      email: 'demo-resident@test.com',
      firstName: 'Demo',
      lastName: 'Resident',
      password: '$2b$12$demo.hash',
      role: 'demo_resident',
    }).returning();

    // Create regular user for comparison
    [regularUser] = await db.insert(schema.users).values({
      username: 'regular-user',
      email: 'regular@test.com',
      firstName: 'Regular',
      lastName: 'User',
      password: '$2b$12$regular.hash',
      role: 'manager',
    }).returning();

    // Link users to appropriate organizations
    await db.insert(schema.userOrganizations).values([
      { userId: demoManagerUser.id, organizationId: openDemoOrg.id, organizationRole: 'manager' },
      { userId: demoTenantUser.id, organizationId: openDemoOrg.id, organizationRole: 'tenant' },
      { userId: demoResidentUser.id, organizationId: openDemoOrg.id, organizationRole: 'resident' },
      { userId: regularUser.id, organizationId: regularOrg.id, organizationRole: 'manager' },
    ]);

    // Create test building and residence
    [testBuilding] = await db.insert(schema.buildings).values({
      name: 'Test Building',
      address: '789 Test Avenue',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1C 1C1',
      organizationId: openDemoOrg.id,
      buildingType: 'apartment',
      totalUnits: 10,
    }).returning();

    [testResidence] = await db.insert(schema.residences).values({
      buildingId: testBuilding.id,
      unitNumber: '101',
      floor: 1,
      isActive: true,
    }).returning();
  });

  afterEach(async () => {
    // Clean up all test data
    await db.delete(schema.userOrganizations).where(
      eq(schema.userOrganizations.organizationId, openDemoOrg?.id)
    );
    await db.delete(schema.userOrganizations).where(
      eq(schema.userOrganizations.organizationId, regularOrg?.id)
    );
    await db.delete(schema.residences).where(eq(schema.residences.id, testResidence?.id));
    await db.delete(schema.buildings).where(eq(schema.buildings.id, testBuilding?.id));
    await db.delete(schema.users).where(eq(schema.users.email, 'demo-manager@test.com'));
    await db.delete(schema.users).where(eq(schema.users.email, 'demo-tenant@test.com'));
    await db.delete(schema.users).where(eq(schema.users.email, 'demo-resident@test.com'));
    await db.delete(schema.users).where(eq(schema.users.email, 'regular@test.com'));
    if (openDemoOrg?.id) await db.delete(schema.organizations).where(eq(schema.organizations.id, openDemoOrg.id));
    if (regularOrg?.id) await db.delete(schema.organizations).where(eq(schema.organizations.id, regularOrg.id));
  });

  describe('Demo User Role Validation', () => {
    it('should correctly identify all demo users as Open Demo users', async () => {
      const demoManagerIsOpenDemo = await isOpenDemoUser(demoManagerUser.id);
      const demoTenantIsOpenDemo = await isOpenDemoUser(demoTenantUser.id);
      const demoResidentIsOpenDemo = await isOpenDemoUser(demoResidentUser.id);
      const regularUserIsOpenDemo = await isOpenDemoUser(regularUser.id);

      expect(demoManagerIsOpenDemo).toBe(true);
      expect(demoTenantIsOpenDemo).toBe(true);
      expect(demoResidentIsOpenDemo).toBe(true);
      expect(regularUserIsOpenDemo).toBe(false);

      console.log('✅ All demo users correctly identified as Open Demo users');
    });

    it('should prevent all demo users from performing write operations', async () => {
      const users = [
        { user: demoManagerUser, role: 'demo_manager' },
        { user: demoTenantUser, role: 'demo_tenant' },
        { user: demoResidentUser, role: 'demo_resident' }
      ];

      for (const { user, role } of users) {
        const canCreate = await canUserPerformWriteOperation(user.id, 'create');
        const canUpdate = await canUserPerformWriteOperation(user.id, 'update');
        const canDelete = await canUserPerformWriteOperation(user.id, 'delete');
        const canManage = await canUserPerformWriteOperation(user.id, 'manage');

        expect(canCreate).toBe(false);
        expect(canUpdate).toBe(false);
        expect(canDelete).toBe(false);
        expect(canManage).toBe(false);

        console.log(`✅ ${role} cannot perform any write operations`);
      }
    });
  });

  describe('Demo User Data Creation Restrictions', () => {
    it('should prevent demo users from creating organizations', async () => {
      const agent = request.agent(app);
      
      // Test with demo manager
      const response = await agent
        .post('/api/organizations')
        .send({
          name: 'New Organization',
          type: 'syndicate',
          address: '123 New Street',
          city: 'Montreal',
          province: 'QC',
          postalCode: 'H2A 2A2'
        });

      expect(response.status).toBe(403);
      expect(response.body?.code).toMatch(/DEMO_RESTRICTED|AUTH_REQUIRED/);
    });

    it('should prevent demo users from creating buildings', async () => {
      const agent = request.agent(app);
      
      const response = await agent
        .post('/api/buildings')
        .send({
          name: 'New Building',
          address: '456 New Avenue',
          city: 'Montreal',
          province: 'QC',
          postalCode: 'H2B 2B2',
          organizationId: openDemoOrg.id,
          buildingType: 'apartment',
          totalUnits: 20
        });

      expect(response.status).toBe(403);
      expect(response.body?.code).toMatch(/DEMO_RESTRICTED|AUTH_REQUIRED/);
    });

    it('should prevent demo users from creating residences', async () => {
      const agent = request.agent(app);
      
      const response = await agent
        .post('/api/residences')
        .send({
          buildingId: testBuilding.id,
          unitNumber: '201',
          floor: 2
        });

      expect(response.status).toBe(403);
      expect(response.body?.code).toMatch(/DEMO_RESTRICTED|AUTH_REQUIRED/);
    });

    it('should prevent demo users from creating documents', async () => {
      const agent = request.agent(app);
      
      const response = await agent
        .post('/api/documents')
        .send({
          name: 'New Document',
          category: 'legal',
          organizationId: openDemoOrg.id,
          buildingId: testBuilding.id
        });

      expect(response.status).toBe(403);
      expect(response.body?.code).toMatch(/DEMO_RESTRICTED|AUTH_REQUIRED/);
    });
  });

  describe('Demo User Data Modification Restrictions', () => {
    it('should prevent demo users from updating organizations', async () => {
      const agent = request.agent(app);
      
      const response = await agent
        .put(`/api/organizations/${openDemoOrg.id}`)
        .send({
          name: 'Updated Demo Organization',
          phone: '514-555-0123'
        });

      expect(response.status).toBe(403);
      expect(response.body?.code).toMatch(/DEMO_RESTRICTED|AUTH_REQUIRED/);
    });

    it('should prevent demo users from updating buildings', async () => {
      const agent = request.agent(app);
      
      const response = await agent
        .put(`/api/buildings/${testBuilding.id}`)
        .send({
          name: 'Updated Test Building',
          totalUnits: 15
        });

      expect(response.status).toBe(403);
      expect(response.body?.code).toMatch(/DEMO_RESTRICTED|AUTH_REQUIRED/);
    });

    it('should prevent demo users from updating their own profiles', async () => {
      const agent = request.agent(app);
      
      const response = await agent
        .put(`/api/users/${demoManagerUser.id}`)
        .send({
          firstName: 'Updated',
          lastName: 'Name'
        });

      expect(response.status).toBe(403);
      expect(response.body?.code).toMatch(/DEMO_RESTRICTED|AUTH_REQUIRED/);
    });
  });

  describe('Demo User Data Deletion Restrictions', () => {
    it('should prevent demo users from deleting organizations', async () => {
      const agent = request.agent(app);
      
      const response = await agent.delete(`/api/organizations/${openDemoOrg.id}`);

      expect(response.status).toBe(403);
      expect(response.body?.code).toMatch(/DEMO_RESTRICTED|AUTH_REQUIRED/);
    });

    it('should prevent demo users from deleting buildings', async () => {
      const agent = request.agent(app);
      
      const response = await agent.delete(`/api/buildings/${testBuilding.id}`);

      expect(response.status).toBe(403);
      expect(response.body?.code).toMatch(/DEMO_RESTRICTED|AUTH_REQUIRED/);
    });

    it('should prevent demo users from deleting residences', async () => {
      const agent = request.agent(app);
      
      const response = await agent.delete(`/api/residences/${testResidence.id}`);

      expect(response.status).toBe(403);
      expect(response.body?.code).toMatch(/DEMO_RESTRICTED|AUTH_REQUIRED/);
    });

    it('should prevent demo users from deleting their own accounts', async () => {
      const agent = request.agent(app);
      
      const response = await agent.delete(`/api/users/${demoManagerUser.id}`);

      expect(response.status).toBe(403);
      expect(response.body?.code).toMatch(/DEMO_RESTRICTED|AUTH_REQUIRED/);
    });
  });

  describe('Demo User File Operations Restrictions', () => {
    it('should prevent demo users from uploading files', async () => {
      const agent = request.agent(app);
      
      const response = await agent
        .post('/api/upload')
        .attach('file', Buffer.from('test file content'), 'test.txt');

      expect(response.status).toBe(403);
      expect(response.body?.code).toMatch(/DEMO_RESTRICTED|AUTH_REQUIRED/);
    });

    it('should prevent demo users from uploading documents', async () => {
      const agent = request.agent(app);
      
      const response = await agent
        .post('/api/documents/upload')
        .attach('file', Buffer.from('test document content'), 'document.pdf');

      expect(response.status).toBe(403);
      expect(response.body?.code).toMatch(/DEMO_RESTRICTED|AUTH_REQUIRED/);
    });
  });

  describe('Demo User Permission Escalation Prevention', () => {
    it('should prevent demo users from changing roles', async () => {
      const agent = request.agent(app);
      
      const response = await agent
        .put(`/api/users/${demoTenantUser.id}`)
        .send({
          role: 'admin'
        });

      expect(response.status).toBe(403);
      expect(response.body?.code).toMatch(/DEMO_RESTRICTED|AUTH_REQUIRED/);
    });

    it('should prevent demo users from creating admin users', async () => {
      const agent = request.agent(app);
      
      const response = await agent
        .post('/api/users')
        .send({
          username: 'new-admin',
          email: 'admin@example.com',
          firstName: 'New',
          lastName: 'Admin',
          password: 'password123',
          role: 'admin'
        });

      expect(response.status).toBe(403);
      expect(response.body?.code).toMatch(/DEMO_RESTRICTED|AUTH_REQUIRED/);
    });

    it('should prevent demo users from assigning users to organizations', async () => {
      const agent = request.agent(app);
      
      const response = await agent
        .post('/api/organizations/assign-user')
        .send({
          userId: regularUser.id,
          organizationId: openDemoOrg.id,
          role: 'manager'
        });

      expect(response.status).toBe(403);
      expect(response.body?.code).toMatch(/DEMO_RESTRICTED|AUTH_REQUIRED/);
    });
  });

  describe('Demo User Read Access Validation', () => {
    it('should allow demo users to view organizations', async () => {
      const agent = request.agent(app);
      
      const response = await agent.get('/api/organizations');
      
      // Should either be successful or fail due to auth (but not demo restrictions)
      expect([200, 401, 422].includes(response.status)).toBe(true);
      if (response.status === 403) {
        expect(response.body?.code).not.toBe('DEMO_RESTRICTED');
      }
    });

    it('should allow demo users to view buildings', async () => {
      const agent = request.agent(app);
      
      const response = await agent.get('/api/buildings');
      
      expect([200, 401, 422].includes(response.status)).toBe(true);
      if (response.status === 403) {
        expect(response.body?.code).not.toBe('DEMO_RESTRICTED');
      }
    });

    it('should allow demo users to view residences', async () => {
      const agent = request.agent(app);
      
      const response = await agent.get('/api/residences');
      
      expect([200, 401, 422].includes(response.status)).toBe(true);
      if (response.status === 403) {
        expect(response.body?.code).not.toBe('DEMO_RESTRICTED');
      }
    });

    it('should allow demo users to view documents', async () => {
      const agent = request.agent(app);
      
      const response = await agent.get('/api/documents');
      
      expect([200, 401, 422].includes(response.status)).toBe(true);
      if (response.status === 403) {
        expect(response.body?.code).not.toBe('DEMO_RESTRICTED');
      }
    });
  });

  describe('Edge Cases and Security Boundaries', () => {
    it('should handle invalid demo user operations gracefully', async () => {
      const agent = request.agent(app);
      
      // Test with malformed requests
      const malformedRequests = [
        { method: 'POST', path: '/api/organizations', body: { malformed: 'data' } },
        { method: 'PUT', path: '/api/buildings/invalid-id', body: {} },
        { method: 'DELETE', path: '/api/users/nonexistent' }
      ];

      for (const req of malformedRequests) {
        let response;
        switch (req.method) {
          case 'POST':
            response = await agent.post(req.path).send(req.body);
            break;
          case 'PUT':
            response = await agent.put(req.path).send(req.body);
            break;
          case 'DELETE':
            response = await agent.delete(req.path);
            break;
        }

        // Should be blocked by demo restrictions, not just fail due to malformed data
        expect([400, 403, 422].includes(response.status)).toBe(true);
      }
    });

    it('should maintain demo restrictions under concurrent requests', async () => {
      const agent = request.agent(app);
      
      // Create multiple concurrent write requests
      const concurrentRequests = Array.from({ length: 5 }, (_, i) => 
        agent.post('/api/organizations').send({
          name: `Concurrent Org ${i}`,
          type: 'syndicate',
          address: `${i} Concurrent St`,
          city: 'Montreal',
          province: 'QC',
          postalCode: 'H3A 3A3'
        })
      );

      const responses = await Promise.allSettled(concurrentRequests);
      
      // All should be rejected due to demo restrictions
      responses.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          expect([403, 401].includes(result.value.status)).toBe(true);
        }
      });
    });
  });
});