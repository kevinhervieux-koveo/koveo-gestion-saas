/**
 * @file RBAC Middleware Integration Tests.
 * @description Tests for authentication and authorization middleware functions,
 * including role-based access control, permission validation, and security boundaries.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole, authorize } from '../../server/auth';
import { checkPermission, permissions } from '../../config';
import type { Role, Permission } from '../../config/permissions-schema';

// Mock storage module
jest.mock('../../server/storage', () => ({
  storage: {
    getUser: jest.fn(),
    getUserByEmail: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn()
  }
}));

// Mock dependencies
const mockStorage = require('../../server/storage').storage;

// Mock request/response objects
const createMockRequest = (overrides: Partial<Request> = {}): Partial<Request> => ({
  session: {},
  user: undefined,
  body: {},
  _params: {},
  query: {},
  headers: {},
  ip: '127.0.0.1',
  ...overrides
});

const createMockResponse = (): Partial<Response> => {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis()
  };
  return res;
};

const mockNext: NextFunction = jest.fn();

describe('RBAC Middleware Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.getUser.mockClear();
    (mockNext as jest.Mock).mockClear();
  });

  describe('requireAuth Middleware', () => {
    it('should pass authentication for valid session with active user', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        role: 'admin',
        isActive: true,
        firstName: 'Test',
        lastName: 'User'
      };

      mockStorage.getUser.mockResolvedValue(mockUser);

      const req = createMockRequest({
        session: { userId: '1', role: 'admin' }
      });
      const res = createMockResponse();

      await requireAuth(req as Request, res as Response, mockNext);

      expect(mockStorage.getUser).toHaveBeenCalledWith('1');
      expect(mockNext).toHaveBeenCalled();
      expect(req.user).toMatchObject(mockUser);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject authentication when no session exists', async () => {
      const req = createMockRequest({ session: {} });
      const res = createMockResponse();

      await requireAuth(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject authentication for inactive user', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        role: 'admin',
        isActive: false,
        firstName: 'Test',
        lastName: 'User'
      };

      mockStorage.getUser.mockResolvedValue(mockUser);

      const req = createMockRequest({
        session: {
          userId: '1',
          role: 'admin',
          destroy: jest.fn((callback) => callback())
        }
      });
      const res = createMockResponse();

      await requireAuth(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User account not found or inactive',
        code: 'USER_INACTIVE'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockStorage.getUser.mockRejectedValue(new Error('Database error'));

      const req = createMockRequest({
        session: { userId: '1', role: 'admin' }
      });
      const res = createMockResponse();

      await requireAuth(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Authentication error',
        code: 'AUTH_ERROR'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should populate session permissions for backwards compatibility', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        role: 'admin',
        isActive: true,
        firstName: 'Test',
        lastName: 'User'
      };

      // Mock database query for user organizations
      const mockDb = {
        query: {
          userOrganizations: {
            findMany: jest.fn().mockResolvedValue([
              {
                organizationId: 'org-1',
                canAccessAllOrganizations: true,
                organization: { id: 'org-1', name: 'Test Org' }
              }
            ])
          }
        }
      };

      jest.doMock('drizzle-orm/neon-serverless', () => ({
        drizzle: () => mockDb
      }));

      mockStorage.getUser.mockResolvedValue(mockUser);

      const req = createMockRequest({
        session: { userId: '1' } // No role/permissions initially
      });
      const res = createMockResponse();

      await requireAuth(req as Request, res as Response, mockNext);

      expect(req.session?.role).toBe('admin');
      expect(req.session?.permissions).toBeDefined();
      expect(Array.isArray(req.session?.permissions)).toBe(true);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireRole Middleware', () => {
    it('should allow access for users with correct role', async () => {
      const req = createMockRequest({
        user: { id: '1', role: 'admin', isActive: true }
      });
      const res = createMockResponse();

      const middleware = requireRole(['admin', 'manager']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should deny access for users without correct role', async () => {
      const req = createMockRequest({
        user: { id: '1', role: 'tenant', isActive: true }
      });
      const res = createMockResponse();

      const middleware = requireRole(['admin', 'manager']);
      await middleware(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: ['admin', 'manager'],
        current: 'tenant'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should require authentication before role check', async () => {
      const req = createMockRequest({ user: undefined });
      const res = createMockResponse();

      const middleware = requireRole(['admin']);
      await middleware(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle multiple role validation scenarios', async () => {
      const roleTests = [
        { userRole: 'admin', allowedRoles: ['admin'], shouldPass: true },
        { userRole: 'admin', allowedRoles: ['admin', 'manager'], shouldPass: true },
        { userRole: 'manager', allowedRoles: ['admin'], shouldPass: false },
        { userRole: 'manager', allowedRoles: ['manager', 'tenant'], shouldPass: true },
        { userRole: 'tenant', allowedRoles: ['admin', 'manager'], shouldPass: false },
        { userRole: 'resident', allowedRoles: ['tenant', 'resident'], shouldPass: true }
      ];

      for (const test of roleTests) {
        jest.clearAllMocks();
        const req = createMockRequest({
          user: { id: '1', role: test.userRole, isActive: true }
        });
        const res = createMockResponse();

        const middleware = requireRole(test.allowedRoles);
        await middleware(req as Request, res as Response, mockNext);

        if (test.shouldPass) {
          expect(mockNext).toHaveBeenCalled();
          expect(res.status).not.toHaveBeenCalled();
        } else {
          expect(res.status).toHaveBeenCalledWith(403);
          expect(mockNext).not.toHaveBeenCalled();
        }
      }
    });
  });

  describe('authorize Middleware (Permission-Based)', () => {
    it('should allow access for users with required permission', async () => {
      const req = createMockRequest({
        user: { id: '1', role: 'admin', isActive: true }
      });
      const res = createMockResponse();

      const middleware = authorize('read:user');
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should deny access for users without required permission', async () => {
      const req = createMockRequest({
        user: { id: '1', role: 'tenant', isActive: true }
      });
      const res = createMockResponse();

      const middleware = authorize('delete:user');
      await middleware(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Insufficient permissions',
        code: 'PERMISSION_DENIED',
        required: 'delete:user',
        userRole: 'tenant',
        details: "User with role 'tenant' does not have permission 'delete:user'"
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should require authentication before permission check', async () => {
      const req = createMockRequest({ user: undefined });
      const res = createMockResponse();

      const middleware = authorize('read:user');
      await middleware(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should validate comprehensive permission scenarios', async () => {
      const permissionTests = [
        // Admin permissions
        { role: 'admin', permission: 'read:user', shouldPass: true },
        { role: 'admin', permission: 'delete:user', shouldPass: true },
        { role: 'admin', permission: 'create:organization', shouldPass: true },
        { role: 'admin', permission: 'delete:building', shouldPass: true },

        // Manager permissions
        { role: 'manager', permission: 'read:user', shouldPass: true },
        { role: 'manager', permission: 'create:building', shouldPass: true },
        { role: 'manager', permission: 'approve:bill', shouldPass: true },
        { role: 'manager', permission: 'delete:user', shouldPass: false },
        { role: 'manager', permission: 'delete:organization', shouldPass: false },

        // Tenant permissions
        { role: 'tenant', permission: 'read:profile', shouldPass: true },
        { role: 'tenant', permission: 'read:residence', shouldPass: true },
        { role: 'tenant', permission: 'create:maintenance_request', shouldPass: true },
        { role: 'tenant', permission: 'read:user', shouldPass: false },
        { role: 'tenant', permission: 'create:building', shouldPass: false },

        // Resident permissions
        { role: 'resident', permission: 'read:profile', shouldPass: true },
        { role: 'resident', permission: 'update:profile', shouldPass: true },
        { role: 'resident', permission: 'read:bill', shouldPass: true },
        { role: 'resident', permission: 'create:bill', shouldPass: false },
        { role: 'resident', permission: 'delete:maintenance_request', shouldPass: false }
      ];

      for (const test of permissionTests) {
        jest.clearAllMocks();
        const req = createMockRequest({
          user: { id: '1', role: test.role, isActive: true }
        });
        const res = createMockResponse();

        const middleware = authorize(test.permission);
        await middleware(req as Request, res as Response, mockNext);

        if (test.shouldPass) {
          expect(mockNext).toHaveBeenCalled();
          expect(res.status).not.toHaveBeenCalled();
        } else {
          expect(res.status).toHaveBeenCalledWith(403);
          expect(mockNext).not.toHaveBeenCalled();
        }
      }
    });

    it('should handle authorization errors gracefully', async () => {
      // Mock checkPermission to throw an error
      jest.doMock('../../config', () => ({
        checkPermission: jest.fn().mockImplementation(() => {
          throw new Error('Permission check failed');
        }),
        permissions: {}
      }));

      const req = createMockRequest({
        user: { id: '1', role: 'admin', isActive: true }
      });
      const res = createMockResponse();

      const middleware = authorize('read:user');
      await middleware(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Authorization check failed',
        code: 'AUTHORIZATION_ERROR'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Middleware Chaining Integration', () => {
    it('should work correctly when chained together', async () => {
      const mockUser = {
        id: '1',
        email: 'admin@test.com',
        role: 'admin',
        isActive: true,
        firstName: 'Admin',
        lastName: 'User'
      };

      mockStorage.getUser.mockResolvedValue(mockUser);

      const req = createMockRequest({
        session: { userId: '1', role: 'admin' }
      });
      const res = createMockResponse();

      // Chain: requireAuth -> requireRole -> authorize
      await requireAuth(req as Request, res as Response, async () => {
        const roleMiddleware = requireRole(['admin']);
        await roleMiddleware(req as Request, res as Response, async () => {
          const authMiddleware = authorize('delete:user');
          await authMiddleware(req as Request, res as Response, mockNext);
        });
      });

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(req.user).toMatchObject(mockUser);
    });

    it('should stop chain execution when middleware fails', async () => {
      const mockUser = {
        id: '1',
        email: 'tenant@test.com',
        role: 'tenant',
        isActive: true,
        firstName: 'Tenant',
        lastName: 'User'
      };

      mockStorage.getUser.mockResolvedValue(mockUser);

      const req = createMockRequest({
        session: { userId: '1', role: 'tenant' }
      });
      const res = createMockResponse();

      // Chain: requireAuth (should pass) -> requireRole (should fail) -> authorize (should not be called)
      await requireAuth(req as Request, res as Response, async () => {
        const roleMiddleware = requireRole(['admin', 'manager']);
        await roleMiddleware(req as Request, res as Response, async () => {
          const authMiddleware = authorize('delete:user');
          await authMiddleware(req as Request, res as Response, mockNext);
        });
      });

      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(req.user).toMatchObject(mockUser);
    });
  });

  describe('Edge Cases and Security Scenarios', () => {
    it('should handle malformed session data', async () => {
      const req = createMockRequest({
        session: { userId: null, role: 'admin' }
      });
      const res = createMockResponse();

      await requireAuth(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should prevent role tampering attempts', async () => {
      const mockUser = {
        id: '1',
        email: 'tenant@test.com',
        role: 'tenant', // Actual role in database
        isActive: true,
        firstName: 'Tenant',
        lastName: 'User'
      };

      mockStorage.getUser.mockResolvedValue(mockUser);

      const req = createMockRequest({
        session: { userId: '1', role: 'admin' }, // Tampered session role
        user: { ...mockUser, role: 'admin' } // Tampered user object
      });
      const res = createMockResponse();

      const middleware = requireRole(['admin']);
      await middleware(req as Request, res as Response, mockNext);

      // Should use the role from the user object, not session
      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should validate permission existence before checking', async () => {
      const req = createMockRequest({
        user: { id: '1', role: 'admin', isActive: true }
      });
      const res = createMockResponse();

      const middleware = authorize('invalid:permission');
      await middleware(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'PERMISSION_DENIED',
          required: 'invalid:permission'
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle concurrent authentication attempts', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        role: 'admin',
        isActive: true,
        firstName: 'Test',
        lastName: 'User'
      };

      mockStorage.getUser.mockResolvedValue(mockUser);

      const requests = Array.from({ length: 5 }, (_, i) => 
        createMockRequest({
          session: { userId: '1', role: 'admin' }
        })
      );
      const responses = Array.from({ length: 5 }, () => createMockResponse());
      const nextFunctions = Array.from({ length: 5 }, () => jest.fn());

      // Execute concurrent authentication
      await Promise.all(
        requests.map((req, i) => 
          requireAuth(req as Request, responses[i] as Response, nextFunctions[i])
        )
      );

      // All should succeed
      nextFunctions.forEach(next => expect(next).toHaveBeenCalled());
      responses.forEach(res => expect(res.status).not.toHaveBeenCalled());
    });
  });
});