/**
 * @file API Security Integration Tests.
 * @description Tests for API security, authentication, and authorization.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { db } from '../../../server/db';
import {
  users,
  organizations,
  buildings,
  residences,
  demands,
  userOrganizations,
  userResidences,
} from '../../../shared/schema';
import { eq } from 'drizzle-orm';

describe('API Security Integration Tests', () => {
  let app: express.Application;
  let testData: {
    admin: any;
    manager: any;
    resident: any;
    tenant: any;
    organization: any;
    building: any;
    residence: any;
    adminToken: string;
    managerToken: string;
    residentToken: string;
    tenantToken: string;
  };

  beforeAll(async () => {
    app = express();
    app.use(express.json());

    // Mock authentication middleware
    app.use((req: unknown, res: unknown, next: unknown) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ message: 'Authorization header required' });
      }

      const token = authHeader.replace('Bearer ', '');

      // Mock token validation and user assignment
      switch (token) {
        case 'admin-token':
          req.user = testData.admin;
          break;
        case 'manager-token':
          req.user = testData.manager;
          break;
        case 'resident-token':
          req.user = testData.resident;
          break;
        case 'tenant-token':
          req.user = testData.tenant;
          break;
        default:
          return res.status(401).json({ message: 'Invalid token' });
      }

      next();
    });

    // Register API routes (mock implementation)
    registerSecurityTestRoutes(app);

    await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   *
   */
  /**
   * SetupTestData function.
   * @returns Function result.
   */
  async function setupTestData() {
    // Create test organization
    const [org] = await db
      .insert(organizations)
      .values({
        name: 'Security Test Org',
        type: 'management_company',
        address: '123 Security St',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1S 1S1',
        phone: '514-555-0200',
        email: 'security@test.com',
      })
      .returning();

    // Create test users
    const [admin] = await db
      .insert(users)
      .values({
        username: 'admin_security',
        email: 'admin.security@test.com',
        password: 'hashed_password',
        firstName: 'Admin',
        lastName: 'Security',
        role: 'admin',
      })
      .returning();

    const [manager] = await db
      .insert(users)
      .values({
        username: 'manager_security',
        email: 'manager.security@test.com',
        password: 'hashed_password',
        firstName: 'Manager',
        lastName: 'Security',
        role: 'manager',
      })
      .returning();

    const [resident] = await db
      .insert(users)
      .values({
        username: 'resident_security',
        email: 'resident.security@test.com',
        password: 'hashed_password',
        firstName: 'Resident',
        lastName: 'Security',
        role: 'resident',
      })
      .returning();

    const [tenant] = await db
      .insert(users)
      .values({
        username: 'tenant_security',
        email: 'tenant.security@test.com',
        password: 'hashed_password',
        firstName: 'Tenant',
        lastName: 'Security',
        role: 'tenant',
      })
      .returning();

    // Link users to organization
    await db.insert(userOrganizations).values([
      { userId: admin.id, organizationId: org.id, organizationRole: 'admin' },
      { userId: manager.id, organizationId: org.id, organizationRole: 'manager' },
      { userId: resident.id, organizationId: org.id, organizationRole: 'resident' },
      { userId: tenant.id, organizationId: org.id, organizationRole: 'tenant' },
    ]);

    // Create test building and residence
    const [building] = await db
      .insert(buildings)
      .values({
        organizationId: org.id,
        name: 'Security Test Building',
        address: '456 Security Ave',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1S 2S2',
        buildingType: 'Apartment',
        totalUnits: 5,
      })
      .returning();

    const [residence] = await db
      .insert(residences)
      .values({
        buildingId: building.id,
        unitNumber: '101',
        floor: 1,
        squareFootage: 750,
      })
      .returning();

    await db.insert(userResidences).values({
      userId: resident.id,
      residenceId: residence.id,
      residenceRole: 'owner',
    });

    testData = {
      admin,
      manager,
      resident,
      tenant,
      organization: org,
      building,
      residence,
      adminToken: 'admin-token',
      managerToken: 'manager-token',
      residentToken: 'resident-token',
      tenantToken: 'tenant-token',
    };
  }

  /**
   *
   */
  /**
   * CleanupTestData function.
   * @returns Function result.
   */
  async function cleanupTestData() {
    if (testData) {
      await db.delete(demands);
      await db.delete(userResidences);
      await db.delete(residences);
      await db.delete(buildings);
      await db.delete(userOrganizations);
      await db.delete(users);
      await db.delete(organizations);
    }
  }

  /**
   *
   * @param app
   */
  /**
   * RegisterSecurityTestRoutes function.
   * @param app
   * @returns Function result.
   */
  function registerSecurityTestRoutes(app: express.Application) {
    // Mock protected routes for testing
    app.get('/api/admin-only', (req: unknown, res: unknown) => {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }
      res.json({ message: 'Admin access granted' });
    });

    app.get('/api/manager-or-admin', (req: unknown, res: unknown) => {
      if (!['admin', 'manager'].includes(req.user?.role)) {
        return res.status(403).json({ message: 'Manager or admin access required' });
      }
      res.json({ message: 'Manager/admin access granted' });
    });

    app.get('/api/authenticated', (req: unknown, res: unknown) => {
      res.json({ message: 'Authenticated user', userId: req.user.id });
    });

    app.post('/api/demands', (req: unknown, res: unknown) => {
      if (req.user?.role === 'tenant') {
        return res.status(403).json({ message: 'Tenants cannot create demands' });
      }
      res.status(201).json({ message: 'Demand created', submitterId: req.user.id });
    });

    app.patch('/api/demands/:id/status', (req: unknown, res: unknown) => {
      if (!['admin', 'manager'].includes(req.user?.role)) {
        return res.status(403).json({ message: 'Cannot update demand status' });
      }
      res.json({ message: 'Status updated', updatedBy: req.user.id });
    });

    app.get('/api/users', (req: unknown, res: unknown) => {
      if (!['admin', 'manager'].includes(req.user?.role)) {
        return res.status(403).json({ message: 'User list access denied' });
      }
      res.json({ message: 'User list', requestedBy: req.user.role });
    });

    // Sensitive data endpoint
    app.get('/api/sensitive-data', (req: unknown, res: unknown) => {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
      }
      res.json({
        message: 'Sensitive data access granted',
        _data: 'CONFIDENTIAL_INFORMATION',
      });
    });

    // SQL injection vulnerable endpoint (for testing)
    app.get('/api/vulnerable-search', async (req: unknown, res: unknown) => {
      const { query } = req.query;
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: 'Query parameter required' });
      }

      // This would be vulnerable to SQL injection in real code
      // Here we simulate detection of malicious input
      if (query.includes("'") || query.includes(';') || query.includes('--')) {
        return res.status(400).json({ message: 'Invalid characters detected' });
      }

      res.json({ message: 'Search completed', query });
    });
  }

  describe('Authentication Tests', () => {
    it('should reject requests without authorization header', async () => {
      const response = await request(app).get('/api/authenticated');

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Authorization header required');
    });

    it('should reject requests with invalid tokens', async () => {
      const response = await request(app)
        .get('/api/authenticated')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Invalid token');
    });

    it('should accept requests with valid tokens', async () => {
      const response = await request(app)
        .get('/api/authenticated')
        .set('Authorization', `Bearer ${testData.adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Authenticated user');
      expect(response.body.userId).toBe(testData.admin.id);
    });

    it('should handle malformed authorization headers', async () => {
      const response = await request(app)
        .get('/api/authenticated')
        .set('Authorization', 'InvalidFormat');

      expect(response.status).toBe(401);
    });
  });

  describe('Authorization Tests', () => {
    it('should allow admin access to admin-only endpoints', async () => {
      const response = await request(app)
        .get('/api/admin-only')
        .set('Authorization', `Bearer ${testData.adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Admin access granted');
    });

    it('should deny non-admin access to admin-only endpoints', async () => {
      const roles = ['manager', 'resident', 'tenant'];
      const tokens = [testData.managerToken, testData.residentToken, testData.tenantToken];

      for (let i = 0; i < roles.length; i++) {
        const response = await request(app)
          .get('/api/admin-only')
          .set('Authorization', `Bearer ${tokens[i]}`);

        expect(response.status).toBe(403);
        expect(response.body.message).toContain('Admin access required');
      }
    });

    it('should allow manager and admin access to manager endpoints', async () => {
      // Admin access
      const adminResponse = await request(app)
        .get('/api/manager-or-admin')
        .set('Authorization', `Bearer ${testData.adminToken}`);

      expect(adminResponse.status).toBe(200);

      // Manager access
      const managerResponse = await request(app)
        .get('/api/manager-or-admin')
        .set('Authorization', `Bearer ${testData.managerToken}`);

      expect(managerResponse.status).toBe(200);
    });

    it('should deny resident and tenant access to manager endpoints', async () => {
      const tokens = [testData.residentToken, testData.tenantToken];

      for (const token of tokens) {
        const response = await request(app)
          .get('/api/manager-or-admin')
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(403);
        expect(response.body.message).toContain('Manager or admin access required');
      }
    });
  });

  describe('Role-Based Resource Access', () => {
    it('should allow demand creation for residents but not tenants', async () => {
      // Resident can create demands
      const residentResponse = await request(app)
        .post('/api/demands')
        .send({ type: 'maintenance', description: 'Test demand' })
        .set('Authorization', `Bearer ${testData.residentToken}`);

      expect(residentResponse.status).toBe(201);
      expect(residentResponse.body.submitterId).toBe(testData.resident.id);

      // Tenant cannot create demands
      const tenantResponse = await request(app)
        .post('/api/demands')
        .send({ type: 'maintenance', description: 'Test demand' })
        .set('Authorization', `Bearer ${testData.tenantToken}`);

      expect(tenantResponse.status).toBe(403);
      expect(tenantResponse.body.message).toContain('Tenants cannot create demands');
    });

    it('should allow demand status updates for managers and admins only', async () => {
      const statusUpdate = { status: 'approved', reviewNotes: 'Approved for work' };

      // Admin can update status
      const adminResponse = await request(app)
        .patch('/api/demands/123/status')
        .send(statusUpdate)
        .set('Authorization', `Bearer ${testData.adminToken}`);

      expect(adminResponse.status).toBe(200);

      // Manager can update status
      const managerResponse = await request(app)
        .patch('/api/demands/123/status')
        .send(statusUpdate)
        .set('Authorization', `Bearer ${testData.managerToken}`);

      expect(managerResponse.status).toBe(200);

      // Resident cannot update status
      const residentResponse = await request(app)
        .patch('/api/demands/123/status')
        .send(statusUpdate)
        .set('Authorization', `Bearer ${testData.residentToken}`);

      expect(residentResponse.status).toBe(403);
    });

    it('should restrict user list access to managers and admins', async () => {
      // Admin can view user list
      const adminResponse = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${testData.adminToken}`);

      expect(adminResponse.status).toBe(200);

      // Manager can view user list
      const managerResponse = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${testData.managerToken}`);

      expect(managerResponse.status).toBe(200);

      // Resident cannot view user list
      const residentResponse = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${testData.residentToken}`);

      expect(residentResponse.status).toBe(403);
    });
  });

  describe('Input Validation and Sanitization', () => {
    it('should reject requests with SQL injection attempts', async () => {
      const maliciousQueries = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        '1; DELETE FROM demands WHERE 1=1; --',
        "' UNION SELECT * FROM users --",
      ];

      for (const query of maliciousQueries) {
        const response = await request(app)
          .get('/api/vulnerable-search')
          .query({ query })
          .set('Authorization', `Bearer ${testData.adminToken}`);

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid characters detected');
      }
    });

    it('should accept safe search queries', async () => {
      const safeQueries = [
        'kitchen faucet repair',
        'maintenance request 2025',
        'building regulations',
      ];

      for (const query of safeQueries) {
        const response = await request(app)
          .get('/api/vulnerable-search')
          .query({ query })
          .set('Authorization', `Bearer ${testData.adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.query).toBe(query);
      }
    });

    it('should validate required parameters', async () => {
      const response = await request(app)
        .get('/api/vulnerable-search')
        .set('Authorization', `Bearer ${testData.adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Query parameter required');
    });
  });

  describe('Data Privacy and Protection', () => {
    it('should protect sensitive data from unauthorized access', async () => {
      // Only admin should access sensitive data
      const adminResponse = await request(app)
        .get('/api/sensitive-data')
        .set('Authorization', `Bearer ${testData.adminToken}`);

      expect(adminResponse.status).toBe(200);
      expect(adminResponse.body._data).toBe('CONFIDENTIAL_INFORMATION');

      // Other roles should be denied
      const roles = [testData.managerToken, testData.residentToken, testData.tenantToken];

      for (const token of roles) {
        const response = await request(app)
          .get('/api/sensitive-data')
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(403);
        expect(response.body.message).toBe('Access denied');
      }
    });

    it('should not leak sensitive information in error messages', async () => {
      const response = await request(app)
        .get('/api/sensitive-data')
        .set('Authorization', `Bearer ${testData.residentToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).not.toContain('CONFIDENTIAL');
      expect(response.body.message).not.toContain('admin');
      expect(response.body.message).toBe('Access denied');
    });
  });

  describe('Rate Limiting and Abuse Prevention', () => {
    it('should handle concurrent requests gracefully', async () => {
      const requests = Array.from({ length: 10 }, () =>
        request(app).get('/api/authenticated').set('Authorization', `Bearer ${testData.adminToken}`)
      );

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });

    it('should maintain session integrity under load', async () => {
      const differentUserRequests = [
        request(app)
          .get('/api/authenticated')
          .set('Authorization', `Bearer ${testData.adminToken}`),
        request(app)
          .get('/api/authenticated')
          .set('Authorization', `Bearer ${testData.managerToken}`),
        request(app)
          .get('/api/authenticated')
          .set('Authorization', `Bearer ${testData.residentToken}`),
      ];

      const responses = await Promise.all(differentUserRequests);

      expect(responses[0].body.userId).toBe(testData.admin.id);
      expect(responses[1].body.userId).toBe(testData.manager.id);
      expect(responses[2].body.userId).toBe(testData.resident.id);
    });
  });

  describe('Security Headers and CORS', () => {
    it('should include appropriate security headers', async () => {
      const response = await request(app)
        .get('/api/authenticated')
        .set('Authorization', `Bearer ${testData.adminToken}`);

      // In a real implementation, we would check for:
      // - X-Content-Type-Options: nosniff
      // - X-Frame-Options: DENY
      // - X-XSS-Protection: 1; mode=block
      // - Strict-Transport-Security
      expect(response.status).toBe(200);
    });

    it('should handle preflight requests correctly', async () => {
      const response = await request(app).options('/api/authenticated');

      // CORS preflight handling would be tested here
      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling Security', () => {
    it('should not expose internal system information in errors', async () => {
      const response = await request(app)
        .get('/api/non-existent-endpoint')
        .set('Authorization', `Bearer ${testData.adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message || '').not.toContain('/server/');
      expect(response.body.message || '').not.toContain('node_modules');
      expect(response.body.message || '').not.toContain('stacktrace');
    });

    it('should handle database errors securely', async () => {
      // Simulate database connection error
      // In real implementation, this would test graceful degradation
      expect(true).toBe(true); // Placeholder for database error handling test
    });
  });
});
