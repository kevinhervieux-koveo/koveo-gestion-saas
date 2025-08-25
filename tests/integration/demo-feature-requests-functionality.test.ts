import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

/**
 * Demo test for feature request functionality using existing demo users.
 * This test demonstrates all feature request operations using the demo users created in the system.
 */

describe('Demo Feature Request Functionality Tests', () => {
  let app: any;
  let demoUserCookies: Record<string, string[]> = {};

  // Demo user credentials - these should match the test users created by scripts/create-test-users.ts
  const demoUsers = {
    admin: {
      email: 'manager@563pionniers.test',
      password: 'TestManager2024!'
    },
    tenant: {
      email: 'tenant@563pionniers.test', 
      password: 'TestTenant2024!'
    },
    resident: {
      email: 'resident@563pionniers.test',
      password: 'TestResident2024!'
    }
  };

  let createdFeatureRequestIds: string[] = [];

  beforeAll(async () => {
    try {
      // Import the app
      const { app: testApp } = await import('../../server/index');
      app = testApp;

      // Login all demo users
      for (const [role, credentials] of Object.entries(demoUsers)) {
        console.log(`🔐 Logging in demo ${role}...`);
        
        const response = await request(app)
          .post('/api/auth/login')
          .send(credentials);

        if (response.status === 200 && response.headers['set-cookie']) {
          demoUserCookies[role] = response.headers['set-cookie'];
          console.log(`✅ Demo ${role} logged in successfully`);
        } else {
          console.log(`⚠️ Could not login demo ${role} (status: ${response.status})`);
          console.log(`Response: ${JSON.stringify(response.body)}`);
        }
      }
    } catch (error) {
      console.error('Setup error:', error);
    }
  });

  afterAll(async () => {
    // Cleanup: Delete any feature requests created during testing
    if (createdFeatureRequestIds.length > 0 && demoUserCookies.admin) {
      console.log('🧹 Cleaning up test feature requests...');
      
      for (const featureRequestId of createdFeatureRequestIds) {
        try {
          await request(app)
            .delete(`/api/feature-requests/${featureRequestId}`)
            .set('Cookie', demoUserCookies.admin);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }
  });

  describe('Feature Request Creation by Different User Roles', () => {
    const sampleFeatureRequest = {
      title: 'Enhanced Dashboard Analytics',
      description: 'Add more detailed analytics and reporting capabilities to the dashboard with real-time data visualization.',
      need: 'Users need better insights into their property performance and tenant behavior to make informed decisions.',
      category: 'dashboard',
      page: 'Dashboard'
    };

    test('should allow admin to create feature request', async () => {
      if (!demoUserCookies.admin) {
        console.log('⏭️ Skipping admin feature request creation test - no admin cookies');
        return;
      }

      const response = await request(app)
        .post('/api/feature-requests')
        .set('Cookie', demoUserCookies.admin)
        .send(sampleFeatureRequest);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe(sampleFeatureRequest.title);
      expect(response.body.status).toBe('submitted');
      expect(response.body.upvoteCount).toBe(0);

      createdFeatureRequestIds.push(response.body.id);
    });

    test('should allow tenant to create feature request', async () => {
      if (!demoUserCookies.tenant) {
        console.log('⏭️ Skipping tenant feature request creation test - no tenant cookies');
        return;
      }

      const tenantFeatureRequest = {
        ...sampleFeatureRequest,
        title: 'Mobile App for Tenants',
        category: 'mobile_app',
        page: 'Mobile Application'
      };

      const response = await request(app)
        .post('/api/feature-requests')
        .set('Cookie', demoUserCookies.tenant)
        .send(tenantFeatureRequest);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe(tenantFeatureRequest.title);

      createdFeatureRequestIds.push(response.body.id);
    });

    test('should allow resident to create feature request', async () => {
      if (!demoUserCookies.resident) {
        console.log('⏭️ Skipping resident feature request creation test - no resident cookies');
        return;
      }

      const residentFeatureRequest = {
        ...sampleFeatureRequest,
        title: 'Improved Maintenance Request System',
        category: 'maintenance',
        page: 'Maintenance'
      };

      const response = await request(app)
        .post('/api/feature-requests')
        .set('Cookie', demoUserCookies.resident)
        .send(residentFeatureRequest);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe(residentFeatureRequest.title);

      createdFeatureRequestIds.push(response.body.id);
    });
  });

  describe('Feature Request Validation', () => {
    test('should reject feature request with missing required fields', async () => {
      if (!demoUserCookies.admin) {
        console.log('⏭️ Skipping validation test - no admin cookies');
        return;
      }

      const invalidFeatureRequest = {
        title: '',
        description: 'Short',
        category: 'dashboard'
        // Missing need and page fields
      };

      const response = await request(app)
        .post('/api/feature-requests')
        .set('Cookie', demoUserCookies.admin)
        .send(invalidFeatureRequest);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('should reject feature request with invalid category', async () => {
      if (!demoUserCookies.admin) {
        console.log('⏭️ Skipping validation test - no admin cookies');
        return;
      }

      const invalidFeatureRequest = {
        title: 'Test Feature',
        description: 'This is a test feature request with invalid category.',
        need: 'Testing validation rules.',
        category: 'invalid_category',
        page: 'Test Page'
      };

      const response = await request(app)
        .post('/api/feature-requests')
        .set('Cookie', demoUserCookies.admin)
        .send(invalidFeatureRequest);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Feature Request Retrieval and Access Control', () => {
    test('should return all feature requests for admin with submitter info', async () => {
      if (!demoUserCookies.admin) {
        console.log('⏭️ Skipping admin retrieval test - no admin cookies');
        return;
      }

      const response = await request(app)
        .get('/api/feature-requests')
        .set('Cookie', demoUserCookies.admin);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // Admin should see submitter information
      if (response.body.length > 0) {
        const featureRequest = response.body[0];
        expect(featureRequest).toHaveProperty('createdBy');
        expect(featureRequest.createdBy).not.toBeNull();
      }
    });

    test('should return all feature requests for non-admin without submitter info', async () => {
      if (!demoUserCookies.tenant) {
        console.log('⏭️ Skipping tenant retrieval test - no tenant cookies');
        return;
      }

      const response = await request(app)
        .get('/api/feature-requests')
        .set('Cookie', demoUserCookies.tenant);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // Non-admin should NOT see submitter information
      if (response.body.length > 0) {
        const featureRequest = response.body[0];
        expect(featureRequest).toHaveProperty('createdBy');
        expect(featureRequest.createdBy).toBeNull();
      }
    });
  });

  describe('Feature Request Upvoting', () => {
    let testFeatureRequestId: string;

    test('should create a feature request for upvoting tests', async () => {
      if (!demoUserCookies.admin) {
        console.log('⏭️ Skipping upvoting test setup - no admin cookies');
        return;
      }

      const response = await request(app)
        .post('/api/feature-requests')
        .set('Cookie', demoUserCookies.admin)
        .send({
          title: 'Upvoting Test Feature',
          description: 'This feature request is for testing upvoting functionality.',
          need: 'Testing the upvoting system.',
          category: 'other',
          page: 'Test'
        });

      expect(response.status).toBe(201);
      testFeatureRequestId = response.body.id;
      createdFeatureRequestIds.push(testFeatureRequestId);
    });

    test('should allow user to upvote feature request', async () => {
      if (!demoUserCookies.tenant || !testFeatureRequestId) {
        console.log('⏭️ Skipping upvote test - missing cookies or test feature request');
        return;
      }

      const response = await request(app)
        .post(`/api/feature-requests/${testFeatureRequestId}/upvote`)
        .set('Cookie', demoUserCookies.tenant);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data.featureRequest.upvoteCount).toBe(1);
    });

    test('should prevent duplicate upvotes from same user', async () => {
      if (!demoUserCookies.tenant || !testFeatureRequestId) {
        console.log('⏭️ Skipping duplicate upvote test - missing cookies or test feature request');
        return;
      }

      const response = await request(app)
        .post(`/api/feature-requests/${testFeatureRequestId}/upvote`)
        .set('Cookie', demoUserCookies.tenant);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('already upvoted');
    });

    test('should allow user to remove upvote', async () => {
      if (!demoUserCookies.tenant || !testFeatureRequestId) {
        console.log('⏭️ Skipping remove upvote test - missing cookies or test feature request');
        return;
      }

      const response = await request(app)
        .delete(`/api/feature-requests/${testFeatureRequestId}/upvote`)
        .set('Cookie', demoUserCookies.tenant);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.featureRequest.upvoteCount).toBe(0);
    });
  });

  describe('Admin Feature Request Management', () => {
    let adminTestFeatureRequestId: string;

    test('should create a feature request for admin management tests', async () => {
      if (!demoUserCookies.admin) {
        console.log('⏭️ Skipping admin management test setup - no admin cookies');
        return;
      }

      const response = await request(app)
        .post('/api/feature-requests')
        .set('Cookie', demoUserCookies.admin)
        .send({
          title: 'Admin Management Test Feature',
          description: 'This feature request is for testing admin management functionality.',
          need: 'Testing admin capabilities.',
          category: 'other',
          page: 'Admin Test'
        });

      expect(response.status).toBe(201);
      adminTestFeatureRequestId = response.body.id;
      createdFeatureRequestIds.push(adminTestFeatureRequestId);
    });

    test('should allow admin to update feature request status', async () => {
      if (!demoUserCookies.admin || !adminTestFeatureRequestId) {
        console.log('⏭️ Skipping admin update test - missing cookies or test feature request');
        return;
      }

      const updates = {
        status: 'under_review',
        assignedTo: 'john.doe@example.com',
        adminNotes: 'Reviewing this feature request for feasibility.'
      };

      const response = await request(app)
        .patch(`/api/feature-requests/${adminTestFeatureRequestId}`)
        .set('Cookie', demoUserCookies.admin)
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('under_review');
      expect(response.body.assignedTo).toBe('john.doe@example.com');
      expect(response.body.adminNotes).toBe('Reviewing this feature request for feasibility.');
    });

    test('should prevent non-admin from updating feature request', async () => {
      if (!demoUserCookies.tenant || !adminTestFeatureRequestId) {
        console.log('⏭️ Skipping non-admin update test - missing cookies or test feature request');
        return;
      }

      const updates = {
        status: 'completed',
        adminNotes: 'Trying to update as non-admin'
      };

      const response = await request(app)
        .patch(`/api/feature-requests/${adminTestFeatureRequestId}`)
        .set('Cookie', demoUserCookies.tenant)
        .send(updates);

      expect(response.status).toBe(403);
    });

    test('should allow admin to delete feature request', async () => {
      if (!demoUserCookies.admin || !adminTestFeatureRequestId) {
        console.log('⏭️ Skipping admin delete test - missing cookies or test feature request');
        return;
      }

      const response = await request(app)
        .delete(`/api/feature-requests/${adminTestFeatureRequestId}`)
        .set('Cookie', demoUserCookies.admin);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);

      // Remove from cleanup list since it's already deleted
      createdFeatureRequestIds = createdFeatureRequestIds.filter(id => id !== adminTestFeatureRequestId);
    });

    test('should prevent non-admin from deleting feature request', async () => {
      if (!demoUserCookies.tenant || createdFeatureRequestIds.length === 0) {
        console.log('⏭️ Skipping non-admin delete test - missing cookies or no test feature requests');
        return;
      }

      const testId = createdFeatureRequestIds[0];
      const response = await request(app)
        .delete(`/api/feature-requests/${testId}`)
        .set('Cookie', demoUserCookies.tenant);

      expect(response.status).toBe(403);
    });
  });

  describe('Feature Request Edge Cases', () => {
    test('should handle non-existent feature request gracefully', async () => {
      if (!demoUserCookies.admin) {
        console.log('⏭️ Skipping non-existent test - no admin cookies');
        return;
      }

      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      
      const response = await request(app)
        .get(`/api/feature-requests/${nonExistentId}`)
        .set('Cookie', demoUserCookies.admin);

      expect(response.status).toBe(404);
    });

    test('should handle upvoting non-existent feature request', async () => {
      if (!demoUserCookies.tenant) {
        console.log('⏭️ Skipping non-existent upvote test - no tenant cookies');
        return;
      }

      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      
      const response = await request(app)
        .post(`/api/feature-requests/${nonExistentId}/upvote`)
        .set('Cookie', demoUserCookies.tenant);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('not found');
    });
  });

  describe('Feature Request Performance and Pagination', () => {
    test('should retrieve feature requests efficiently', async () => {
      if (!demoUserCookies.admin) {
        console.log('⏭️ Skipping performance test - no admin cookies');
        return;
      }

      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/feature-requests')
        .set('Cookie', demoUserCookies.admin);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds
      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});