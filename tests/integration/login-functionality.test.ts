/**
 * Login Functionality Test with Mocked Database
 * Tests login system with REAL production auth routes but mocked storage
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import session from 'express-session';

// Create mock implementations BEFORE importing
const mockStorageImpl = {
  getUserByEmail: jest.fn<() => Promise<any | null>>(),
  updateUser: jest.fn<() => Promise<any>>(),
  getUser: jest.fn<() => Promise<any | null>>(),
};

const mockBcryptImpl = {
  compare: jest.fn<() => Promise<boolean>>(),
  hash: jest.fn<() => Promise<string>>(),
};

// Mock the modules with our controlled implementations
jest.mock('../../server/storage', () => ({
  storage: mockStorageImpl,
}));

jest.mock('bcryptjs', () => mockBcryptImpl);

// Mock other dependencies to prevent initialization issues
jest.mock('../../server/db', () => ({
  db: {},
  pool: {},
  sql: jest.fn(),
}));

jest.mock('../../server/config/index', () => ({
  config: {
    server: { isProduction: false, domain: 'test.local' },
    database: { getRuntimeDatabaseUrl: jest.fn(() => 'postgresql://test') },
  },
}));

jest.mock('../../server/services/email-service', () => ({
  emailService: { sendEmail: jest.fn() },
}));

jest.mock('../../server/query-cache', () => ({
  queryCache: { get: jest.fn(), set: jest.fn() },
}));

// Get REAL setupAuthRoutes bypassing moduleNameMapper
// NOTE: jest.requireActual must be called at runtime, not at module load time
// So we'll load it in beforeEach
let setupAuthRoutes: any;

describe('Login Functionality with Mocked Database', () => {
  let app: express.Application;
  let agent: ReturnType<typeof request.agent>;

  const testUser = {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'kevin.hervieux@koveo-gestion.com',
    username: 'kevin.hervieux',
    password: '$2a$12$hashedpassword123',
    firstName: 'Kevin',
    lastName: 'Hervieux',
    role: 'admin' as const,
    language: 'fr' as const,
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    // Load REAL setupAuthRoutes at runtime to bypass moduleNameMapper
    if (!setupAuthRoutes) {
      const authModule = await jest.requireActual('../../server/auth') as any;
      setupAuthRoutes = authModule.setupAuthRoutes;
    }

    // Reset all mocks
    jest.clearAllMocks();

    // Configure mock implementations for this test
    mockStorageImpl.getUserByEmail.mockImplementation(async (email: string) => {
      if (email === testUser.email.toLowerCase()) {
        return testUser as any;
      }
      return null;
    });

    mockStorageImpl.updateUser.mockImplementation(async (id: string, data: any) => {
      return { ...testUser, ...data, lastLoginAt: new Date() } as any;
    });

    mockStorageImpl.getUser.mockImplementation(async (id: string) => {
      if (id === testUser.id) {
        return testUser as any;
      }
      return null;
    });

    mockBcryptImpl.compare.mockImplementation(async (password: string, hash: string) => {
      return password === 'admin123';
    });

    mockBcryptImpl.hash.mockImplementation(async (password: string, saltRounds: number) => {
      return `$2a$12$hashed_${password}`;
    });

    // Create fresh Express app for each test
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true}));

    // Setup session middleware (same as production)
    app.use(
      session({
        secret: 'test-secret',
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false },
        name: 'koveo.sid',
      })
    );

    // Mount REAL production auth routes
    // This will use our mocked storage and bcrypt
    setupAuthRoutes(app);

    agent = request.agent(app);
  });

  describe('Real User Login Tests', () => {
    it('should successfully login with valid credentials', async () => {
      const loginData = {
        email: 'kevin.hervieux@koveo-gestion.com',
        password: 'admin123',
      };

      const response = await agent.post('/api/auth/login').send(loginData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('kevin.hervieux@koveo-gestion.com');
      expect(response.body.user.role).toBe('admin');

      // Verify password was not included in response
      expect(response.body.user.password).toBeUndefined();

      // Verify session cookie is set
      expect(response.headers['set-cookie']).toBeDefined();
      const cookie = response.headers['set-cookie'][0];
      expect(cookie).toMatch(/koveo\.sid/);

      // Verify storage methods were called
      expect(mockStorageImpl.getUserByEmail).toHaveBeenCalledWith('kevin.hervieux@koveo-gestion.com');
      expect(mockBcryptImpl.compare).toHaveBeenCalledWith('admin123', testUser.password);
      expect(mockStorageImpl.updateUser).toHaveBeenCalledWith(
        testUser.id,
        expect.objectContaining({
          lastLoginAt: expect.any(Date),
        })
      );
    });

    it('should fail login with wrong password', async () => {
      const loginData = {
        email: 'kevin.hervieux@koveo-gestion.com',
        password: 'wrongpassword',
      };

      // Mock bcrypt to return false for wrong password
      mockBcryptImpl.compare.mockResolvedValue(false);

      const response = await agent.post('/api/auth/login').send(loginData);

      expect(response.status).toBe(401);
      expect(response.body.message).toMatch(/invalid.*credentials/i);

      // Verify storage methods were called
      expect(mockStorageImpl.getUserByEmail).toHaveBeenCalledWith('kevin.hervieux@koveo-gestion.com');
      expect(mockBcryptImpl.compare).toHaveBeenCalledWith('wrongpassword', testUser.password);
      expect(mockStorageImpl.updateUser).not.toHaveBeenCalled();
    });

    it('should fail login with wrong email', async () => {
      const loginData = {
        email: 'wrong@email.com',
        password: 'admin123',
      };

      const response = await agent.post('/api/auth/login').send(loginData);

      expect(response.status).toBe(401);
      expect(response.body.message).toMatch(/invalid.*credentials/i);

      // Verify storage methods were called
      expect(mockStorageImpl.getUserByEmail).toHaveBeenCalledWith('wrong@email.com');
      expect(mockBcryptImpl.compare).not.toHaveBeenCalled();
      expect(mockStorageImpl.updateUser).not.toHaveBeenCalled();
    });

    it('should check user session after login', async () => {
      // First login
      const loginResponse = await agent.post('/api/auth/login').send({
        email: 'kevin.hervieux@koveo-gestion.com',
        password: 'admin123',
      });

      expect(loginResponse.status).toBe(200);

      // Check auth status with session (agent maintains cookies automatically)
      const authResponse = await agent.get('/api/auth/user');

      expect(authResponse.status).toBe(200);
      expect(authResponse.body.email).toBe('kevin.hervieux@koveo-gestion.com');
      expect(authResponse.body.role).toBe('admin');
      expect(authResponse.body.password).toBeUndefined();

      // Verify getUser was called
      expect(mockStorageImpl.getUser).toHaveBeenCalledWith(testUser.id);
    });

    it('should logout and clear session', async () => {
      // First login
      const loginResponse = await agent.post('/api/auth/login').send({
        email: 'kevin.hervieux@koveo-gestion.com',
        password: 'admin123',
      });

      expect(loginResponse.status).toBe(200);

      // Logout (agent maintains cookies automatically)
      const logoutResponse = await agent.post('/api/auth/logout');

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body.message).toMatch(/logout.*success/i);

      // Try to access protected endpoint after logout
      const protectedResponse = await agent.get('/api/auth/user');

      expect(protectedResponse.status).toBe(401);
      expect(protectedResponse.body.message).toMatch(/not authenticated/i);
    });
  });

  describe('Session Management', () => {
    it('should handle multiple concurrent login attempts', async () => {
      const loginData = {
        email: 'kevin.hervieux@koveo-gestion.com',
        password: 'admin123',
      };

      // Create multiple simultaneous login requests
      const loginPromises = Array(3)
        .fill(null)
        .map(() => request(app).post('/api/auth/login').send(loginData));

      const responses = await Promise.all(loginPromises);

      // All should succeed and get unique sessions
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.headers['set-cookie']).toBeDefined();
      });

      // Verify each got a different session
      const sessionIds = responses.map((r) => r.headers['set-cookie'][0]);
      const uniqueSessions = new Set(sessionIds);
      expect(uniqueSessions.size).toBe(3);

      // Verify storage methods were called 3 times
      expect(mockStorageImpl.getUserByEmail).toHaveBeenCalledTimes(3);
      expect(mockBcryptImpl.compare).toHaveBeenCalledTimes(3);
      expect(mockStorageImpl.updateUser).toHaveBeenCalledTimes(3);
    });
  });
});
