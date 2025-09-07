/**
 * Critical Session Persistence Tests
 * 
 * Tests for session loss scenarios that affect both development and production environments.
 * Detects issues with session storage, cookie management, and auth state persistence.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import '../setup';
import { storage } from '../../server/storage';
import { hashPassword, sessionConfig, setupAuthRoutes } from '../../server/auth';

describe('Session Persistence Critical Tests', () => {
  let app: any;
  let testUser: any;
  let sessionCookie: string;

  beforeEach(async () => {
    // Create test Express app with session management
    app = express();
    app.use(express.json());
    app.use(sessionConfig);
    setupAuthRoutes(app);
    
    // Create test user
    testUser = {
      email: 'test-session@koveo-gestion.com',
      password: await hashPassword('TestPassword123!'),
      firstName: 'Session',
      lastName: 'Test',
      username: 'sessiontest',
      role: 'admin' as const,
      isActive: true,
    };

    const createdUser = await storage.createUser(testUser);
    testUser.id = createdUser.id;
  });

  afterEach(async () => {
    // Clean up test user
    if (testUser?.id) {
      try {
        await storage.deleteUser(testUser.id);
      } catch (error) {
        // User might already be deleted
      }
    }
  });

  describe('Session Loss Detection', () => {
    it('should maintain session after login and user check', async () => {
      // Step 1: Login and capture session cookie
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'TestPassword123!',
        })
        .expect(200);

      expect(loginResponse.body.user).toBeDefined();
      expect(loginResponse.body.user.id).toBe(testUser.id);

      // Extract session cookie
      const cookies = loginResponse.headers['set-cookie'];
      expect(cookies).toBeDefined();
      sessionCookie = cookies.find((cookie: string) => cookie.startsWith('koveo.sid='));
      expect(sessionCookie).toBeDefined();

      // Step 2: Use session cookie to check user auth (should work)
      const userCheckResponse = await request(app)
        .get('/api/auth/user')
        .set('Cookie', sessionCookie)
        .expect(200);

      expect(userCheckResponse.body.id).toBe(testUser.id);
      expect(userCheckResponse.body.email).toBe(testUser.email);
      expect(userCheckResponse.body.firstName).toBe('Session');
      expect(userCheckResponse.body.lastName).toBe('Test');

      // Step 3: Make another request to ensure session persists
      const secondCheckResponse = await request(app)
        .get('/api/auth/user')
        .set('Cookie', sessionCookie)
        .expect(200);

      expect(secondCheckResponse.body.id).toBe(testUser.id);
      expect(secondCheckResponse.body.email).toBe(testUser.email);
    });

    it('should detect session loss after multiple requests', async () => {
      // Login first
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'TestPassword123!',
        })
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'];
      sessionCookie = cookies.find((cookie: string) => cookie.startsWith('koveo.sid='));

      // Make multiple requests to simulate session usage
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .get('/api/auth/user')
          .set('Cookie', sessionCookie);

        // Should maintain auth across all requests
        expect(response.status).toBe(200);
        expect(response.body.id).toBe(testUser.id);
        expect(response.body.firstName).toBe('Session');
        expect(response.body.lastName).toBe('Test');
        
        // Session should return defined user data, not "undefined undefined"
        expect(response.body.firstName).not.toBe('undefined');
        expect(response.body.lastName).not.toBe('undefined');
        expect(response.body.email).not.toBe('undefined');
      }
    });

    it('should handle session store connection issues gracefully', async () => {
      // Login successfully
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'TestPassword123!',
        })
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'];
      sessionCookie = cookies.find((cookie: string) => cookie.startsWith('koveo.sid='));

      // Verify session works
      await request(app)
        .get('/api/auth/user')
        .set('Cookie', sessionCookie)
        .expect(200);

      // Test session persistence under load
      const requests = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .get('/api/auth/user')
          .set('Cookie', sessionCookie)
      );

      const responses = await Promise.all(requests);
      
      // All requests should succeed
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.id).toBe(testUser.id);
        expect(response.body.firstName).toBe('Session');
        expect(response.body.lastName).toBe('Test');
      });
    });

    it('should properly handle session refresh and extension', async () => {
      // Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'TestPassword123!',
        })
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'];
      sessionCookie = cookies.find((cookie: string) => cookie.startsWith('koveo.sid='));

      // Simulate multiple API calls that should extend session
      const initialCheck = await request(app)
        .get('/api/auth/user')
        .set('Cookie', sessionCookie)
        .expect(200);

      // Wait a moment and make another request (simulates user activity)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const extendedCheck = await request(app)
        .get('/api/auth/user')
        .set('Cookie', sessionCookie)
        .expect(200);

      // Both should return valid user data
      expect(initialCheck.body.id).toBe(testUser.id);
      expect(extendedCheck.body.id).toBe(testUser.id);
      expect(extendedCheck.body.firstName).toBe('Session');
      expect(extendedCheck.body.lastName).toBe('Test');
    });

    it('should detect undefined user data patterns', async () => {
      // Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'TestPassword123!',
        })
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'];
      sessionCookie = cookies.find((cookie: string) => cookie.startsWith('koveo.sid='));

      // Check user data structure
      const userResponse = await request(app)
        .get('/api/auth/user')
        .set('Cookie', sessionCookie)
        .expect(200);

      const user = userResponse.body;

      // Ensure no undefined values that cause "undefined undefined" display
      expect(user.firstName).toBeDefined();
      expect(user.firstName).not.toBe('undefined');
      expect(user.firstName).not.toBe(null);
      expect(typeof user.firstName).toBe('string');
      expect(user.firstName.length).toBeGreaterThan(0);

      expect(user.lastName).toBeDefined();
      expect(user.lastName).not.toBe('undefined');
      expect(user.lastName).not.toBe(null);
      expect(typeof user.lastName).toBe('string');
      expect(user.lastName.length).toBeGreaterThan(0);

      expect(user.email).toBeDefined();
      expect(user.email).not.toBe('undefined');
      expect(user.email).toBe(testUser.email);

      expect(user.role).toBeDefined();
      expect(user.role).not.toBe('undefined');
      expect(user.role).toBe('admin');

      // Verify the complete user object structure
      expect(user).toMatchObject({
        id: expect.any(String),
        firstName: expect.any(String),
        lastName: expect.any(String),
        email: expect.any(String),
        role: expect.any(String),
        isActive: expect.any(Boolean),
      });
    });
  });

  describe('Session Cookie Management', () => {
    it('should set proper cookie attributes for session persistence', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'TestPassword123!',
        })
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'];
      const sessionCookie = cookies.find((cookie: string) => cookie.startsWith('koveo.sid='));
      
      expect(sessionCookie).toBeDefined();
      
      // Check cookie attributes for proper session management
      expect(sessionCookie).toMatch(/HttpOnly/i);
      expect(sessionCookie).toMatch(/Path=\//);
      
      // Should have a reasonable max age (7 days = 604800 seconds)
      expect(sessionCookie).toMatch(/Max-Age=\d+/);
    });

    it('should handle logout and clear session properly', async () => {
      // Login first
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'TestPassword123!',
        })
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'];
      sessionCookie = cookies.find((cookie: string) => cookie.startsWith('koveo.sid='));

      // Verify session works
      await request(app)
        .get('/api/auth/user')
        .set('Cookie', sessionCookie)
        .expect(200);

      // Logout
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', sessionCookie)
        .expect(200);

      // Verify session is cleared
      await request(app)
        .get('/api/auth/user')
        .set('Cookie', sessionCookie)
        .expect(401);
    });
  });

  describe('Production Environment Simulation', () => {
    it('should work with production-like cookie settings', async () => {
      // This test simulates production environment cookie behavior
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'TestPassword123!',
          })
          .expect(200);

        const cookies = loginResponse.headers['set-cookie'];
        sessionCookie = cookies.find((cookie: string) => cookie.startsWith('koveo.sid='));

        // Should still work with production cookie settings
        const userResponse = await request(app)
          .get('/api/auth/user')
          .set('Cookie', sessionCookie)
          .expect(200);

        expect(userResponse.body.id).toBe(testUser.id);
        expect(userResponse.body.firstName).toBe('Session');
        expect(userResponse.body.lastName).toBe('Test');
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });
  });
});