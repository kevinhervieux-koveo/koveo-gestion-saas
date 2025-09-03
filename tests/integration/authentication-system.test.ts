import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { db } from '../../server/db';
import { users } from '../../shared/schema';
import { eq, count } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';

/**
 * Authentication System Integration Test
 * 
 * This test ensures the authentication system works end-to-end and catches
 * critical issues like:
 * - Missing users in database  
 * - Login endpoint failures
 * - Session management problems
 * - Demo user accessibility issues
 */

describe('Authentication System', () => {
  const testUser = {
    username: 'isolated-auth-test',
    email: 'isolated-auth-test@test-only.com',
    password: 'test123',
    firstName: 'Isolated',
    lastName: 'AuthTest',
    role: 'manager' as const,
    language: 'en',
    isActive: true
  };

  beforeAll(async () => {
    // Clean up any existing test user
    await db.delete(users).where(eq(users.email, testUser.email));
    
    // Create test user with proper bcrypt hash
    const hashedPassword = await bcrypt.hash(testUser.password, 10);
    
    await db.insert(users).values({
      username: testUser.username,
      email: testUser.email,
      password: hashedPassword,
      firstName: testUser.firstName,
      lastName: testUser.lastName,
      role: testUser.role,
      language: testUser.language,
      isActive: testUser.isActive
    });
  });

  afterAll(async () => {
    // Clean up test user
    await db.delete(users).where(eq(users.email, testUser.email));
  });

  describe('Database User Existence', () => {
    it('should have at least one active user in the database', async () => {
      const userCount = await db
        .select({ count: count() })
        .from(users)
        .where(eq(users.isActive, true))
        .then(result => result[0]?.count || 0);

      expect(userCount).toBeGreaterThan(0);
    });

    it('should find created test user in database', async () => {
      const user = await db
        .select()
        .from(users)
        .where(eq(users.email, testUser.email))
        .then(results => results[0]);

      expect(user).toBeDefined();
      expect(user.email).toBe(testUser.email);
      expect(user.isActive).toBe(true);
      expect(user.role).toBe(testUser.role);
    });
  });

  describe('Authentication Endpoints', () => {
    it('should reject login with invalid credentials', async () => {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: testUser.email,
          password: 'wrongpassword'
        })
      });

      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data.code).toBe('INVALID_CREDENTIALS');
    });

    it('should accept login with valid credentials', async () => {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: testUser.email,
          password: testUser.password
        })
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.message).toBe('Login successful');
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(testUser.email);
      expect(data.user.password).toBeUndefined(); // Password should not be returned
    });

    it('should handle missing credentials', async () => {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: testUser.email
          // Missing password
        })
      });

      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.code).toBe('MISSING_CREDENTIALS');
    });

    it('should return 401 for user endpoint without authentication', async () => {
      const response = await fetch('http://localhost:5000/api/auth/user');

      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data.code).toBe('NOT_AUTHENTICATED');
    });
  });

  describe('Demo User Issues', () => {
    it('should not have any demo users in database', async () => {
      const demoUsers = await db
        .select()
        .from(users)
        .where(eq(users.email, 'demo@koveo.com'));

      expect(demoUsers).toHaveLength(0);
    });

    it('should fail login for non-existent demo users', async () => {
      const demoEmails = [
        'demo@koveo.com',
        'marc.gauthier@demo.com', 
        'sophie.tremblay@demo.com'
      ];

      for (const email of demoEmails) {
        const response = await fetch('http://localhost:5000/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email,
            password: 'demo123'
          })
        });

        expect(response.status).toBe(401);
        
        const data = await response.json();
        expect(data.code).toBe('INVALID_CREDENTIALS');
      }
    });
  });

  describe('Password Security', () => {
    it('should properly hash passwords', async () => {
      const user = await db
        .select()
        .from(users)
        .where(eq(users.email, testUser.email))
        .then(results => results[0]);

      expect(user.password).toBeDefined();
      expect(user.password).not.toBe(testUser.password); // Should be hashed
      expect(user.password.startsWith('$2')).toBe(true); // bcrypt hash format
    });

    it('should verify password correctly', async () => {
      const user = await db
        .select()
        .from(users)
        .where(eq(users.email, testUser.email))
        .then(results => results[0]);

      const isValid = await bcrypt.compare(testUser.password, user.password);
      expect(isValid).toBe(true);

      const isInvalid = await bcrypt.compare('wrongpassword', user.password);
      expect(isInvalid).toBe(false);
    });
  });

  describe('Critical Authentication Issues', () => {
    it('should detect if no users exist in system', async () => {
      const totalUsers = await db
        .select({ count: count() })
        .from(users)
        .then(result => result[0]?.count || 0);

      // This test will fail if the database has no users, alerting us to the issue
      expect(totalUsers).toBeGreaterThan(0);
      
      if (totalUsers === 0) {
        throw new Error('CRITICAL: No users found in database. Authentication system unusable.');
      }
    });

    it('should ensure authentication endpoints are accessible', async () => {
      // Test that endpoints exist and respond (not 404)
      const endpoints = [
        'http://localhost:5000/api/auth/login',
        'http://localhost:5000/api/auth/user'
      ];

      for (const endpoint of endpoints) {
        const response = await fetch(endpoint, {
          method: endpoint.includes('login') ? 'POST' : 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          ...(endpoint.includes('login') && {
            body: JSON.stringify({ email: 'test', password: 'test' })
          })
        });

        // Should not return 404 (endpoint exists)
        expect(response.status).not.toBe(404);
        
        // Should return JSON response (API working)
        const contentType = response.headers.get('content-type');
        expect(contentType).toContain('application/json');
      }
    });
  });
});