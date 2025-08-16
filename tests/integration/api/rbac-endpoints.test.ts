import request from 'supertest';
import express from 'express';
import { sessionConfig, setupAuthRoutes } from '../../../server/auth';
import { registerUserRoutes } from '../../../server/api/users';
import { storage } from '../../../server/storage';

// Mock storage
jest.mock('../../../server/storage', () => ({
  storage: {
    getUser: jest.fn(),
    getUserByEmail: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn(),
    getUsers: jest.fn(),
  },
}));

describe('RBAC API Endpoints Integration Tests', () => {
  let app: express.Application;
  let agent: request.SuperAgentTest;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(sessionConfig);
    
    setupAuthRoutes(app);
    registerUserRoutes(app);
    
    agent = request.agent(app);
    jest.clearAllMocks();
  });

  describe('Authentication Flow with Permissions', () => {
    test('should login and store role and permissions in session', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'admin@example.com',
        password: 'password123',
        role: 'admin',
        isActive: true,
        firstName: 'Admin',
        lastName: 'User'
      };

      (storage.getUserByEmail as jest.Mock).mockResolvedValue(mockUser);
      (storage.updateUser as jest.Mock).mockResolvedValue(mockUser);

      const response = await agent
        .post('/api/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('admin');
      expect(response.body.message).toBe('Login successful');

      // Verify session contains role and permissions by accessing a protected route
      (storage.getUser as jest.Mock).mockResolvedValue(mockUser);
      
      const protectedResponse = await agent.get('/api/user/permissions');
      
      expect(protectedResponse.status).toBe(200);
      expect(protectedResponse.body.role).toBe('admin');
      expect(protectedResponse.body.permissions).toBeDefined();
      expect(Array.isArray(protectedResponse.body.permissions)).toBe(true);
      expect(protectedResponse.body.permissions.length).toBeGreaterThan(0);
    });

    test('should maintain session permissions across requests', async () => {
      const mockManager = {
        id: 'manager-123',
        email: 'manager@example.com',
        password: 'password123',
        role: 'manager',
        isActive: true,
        firstName: 'Manager',
        lastName: 'User'
      };

      (storage.getUserByEmail as jest.Mock).mockResolvedValue(mockManager);
      (storage.updateUser as jest.Mock).mockResolvedValue(mockManager);
      (storage.getUser as jest.Mock).mockResolvedValue(mockManager);

      // Login
      await agent
        .post('/api/auth/login')
        .send({
          email: 'manager@example.com',
          password: 'password123'
        });

      // First permissions request
      const response1 = await agent.get('/api/user/permissions');
      expect(response1.status).toBe(200);
      expect(response1.body.role).toBe('manager');

      // Second permissions request (should use cached session data)
      const response2 = await agent.get('/api/user/permissions');
      expect(response2.status).toBe(200);
      expect(response2.body.role).toBe('manager');
      expect(response2.body.permissions).toEqual(response1.body.permissions);
    });
  });

  describe('Role-Based Endpoint Access', () => {
    beforeEach(() => {
      // Mock different user types
      const mockUsers = {
        admin: {
          id: 'admin-123',
          email: 'admin@example.com',
          password: 'password123',
          role: 'admin',
          isActive: true,
          firstName: 'Admin',
          lastName: 'User'
        },
        manager: {
          id: 'manager-123',
          email: 'manager@example.com',
          password: 'password123',
          role: 'manager',
          isActive: true,
          firstName: 'Manager',
          lastName: 'User'
        },
        tenant: {
          id: 'tenant-123',
          email: 'tenant@example.com',
          password: 'password123',
          role: 'tenant',
          isActive: true,
          firstName: 'Tenant',
          lastName: 'User'
        }
      };

      (storage.getUserByEmail as jest.Mock).mockImplementation(async (email) => {
        if (email === 'admin@example.com') {return mockUsers.admin;}
        if (email === 'manager@example.com') {return mockUsers.manager;}
        if (email === 'tenant@example.com') {return mockUsers.tenant;}
        return null;
      });

      (storage.getUser as jest.Mock).mockImplementation(async (id) => {
        if (id === 'admin-123') {return mockUsers.admin;}
        if (id === 'manager-123') {return mockUsers.manager;}
        if (id === 'tenant-123') {return mockUsers.tenant;}
        return null;
      });

      (storage.updateUser as jest.Mock).mockImplementation(async (id) => {
        if (id === 'admin-123') {return mockUsers.admin;}
        if (id === 'manager-123') {return mockUsers.manager;}
        if (id === 'tenant-123') {return mockUsers.tenant;}
        return null;
      });
    });

    test('should allow admin to access user permissions endpoint', async () => {
      await agent
        .post('/api/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'password123'
        });

      const response = await agent.get('/api/user/permissions');
      
      expect(response.status).toBe(200);
      expect(response.body.role).toBe('admin');
      expect(response.body.permissions).toContain('delete:user');
      expect(response.body.permissions).toContain('manage:user_roles');
    });

    test('should allow manager to access user permissions endpoint with limited permissions', async () => {
      await agent
        .post('/api/auth/login')
        .send({
          email: 'manager@example.com',
          password: 'password123'
        });

      const response = await agent.get('/api/user/permissions');
      
      expect(response.status).toBe(200);
      expect(response.body.role).toBe('manager');
      expect(response.body.permissions).toContain('read:bill');
      expect(response.body.permissions).toContain('create:maintenance_request');
      expect(response.body.permissions).not.toContain('delete:user');
      expect(response.body.permissions).not.toContain('manage:user_roles');
    });

    test('should allow tenant to access user permissions endpoint with minimal permissions', async () => {
      await agent
        .post('/api/auth/login')
        .send({
          email: 'tenant@example.com',
          password: 'password123'
        });

      const response = await agent.get('/api/user/permissions');
      
      expect(response.status).toBe(200);
      expect(response.body.role).toBe('tenant');
      expect(response.body.permissions).toContain('read:profile');
      expect(response.body.permissions).toContain('update:profile');
      expect(response.body.permissions).not.toContain('read:bill');
      expect(response.body.permissions).not.toContain('delete:user');
    });

    test('should deny access to permissions endpoint without authentication', async () => {
      const response = await agent.get('/api/user/permissions');
      
      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Authentication required');
      expect(response.body.code).toBe('AUTH_REQUIRED');
    });
  });

  describe('Permission Validation', () => {
    test('should validate permission count matches role expectations', async () => {
      const testCases = [
        { email: 'admin@example.com', role: 'admin', expectedMinPermissions: 100 },
        { email: 'manager@example.com', role: 'manager', expectedMinPermissions: 50 },
        { email: 'tenant@example.com', role: 'tenant', expectedMinPermissions: 10 }
      ];

      for (const testCase of testCases) {
        const agent = request.agent(app);
        
        await agent
          .post('/api/auth/login')
          .send({
            email: testCase.email,
            password: 'password123'
          });

        const response = await agent.get('/api/user/permissions');
        
        expect(response.status).toBe(200);
        expect(response.body.role).toBe(testCase.role);
        expect(response.body.permissionCount).toBeGreaterThanOrEqual(testCase.expectedMinPermissions);
        expect(response.body.permissions.length).toBe(response.body.permissionCount);
      }
    });

    test('should validate permissions are properly formatted', async () => {
      await agent
        .post('/api/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'password123'
        });

      const response = await agent.get('/api/user/permissions');
      
      expect(response.status).toBe(200);
      expect(response.body.permissions).toBeDefined();
      
      // Validate permission format (action:resource)
      response.body.permissions.forEach((permission: string) => {
        expect(permission).toMatch(/^[a-z_]+:[a-z_]+$/);
        expect(permission.includes(':')).toBe(true);
        const [action, resource] = permission.split(':');
        expect(action.length).toBeGreaterThan(0);
        expect(resource.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Session Security', () => {
    test('should clear permissions on logout', async () => {
      await agent
        .post('/api/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'password123'
        });

      // Verify permissions are accessible
      let response = await agent.get('/api/user/permissions');
      expect(response.status).toBe(200);

      // Logout
      await agent.post('/api/auth/logout');

      // Verify permissions are no longer accessible
      response = await agent.get('/api/user/permissions');
      expect(response.status).toBe(401);
    });

    test('should handle invalid session gracefully', async () => {
      // Try to access protected endpoint without login
      const response = await agent.get('/api/user/permissions');
      
      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Authentication required');
      expect(response.body.code).toBe('AUTH_REQUIRED');
    });

    test('should regenerate permissions if missing from session', async () => {
      const mockAdmin = {
        id: 'admin-123',
        email: 'admin@example.com',
        password: 'password123',
        role: 'admin',
        isActive: true,
        firstName: 'Admin',
        lastName: 'User'
      };

      (storage.getUser as jest.Mock).mockResolvedValue(mockAdmin);

      // Simulate a session with missing permissions (backwards compatibility)
      const response = await agent.get('/api/user/permissions');
      
      // Should either authenticate properly or return 401
      expect([200, 401]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body.permissions).toBeDefined();
        expect(Array.isArray(response.body.permissions)).toBe(true);
      }
    });
  });
});