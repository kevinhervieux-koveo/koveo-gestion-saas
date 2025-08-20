/**
 * @file SQL Injection Security Tests.
 * @description Comprehensive tests to verify the application is protected against SQL injection attacks.
 * These tests target API endpoints, authentication, search functionality, and data access controls.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../../server/routes-minimal';
import { db } from '../../server/db';
import * as schema from '../../shared/schema';
import { eq } from 'drizzle-orm';

// SQL Injection attack payloads for testing
const SQL_INJECTION_PAYLOADS = {
  // Basic SQL injection attempts
  basic: [
    "'; DROP TABLE users; --",
    "' OR '1'='1",
    "' OR 1=1 --",
    "admin'--",
    "admin'/*",
    "' OR 'x'='x",
    "') OR ('1'='1",
    "' UNION SELECT NULL--",
  ],

  // Authentication bypass attempts
  auth: [
    "admin' OR '1'='1' --",
    "' OR 'a'='a",
    "') OR ('1'='1') --",
    "' OR 1=1#",
    "' OR 1=1/*",
    "admin'/**/OR/**/1=1/**/--",
    "' UNION SELECT 1,'admin','password' --",
  ],

  // Data extraction attempts
  extraction: [
    "' UNION SELECT username, password FROM users --",
    "' UNION SELECT table_name FROM information_schema.tables --",
    "' UNION SELECT column_name FROM information_schema.columns --",
    "'; SELECT * FROM users WHERE id=1 --",
    "' AND (SELECT COUNT(*) FROM users) > 0 --",
  ],

  // Time-based blind injection
  timeBased: [
    "'; WAITFOR DELAY '00:00:05' --",
    "' AND (SELECT COUNT(*) FROM pg_sleep(5)) > 0 --",
    "' OR (SELECT pg_sleep(5)) --",
    "'; SELECT pg_sleep(10) --",
  ],

  // Boolean-based blind injection
  booleanBased: [
    "' AND (SELECT SUBSTR(current_database(),1,1))='a' --",
    "' AND (SELECT LENGTH(current_database()))=10 --",
    "' AND (SELECT COUNT(*) FROM users) > 5 --",
    "' AND EXISTS(SELECT 1 FROM users WHERE id=1) --",
  ],

  // Second-order injection (stored payload)
  secondOrder: [
    "test'; INSERT INTO users (email) VALUES ('injected@test.com'); --",
    "'; UPDATE users SET role='admin' WHERE id=1; --",
  ],
};

describe('SQL Injection Security Tests', () => {
  let app: express.Application;
  let testUserId: string;
  let authToken: string;

  beforeAll(async () => {
    // Setup test application
    app = express();
    app.use(express.json());
    await registerRoutes(app);

    // Create a test user for authentication
    try {
      const [testUser] = await db.insert(schema.users).values({
        username: 'sqltest',
        email: 'sqltest@test.com',
        password: 'hashed_password',
        firstName: 'SQL',
        lastName: 'Test',
        role: 'tenant',
      }).returning({ id: schema.users.id });
      
      testUserId = testUser.id;
    } catch (error) {
      console.log('Test user may already exist, continuing...');
    }
  });

  afterAll(async () => {
    // Cleanup test data
    try {
      if (testUserId) {
        await db.delete(schema.users).where(eq(schema.users.id, testUserId));
      }
    } catch (error) {
      console.log('Cleanup error:', error);
    }
  });

  beforeEach(() => {
    // Reset any mocks
    jest.clearAllMocks();
  });

  describe('Authentication Endpoint SQL Injection Tests', () => {
    it.each(SQL_INJECTION_PAYLOADS.auth)('should prevent SQL injection in login email field: %s', async (payload) => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: payload,
          password: 'anypassword'
        });

      // Should not return successful authentication
      expect(response.status).not.toBe(200);
      // Should not reveal database errors
      expect(response.body.message).not.toMatch(/sql|database|error|syntax/i);
      // Should handle gracefully with proper error message
      expect([400, 401, 422]).toContain(response.status);
    });

    it.each(SQL_INJECTION_PAYLOADS.auth)('should prevent SQL injection in login password field: %s', async (payload) => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'sqltest@test.com',
          password: payload
        });

      expect(response.status).not.toBe(200);
      expect(response.body.message).not.toMatch(/sql|database|error|syntax/i);
      expect([400, 401, 422]).toContain(response.status);
    });

    it.each(SQL_INJECTION_PAYLOADS.basic)('should prevent SQL injection in registration email: %s', async (payload) => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: payload,
          password: 'ValidPassword123!',
          firstName: 'Test',
          lastName: 'User',
          phone: '5555551234',
          language: 'en'
        });

      // Should fail validation or return proper error
      expect(response.status).not.toBe(200);
      expect(response.body.message).not.toMatch(/sql|database|error|syntax|constraint/i);
    });
  });

  describe('User Management SQL Injection Tests', () => {
    it.each(SQL_INJECTION_PAYLOADS.basic)('should prevent SQL injection in user search: %s', async (payload) => {
      const response = await request(app)
        .get('/api/users')
        .query({ search: payload })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBeOneOf([200, 400, 401, 403]);
      if (response.status === 200) {
        expect(Array.isArray(response.body)).toBe(true);
      }
      expect(response.body.message).not.toMatch(/sql|database|error|syntax/i);
    });

    it.each(SQL_INJECTION_PAYLOADS.extraction)('should prevent data extraction via user filters: %s', async (payload) => {
      const response = await request(app)
        .get('/api/users')
        .query({ role: payload })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBeOneOf([200, 400, 401, 403]);
      if (response.status === 200) {
        // Should not return unauthorized data or reveal schema
        expect(response.body).not.toContain('information_schema');
        expect(response.body).not.toContain('pg_catalog');
      }
    });
  });

  describe('Organization and Building SQL Injection Tests', () => {
    it.each(SQL_INJECTION_PAYLOADS.basic)('should prevent SQL injection in organization ID parameter: %s', async (payload) => {
      const response = await request(app)
        .get(`/api/organizations/${encodeURIComponent(payload)}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBeOneOf([400, 401, 403, 404]);
      expect(response.body.message).not.toMatch(/sql|database|error|syntax/i);
    });

    it.each(SQL_INJECTION_PAYLOADS.basic)('should prevent SQL injection in building search filters: %s', async (payload) => {
      const response = await request(app)
        .get('/api/buildings')
        .query({ 
          organizationId: payload,
          search: payload,
          buildingType: payload
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBeOneOf([200, 400, 401, 403]);
      if (response.status === 200) {
        expect(Array.isArray(response.body)).toBe(true);
      }
    });
  });

  describe('Invitation System SQL Injection Tests', () => {
    it.each(SQL_INJECTION_PAYLOADS.basic)('should prevent SQL injection in invitation email: %s', async (payload) => {
      const response = await request(app)
        .post('/api/invitations')
        .send({
          email: payload,
          role: 'tenant',
          organizationId: 'valid-org-id',
          personalMessage: 'Test invitation'
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).not.toBe(201);
      expect(response.body.message).not.toMatch(/sql|database|error|syntax/i);
    });

    it.each(SQL_INJECTION_PAYLOADS.basic)('should prevent SQL injection in invitation token validation: %s', async (payload) => {
      const response = await request(app)
        .post('/api/invitations/validate')
        .send({ token: payload });

      expect(response.status).toBeOneOf([400, 404, 410]);
      expect(response.body.isValid).toBe(false);
      expect(response.body.message).not.toMatch(/sql|database|error|syntax/i);
    });
  });

  describe('Suggestions and Quality Metrics SQL Injection Tests', () => {
    it.each(SQL_INJECTION_PAYLOADS.basic)('should prevent SQL injection in suggestions endpoint: %s', async (payload) => {
      const response = await request(app)
        .get('/api/pillars/suggestions')
        .query({ category: payload, priority: payload })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBeOneOf([200, 400, 401, 403]);
      if (response.status === 200) {
        expect(Array.isArray(response.body)).toBe(true);
      }
    });

    it.each(SQL_INJECTION_PAYLOADS.basic)('should prevent SQL injection in suggestion actions: %s', async (payload) => {
      const response = await request(app)
        .post(`/api/pillars/suggestions/${encodeURIComponent(payload)}/acknowledge`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBeOneOf([400, 401, 403, 404]);
      expect(response.body.message).not.toMatch(/sql|database|error|syntax/i);
    });
  });

  describe('Time-Based SQL Injection Tests', () => {
    it.each(SQL_INJECTION_PAYLOADS.timeBased)('should prevent time-based SQL injection: %s', async (payload) => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: payload,
          password: 'password'
        });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should not cause significant delay (> 3 seconds)
      expect(duration).toBeLessThan(3000);
      expect(response.status).not.toBe(200);
      expect(response.body.message).not.toMatch(/sql|database|error|syntax/i);
    });
  });

  describe('Boolean-Based Blind SQL Injection Tests', () => {
    it.each(SQL_INJECTION_PAYLOADS.booleanBased)('should prevent boolean-based blind SQL injection: %s', async (payload) => {
      const response1 = await request(app)
        .get('/api/users')
        .query({ search: payload })
        .set('Authorization', `Bearer ${authToken}`);

      const response2 = await request(app)
        .get('/api/users')
        .query({ search: payload.replace('=', '!=') })
        .set('Authorization', `Bearer ${authToken}`);

      // Responses should be consistent and not reveal information through different behaviors
      expect(response1.status).toBe(response2.status);
      
      if (response1.status === 200 && response2.status === 200) {
        // Should not leak information through different response patterns
        expect(typeof response1.body).toBe(typeof response2.body);
      }
    });
  });

  describe('Second-Order SQL Injection Tests', () => {
    it.each(SQL_INJECTION_PAYLOADS.secondOrder)('should prevent second-order SQL injection via user input: %s', async (payload) => {
      // First, try to store malicious payload
      const storeResponse = await request(app)
        .post('/api/invitations')
        .send({
          email: 'test@example.com',
          role: 'tenant',
          organizationId: 'valid-org-id',
          personalMessage: payload
        })
        .set('Authorization', `Bearer ${authToken}`);

      // Then try to trigger it by retrieving data
      const retrieveResponse = await request(app)
        .get('/api/invitations')
        .set('Authorization', `Bearer ${authToken}`);

      // Should not execute the stored payload
      expect(retrieveResponse.status).toBeOneOf([200, 401, 403]);
      if (retrieveResponse.status === 200) {
        expect(Array.isArray(retrieveResponse.body)).toBe(true);
      }
    });
  });

  describe('Error Message Information Disclosure Tests', () => {
    it('should not expose database structure in error messages', async () => {
      const maliciousPayloads = [
        "'; SELECT version(); --",
        "' AND (SELECT COUNT(*) FROM information_schema.tables) > 0 --",
        "' UNION SELECT table_name FROM information_schema.tables --"
      ];

      for (const payload of maliciousPayloads) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: payload,
            password: 'password'
          });

        // Should not expose sensitive information
        expect(response.body.message).not.toMatch(/PostgreSQL|pg_|information_schema|table|column|constraint/i);
        expect(response.body.message).not.toMatch(/syntax error|parse error|database error/i);
        expect(response.body).not.toHaveProperty('stack');
        expect(response.body).not.toHaveProperty('query');
      }
    });

    it('should provide generic error messages for database-related failures', async () => {
      const response = await request(app)
        .get('/api/organizations/invalid-uuid-format-test')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBeOneOf([400, 404]);
      expect(response.body.message).toMatch(/not found|invalid|bad request/i);
      expect(response.body.message).not.toMatch(/uuid|constraint|foreign key|syntax/i);
    });
  });

  describe('Parameter Validation Tests', () => {
    it('should validate UUIDs and reject malformed input', async () => {
      const invalidUUIDs = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "not-a-uuid",
        "12345",
        "",
        null,
        undefined
      ];

      for (const invalidUUID of invalidUUIDs) {
        const response = await request(app)
          .get(`/api/organizations/${invalidUUID}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBeOneOf([400, 404]);
        expect(response.body.message).not.toMatch(/sql|database|error|syntax/i);
      }
    });

    it('should validate email format and reject SQL injection attempts', async () => {
      const invalidEmails = [
        "test'; DROP TABLE users; --@example.com",
        "test@example.com'; UPDATE users SET role='admin' WHERE id=1; --",
        "test@' OR '1'='1'.com",
      ];

      for (const invalidEmail of invalidEmails) {
        const response = await request(app)
          .post('/api/invitations')
          .send({
            email: invalidEmail,
            role: 'tenant',
            organizationId: 'valid-org-id'
          })
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).not.toBe(201);
        expect(response.body.message).not.toMatch(/sql|database|error|syntax/i);
      }
    });
  });

  describe('Query Scoping Security Tests', () => {
    it('should maintain proper access controls despite injection attempts', async () => {
      const maliciousQuery = "' UNION SELECT id, email, password FROM users --";
      
      const response = await request(app)
        .get('/api/buildings')
        .query({ search: maliciousQuery })
        .set('Authorization', `Bearer ${authToken}`);

      // Should still respect user access controls
      expect(response.status).toBeOneOf([200, 401, 403]);
      
      if (response.status === 200) {
        // Should not return user data when querying buildings
        expect(JSON.stringify(response.body)).not.toMatch(/password|email.*@.*com/);
        // Should only return building-related data
        if (response.body.length > 0) {
          expect(response.body[0]).not.toHaveProperty('password');
          expect(response.body[0]).not.toHaveProperty('email');
        }
      }
    });
  });
});

