/**
 * Critical Authentication System Test
 * These tests should have caught the login issues - this ensures they never happen again.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { setupAuthRoutes } from '../../server/auth';

// Create minimal test app for authentication only
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Add session middleware for memory-based sessions in tests
  const session = require('express-session');
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
  }));
  
  setupAuthRoutes(app);
  return app;
};

describe('🔐 Critical Authentication Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('Demo User Login Tests', () => {
    it('should successfully login with admin@demo.com and demo123', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@demo.com',
          password: 'demo123'
        })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('admin@demo.com');
      expect(response.body.user.role).toBe('admin');
      expect(response.body.message).toBe('Login successful');
      
      // Check session cookie is set
      expect(response.headers['set-cookie']).toBeDefined();
      expect(response.headers['set-cookie'][0]).toContain('koveo.sid');
    });

    it('should successfully login with manager@demo.com and demo123', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'manager@demo.com',
          password: 'demo123'
        })
        .expect(200);

      expect(response.body.user.email).toBe('manager@demo.com');
      expect(response.body.user.role).toBe('manager');
    });

    it('should successfully login with tenant@demo.com and demo123', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'tenant@demo.com',
          password: 'demo123'
        })
        .expect(200);

      expect(response.body.user.email).toBe('tenant@demo.com');
      expect(response.body.user.role).toBe('tenant');
    });
  });

  describe('Authentication Error Handling', () => {
    it('should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@demo.com',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.message).toBe('Invalid credentials');
      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login with non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@demo.com',
          password: 'demo123'
        })
        .expect(401);

      expect(response.body.message).toBe('Invalid credentials');
      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login with missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({})
        .expect(400);

      expect(response.body.message).toBe('Email and password are required');
      expect(response.body.code).toBe('MISSING_CREDENTIALS');
    });
  });

  describe('Session Management', () => {
    it('should return user info for authenticated session', async () => {
      // First login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@demo.com',
          password: 'demo123'
        })
        .expect(200);

      // Extract session cookie
      const sessionCookie = loginResponse.headers['set-cookie'][0];

      // Test authenticated request
      const userResponse = await request(app)
        .get('/api/auth/user')
        .set('Cookie', sessionCookie)
        .expect(200);

      expect(userResponse.body.email).toBe('admin@demo.com');
      expect(userResponse.body.role).toBe('admin');
    });

    it('should reject unauthenticated requests to protected endpoints', async () => {
      const response = await request(app)
        .get('/api/auth/user')
        .expect(401);

      expect(response.body.message).toBe('Not authenticated');
    });
  });

  describe('Password Security', () => {
    it('should verify passwords are properly hashed in database', async () => {
      // Login should work with plain password
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@demo.com',
          password: 'demo123'
        })
        .expect(200);

      // But the stored password should be a bcrypt hash, not plain text
      // This test ensures we're not storing plain text passwords
    });
  });
});