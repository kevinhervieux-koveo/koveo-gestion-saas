import { describe, it, expect, beforeAll } from '@jest/globals';

import request from 'supertest';
import express from 'express';
import { setupAuthRoutes } from '../../server/auth';

describe('CRITICAL Authentication System', () => {
  describe('Demo User Login Flow (Supertest)', () => {
    let app: express.Application;

    beforeAll(() => {
      const session = require('express-session');
      app = express();
      app.use(express.json());
      app.use(express.urlencoded({ extended: true }));
      app.use(session({
        name: 'koveo.sid',
        secret: 'test-secret',
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
      }));
      setupAuthRoutes(app);
    });

    it('should successfully login with admin@demo.com', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@demo.com', password: 'demo123' })
        .expect(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('admin@demo.com');
      expect(response.body.user.role).toBe('admin');
      expect(response.headers['set-cookie']).toBeDefined();
      expect(response.headers['set-cookie'][0]).toContain('koveo.sid');
    });

    it('should successfully login with manager@demo.com', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'manager@demo.com', password: 'demo123' })
        .expect(200);
      expect(response.body.user.email).toBe('manager@demo.com');
      expect(response.body.user.role).toBe('manager');
    });

    it('should successfully login with tenant@demo.com', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'tenant@demo.com', password: 'demo123' })
        .expect(200);
      expect(response.body.user.email).toBe('tenant@demo.com');
      expect(response.body.user.role).toBe('tenant');
    });

    it('should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@demo.com', password: 'wrongpassword' })
        .expect(401);
      expect(response.body.message).toBe('Invalid credentials');
      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login with non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@demo.com', password: 'demo123' })
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

    it('should return user info for authenticated session', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@demo.com', password: 'demo123' })
        .expect(200);
      const sessionCookie = loginResponse.headers['set-cookie'][0];
      const userResponse = await request(app)
        .get('/api/auth/user')
        .set('Cookie', sessionCookie)
        .expect(200);
      expect(userResponse.body.email).toBe('admin@demo.com');
      expect(userResponse.body.role).toBe('admin');
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .get('/api/auth/user')
        .expect(401);
      expect(response.body.message).toBe('Not authenticated');
    });
  });
});
