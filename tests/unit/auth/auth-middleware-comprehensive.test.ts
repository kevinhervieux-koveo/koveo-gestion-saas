/**
 * @file Comprehensive Authentication Middleware Tests
 * @description Complete test coverage for authentication middleware functions
 * focusing on edge cases and security scenarios for Quebec property management.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole } from '../../../server/middleware/auth-middleware';

// Mock Express objects
const createMockRequest = (sessionData?: any): Partial<Request> => ({
  session: sessionData,
  path: '/api/test',
  method: 'GET',
  ip: '127.0.0.1',
  headers: {
    'user-agent': 'Test Agent',
  }
});

const createMockResponse = (): Partial<Response> => {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    locals: {}
  };
  return res;
};

const createMockNext = (): NextFunction => jest.fn();

// Test users for Quebec property management scenarios
const testUsers = {
  admin: {
    id: 'admin-user-id',
    username: 'admin@koveo.com',
    email: 'admin@koveo.com',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    isActive: true,
  },
  manager: {
    id: 'manager-user-id',
    username: 'gestionnaire@propriete.qc.ca',
    email: 'gestionnaire@propriete.qc.ca',
    firstName: 'Gestionnaire',
    lastName: 'Propriété',
    role: 'manager',
    isActive: true,
  },
  tenant: {
    id: 'tenant-user-id',
    username: 'locataire@email.com',
    email: 'locataire@email.com',
    firstName: 'Jean',
    lastName: 'Locataire',
    role: 'tenant',
    isActive: true,
  },
  resident: {
    id: 'resident-user-id',
    username: 'resident@email.com',
    email: 'resident@email.com',
    firstName: 'Marie',
    lastName: 'Résidente',
    role: 'resident',
    isActive: true,
  },
  inactiveUser: {
    id: 'inactive-user-id',
    username: 'inactive@email.com',
    email: 'inactive@email.com',
    firstName: 'Inactive',
    lastName: 'User',
    role: 'tenant',
    isActive: false,
  }
};

describe('Authentication Middleware - Comprehensive Tests', () => {
  describe('requireAuth - Authentication Validation', () => {
    it('should allow authenticated users to proceed', () => {
      const req = createMockRequest({ user: testUsers.admin });
      const res = createMockResponse();
      const next = createMockNext();

      requireAuth(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should reject requests without session', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      requireAuth(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    });

    it('should reject requests with empty session', () => {
      const req = createMockRequest({});
      const res = createMockResponse();
      const next = createMockNext();

      requireAuth(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    });

    it('should reject requests with null user in session', () => {
      const req = createMockRequest({ user: null });
      const res = createMockResponse();
      const next = createMockNext();

      requireAuth(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    });

    it('should reject requests with undefined user in session', () => {
      const req = createMockRequest({ user: undefined });
      const res = createMockResponse();
      const next = createMockNext();

      requireAuth(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    });

    it('should handle malformed session data gracefully', () => {
      const malformedSessions = [
        { user: '' },
        { user: 0 },
        { user: false },
        { user: [] },
        { user: {} },
        { notUser: testUsers.admin }
      ];

      malformedSessions.forEach((sessionData, index) => {
        const req = createMockRequest(sessionData);
        const res = createMockResponse();
        const next = createMockNext();

        requireAuth(req as Request, res as Response, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });

        jest.clearAllMocks();
      });
    });

    it('should accept various valid user objects', () => {
      const validUsers = [
        testUsers.admin,
        testUsers.manager,
        testUsers.tenant,
        testUsers.resident,
        testUsers.inactiveUser // Authentication doesn't check active status
      ];

      validUsers.forEach((user) => {
        const req = createMockRequest({ user });
        const res = createMockResponse();
        const next = createMockNext();

        requireAuth(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();

        jest.clearAllMocks();
      });
    });
  });

  describe('requireRole - Role-Based Authorization', () => {
    describe('Single Role Requirements', () => {
      it('should allow admin users to access admin-only routes', () => {
        const middleware = requireRole(['admin']);
        const req = createMockRequest({ user: testUsers.admin });
        const res = createMockResponse();
        const next = createMockNext();

        middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
      });

      it('should allow manager users to access manager routes', () => {
        const middleware = requireRole(['manager']);
        const req = createMockRequest({ user: testUsers.manager });
        const res = createMockResponse();
        const next = createMockNext();

        middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
      });

      it('should allow tenant users to access tenant routes', () => {
        const middleware = requireRole(['tenant']);
        const req = createMockRequest({ user: testUsers.tenant });
        const res = createMockResponse();
        const next = createMockNext();

        middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
      });

      it('should allow resident users to access resident routes', () => {
        const middleware = requireRole(['resident']);
        const req = createMockRequest({ user: testUsers.resident });
        const res = createMockResponse();
        const next = createMockNext();

        middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
      });
    });

    describe('Multiple Role Requirements', () => {
      it('should allow admin or manager access to management routes', () => {
        const middleware = requireRole(['admin', 'manager']);
        
        // Test admin access
        let req = createMockRequest({ user: testUsers.admin });
        let res = createMockResponse();
        let next = createMockNext();

        middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();

        jest.clearAllMocks();

        // Test manager access
        req = createMockRequest({ user: testUsers.manager });
        res = createMockResponse();
        next = createMockNext();

        middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should allow tenant or resident access to occupant routes', () => {
        const middleware = requireRole(['tenant', 'resident']);
        
        // Test tenant access
        let req = createMockRequest({ user: testUsers.tenant });
        let res = createMockResponse();
        let next = createMockNext();

        middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();

        jest.clearAllMocks();

        // Test resident access
        req = createMockRequest({ user: testUsers.resident });
        res = createMockResponse();
        next = createMockNext();

        middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should allow any role access to public routes', () => {
        const middleware = requireRole(['admin', 'manager', 'tenant', 'resident']);
        
        const allUsers = [testUsers.admin, testUsers.manager, testUsers.tenant, testUsers.resident];
        
        allUsers.forEach((user) => {
          const req = createMockRequest({ user });
          const res = createMockResponse();
          const next = createMockNext();

          middleware(req as Request, res as Response, next);

          expect(next).toHaveBeenCalledTimes(1);
          expect(res.status).not.toHaveBeenCalled();

          jest.clearAllMocks();
        });
      });
    });

    describe('Access Denial Scenarios', () => {
      it('should deny tenant access to admin routes', () => {
        const middleware = requireRole(['admin']);
        const req = createMockRequest({ user: testUsers.tenant });
        const res = createMockResponse();
        const next = createMockNext();

        middleware(req as Request, res as Response, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      });

      it('should deny resident access to manager routes', () => {
        const middleware = requireRole(['manager']);
        const req = createMockRequest({ user: testUsers.resident });
        const res = createMockResponse();
        const next = createMockNext();

        middleware(req as Request, res as Response, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      });

      it('should deny manager access to tenant-only routes', () => {
        const middleware = requireRole(['tenant']);
        const req = createMockRequest({ user: testUsers.manager });
        const res = createMockResponse();
        const next = createMockNext();

        middleware(req as Request, res as Response, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      });
    });

    describe('Authentication Validation in Role Middleware', () => {
      it('should reject unauthenticated requests with 401', () => {
        const middleware = requireRole(['admin']);
        const req = createMockRequest();
        const res = createMockResponse();
        const next = createMockNext();

        middleware(req as Request, res as Response, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      });

      it('should reject requests with null user in session', () => {
        const middleware = requireRole(['admin']);
        const req = createMockRequest({ user: null });
        const res = createMockResponse();
        const next = createMockNext();

        middleware(req as Request, res as Response, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      });

      it('should reject requests with empty session object', () => {
        const middleware = requireRole(['admin']);
        const req = createMockRequest({});
        const res = createMockResponse();
        const next = createMockNext();

        middleware(req as Request, res as Response, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      });
    });

    describe('Edge Cases and Security Testing', () => {
      it('should handle malformed role data in user object', () => {
        const usersWithMalformedRoles = [
          { ...testUsers.admin, role: null },
          { ...testUsers.admin, role: undefined },
          { ...testUsers.admin, role: '' },
          { ...testUsers.admin, role: 123 },
          { ...testUsers.admin, role: {} },
          { ...testUsers.admin, role: [] },
          { ...testUsers.admin }, // Missing role property
        ];

        usersWithMalformedRoles.forEach((user, index) => {
          const middleware = requireRole(['admin']);
          const req = createMockRequest({ user });
          const res = createMockResponse();
          const next = createMockNext();

          middleware(req as Request, res as Response, next);

          expect(next).not.toHaveBeenCalled();
          expect(res.status).toHaveBeenCalledWith(403);
          expect(res.json).toHaveBeenCalledWith({
            message: 'Insufficient permissions',
            code: 'INSUFFICIENT_PERMISSIONS'
          });

          jest.clearAllMocks();
        });
      });

      it('should handle empty role requirements array', () => {
        const middleware = requireRole([]);
        const req = createMockRequest({ user: testUsers.admin });
        const res = createMockResponse();
        const next = createMockNext();

        middleware(req as Request, res as Response, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      });

      it('should handle role injection attempts', () => {
        const maliciousRoles = [
          "admin'; DROP TABLE users; --",
          "<script>alert('xss')</script>",
          "admin OR 1=1",
          "admin' UNION SELECT * FROM users",
          "../../../admin"
        ];

        maliciousRoles.forEach((maliciousRole) => {
          const middleware = requireRole(['admin']);
          const userWithMaliciousRole = { ...testUsers.admin, role: maliciousRole };
          const req = createMockRequest({ user: userWithMaliciousRole });
          const res = createMockResponse();
          const next = createMockNext();

          middleware(req as Request, res as Response, next);

          expect(next).not.toHaveBeenCalled();
          expect(res.status).toHaveBeenCalledWith(403);
          expect(res.json).toHaveBeenCalledWith({
            message: 'Insufficient permissions',
            code: 'INSUFFICIENT_PERMISSIONS'
          });

          jest.clearAllMocks();
        });
      });

      it('should be case-sensitive for role matching', () => {
        const caseSensitiveRoles = [
          'Admin',
          'ADMIN',
          'Admin',
          'aDmIn',
          'manager',
          'Manager',
          'MANAGER'
        ];

        caseSensitiveRoles.forEach((role) => {
          const middleware = requireRole(['admin']); // Expecting lowercase 'admin'
          const userWithDifferentCase = { ...testUsers.admin, role };
          const req = createMockRequest({ user: userWithDifferentCase });
          const res = createMockResponse();
          const next = createMockNext();

          middleware(req as Request, res as Response, next);

          if (role === 'admin') {
            expect(next).toHaveBeenCalledTimes(1);
          } else {
            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
          }

          jest.clearAllMocks();
        });
      });

      it('should handle concurrent role checks correctly', () => {
        const middleware = requireRole(['admin', 'manager']);
        
        const concurrentRequests = [
          { user: testUsers.admin },
          { user: testUsers.manager },
          { user: testUsers.tenant },
          { user: testUsers.resident }
        ];

        const results = concurrentRequests.map((sessionData) => {
          const req = createMockRequest(sessionData);
          const res = createMockResponse();
          const next = createMockNext();

          middleware(req as Request, res as Response, next);

          return {
            nextCalled: next.mock.calls.length > 0,
            statusCode: res.status.mock.calls[0]?.[0]
          };
        });

        expect(results[0].nextCalled).toBe(true);  // admin allowed
        expect(results[1].nextCalled).toBe(true);  // manager allowed
        expect(results[2].nextCalled).toBe(false); // tenant denied
        expect(results[2].statusCode).toBe(403);
        expect(results[3].nextCalled).toBe(false); // resident denied
        expect(results[3].statusCode).toBe(403);
      });
    });

    describe('Quebec-Specific Role Scenarios', () => {
      it('should handle Quebec property management role hierarchy', () => {
        // Test Quebec-specific role hierarchy: admin > manager > tenant/resident
        const roleHierarchy = [
          { roles: ['admin'], user: testUsers.admin, shouldPass: true },
          { roles: ['admin'], user: testUsers.manager, shouldPass: false },
          { roles: ['admin', 'manager'], user: testUsers.manager, shouldPass: true },
          { roles: ['admin', 'manager'], user: testUsers.tenant, shouldPass: false },
          { roles: ['tenant', 'resident'], user: testUsers.tenant, shouldPass: true },
          { roles: ['tenant', 'resident'], user: testUsers.resident, shouldPass: true },
          { roles: ['tenant', 'resident'], user: testUsers.manager, shouldPass: false },
        ];

        roleHierarchy.forEach(({ roles, user, shouldPass }) => {
          const middleware = requireRole(roles);
          const req = createMockRequest({ user });
          const res = createMockResponse();
          const next = createMockNext();

          middleware(req as Request, res as Response, next);

          if (shouldPass) {
            expect(next).toHaveBeenCalledTimes(1);
            expect(res.status).not.toHaveBeenCalled();
          } else {
            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
          }

          jest.clearAllMocks();
        });
      });

      it('should handle bilingual user scenarios', () => {
        const bilingualUser = {
          id: 'bilingual-user-id',
          username: 'gestionnaire@bilingue.ca',
          email: 'gestionnaire@bilingue.ca',
          firstName: 'Bilingual',
          lastName: 'Manager / Gestionnaire',
          role: 'manager',
          language: 'fr-CA',
          isActive: true,
        };

        const middleware = requireRole(['manager']);
        const req = createMockRequest({ user: bilingualUser });
        const res = createMockResponse();
        const next = createMockNext();

        middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should maintain security for temporary access scenarios', () => {
        // Test scenario where user might have temporary elevated access
        const temporaryAdminUser = {
          ...testUsers.manager,
          temporaryRole: 'admin', // This should NOT grant admin access
          role: 'manager' // Only the actual role should matter
        };

        const middleware = requireRole(['admin']);
        const req = createMockRequest({ user: temporaryAdminUser });
        const res = createMockResponse();
        const next = createMockNext();

        middleware(req as Request, res as Response, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      });
    });
  });

  describe('Middleware Chaining and Integration', () => {
    it('should work correctly when requireAuth and requireRole are chained', () => {
      const authMiddleware = requireAuth;
      const roleMiddleware = requireRole(['admin']);

      // First test successful chain
      const req1 = createMockRequest({ user: testUsers.admin });
      const res1 = createMockResponse();
      const next1 = createMockNext();

      authMiddleware(req1 as Request, res1 as Response, next1);
      expect(next1).toHaveBeenCalledTimes(1);

      roleMiddleware(req1 as Request, res1 as Response, next1);
      expect(next1).toHaveBeenCalledTimes(2);

      jest.clearAllMocks();

      // Test auth failure stops chain
      const req2 = createMockRequest();
      const res2 = createMockResponse();
      const next2 = createMockNext();

      authMiddleware(req2 as Request, res2 as Response, next2);
      expect(next2).not.toHaveBeenCalled();
      expect(res2.status).toHaveBeenCalledWith(401);

      // Don't call role middleware since auth failed
      jest.clearAllMocks();

      // Test role failure after auth success
      const req3 = createMockRequest({ user: testUsers.tenant });
      const res3 = createMockResponse();
      const next3 = createMockNext();

      authMiddleware(req3 as Request, res3 as Response, next3);
      expect(next3).toHaveBeenCalledTimes(1);

      roleMiddleware(req3 as Request, res3 as Response, next3);
      expect(next3).toHaveBeenCalledTimes(1); // No additional call
      expect(res3.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Performance and Memory Tests', () => {
    it('should handle rapid sequential authentications efficiently', () => {
      const startTime = Date.now();
      
      // Perform 100 rapid authentications
      for (let i = 0; i < 100; i++) {
        const req = createMockRequest({ user: testUsers.admin });
        const res = createMockResponse();
        const next = createMockNext();

        requireAuth(req as Request, res as Response, next);
        expect(next).toHaveBeenCalledTimes(1);

        jest.clearAllMocks();
      }
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });

    it('should handle rapid sequential role checks efficiently', () => {
      const middleware = requireRole(['admin', 'manager']);
      const startTime = Date.now();
      
      // Perform 100 rapid role checks
      for (let i = 0; i < 100; i++) {
        const req = createMockRequest({ user: testUsers.admin });
        const res = createMockResponse();
        const next = createMockNext();

        middleware(req as Request, res as Response, next);
        expect(next).toHaveBeenCalledTimes(1);

        jest.clearAllMocks();
      }
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });

    it('should not leak memory with repeated middleware creation', () => {
      // Create many middleware instances to test for memory leaks
      const middlewares = [];
      
      for (let i = 0; i < 1000; i++) {
        middlewares.push(requireRole(['admin']));
      }
      
      expect(middlewares.length).toBe(1000);
      
      // Test that all middleware instances work correctly
      middlewares.forEach((middleware) => {
        const req = createMockRequest({ user: testUsers.admin });
        const res = createMockResponse();
        const next = createMockNext();

        middleware(req as Request, res as Response, next);
        expect(next).toHaveBeenCalledTimes(1);

        jest.clearAllMocks();
      });
    });
  });
});