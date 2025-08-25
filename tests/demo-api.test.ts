import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq } from 'drizzle-orm';
import * as schema from '../shared/schema';
import { app } from '../server/index';
import { hashPassword } from '../server/auth';

// Test database setup
const TEST_DATABASE_URL = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;
if (!TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL or DATABASE_URL must be defined for tests');
}

const pool = new Pool({ connectionString: TEST_DATABASE_URL });
const db = drizzle({ client: pool, schema });
// app is imported from server/index

// Test user credentials
const TEST_ADMIN_USER = {
  username: 'testadmin',
  email: 'testadmin@test.com',
  password: 'TestAdmin@123456',
  firstName: 'Test',
  lastName: 'Admin',
  role: 'admin' as const
};

const TEST_USER = {
  username: 'testuser',
  email: 'testuser@test.com',
  password: 'TestUser@123456',
  firstName: 'Test',
  lastName: 'User',
  role: 'tenant' as const
};

describe('Demo Management API', () => {
  let adminAuthCookie: string;
  let userAuthCookie: string;
  let testOrgId: string;

  beforeAll(async () => {
    // Create test organization
    const [testOrg] = await db.insert(schema.organizations).values({
      name: 'Test Organization',
      type: 'management_company',
      address: '123 Test St',
      city: 'Test City',
      province: 'QC',
      postalCode: 'H1A 1A1',
      isActive: true,
    }).returning();
    testOrgId = testOrg.id;

    // Create admin user
    const hashedAdminPassword = await hashPassword(TEST_ADMIN_USER.password);
    const [adminUser] = await db.insert(schema.users).values({
      username: TEST_ADMIN_USER.username,
      email: TEST_ADMIN_USER.email,
      password: hashedAdminPassword,
      firstName: TEST_ADMIN_USER.firstName,
      lastName: TEST_ADMIN_USER.lastName,
      role: TEST_ADMIN_USER.role,
      isActive: true,
    }).returning();

    // Create admin user-organization relationship
    await db.insert(schema.userOrganizations).values({
      userId: adminUser.id,
      organizationId: testOrgId,
      organizationRole: 'admin',
      canAccessAllOrganizations: true,
    });

    // Create regular user
    const hashedUserPassword = await hashPassword(TEST_USER.password);
    const [regularUser] = await db.insert(schema.users).values({
      username: TEST_USER.username,
      email: TEST_USER.email,
      password: hashedUserPassword,
      firstName: TEST_USER.firstName,
      lastName: TEST_USER.lastName,
      role: TEST_USER.role,
      isActive: true,
    }).returning();

    // Create user-organization relationship
    await db.insert(schema.userOrganizations).values({
      userId: regularUser.id,
      organizationId: testOrgId,
      organizationRole: 'tenant',
      canAccessAllOrganizations: false,
    });

    // Login admin user
    const adminLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: TEST_ADMIN_USER.username,
        password: TEST_ADMIN_USER.password,
      });

    expect(adminLoginResponse.status).toBe(200);
    adminAuthCookie = adminLoginResponse.headers['set-cookie']?.[0]?.split(';')[0] || '';

    // Login regular user
    const userLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: TEST_USER.username,
        password: TEST_USER.password,
      });

    expect(userLoginResponse.status).toBe(200);
    userAuthCookie = userLoginResponse.headers['set-cookie']?.[0]?.split(';')[0] || '';
  });

  afterAll(async () => {
    // Clean up test data
    await cleanupTestData();
    await pool.end();
  });

  beforeEach(async () => {
    // Clean up demo organizations before each test
    await cleanupDemoData();
  });

  /**
   *
   */
  async function cleanupTestData() {
    try {
      const testOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Test Organization')
      });
      if (testOrg) {
        await db.delete(schema.organizations).where(eq(schema.organizations.id, testOrg.id));
      }
    } catch (error) {
      console.warn('Test cleanup warning:', error);
    }
  }

  /**
   *
   */
  async function cleanupDemoData() {
    try {
      const demoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Demo')
      });
      const openDemoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Open Demo')
      });

      if (demoOrg) {
        await db.delete(schema.organizations).where(eq(schema.organizations.id, demoOrg.id));
      }
      if (openDemoOrg) {
        await db.delete(schema.organizations).where(eq(schema.organizations.id, openDemoOrg.id));
      }
    } catch (error) {
      console.warn('Demo cleanup warning:', error);
    }
  }

  describe('GET /api/demo/health', () => {
    it('should return health status without authentication', async () => {
      const response = await request(app)
        .get('/api/demo/health');

      expect(response.status).toBe(503); // Unhealthy when no demo orgs exist
      expect(response.body.success).toBe(true);
      expect(response.body.data.healthy).toBe(false);
      expect(response.body.data.status).toBeDefined();
      expect(response.body.data.timestamp).toBeDefined();
    });

    it('should return healthy status when demo orgs exist with data', async () => {
      // First ensure demo organizations exist
      await request(app)
        .post('/api/demo/ensure')
        .set('Cookie', adminAuthCookie);

      const response = await request(app)
        .get('/api/demo/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.healthy).toBe(true);
    }, 60000);
  });

  describe('GET /api/demo/status', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/demo/status');

      expect(response.status).toBe(401);
    });

    it('should return demo organization status for authenticated user', async () => {
      const response = await request(app)
        .get('/api/demo/status')
        .set('Cookie', userAuthCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.stats).toBeDefined();
    });

    it('should return detailed information when demo orgs exist', async () => {
      // Ensure demo organizations exist
      await request(app)
        .post('/api/demo/ensure')
        .set('Cookie', adminAuthCookie);

      const response = await request(app)
        .get('/api/demo/status')
        .set('Cookie', userAuthCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.demo).toBeDefined();
      expect(response.body.data.openDemo).toBeDefined();
      expect(response.body.data.stats.demoBuildings).toBeGreaterThanOrEqual(0);
      expect(response.body.data.stats.demoUsers).toBeGreaterThanOrEqual(0);
    }, 60000);
  });

  describe('POST /api/demo/ensure', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/demo/ensure');

      expect(response.status).toBe(401);
    });

    it('should require admin role', async () => {
      const response = await request(app)
        .post('/api/demo/ensure')
        .set('Cookie', userAuthCookie);

      expect(response.status).toBe(403);
    });

    it('should create demo organizations for admin user', async () => {
      const response = await request(app)
        .post('/api/demo/ensure')
        .set('Cookie', adminAuthCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('properly configured');
      expect(response.body.data.demoOrgId).toBeDefined();
      expect(response.body.data.openDemoOrgId).toBeDefined();

      // Verify organizations were created
      const demoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Demo')
      });
      const openDemoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Open Demo')
      });

      expect(demoOrg).toBeDefined();
      expect(openDemoOrg).toBeDefined();
    }, 120000);
  });

  describe('POST /api/demo/recreate', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/demo/recreate');

      expect(response.status).toBe(401);
    });

    it('should require admin role', async () => {
      const response = await request(app)
        .post('/api/demo/recreate')
        .set('Cookie', userAuthCookie);

      expect(response.status).toBe(403);
    });

    it('should recreate demo organizations for admin user', async () => {
      const response = await request(app)
        .post('/api/demo/recreate')
        .set('Cookie', adminAuthCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('recreated successfully');
      expect(response.body.data.demoOrgId).toBeDefined();
      expect(response.body.data.openDemoOrgId).toBeDefined();

      // Verify organizations were created
      const demoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Demo')
      });
      const openDemoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Open Demo')
      });

      expect(demoOrg).toBeDefined();
      expect(openDemoOrg).toBeDefined();
    }, 120000);
  });

  describe('POST /api/demo/maintenance', () => {
    beforeEach(async () => {
      // Ensure demo organizations exist for maintenance tests
      await request(app)
        .post('/api/demo/ensure')
        .set('Cookie', adminAuthCookie);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/demo/maintenance');

      expect(response.status).toBe(401);
    });

    it('should require admin role', async () => {
      const response = await request(app)
        .post('/api/demo/maintenance')
        .set('Cookie', userAuthCookie);

      expect(response.status).toBe(403);
    });

    it('should run maintenance for admin user', async () => {
      const response = await request(app)
        .post('/api/demo/maintenance')
        .set('Cookie', adminAuthCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('completed successfully');
      expect(response.body.data.actions).toBeInstanceOf(Array);
      expect(response.body.data.actions.length).toBeGreaterThan(0);
    }, 120000);
  });

  describe('Error Handling', () => {
    it('should handle invalid endpoints gracefully', async () => {
      const response = await request(app)
        .get('/api/demo/invalid-endpoint')
        .set('Cookie', adminAuthCookie);

      expect(response.status).toBe(404);
    });

    it('should handle malformed requests gracefully', async () => {
      const response = await request(app)
        .post('/api/demo/ensure')
        .set('Cookie', adminAuthCookie)
        .send({ invalid: 'data' });

      // Should still work since we don't validate request body for this endpoint
      expect([200, 400, 500]).toContain(response.status);
    }, 60000);
  });

  describe('Integration Flow', () => {
    it('should support complete demo lifecycle', async () => {
      // 1. Check initial health (should be unhealthy)
      let healthResponse = await request(app).get('/api/demo/health');
      expect(healthResponse.body.data.healthy).toBe(false);

      // 2. Ensure demo organizations
      const ensureResponse = await request(app)
        .post('/api/demo/ensure')
        .set('Cookie', adminAuthCookie);
      expect(ensureResponse.status).toBe(200);

      // 3. Check health again (should be healthy)
      healthResponse = await request(app).get('/api/demo/health');
      expect(healthResponse.body.data.healthy).toBe(true);

      // 4. Get status
      const statusResponse = await request(app)
        .get('/api/demo/status')
        .set('Cookie', userAuthCookie);
      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.data.demo).toBeDefined();
      expect(statusResponse.body.data.openDemo).toBeDefined();

      // 5. Run maintenance
      const maintenanceResponse = await request(app)
        .post('/api/demo/maintenance')
        .set('Cookie', adminAuthCookie);
      expect(maintenanceResponse.status).toBe(200);

      // 6. Recreate (force refresh)
      const recreateResponse = await request(app)
        .post('/api/demo/recreate')
        .set('Cookie', adminAuthCookie);
      expect(recreateResponse.status).toBe(200);

      // 7. Final health check
      healthResponse = await request(app).get('/api/demo/health');
      expect(healthResponse.body.data.healthy).toBe(true);
    }, 300000); // 5 minute timeout for full integration test
  });
});