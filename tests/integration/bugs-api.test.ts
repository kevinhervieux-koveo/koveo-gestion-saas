import request from 'supertest';
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq, sql } from 'drizzle-orm';
import * as schema from '@shared/schema';
import { hashPassword } from '../../server/auth';
import { randomUUID } from 'crypto';

/**
 * Comprehensive integration tests for bug reporting system API.
 * Tests all CRUD operations with different user roles and access controls.
 */

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

// Test users for different roles
const testUsers = {
  admin: {
    id: '',
    username: 'test_admin_bugs',
    email: 'admin.bugs@test.com',
    password: 'AdminTest2024!',
    firstName: 'Admin',
    lastName: 'Bugs',
    role: 'admin' as const,
    organizationId: ''
  },
  manager: {
    id: '',
    username: 'test_manager_bugs',
    email: 'manager.bugs@test.com',
    password: 'ManagerTest2024!',
    firstName: 'Manager',
    lastName: 'Bugs',
    role: 'manager' as const,
    organizationId: ''
  },
  tenant: {
    id: '',
    username: 'test_tenant_bugs',
    email: 'tenant.bugs@test.com',
    password: 'TenantTest2024!',
    firstName: 'Tenant',
    lastName: 'Bugs',
    role: 'tenant' as const,
    organizationId: ''
  },
  resident: {
    id: '',
    username: 'test_resident_bugs',
    email: 'resident.bugs@test.com',
    password: 'ResidentTest2024!',
    firstName: 'Resident',
    lastName: 'Bugs',
    role: 'resident' as const,
    organizationId: ''
  }
};

let testOrganizationId: string;
let createdBugIds: string[] = [];

/**
 * Create test users and organization for bug testing
 */
async function setupTestData() {
  console.log('🏗️ Setting up bug test data...');

  // Create test organization
  const [organization] = await db.insert(schema.organizations).values({
    id: randomUUID(),
    name: 'Bug Test Organization',
    type: 'condo',
    address: '123 Bug Test Street',
    city: 'Montréal',
    province: 'QC',
    postalCode: 'H1A 1A1',
    country: 'Canada'
  }).returning();

  testOrganizationId = organization.id;

  // Create test users for each role
  for (const [role, userData] of Object.entries(testUsers)) {
    const { salt, hash } = hashPassword(userData.password);
    const combinedPassword = `${salt}:${hash}`;

    const [user] = await db.insert(schema.users).values({
      id: randomUUID(),
      username: userData.username,
      email: userData.email,
      password: combinedPassword,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role,
      language: 'fr'
    }).returning();

    userData.id = user.id;
    userData.organizationId = testOrganizationId;

    // Add user to organization
    await db.insert(schema.userOrganizations).values({
      userId: user.id,
      organizationId: testOrganizationId,
      organizationRole: userData.role,
      isActive: true,
      canAccessAllOrganizations: false
    });

    console.log(`✅ Created ${role}: ${user.id}`);
  }

  console.log(`✅ Test organization created: ${testOrganizationId}`);
}

/**
 * Clean up test data
 */
async function cleanupTestData() {
  console.log('🧹 Cleaning up bug test data...');

  try {
    // Delete test bugs
    if (createdBugIds.length > 0) {
      await db.delete(schema.bugs).where(sql`id = ANY(${createdBugIds})`);
    }

    // Delete test user-organization relationships
    const userIds = Object.values(testUsers).map(u => u.id).filter(Boolean);
    if (userIds.length > 0) {
      await db.delete(schema.userOrganizations).where(sql`user_id = ANY(${userIds})`);
    }

    // Delete test users
    if (userIds.length > 0) {
      await db.delete(schema.users).where(sql`id = ANY(${userIds})`);
    }

    // Delete test organization
    if (testOrganizationId) {
      await db.delete(schema.organizations).where(eq(schema.organizations.id, testOrganizationId));
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }

  await pool.end();
}

/**
 * Login helper function
 */
async function loginUser(app: any, email: string, password: string) {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password })
    .expect(200);

  return response.headers['set-cookie'];
}

describe('Bug Reporting System API - Comprehensive Tests', () => {
  let app: any;

  beforeAll(async () => {
    // Import the app after environment setup
    const { app: testApp } = await import('../../server/index');
    app = testApp;
    await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('Bug Creation Tests', () => {
    test('Admin can create bug reports', async () => {
      const cookies = await loginUser(app, testUsers.admin.email, testUsers.admin.password);

      const bugData = {
        title: 'Admin Test Bug',
        description: 'Bug description from admin user',
        category: 'functionality',
        page: '/admin/dashboard',
        priority: 'high',
        reproductionSteps: 'Step 1: Login as admin\nStep 2: Navigate to dashboard',
        environment: 'Production - Chrome 120'
      };

      const response = await request(app)
        .post('/api/bugs')
        .set('Cookie', cookies)
        .send(bugData)
        .expect(201);

      expect(response.body).toMatchObject({
        title: bugData.title,
        description: bugData.description,
        category: bugData.category,
        page: bugData.page,
        priority: bugData.priority,
        status: 'new',
        createdBy: testUsers.admin.id
      });

      createdBugIds.push(response.body.id);
    });

    test('Manager can create bug reports', async () => {
      const cookies = await loginUser(app, testUsers.manager.email, testUsers.manager.password);

      const bugData = {
        title: 'Manager Test Bug',
        description: 'Bug description from manager user',
        category: 'ui_ux',
        page: '/manager/buildings',
        priority: 'medium',
        reproductionSteps: 'Step 1: Login as manager\nStep 2: View buildings',
        environment: 'Chrome 120'
      };

      const response = await request(app)
        .post('/api/bugs')
        .set('Cookie', cookies)
        .send(bugData)
        .expect(201);

      expect(response.body.title).toBe(bugData.title);
      expect(response.body.createdBy).toBe(testUsers.manager.id);
      createdBugIds.push(response.body.id);
    });

    test('Tenant can create bug reports', async () => {
      const cookies = await loginUser(app, testUsers.tenant.email, testUsers.tenant.password);

      const bugData = {
        title: 'Tenant Test Bug',
        description: 'Bug description from tenant user',
        category: 'data',
        page: '/dashboard',
        priority: 'low'
      };

      const response = await request(app)
        .post('/api/bugs')
        .set('Cookie', cookies)
        .send(bugData)
        .expect(201);

      expect(response.body.title).toBe(bugData.title);
      expect(response.body.createdBy).toBe(testUsers.tenant.id);
      createdBugIds.push(response.body.id);
    });

    test('Resident can create bug reports', async () => {
      const cookies = await loginUser(app, testUsers.resident.email, testUsers.resident.password);

      const bugData = {
        title: 'Resident Test Bug',
        description: 'Bug description from resident user',
        category: 'performance',
        page: '/residents/residence',
        priority: 'critical'
      };

      const response = await request(app)
        .post('/api/bugs')
        .set('Cookie', cookies)
        .send(bugData)
        .expect(201);

      expect(response.body.title).toBe(bugData.title);
      expect(response.body.createdBy).toBe(testUsers.resident.id);
      createdBugIds.push(response.body.id);
    });

    test('Bug creation validation - missing required fields', async () => {
      const cookies = await loginUser(app, testUsers.admin.email, testUsers.admin.password);

      const bugData = {
        title: 'Test Bug',
        // Missing required fields: description, category, page
      };

      await request(app)
        .post('/api/bugs')
        .set('Cookie', cookies)
        .send(bugData)
        .expect(400);
    });

    test('Bug creation validation - invalid category', async () => {
      const cookies = await loginUser(app, testUsers.admin.email, testUsers.admin.password);

      const bugData = {
        title: 'Test Bug',
        description: 'Test description',
        category: 'invalid_category',
        page: '/test',
        priority: 'medium'
      };

      await request(app)
        .post('/api/bugs')
        .set('Cookie', cookies)
        .send(bugData)
        .expect(400);
    });
  });

  describe('Bug Retrieval Tests - Role-based Access Control', () => {
    test('Admin can see all bugs', async () => {
      const cookies = await loginUser(app, testUsers.admin.email, testUsers.admin.password);

      const response = await request(app)
        .get('/api/bugs')
        .set('Cookie', cookies)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(4); // Should see all created bugs
      
      // Should see bugs from all users
      const creatorIds = response.body.map((bug: any) => bug.createdBy);
      expect(creatorIds).toContain(testUsers.admin.id);
      expect(creatorIds).toContain(testUsers.manager.id);
      expect(creatorIds).toContain(testUsers.tenant.id);
      expect(creatorIds).toContain(testUsers.resident.id);
    });

    test('Manager can see all bugs from their organization', async () => {
      const cookies = await loginUser(app, testUsers.manager.email, testUsers.manager.password);

      const response = await request(app)
        .get('/api/bugs')
        .set('Cookie', cookies)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // Managers can see all bugs for now (can be refined later)
      expect(response.body.length).toBeGreaterThanOrEqual(1);
    });

    test('Tenant can only see their own bugs', async () => {
      const cookies = await loginUser(app, testUsers.tenant.email, testUsers.tenant.password);

      const response = await request(app)
        .get('/api/bugs')
        .set('Cookie', cookies)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      // Should only see their own bugs
      response.body.forEach((bug: any) => {
        expect(bug.createdBy).toBe(testUsers.tenant.id);
      });
    });

    test('Resident can only see their own bugs', async () => {
      const cookies = await loginUser(app, testUsers.resident.email, testUsers.resident.password);

      const response = await request(app)
        .get('/api/bugs')
        .set('Cookie', cookies)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      // Should only see their own bugs
      response.body.forEach((bug: any) => {
        expect(bug.createdBy).toBe(testUsers.resident.id);
      });
    });

    test('Unauthenticated users cannot access bugs', async () => {
      await request(app)
        .get('/api/bugs')
        .expect(401);
    });
  });

  describe('Individual Bug Access Tests', () => {
    let tenantBugId: string;

    beforeAll(async () => {
      // Create a bug by tenant for access control testing
      const cookies = await loginUser(app, testUsers.tenant.email, testUsers.tenant.password);
      
      const response = await request(app)
        .post('/api/bugs')
        .set('Cookie', cookies)
        .send({
          title: 'Tenant Access Test Bug',
          description: 'Test bug for access control',
          category: 'other',
          page: '/test',
          priority: 'low'
        });

      tenantBugId = response.body.id;
      createdBugIds.push(tenantBugId);
    });

    test('Admin can access any bug', async () => {
      const cookies = await loginUser(app, testUsers.admin.email, testUsers.admin.password);

      await request(app)
        .get(`/api/bugs/${tenantBugId}`)
        .set('Cookie', cookies)
        .expect(200);
    });

    test('Manager can access any bug', async () => {
      const cookies = await loginUser(app, testUsers.manager.email, testUsers.manager.password);

      await request(app)
        .get(`/api/bugs/${tenantBugId}`)
        .set('Cookie', cookies)
        .expect(200);
    });

    test('Tenant can access their own bug', async () => {
      const cookies = await loginUser(app, testUsers.tenant.email, testUsers.tenant.password);

      const response = await request(app)
        .get(`/api/bugs/${tenantBugId}`)
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.id).toBe(tenantBugId);
    });

    test('Resident cannot access other users\' bugs', async () => {
      const cookies = await loginUser(app, testUsers.resident.email, testUsers.resident.password);

      await request(app)
        .get(`/api/bugs/${tenantBugId}`)
        .set('Cookie', cookies)
        .expect(404); // Should return 404 for access denied
    });
  });

  describe('Bug Update Tests', () => {
    let updateTestBugId: string;

    beforeAll(async () => {
      // Create a bug for update testing
      const cookies = await loginUser(app, testUsers.tenant.email, testUsers.tenant.password);
      
      const response = await request(app)
        .post('/api/bugs')
        .set('Cookie', cookies)
        .send({
          title: 'Update Test Bug',
          description: 'Test bug for updates',
          category: 'functionality',
          page: '/test-update',
          priority: 'medium'
        });

      updateTestBugId = response.body.id;
      createdBugIds.push(updateTestBugId);
    });

    test('Admin can update bug status and priority', async () => {
      const cookies = await loginUser(app, testUsers.admin.email, testUsers.admin.password);

      const updateData = {
        status: 'acknowledged',
        priority: 'high',
        notes: 'Bug acknowledged by admin'
      };

      const response = await request(app)
        .patch(`/api/bugs/${updateTestBugId}`)
        .set('Cookie', cookies)
        .send(updateData)
        .expect(200);

      expect(response.body.status).toBe('acknowledged');
      expect(response.body.priority).toBe('high');
      expect(response.body.notes).toBe('Bug acknowledged by admin');
    });

    test('Manager can update bug status', async () => {
      const cookies = await loginUser(app, testUsers.manager.email, testUsers.manager.password);

      const updateData = {
        status: 'in_progress',
        assignedTo: testUsers.manager.id,
        notes: 'Working on this bug'
      };

      const response = await request(app)
        .patch(`/api/bugs/${updateTestBugId}`)
        .set('Cookie', cookies)
        .send(updateData)
        .expect(200);

      expect(response.body.status).toBe('in_progress');
      expect(response.body.assignedTo).toBe(testUsers.manager.id);
    });

    test('Tenant cannot update bugs', async () => {
      const cookies = await loginUser(app, testUsers.tenant.email, testUsers.tenant.password);

      const updateData = {
        status: 'resolved'
      };

      await request(app)
        .patch(`/api/bugs/${updateTestBugId}`)
        .set('Cookie', cookies)
        .send(updateData)
        .expect(404); // Access denied returns 404
    });

    test('Resident cannot update bugs', async () => {
      const cookies = await loginUser(app, testUsers.resident.email, testUsers.resident.password);

      const updateData = {
        status: 'resolved'
      };

      await request(app)
        .patch(`/api/bugs/${updateTestBugId}`)
        .set('Cookie', cookies)
        .send(updateData)
        .expect(404); // Access denied returns 404
    });

    test('Update validation - invalid status', async () => {
      const cookies = await loginUser(app, testUsers.admin.email, testUsers.admin.password);

      const updateData = {
        status: 'invalid_status'
      };

      await request(app)
        .patch(`/api/bugs/${updateTestBugId}`)
        .set('Cookie', cookies)
        .send(updateData)
        .expect(400);
    });
  });

  describe('Bug Deletion Tests', () => {
    let deleteTestBugId: string;

    beforeAll(async () => {
      // Create a bug for deletion testing
      const cookies = await loginUser(app, testUsers.tenant.email, testUsers.tenant.password);
      
      const response = await request(app)
        .post('/api/bugs')
        .set('Cookie', cookies)
        .send({
          title: 'Delete Test Bug',
          description: 'Test bug for deletion',
          category: 'other',
          page: '/test-delete',
          priority: 'low'
        });

      deleteTestBugId = response.body.id;
    });

    test('Only admin can delete bugs', async () => {
      const cookies = await loginUser(app, testUsers.admin.email, testUsers.admin.password);

      await request(app)
        .delete(`/api/bugs/${deleteTestBugId}`)
        .set('Cookie', cookies)
        .expect(204);

      // Verify bug is deleted
      await request(app)
        .get(`/api/bugs/${deleteTestBugId}`)
        .set('Cookie', cookies)
        .expect(404);
    });

    test('Manager cannot delete bugs', async () => {
      const cookies = await loginUser(app, testUsers.manager.email, testUsers.manager.password);

      await request(app)
        .delete(`/api/bugs/${deleteTestBugId}`)
        .set('Cookie', cookies)
        .expect(404); // Access denied returns 404
    });

    test('Tenant cannot delete bugs', async () => {
      const cookies = await loginUser(app, testUsers.tenant.email, testUsers.tenant.password);

      await request(app)
        .delete(`/api/bugs/${deleteTestBugId}`)
        .set('Cookie', cookies)
        .expect(404); // Access denied returns 404
    });

    test('Resident cannot delete bugs', async () => {
      const cookies = await loginUser(app, testUsers.resident.email, testUsers.resident.password);

      await request(app)
        .delete(`/api/bugs/${deleteTestBugId}`)
        .set('Cookie', cookies)
        .expect(404); // Access denied returns 404
    });

    test('Cannot delete non-existent bug', async () => {
      const cookies = await loginUser(app, testUsers.admin.email, testUsers.admin.password);

      await request(app)
        .delete('/api/bugs/non-existent-id')
        .set('Cookie', cookies)
        .expect(404);
    });
  });

  describe('Bug Status Workflow Tests', () => {
    let workflowBugId: string;

    beforeAll(async () => {
      // Create a bug for workflow testing
      const cookies = await loginUser(app, testUsers.tenant.email, testUsers.tenant.password);
      
      const response = await request(app)
        .post('/api/bugs')
        .set('Cookie', cookies)
        .send({
          title: 'Workflow Test Bug',
          description: 'Test bug for status workflow',
          category: 'functionality',
          page: '/workflow-test',
          priority: 'medium'
        });

      workflowBugId = response.body.id;
      createdBugIds.push(workflowBugId);
    });

    test('Complete bug workflow: new -> acknowledged -> in_progress -> resolved -> closed', async () => {
      const adminCookies = await loginUser(app, testUsers.admin.email, testUsers.admin.password);

      // Step 1: Acknowledge bug
      let response = await request(app)
        .patch(`/api/bugs/${workflowBugId}`)
        .set('Cookie', adminCookies)
        .send({ status: 'acknowledged' })
        .expect(200);

      expect(response.body.status).toBe('acknowledged');

      // Step 2: Start working on bug
      response = await request(app)
        .patch(`/api/bugs/${workflowBugId}`)
        .set('Cookie', adminCookies)
        .send({ 
          status: 'in_progress',
          assignedTo: testUsers.admin.id,
          notes: 'Started working on this issue'
        })
        .expect(200);

      expect(response.body.status).toBe('in_progress');
      expect(response.body.assignedTo).toBe(testUsers.admin.id);

      // Step 3: Resolve bug
      response = await request(app)
        .patch(`/api/bugs/${workflowBugId}`)
        .set('Cookie', adminCookies)
        .send({ 
          status: 'resolved',
          resolvedBy: testUsers.admin.id,
          resolvedAt: new Date().toISOString(),
          notes: 'Bug has been fixed and deployed'
        })
        .expect(200);

      expect(response.body.status).toBe('resolved');
      expect(response.body.resolvedBy).toBe(testUsers.admin.id);

      // Step 4: Close bug
      response = await request(app)
        .patch(`/api/bugs/${workflowBugId}`)
        .set('Cookie', adminCookies)
        .send({ 
          status: 'closed',
          notes: 'Verified fix in production'
        })
        .expect(200);

      expect(response.body.status).toBe('closed');
    });
  });

  describe('Bug Category and Priority Tests', () => {
    test('All valid categories work', async () => {
      const cookies = await loginUser(app, testUsers.admin.email, testUsers.admin.password);
      const validCategories = ['ui_ux', 'functionality', 'performance', 'data', 'security', 'integration', 'other'];

      for (const category of validCategories) {
        const response = await request(app)
          .post('/api/bugs')
          .set('Cookie', cookies)
          .send({
            title: `Test ${category} Bug`,
            description: `Test bug for ${category} category`,
            category: category,
            page: '/test',
            priority: 'medium'
          })
          .expect(201);

        expect(response.body.category).toBe(category);
        createdBugIds.push(response.body.id);
      }
    });

    test('All valid priorities work', async () => {
      const cookies = await loginUser(app, testUsers.admin.email, testUsers.admin.password);
      const validPriorities = ['low', 'medium', 'high', 'critical'];

      for (const priority of validPriorities) {
        const response = await request(app)
          .post('/api/bugs')
          .set('Cookie', cookies)
          .send({
            title: `Test ${priority} Priority Bug`,
            description: `Test bug for ${priority} priority`,
            category: 'other',
            page: '/test',
            priority: priority
          })
          .expect(201);

        expect(response.body.priority).toBe(priority);
        createdBugIds.push(response.body.id);
      }
    });
  });

  describe('Bug Data Integrity Tests', () => {
    test('Bug creation includes all required timestamps', async () => {
      const cookies = await loginUser(app, testUsers.admin.email, testUsers.admin.password);

      const response = await request(app)
        .post('/api/bugs')
        .set('Cookie', cookies)
        .send({
          title: 'Timestamp Test Bug',
          description: 'Test bug for timestamp validation',
          category: 'other',
          page: '/timestamp-test',
          priority: 'low'
        })
        .expect(201);

      expect(response.body.createdAt).toBeDefined();
      expect(response.body.updatedAt).toBeDefined();
      expect(new Date(response.body.createdAt)).toBeInstanceOf(Date);
      expect(new Date(response.body.updatedAt)).toBeInstanceOf(Date);

      createdBugIds.push(response.body.id);
    });

    test('Bug update modifies updatedAt timestamp', async () => {
      const cookies = await loginUser(app, testUsers.admin.email, testUsers.admin.password);

      // Create bug
      const createResponse = await request(app)
        .post('/api/bugs')
        .set('Cookie', cookies)
        .send({
          title: 'Update Timestamp Test',
          description: 'Test bug for update timestamp',
          category: 'other',
          page: '/update-test',
          priority: 'low'
        });

      const originalUpdatedAt = createResponse.body.updatedAt;
      createdBugIds.push(createResponse.body.id);

      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      // Update bug
      const updateResponse = await request(app)
        .patch(`/api/bugs/${createResponse.body.id}`)
        .set('Cookie', cookies)
        .send({ notes: 'Added test note' })
        .expect(200);

      expect(new Date(updateResponse.body.updatedAt)).toBeInstanceOf(Date);
      expect(updateResponse.body.updatedAt).not.toBe(originalUpdatedAt);
    });
  });
});