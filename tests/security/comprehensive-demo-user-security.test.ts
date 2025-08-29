import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq, and, inArray } from 'drizzle-orm';
import * as schema from '../../shared/schema';
import { canUserPerformWriteOperation, isOpenDemoUser } from '../../server/rbac';
import ws from 'ws';
import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../../server/app';

neonConfig.webSocketConstructor = ws;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined');
}

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle({ client: pool, schema });

let app: Express;
let testServer: any;
let demoUserId: string;
let openDemoUserId: string;
let regularUserId: string;
let demoOrgId: string;
let openDemoOrgId: string;
let regularOrgId: string;

describe('Comprehensive Demo User Security Tests', () => {
  beforeAll(async () => {
    // Initialize Express app for testing
    app = createApp();
    testServer = app.listen(0); // Use random port for testing

    // Setup test data
    await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await pool.end();
    if (testServer) {
      testServer.close();
    }
  });

  beforeEach(async () => {
    // Reset any state between tests if needed
  });

  afterEach(async () => {
    // Cleanup any temporary data created during tests
  });

  describe('Demo User Write Operation Restrictions', () => {
    test('should correctly identify Open Demo users', async () => {
      const isOpenDemo = await isOpenDemoUser(openDemoUserId);
      expect(isOpenDemo).toBe(true);

      const isRegularUser = await isOpenDemoUser(regularUserId);
      expect(isRegularUser).toBe(false);

      const isDemoUser = await isOpenDemoUser(demoUserId);
      expect(isDemoUser).toBe(false); // Regular Demo users should not be Open Demo
    });

    test('should prevent Open Demo users from performing write operations', async () => {
      const writeOperations = ['create', 'update', 'delete', 'manage', 'approve', 'assign', 'share', 'export', 'backup', 'restore'] as const;

      for (const operation of writeOperations) {
        const canPerform = await canUserPerformWriteOperation(openDemoUserId, operation);
        expect(canPerform).toBe(false);
      }
    });

    test('should allow regular Demo users to perform write operations', async () => {
      const writeOperations = ['create', 'update', 'delete', 'manage'] as const;

      for (const operation of writeOperations) {
        const canPerform = await canUserPerformWriteOperation(demoUserId, operation);
        expect(canPerform).toBe(true);
      }
    });

    test('should allow regular users to perform write operations', async () => {
      const writeOperations = ['create', 'update', 'delete', 'manage'] as const;

      for (const operation of writeOperations) {
        const canPerform = await canUserPerformWriteOperation(regularUserId, operation);
        expect(canPerform).toBe(true);
      }
    });
  });

  describe('API Endpoint Security - User Management', () => {
    test('should prevent Open Demo users from creating users', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${await getAuthToken(openDemoUserId)}`)
        .send({
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'tenant'
        });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/view.?only|restricted|demo/i);
    });

    test('should prevent Open Demo users from updating users', async () => {
      const response = await request(app)
        .put(`/api/users/${regularUserId}`)
        .set('Authorization', `Bearer ${await getAuthToken(openDemoUserId)}`)
        .send({
          firstName: 'Updated Name'
        });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/view.?only|restricted|demo/i);
    });

    test('should prevent Open Demo users from deleting users', async () => {
      const response = await request(app)
        .delete(`/api/users/${regularUserId}`)
        .set('Authorization', `Bearer ${await getAuthToken(openDemoUserId)}`);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/view.?only|restricted|demo/i);
    });

    test('should allow Open Demo users to view users', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${await getAuthToken(openDemoUserId)}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('API Endpoint Security - Document Management', () => {
    test('should prevent Open Demo users from creating documents', async () => {
      const response = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${await getAuthToken(openDemoUserId)}`)
        .send({
          title: 'Test Document',
          category: 'bylaw',
          description: 'Test description'
        });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/view.?only|restricted|demo/i);
    });

    test('should prevent Open Demo users from uploading document files', async () => {
      const response = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${await getAuthToken(openDemoUserId)}`)
        .attach('file', Buffer.from('test content'), 'test.pdf');

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/view.?only|restricted|demo/i);
    });

    test('should allow Open Demo users to view documents', async () => {
      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${await getAuthToken(openDemoUserId)}`);

      expect(response.status).toBe(200);
    });

    test('should allow Open Demo users to download documents', async () => {
      // Create a test document first with regular user
      const createResponse = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${await getAuthToken(demoUserId)}`)
        .send({
          title: 'Test Document for Download',
          category: 'bylaw',
          description: 'Test document for download test'
        });

      if (createResponse.status === 201) {
        const documentId = createResponse.body.id;
        
        const downloadResponse = await request(app)
          .get(`/api/documents/${documentId}/download`)
          .set('Authorization', `Bearer ${await getAuthToken(openDemoUserId)}`);

        expect(downloadResponse.status).toBe(200);
      }
    });
  });

  describe('API Endpoint Security - Building Management', () => {
    test('should prevent Open Demo users from creating buildings', async () => {
      const response = await request(app)
        .post('/api/buildings')
        .set('Authorization', `Bearer ${await getAuthToken(openDemoUserId)}`)
        .send({
          name: 'Test Building',
          address: '123 Test St',
          organizationId: openDemoOrgId,
          totalUnits: 10
        });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/view.?only|restricted|demo/i);
    });

    test('should prevent Open Demo users from updating buildings', async () => {
      // Get a test building first
      const buildingsResponse = await request(app)
        .get('/api/buildings')
        .set('Authorization', `Bearer ${await getAuthToken(openDemoUserId)}`);

      if (buildingsResponse.status === 200 && buildingsResponse.body.length > 0) {
        const buildingId = buildingsResponse.body[0].id;

        const response = await request(app)
          .put(`/api/buildings/${buildingId}`)
          .set('Authorization', `Bearer ${await getAuthToken(openDemoUserId)}`)
          .send({
            name: 'Updated Building Name'
          });

        expect(response.status).toBe(403);
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toMatch(/view.?only|restricted|demo/i);
      }
    });

    test('should allow Open Demo users to view buildings', async () => {
      const response = await request(app)
        .get('/api/buildings')
        .set('Authorization', `Bearer ${await getAuthToken(openDemoUserId)}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('API Endpoint Security - Residence Management', () => {
    test('should prevent Open Demo users from creating residences', async () => {
      const response = await request(app)
        .post('/api/residences')
        .set('Authorization', `Bearer ${await getAuthToken(openDemoUserId)}`)
        .send({
          unitNumber: '101',
          buildingId: 'test-building-id',
          floor: 1
        });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/view.?only|restricted|demo/i);
    });

    test('should prevent Open Demo users from updating residences', async () => {
      // Get a test residence first
      const residencesResponse = await request(app)
        .get('/api/residences')
        .set('Authorization', `Bearer ${await getAuthToken(openDemoUserId)}`);

      if (residencesResponse.status === 200 && residencesResponse.body.length > 0) {
        const residenceId = residencesResponse.body[0].id;

        const response = await request(app)
          .put(`/api/residences/${residenceId}`)
          .set('Authorization', `Bearer ${await getAuthToken(openDemoUserId)}`)
          .send({
            unitNumber: 'Updated Unit'
          });

        expect(response.status).toBe(403);
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toMatch(/view.?only|restricted|demo/i);
      }
    });

    test('should allow Open Demo users to view residences', async () => {
      const response = await request(app)
        .get('/api/residences')
        .set('Authorization', `Bearer ${await getAuthToken(openDemoUserId)}`);

      expect(response.status).toBe(200);
    });
  });

  describe('Error Message Quality', () => {
    test('should provide elegant error messages in both French and English', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${await getAuthToken(openDemoUserId)}`)
        .set('Accept-Language', 'fr')
        .send({
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User'
        });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('messageEn');
      expect(response.body).toHaveProperty('messageFr');
      
      // Check for user-friendly language
      expect(response.body.message).not.toMatch(/error|fail|invalid/i);
      expect(response.body.message).toMatch(/view|demo|restricted|consultation/i);
    });

    test('should provide consistent error structure across all endpoints', async () => {
      const endpoints = [
        { method: 'post', path: '/api/users', data: { email: 'test@test.com' } },
        { method: 'post', path: '/api/buildings', data: { name: 'Test' } },
        { method: 'post', path: '/api/documents', data: { title: 'Test' } }
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${await getAuthToken(openDemoUserId)}`)
          .send(endpoint.data);

        expect(response.status).toBe(403);
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('code');
        expect(response.body.code).toBe('DEMO_RESTRICTED');
      }
    });
  });

  describe('Security Edge Cases', () => {
    test('should prevent privilege escalation through role modification', async () => {
      const response = await request(app)
        .put(`/api/users/${openDemoUserId}`)
        .set('Authorization', `Bearer ${await getAuthToken(openDemoUserId)}`)
        .send({
          role: 'admin'
        });

      expect(response.status).toBe(403);
    });

    test('should prevent organization switching for demo users', async () => {
      const response = await request(app)
        .put(`/api/users/${openDemoUserId}/organization`)
        .set('Authorization', `Bearer ${await getAuthToken(openDemoUserId)}`)
        .send({
          organizationId: regularOrgId
        });

      expect(response.status).toBe(403);
    });

    test('should prevent bulk operations by demo users', async () => {
      const response = await request(app)
        .post('/api/users/bulk')
        .set('Authorization', `Bearer ${await getAuthToken(openDemoUserId)}`)
        .send({
          users: [
            { email: 'bulk1@test.com', firstName: 'Bulk', lastName: 'User1' },
            { email: 'bulk2@test.com', firstName: 'Bulk', lastName: 'User2' }
          ]
        });

      expect(response.status).toBe(403);
    });

    test('should prevent data export by demo users', async () => {
      const response = await request(app)
        .get('/api/export/users')
        .set('Authorization', `Bearer ${await getAuthToken(openDemoUserId)}`);

      expect(response.status).toBe(403);
    });

    test('should handle invalid user IDs gracefully', async () => {
      const invalidUserId = 'invalid-user-id';
      const canPerform = await canUserPerformWriteOperation(invalidUserId, 'create');
      expect(canPerform).toBe(true); // Should not throw error, defaults to allowing
    });
  });

  describe('Demo vs Regular User Permissions', () => {
    test('should allow regular Demo users full access within their organization', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${await getAuthToken(demoUserId)}`)
        .send({
          email: 'regular-demo-test@demo.com',
          firstName: 'Regular',
          lastName: 'Demo',
          role: 'tenant'
        });

      expect(response.status).toBe(201);
    });

    test('should restrict Open Demo users even within their organization', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${await getAuthToken(openDemoUserId)}`)
        .send({
          email: 'open-demo-test@opendemo.com',
          firstName: 'Open',
          lastName: 'Demo',
          role: 'tenant'
        });

      expect(response.status).toBe(403);
    });

    test('should maintain read access for all demo users', async () => {
      const endpoints = ['/api/users', '/api/buildings', '/api/documents', '/api/residences'];

      for (const endpoint of endpoints) {
        const demoResponse = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${await getAuthToken(demoUserId)}`);

        const openDemoResponse = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${await getAuthToken(openDemoUserId)}`);

        expect(demoResponse.status).toBe(200);
        expect(openDemoResponse.status).toBe(200);
      }
    });
  });

  describe('Audit and Logging', () => {
    test('should log attempted security violations', async () => {
      // Mock console.warn to capture logs
      const logSpy = jest.spyOn(console, 'warn');

      await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${await getAuthToken(openDemoUserId)}`)
        .send({
          email: 'violation-test@test.com',
          firstName: 'Violation',
          lastName: 'Test'
        });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Open Demo user.*attempted restricted action/)
      );

      logSpy.mockRestore();
    });

    test('should track demo user activity patterns', async () => {
      // Test multiple read operations to ensure they're not rate-limited
      const promises = Array.from({ length: 5 }, () =>
        request(app)
          .get('/api/users')
          .set('Authorization', `Bearer ${await getAuthToken(openDemoUserId)}`)
      );

      const responses = await Promise.all(promises);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});

// Helper functions
async function setupTestData() {
  try {
    // Create test organizations
    const [demoOrg] = await db.insert(schema.organizations).values({
      name: 'Demo',
      type: 'demo',
      address: '123 Demo St',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A 1A1',
      isActive: true
    }).returning();

    const [openDemoOrg] = await db.insert(schema.organizations).values({
      name: 'Open Demo',
      type: 'demo',
      address: '456 Open Demo Ave',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1B 1B1',
      isActive: true
    }).returning();

    const [regularOrg] = await db.insert(schema.organizations).values({
      name: 'Regular Org',
      type: 'regular',
      address: '789 Regular Rd',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1C 1C1',
      isActive: true
    }).returning();

    demoOrgId = demoOrg.id;
    openDemoOrgId = openDemoOrg.id;
    regularOrgId = regularOrg.id;

    // Create test users
    const hashedPassword = '$2b$12$test.hash.for.testing';

    const [demoUser] = await db.insert(schema.users).values({
      username: 'demo.user',
      email: 'demo.user@demo.com',
      password: hashedPassword,
      firstName: 'Demo',
      lastName: 'User',
      role: 'manager',
      isActive: true
    }).returning();

    const [openDemoUser] = await db.insert(schema.users).values({
      username: 'opendemo.user',
      email: 'opendemo.user@opendemo.com',
      password: hashedPassword,
      firstName: 'OpenDemo',
      lastName: 'User',
      role: 'tenant',
      isActive: true
    }).returning();

    const [regularUser] = await db.insert(schema.users).values({
      username: 'regular.user',
      email: 'regular.user@regular.com',
      password: hashedPassword,
      firstName: 'Regular',
      lastName: 'User',
      role: 'manager',
      isActive: true
    }).returning();

    demoUserId = demoUser.id;
    openDemoUserId = openDemoUser.id;
    regularUserId = regularUser.id;

    // Create user-organization relationships
    await db.insert(schema.userOrganizations).values([
      {
        userId: demoUserId,
        organizationId: demoOrgId,
        organizationRole: 'manager',
        isActive: true
      },
      {
        userId: openDemoUserId,
        organizationId: openDemoOrgId,
        organizationRole: 'tenant',
        isActive: true
      },
      {
        userId: regularUserId,
        organizationId: regularOrgId,
        organizationRole: 'manager',
        isActive: true
      }
    ]);

    console.log('✅ Test data setup completed');
  } catch (error) {
    console.error('❌ Failed to setup test data:', error);
    throw error;
  }
}

async function cleanupTestData() {
  try {
    // Clean up in reverse order to respect foreign key constraints
    await db.delete(schema.userOrganizations).where(
      inArray(schema.userOrganizations.userId, [demoUserId, openDemoUserId, regularUserId])
    );

    await db.delete(schema.users).where(
      inArray(schema.users.id, [demoUserId, openDemoUserId, regularUserId])
    );

    await db.delete(schema.organizations).where(
      inArray(schema.organizations.id, [demoOrgId, openDemoOrgId, regularOrgId])
    );

    console.log('✅ Test data cleanup completed');
  } catch (error) {
    console.error('❌ Failed to cleanup test data:', error);
  }
}

async function getAuthToken(userId: string): Promise<string> {
  // Mock JWT token generation for testing
  // In real implementation, this would generate a proper JWT
  return `mock-jwt-token-${userId}`;
}