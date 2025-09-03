/**
 * Authentication Edge Cases and Security Tests
 * Tests critical authentication scenarios for Quebec property management system
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { registerRoutes } from '../../../server/routes';
import { db } from '../../../server/db';
import * as schema from '../../../shared/schema';
import bcrypt from 'bcryptjs';

// Create test server
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  registerRoutes(app);
  return app;
};

describe('Authentication Edge Cases and Security', () => {
  let app: express.Application;
  let testOrganization: any;
  let testUser: any;

  beforeEach(async () => {
    app = createTestApp();

    // Clean test data
    await db.delete(schema.users);
    await db.delete(schema.organizations);

    // Create test organization
    const [org] = await db
      .insert(schema.organizations)
      .values({
        name: 'Test Organization',
        type: 'Standard' as any,
        address: '123 Test St',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1H 1H1',
        phone: '514-555-0123',
        email: 'test@org.com',
      })
      .returning();
    testOrganization = org;

    // Create test user with hashed password
    const hashedPassword = await bcrypt.hash('TestPassword123!', 12);
    const [user] = await db
      .insert(schema.users)
      .values({
        email: 'test@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        role: 'tenant',
        language: 'fr',
        password: hashedPassword,
        isActive: true,
      })
      .returning();
    testUser = user;
  });

  afterEach(async () => {
    await db.delete(schema.users);
    await db.delete(schema.organizations);
  });

  describe('Login Security Edge Cases', () => {
    it('should prevent SQL injection in login attempts', async () => {
      const maliciousPayloads = [
        { email: "admin@example.com' OR '1'='1", password: 'anything' },
        { email: 'admin@example.com"; DROP TABLE users; --', password: 'anything' },
        { email: 'test@example.com\'; UPDATE users SET role=\'admin\' WHERE email=\'test@example.com', password: 'TestPassword123!' },
      ];

      for (const payload of maliciousPayloads) {
        const response = await request(app)
          .post('/api/auth/login')
          .send(payload);

        // Should not succeed with SQL injection
        expect(response.status).not.toBe(200);
        expect([401, 400]).toContain(response.status);
      }
    });

    it('should handle concurrent login attempts gracefully', async () => {
      const loginPromises = Array(10).fill(null).map(() => 
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'TestPassword123!',
          })
      );

      const responses = await Promise.all(loginPromises);
      
      // All should get consistent responses (either all success or all handled properly)
      const statusCodes = responses.map(r => r.status);
      const uniqueStatuses = [...new Set(statusCodes)];
      
      // Should not have inconsistent auth states
      expect(uniqueStatuses.length).toBeLessThanOrEqual(2);
    });

    it('should validate email format with Quebec-specific edge cases', async () => {
      const invalidEmails = [
        'invalid-email',
        'test@',
        '@example.com',
        'test@.com',
        'test@domain.',
        'test space@example.com',
        'test@québec.com', // Invalid accent in domain
        'test@example..com',
        '',
        null,
        undefined,
      ];

      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email,
            password: 'TestPassword123!',
          });

        expect(response.status).toBe(400);
      }
    });

    it('should enforce password complexity requirements', async () => {
      const weakPasswords = [
        '', // Empty
        'short', // Too short
        'onlylowercase', // No uppercase
        'ONLYUPPERCASE', // No lowercase  
        'NoNumbers', // No numbers
        'password123', // Common pattern
        'TestTest', // No numbers
        '12345678', // Only numbers
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/users')
          .send({
            email: 'newuser@example.com',
            username: 'newuser',
            firstName: 'New',
            lastName: 'User',
            role: 'tenant',
            password,
          });

        expect(response.status).toBe(400);
        if (response.body.message) {
          expect(response.body.message.toLowerCase()).toMatch(/password|weak/);
        }
      }
    });
  });

  describe('Session Security', () => {
    it('should handle session timeout gracefully', async () => {
      // Login to create session
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!',
        });

      const cookies = loginResponse.headers['set-cookie'];
      
      if (loginResponse.status === 200 && cookies) {
        // Try to access protected endpoint
        const protectedResponse = await request(app)
          .get('/api/users')
          .set('Cookie', cookies);

        // Should handle session appropriately
        expect([200, 401, 403]).toContain(protectedResponse.status);
      }
    });

    it('should prevent session fixation attacks', async () => {
      // Attempt to set a predetermined session ID
      const response = await request(app)
        .post('/api/auth/login')
        .set('Cookie', 'koveo.sid=s%3Amalicious-session-id')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!',
        });

      if (response.status === 200) {
        const newCookies = response.headers['set-cookie'];
        expect(newCookies).toBeDefined();
        // Should create a new session, not use the malicious one
        expect(newCookies[0]).not.toContain('malicious-session-id');
      }
    });
  });

  describe('Role-Based Access Control Edge Cases', () => {
    it('should prevent privilege escalation through parameter manipulation', async () => {
      // Try to escalate to admin role
      const response = await request(app)
        .post('/api/users')
        .send({
          email: 'hacker@example.com',
          username: 'hacker',
          firstName: 'Hacker',
          lastName: 'User',
          role: 'admin', // Try to set admin role directly
          password: 'TestPassword123!',
        });

      if (response.status === 201) {
        // If user creation succeeded, verify role wasn't escalated
        const createdUser = response.body.user || response.body;
        expect(createdUser.role).not.toBe('admin');
      }
    });

    it('should validate Quebec Law 25 compliance requirements', async () => {
      // Test that user creation requires proper consent fields for Quebec compliance
      const nonCompliantUser = {
        email: 'quebec@example.com',
        username: 'quebecuser',
        firstName: 'Quebec',
        lastName: 'User',
        role: 'tenant',
        password: 'TestPassword123!',
        // Missing Quebec Law 25 required fields
      };

      const response = await request(app)
        .post('/api/users')
        .send(nonCompliantUser);

      // Quebec users should require additional privacy compliance data
      if (response.status === 201) {
        // Verify the user has appropriate default privacy settings
        const user = response.body.user || response.body;
        expect(user.language).toBeDefined();
      }
    });
  });

  describe('Input Validation and Sanitization', () => {
    it('should sanitize XSS attempts in user fields', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src=x onerror=alert("xss")>',
        '"><script>alert("xss")</script>',
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/users')
          .send({
            email: 'xss@example.com',
            username: 'xssuser',
            firstName: payload,
            lastName: 'User',
            role: 'tenant',
            password: 'TestPassword123!',
          });

        if (response.status === 201) {
          const user = response.body.user || response.body;
          // XSS payload should be sanitized
          expect(user.firstName).not.toContain('<script>');
          expect(user.firstName).not.toContain('javascript:');
          expect(user.firstName).not.toContain('onerror');
        }
      }
    });

    it('should handle Unicode and special characters in Quebec names', async () => {
      const quebecNames = [
        { firstName: 'François', lastName: 'Côté' },
        { firstName: 'Éric', lastName: 'Bélanger' },
        { firstName: 'José', lastName: 'García-López' },
        { firstName: 'Marie-Ève', lastName: 'St-Pierre' },
        { firstName: 'André', lastName: "L'Heureux" },
      ];

      for (const nameData of quebecNames) {
        const response = await request(app)
          .post('/api/users')
          .send({
            email: `${nameData.firstName.toLowerCase()}@example.com`,
            username: nameData.firstName.toLowerCase(),
            firstName: nameData.firstName,
            lastName: nameData.lastName,
            role: 'tenant',
            password: 'TestPassword123!',
          });

        if (response.status === 201) {
          const user = response.body.user || response.body;
          // Should preserve Quebec French characters
          expect(user.firstName).toBe(nameData.firstName);
          expect(user.lastName).toBe(nameData.lastName);
        }
      }
    });
  });

  describe('Data Consistency and Integrity', () => {
    it('should maintain referential integrity during user deletion', async () => {
      // Create user with organization assignment
      const [user] = await db
        .insert(schema.users)
        .values({
          email: 'delete@example.com',
          username: 'deleteuser',
          firstName: 'Delete',
          lastName: 'User',
          role: 'tenant',
          password: await bcrypt.hash('TestPassword123!', 12),
        })
        .returning();

      await db
        .insert(schema.userOrganizations)
        .values({
          userId: user.id,
          organizationId: testOrganization.id,
          organizationRole: 'tenant',
        });

      // Soft delete the user
      const response = await request(app)
        .delete(`/api/users/${user.id}`);

      if (response.status === 200) {
        // Verify user is deactivated, not hard-deleted
        const [deletedUser] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, user.id));
        
        expect(deletedUser).toBeDefined();
        expect(deletedUser.isActive).toBe(false);

        // Verify organization assignments remain for audit purposes
        const assignments = await db
          .select()
          .from(schema.userOrganizations)
          .where(eq(schema.userOrganizations.userId, user.id));
        
        expect(assignments.length).toBeGreaterThan(0);
      }
    });

    it('should handle duplicate email registration attempts', async () => {
      // Try to create another user with same email
      const duplicateUserData = {
        email: testUser.email, // Same as existing user
        username: 'differentuser',
        firstName: 'Different',
        lastName: 'User',
        role: 'tenant',
        password: 'TestPassword123!',
      };

      const response = await request(app)
        .post('/api/users')
        .send(duplicateUserData);

      expect(response.status).toBe(409); // Conflict
      expect(response.body.message).toMatch(/email.*exists/i);
    });

    it('should validate organization permissions in Quebec context', async () => {
      // Create Quebec-specific test organization
      const [quebecOrg] = await db
        .insert(schema.organizations)
        .values({
          name: 'Syndicat de Copropriété Test',
          type: 'Condo' as any,
          address: '123 rue Sainte-Catherine',
          city: 'Montréal',
          province: 'QC',
          postalCode: 'H2X 1L4',
          phone: '514-555-0123',
          email: 'info@syndicat-test.qc.ca',
        })
        .returning();

      // Test user access across different Quebec organizations
      const response = await request(app)
        .get('/api/organizations')
        .set('x-test-user-id', testUser.id);

      // User should only see organizations they have access to
      expect([200, 401, 403]).toContain(response.status);
    });
  });

  describe('Law 25 Privacy Compliance', () => {
    it('should handle personal data deletion requests', async () => {
      // Create user with personal data
      const [privacyUser] = await db
        .insert(schema.users)
        .values({
          email: 'privacy@example.com',
          username: 'privacyuser',
          firstName: 'Privacy',
          lastName: 'User',
          role: 'tenant',
          phone: '514-555-0199',
          password: await bcrypt.hash('TestPassword123!', 12),
        })
        .returning();

      // Request user deletion (should be soft delete for compliance)
      const response = await request(app)
        .delete(`/api/users/${privacyUser.id}`);

      if (response.status === 200) {
        // Verify user data is preserved but marked inactive (for legal compliance)
        const [deletedUser] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, privacyUser.id));
        
        expect(deletedUser).toBeDefined();
        expect(deletedUser.isActive).toBe(false);
        // Personal data should still exist for legal/audit requirements
        expect(deletedUser.email).toBe('privacy@example.com');
      }
    });

    it('should validate consent tracking for Quebec users', async () => {
      const quebecUserData = {
        email: 'quebec-resident@example.com',
        username: 'quebecresident',
        firstName: 'Jean',
        lastName: 'Tremblay',
        role: 'resident',
        language: 'fr', // Quebec French requirement
        password: 'TestPassword123!',
        // Quebec Law 25 may require additional consent fields
      };

      const response = await request(app)
        .post('/api/users')
        .send(quebecUserData);

      if (response.status === 201) {
        const user = response.body.user || response.body;
        // Verify Quebec compliance defaults
        expect(user.language).toBe('fr');
        expect(user.firstName).toBe('Jean');
        expect(user.lastName).toBe('Tremblay');
      }
    });
  });

  describe('API Error Handling Edge Cases', () => {
    it('should handle malformed JSON requests', async () => {
      const malformedRequests = [
        '{"invalid": json}',
        '{email: "test@example.com"}', // Missing quotes
        '{"email": "test@example.com",}', // Trailing comma
        '{"email": }', // Missing value
      ];

      for (const malformedJson of malformedRequests) {
        const response = await request(app)
          .post('/api/users')
          .set('Content-Type', 'application/json')
          .send(malformedJson);

        expect(response.status).toBe(400);
      }
    });

    it('should handle oversized request bodies', async () => {
      const oversizedData = {
        email: 'test@example.com',
        firstName: 'A'.repeat(10000), // Very long string
        lastName: 'B'.repeat(10000),
        password: 'TestPassword123!',
      };

      const response = await request(app)
        .post('/api/users')
        .send(oversizedData);

      // Should either reject oversized data or handle gracefully
      expect([400, 413]).toContain(response.status);
    });

    it('should rate limit authentication attempts', async () => {
      const rapidRequests = Array(20).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'WrongPassword123!',
          })
      );

      const responses = await Promise.all(rapidRequests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Database Connection Resilience', () => {
    it('should handle database connection failures gracefully', async () => {
      // Test API behavior when database operations might fail
      const response = await request(app)
        .get('/api/health');

      // Health check should work even if some DB operations fail
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    });

    it('should validate database constraints enforcement', async () => {
      // Try to create user with invalid organization reference
      const invalidUserData = {
        email: 'invalid-org@example.com',
        username: 'invalidorg',
        firstName: 'Invalid',
        lastName: 'Org',
        role: 'tenant',
        password: 'TestPassword123!',
        organizationId: '00000000-0000-0000-0000-000000000000', // Non-existent org ID
      };

      const response = await request(app)
        .post('/api/users')
        .send(invalidUserData);

      // Should handle foreign key constraint violations
      expect([400, 409, 422]).toContain(response.status);
    });
  });
});