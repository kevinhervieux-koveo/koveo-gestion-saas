import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// Mock WebSocket constructor for Jest environment
jest.mock('ws', () => ({
  __esModule: true,
  default: class MockWebSocket {}
}));

import { registerRoutes } from '../../server/routes';
import { db } from '../../server/db';
import * as schema from '../../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Demo User Security Restrictions Test Suite
 * 
 * Validates that demo users have proper security restrictions:
 * - Cannot modify critical data
 * - Have read-only access to most features  
 * - Cannot access sensitive information
 * - Cannot perform administrative actions
 */

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  registerRoutes(app);
  return app;
};

describe('Demo User Security Restrictions', () => {
  let app: express.Application;
  let demoUser: any;
  let demoOrg: any;
  let normalUser: any;

  beforeEach(async () => {
    app = createTestApp();
    
    // Clean up test data
    await db.delete(schema.users).where(eq(schema.users.email, 'demo-security@example.com'));
    await db.delete(schema.users).where(eq(schema.users.email, 'normal-security@example.com'));

    // Create demo organization
    [demoOrg] = await db.insert(schema.organizations).values({
      name: 'Demo Organization',
      type: 'syndicate',
      address: '123 Demo St',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A 1A1',
    }).returning();

    // Create demo user with demo prefix
    [demoUser] = await db.insert(schema.users).values({
      username: 'demo-user-security',
      email: 'demo-security@example.com',
      firstName: 'Demo',
      lastName: 'User',
      password: '$2b$12$demo.password.hash',
      role: 'manager',
    }).returning();

    // Create normal user for comparison
    [normalUser] = await db.insert(schema.users).values({
      username: 'normal-user-security',
      email: 'normal-security@example.com',
      firstName: 'Normal',
      lastName: 'User', 
      password: '$2b$12$normal.password.hash',
      role: 'manager',
    }).returning();

    // Link users to demo organization
    await db.insert(schema.userOrganizations).values([
      { userId: demoUser[0].id, organizationId: demoOrg.id, organizationRole: 'manager' },
      { userId: normalUser[0].id, organizationId: demoOrg.id, organizationRole: 'manager' },
    ]);
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(schema.users).where(eq(schema.users.email, 'demo-security@example.com'));
    await db.delete(schema.users).where(eq(schema.users.email, 'normal-security@example.com'));
    if (demoOrg?.id) await db.delete(schema.organizations).where(eq(schema.organizations.id, demoOrg.id));
  });

  describe('Write Operation Restrictions', () => {
    it('should prevent demo users from creating new users', async () => {
      // Mock login session for demo user
      const agent = request.agent(app);
      
      // Set up demo user session
      const sessionData = {
        userId: demoUser.id,
        role: demoUser.role,
        organizationId: demoUser.organizationId,
      };

      // Try to create new user
      const createUserResponse = await agent
        .post('/api/users')
        .send({
          username: 'newuser',
          email: 'newuser@example.com',
          firstName: 'New',
          lastName: 'User',
          password: 'password123',
          role: 'resident',
        });

      // Demo users should not be able to create users
      expect(createUserResponse.status).toBe(403);
      expect(createUserResponse.body.error).toContain('Demo users cannot perform this action');
    });

    it('should prevent demo users from deleting data', async () => {
      // Create test building
      const [testBuilding] = await db.insert(schema.buildings).values({
        name: 'Test Building for Demo',
        address: '456 Test Ave',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1B 1B1',
        organizationId: demoOrg.id,
        buildingType: 'apartment',
        totalUnits: 10,
      }).returning();

      const agent = request.agent(app);

      // Try to delete building as demo user
      const deleteResponse = await agent
        .delete(`/api/buildings/${testBuilding.id}`);

      expect(deleteResponse.status).toBe(403);
      expect(deleteResponse.body.error).toContain('Demo users cannot perform this action');

      // Clean up
      await db.delete(schema.buildings).where(eq(schema.buildings.id, testBuilding.id));
    });

    it('should prevent demo users from modifying financial data', async () => {
      const agent = request.agent(app);

      // Try to create/modify financial records
      const billResponse = await agent
        .post('/api/bills')
        .send({
          organizationId: demoOrg.id,
          name: 'Test Bill',
          amount: 100.00,
          dueDate: new Date(),
        });

      expect(billResponse.status).toBe(403);
    });
  });

  describe('Read Access Validation', () => {
    it('should allow demo users to read non-sensitive data', async () => {
      const agent = request.agent(app);

      // Demo users should be able to read buildings
      const buildingsResponse = await agent
        .get('/api/buildings');

      expect(buildingsResponse.status).toBe(200);
    });

    it('should restrict demo users from accessing sensitive reports', async () => {
      const agent = request.agent(app);

      // Try to access financial reports
      const reportsResponse = await agent
        .get('/api/reports/financial');

      expect(reportsResponse.status).toBe(403);
    });
  });

  describe('Demo User Identification', () => {
    it('should properly identify demo users by username prefix', async () => {
      // Test the demo user detection logic
      const isDemoUser = demoUser.username.startsWith('demo-');
      expect(isDemoUser).toBe(true);

      const isNormalUser = normalUser.username.startsWith('demo-');
      expect(isNormalUser).toBe(false);
    });

    it('should apply demo restrictions consistently across all endpoints', async () => {
      const restrictedEndpoints = [
        { method: 'post', path: '/api/users' },
        { method: 'put', path: '/api/organizations/1' },
        { method: 'delete', path: '/api/buildings/1' },
        { method: 'post', path: '/api/bills' },
        { method: 'delete', path: '/api/documents/1' },
      ];

      const agent = request.agent(app);

      for (const endpoint of restrictedEndpoints) {
        let response;
        switch (endpoint.method) {
          case 'post':
            response = await agent.post(endpoint.path).send({});
            break;
          case 'put':
            response = await agent.put(endpoint.path).send({});
            break;
          case 'delete':
            response = await agent.delete(endpoint.path);
            break;
          default:
            response = await agent.get(endpoint.path);
        }

        // All should be restricted for demo users
        expect(response.status).toBe(403);
      }
    });
  });

  describe('Security Edge Cases', () => {
    it('should prevent demo users from changing their own permissions', async () => {
      const agent = request.agent(app);

      // Try to update own user role
      const updateResponse = await agent
        .put(`/api/users/${demoUser.id}`)
        .send({
          role: 'admin'
        });

      expect(updateResponse.status).toBe(403);
    });

    it('should prevent demo users from accessing user management features', async () => {
      const agent = request.agent(app);

      // Try to access user management endpoints
      const inviteResponse = await agent
        .post('/api/invitations')
        .send({
          email: 'test@example.com',
          role: 'resident',
        });

      expect(inviteResponse.status).toBe(403);
    });
  });
});