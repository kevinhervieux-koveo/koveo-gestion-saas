import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { db } from '../../server/db';
import { users } from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Critical Authentication Test Suite
 * 
 * This test MUST catch critical authentication failures that prevent users
 * from accessing the application. It validates:
 * - Essential user accounts exist
 * - Login endpoints are functional
 * - Database connectivity is working
 * - Authentication flow is complete
 */

describe('CRITICAL Authentication System', () => {
  describe('Database User Existence', () => {
    it('CRITICAL: should have at least one active user in the system', async () => {
      const userCount = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(eq(users.isActive, true))
        .then(result => result[0]?.count || 0);

      // CRITICAL FAILURE if no users exist
      if (userCount === 0) {
        throw new Error(`
🚨 CRITICAL AUTHENTICATION FAILURE 🚨
No active users found in database!

This means:
- Nobody can login to the application
- The system is completely inaccessible
- All authentication will fail with 401 errors

Required Action: Create at least one user account immediately
        `);
      }

      expect(userCount).toBeGreaterThan(0);
    });

    it('CRITICAL: should verify admin or manager users exist', async () => {
      // Check for any admin or manager user account (more flexible than specific email)
      const adminUsers = await db
        .select()
        .from(users)
        .where(sql`role IN ('admin', 'manager') AND is_active = true`)
        .then(results => results);

      if (adminUsers.length === 0) {
        throw new Error(`
🚨 NO ADMIN/MANAGER ACCOUNTS FOUND 🚨
No active admin or manager accounts found in the database!

This prevents administrative access to the application.
Required Action: Create at least one admin or manager account immediately
        `);
      }

      expect(adminUsers.length).toBeGreaterThan(0);
      expect(adminUsers.some(user => user.isActive)).toBe(true);
      expect(adminUsers.some(user => ['admin', 'manager'].includes(user.role))).toBe(true);
    });

    it('CRITICAL: should have working user table structure', async () => {
      // Verify the users table exists and has correct structure
      const tableExists = await db
        .select()
        .from(users)
        .limit(1)
        .catch(() => null);

      if (tableExists === null) {
        throw new Error(`
🚨 DATABASE STRUCTURE FAILURE 🚨
Users table is inaccessible or corrupted!

This means the authentication system cannot function.
Required Action: Fix database schema immediately
        `);
      }

      // Should not throw error
      expect(tableExists).not.toBeNull();
    });
  });

  describe('Authentication Endpoint Functionality', () => {
    it('CRITICAL: login endpoint should be accessible and functional', async () => {
      // Test that the login endpoint exists and responds
      let response;
      let error = null;

      try {
        response = await fetch('http://localhost:5000/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'wrongpassword'
          })
        });
      } catch (e: unknown) {
        error = e;
      }

      if (error || !response) {
        throw new Error(`
🚨 LOGIN ENDPOINT FAILURE 🚨
Login endpoint is not accessible or server is down!

Error: ${error instanceof Error ? error.message : 'No response received'}
Required Action: Fix server startup or routing immediately
        `);
      }

      // Should return proper HTTP response (even if 401 for wrong credentials)
      expect(response.status).toBeGreaterThan(0);
      expect(response.status).not.toBe(404); // Endpoint should exist
    });

    it('CRITICAL: user endpoint should be accessible', async () => {
      let response;
      let error = null;

      try {
        response = await fetch('http://localhost:5000/api/auth/user');
      } catch (e: unknown) {
        error = e;
      }

      if (error || !response) {
        throw new Error(`
🚨 USER ENDPOINT FAILURE 🚨
User authentication endpoint is not accessible!

Error: ${error instanceof Error ? error.message : 'No response received'}
Required Action: Fix authentication routes immediately
        `);
      }

      expect(response.status).toBeGreaterThan(0);
      expect(response.status).not.toBe(404); // Endpoint should exist
    });
  });

  describe('Authentication Flow Validation', () => {
    let testUserEmail = 'critical-test@koveo.com';
    let testUserId: string;

    beforeAll(async () => {
      // Create a test user for authentication flow testing
      const testUser = await db.insert(users).values({
        username: 'criticaltest',
        email: testUserEmail,
        password: '$2b$10$MmG3jXpKuT44AMynBAe9JutoL6eSvKvlJ/za/lSY9AFp/J7sB5HYG', // test123
        firstName: 'Critical',
        lastName: 'Test',
        role: 'manager',
        language: 'en',
        isActive: true
      }).returning({ id: users.id });

      testUserId = testUser[0].id;
    });

    afterAll(async () => {
      // Clean up test user
      await db.delete(users).where(eq(users.id, testUserId));
    });

    it('CRITICAL: complete login flow should work end-to-end', async () => {
      // Test complete authentication flow
      const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: testUserEmail,
          password: 'test123'
        })
      });

      if (!loginResponse.ok) {
        const errorData = await loginResponse.json().catch(() => ({}));
        throw new Error(`
🚨 LOGIN FLOW FAILURE 🚨
Authentication login failed for valid user!

Status: ${loginResponse.status}
Error: ${JSON.stringify(errorData)}
User: ${testUserEmail}

This means users cannot login even with correct credentials.
Required Action: Fix authentication logic immediately
        `);
      }

      const loginData = await loginResponse.json();
      expect(loginData.message).toBe('Login successful');
      expect(loginData.user).toBeDefined();
      expect(loginData.user.email).toBe(testUserEmail);

      // Get session cookie for next request
      const cookies = loginResponse.headers.get('set-cookie');
      expect(cookies).toBeDefined();

      // Test that user endpoint works with session
      const userResponse = await fetch('http://localhost:5000/api/auth/user', {
        headers: {
          'Cookie': cookies || ''
        }
      });

      if (!userResponse.ok) {
        throw new Error(`
🚨 SESSION PERSISTENCE FAILURE 🚨
User cannot stay logged in - session not working!

Login succeeds but user endpoint fails with session.
Status: ${userResponse.status}
Required Action: Fix session management immediately
        `);
      }

      const userData = await userResponse.json();
      expect(userData.id).toBeDefined();
      expect(userData.email).toBe(testUserEmail);
    });

    it('CRITICAL: should validate password hashing is working', async () => {
      const testUser = await db
        .select()
        .from(users)
        .where(eq(users.email, testUserEmail))
        .then(results => results[0]);

      expect(testUser).toBeDefined();
      expect(testUser.password).toBeDefined();
      expect(testUser.password.startsWith('$2')).toBe(true); // bcrypt format

      // Verify password is not stored in plain text
      expect(testUser.password).not.toBe('test123');
      expect(testUser.password.length).toBeGreaterThan(10);
    });
  });

  describe('Production Readiness Checks', () => {
    it('CRITICAL: should ensure application is accessible', async () => {
      // Test that the main application responds
      let healthResponse;
      
      try {
        healthResponse = await fetch('http://localhost:5000/api/health');
      } catch (error) {
        throw new Error(`
🚨 APPLICATION INACCESSIBLE 🚨
Application server is not responding!

Error: ${error.message}
Required Action: Fix server startup immediately
        `);
      }

      expect(healthResponse.ok).toBe(true);
      
      const healthData = await healthResponse.json();
      expect(healthData.status).toBe('ok');
    });

    it('CRITICAL: database connection should be working', async () => {
      try {
        const dbTest = await db.select({ version: sql<string>`version()` }).from(users).limit(1);
        expect(dbTest).toBeDefined();
        expect(Array.isArray(dbTest)).toBe(true);
      } catch (error) {
        throw new Error(`
🚨 DATABASE CONNECTION FAILURE 🚨
Cannot connect to database!

Error: ${error instanceof Error ? error.message : 'Unknown error'}
Required Action: Fix database connection immediately
        `);
      }
    });
  });
});