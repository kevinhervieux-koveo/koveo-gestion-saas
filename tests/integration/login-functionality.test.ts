/**
 * Login Functionality Test with Real User Credentials
 * Tests login system with actual user account
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { registerRoutes } from '../../server/routes';
import { db } from '../../server/db';
import * as schema from '../../shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

// Create test server
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  registerRoutes(app);
  return app;
};

describe('Login Functionality with Real User', () => {
  let app: express.Application;
  let testUser: any;

  beforeAll(async () => {
    app = createTestApp();

    // Find existing user or create if needed
    try {
      const [existingUser] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, 'kevin.hervieux@koveo-gestion.com'))
        .limit(1);
      
      if (existingUser) {
        testUser = existingUser;
        console.log('✅ Using existing test user:', { id: existingUser.id, email: existingUser.email, role: existingUser.role });
      } else {
        // Create new user only if it doesn't exist
        const hashedPassword = await bcrypt.hash('admin123', 12);
        const [user] = await db
          .insert(schema.users)
          .values({
            email: 'kevin.hervieux@koveo-gestion.com',
            username: 'kevin.hervieux',
            firstName: 'Kevin',
            lastName: 'Hervieux',
            role: 'admin',
            password: hashedPassword,
            language: 'fr',
            isActive: true,
          })
          .returning();
        testUser = user;
        console.log('✅ New test user created:', { id: user.id, email: user.email, role: user.role });
      }
    } catch (error: any) {
      console.error('❌ Error handling test user:', error);
      throw error;
    }
  });

  afterAll(async () => {
    // Keep the user in database for actual login testing
    console.log('📝 Test user kept in database for real login functionality');
  });

  describe('Real User Login Tests', () => {
    it('should successfully login with valid credentials', async () => {
      const loginData = {
        email: 'kevin.hervieux@koveo-gestion.com',
        password: 'admin123',
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.message).toBe('Login successful');
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('kevin.hervieux@koveo-gestion.com');
      expect(response.body.user.role).toBe('admin');
      
      // Verify session cookie is set
      expect(response.headers['set-cookie']).toBeDefined();
      const cookie = response.headers['set-cookie'][0];
      expect(cookie).toMatch(/koveo\.sid/);
    });

    it('should fail login with wrong password', async () => {
      const loginData = {
        email: 'kevin.hervieux@koveo-gestion.com',
        password: 'wrongpassword',
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.message).toMatch(/invalid.*credentials/i);
    });

    it('should fail login with wrong email', async () => {
      const loginData = {
        email: 'wrong@email.com',
        password: 'admin123',
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.message).toMatch(/invalid.*credentials/i);
    });

    it('should check user session after login', async () => {
      // First login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'kevin.hervieux@koveo-gestion.com',
          password: 'admin123',
        })
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'];

      // Check auth status with session
      const authResponse = await request(app)
        .get('/api/auth/user')
        .set('Cookie', cookies)
        .expect(200);

      expect(authResponse.body.email).toBe('kevin.hervieux@koveo-gestion.com');
      expect(authResponse.body.role).toBe('admin');
    });

    it('should logout and clear session', async () => {
      // First login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'kevin.hervieux@koveo-gestion.com',
          password: 'admin123',
        })
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'];

      // Logout
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookies)
        .expect(200);

      expect(logoutResponse.body.message).toMatch(/logout.*success/i);

      // Try to access protected endpoint after logout
      const protectedResponse = await request(app)
        .get('/api/auth/user')
        .set('Cookie', cookies);

      expect(protectedResponse.status).toBe(401);
    });
  });

  describe('Session Management', () => {
    it('should handle multiple concurrent login attempts', async () => {
      const loginData = {
        email: 'kevin.hervieux@koveo-gestion.com',
        password: 'admin123',
      };

      // Create multiple simultaneous login requests
      const loginPromises = Array(3).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send(loginData)
      );

      const responses = await Promise.all(loginPromises);
      
      // All should succeed and get unique sessions
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.headers['set-cookie']).toBeDefined();
      });

      // Verify each got a different session
      const sessionIds = responses.map(r => r.headers['set-cookie'][0]);
      const uniqueSessions = new Set(sessionIds);
      expect(uniqueSessions.size).toBe(3);
    });
  });
});