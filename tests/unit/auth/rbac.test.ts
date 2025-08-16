import { checkPermission, getRolePermissions, permissions } from '../../../config';
import { requireAuth, requireRole, authorize } from '../../../server/auth';
import { Request, Response, NextFunction } from 'express';
import { storage } from '../../../server/storage';

// Mock storage
jest.mock('../../../server/storage', () => ({
  storage: {
    getUser: jest.fn(),
    updateUser: jest.fn(),
  },
}));

describe('RBAC System Tests', () => {
  describe('Permissions Configuration', () => {
    test('should have all required roles defined', () => {
      expect(permissions).toHaveProperty('admin');
      expect(permissions).toHaveProperty('manager');
      expect(permissions).toHaveProperty('tenant');
      expect(permissions).toHaveProperty('resident');
    });

    test('should have admin with most permissions', () => {
      const adminPerms = permissions.admin;
      const managerPerms = permissions.manager;
      const tenantPerms = permissions.tenant;
      const residentPerms = permissions.resident;

      expect(adminPerms.length).toBeGreaterThan(managerPerms.length);
      expect(managerPerms.length).toBeGreaterThan(tenantPerms.length);
      expect(tenantPerms.length).toBeGreaterThanOrEqual(residentPerms.length);
    });

    test('should validate permission checking function', () => {
      // Admin should have delete:user permission
      expect(checkPermission(permissions as any, 'admin', 'delete:user')).toBe(true);
      
      // Tenant should not have delete:user permission
      expect(checkPermission(permissions as any, 'tenant', 'delete:user')).toBe(false);
      
      // Manager should have read:bill permission
      expect(checkPermission(permissions as any, 'manager', 'read:bill')).toBe(true);
      
      // Tenant should have read:profile permission
      expect(checkPermission(permissions as any, 'tenant', 'read:profile')).toBe(true);
    });

    test('should retrieve role permissions correctly', () => {
      const adminPerms = getRolePermissions(permissions as any, 'admin');
      const tenantPerms = getRolePermissions(permissions as any, 'tenant');

      expect(Array.isArray(adminPerms)).toBe(true);
      expect(Array.isArray(tenantPerms)).toBe(true);
      expect(adminPerms.length).toBeGreaterThan(tenantPerms.length);
      expect(adminPerms).toContain('delete:user');
      expect(tenantPerms).not.toContain('delete:user');
    });
  });

  describe('Authentication Middleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockReq = {
        session: {} as any,
        user: undefined,
      };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      mockNext = jest.fn();
      jest.clearAllMocks();
    });

    test('should reject request without session userId', async () => {
      mockReq.session = {} as any;

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject request for inactive user', async () => {
      mockReq.session = { userId: 'user-123' } as any;
      (storage.getUser as jest.Mock).mockResolvedValue({
        id: 'user-123',
        isActive: false,
        role: 'tenant'
      });

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'User account not found or inactive',
        code: 'USER_INACTIVE'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should accept request for active user and populate session', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'manager',
        isActive: true,
        firstName: 'Test',
        lastName: 'User'
      };

      mockReq.session = { userId: 'user-123' } as any;
      (storage.getUser as jest.Mock).mockResolvedValue(mockUser);

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.user).toEqual(mockUser);
      expect(mockReq.session?.role).toBe('manager');
      expect(mockReq.session?.permissions).toBeDefined();
      expect(Array.isArray(mockReq.session?.permissions)).toBe(true);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Role-Based Authorization', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockReq = {
        user: undefined,
      };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      mockNext = jest.fn();
      jest.clearAllMocks();
    });

    test('should reject request without authenticated user', async () => {
      const middleware = requireRole(['admin']);
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject user with insufficient role', async () => {
      mockReq.user = {
        id: 'user-123',
        role: 'tenant',
        email: 'tenant@example.com',
        isActive: true
      } as any;

      const middleware = requireRole(['admin', 'manager']);
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: ['admin', 'manager'],
        current: 'tenant'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should accept user with sufficient role', async () => {
      mockReq.user = {
        id: 'user-123',
        role: 'manager',
        email: 'manager@example.com',
        isActive: true
      } as any;

      const middleware = requireRole(['admin', 'manager']);
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('Permission-Based Authorization', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockReq = {
        user: undefined,
      };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      mockNext = jest.fn();
      jest.clearAllMocks();
    });

    test('should reject request without authenticated user', async () => {
      const middleware = authorize('read:bill');
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject user without required permission', async () => {
      mockReq.user = {
        id: 'user-123',
        role: 'tenant',
        email: 'tenant@example.com',
        isActive: true
      } as any;

      const middleware = authorize('delete:user');
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Insufficient permissions',
        code: 'PERMISSION_DENIED',
        required: 'delete:user',
        userRole: 'tenant',
        details: "User with role 'tenant' does not have permission 'delete:user'"
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should accept user with required permission', async () => {
      mockReq.user = {
        id: 'user-123',
        role: 'admin',
        email: 'admin@example.com',
        isActive: true
      } as any;

      const middleware = authorize('delete:user');
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('should validate manager permissions correctly', async () => {
      mockReq.user = {
        id: 'user-123',
        role: 'manager',
        email: 'manager@example.com',
        isActive: true
      } as any;

      // Manager should have read:bill permission
      const readBillMiddleware = authorize('read:bill');
      await readBillMiddleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      // Reset mocks
      jest.clearAllMocks();

      // Manager should NOT have delete:user permission
      const deleteUserMiddleware = authorize('delete:user');
      await deleteUserMiddleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should validate tenant permissions correctly', async () => {
      mockReq.user = {
        id: 'user-123',
        role: 'tenant',
        email: 'tenant@example.com',
        isActive: true
      } as any;

      // Tenant should have read:profile permission
      const readProfileMiddleware = authorize('read:profile');
      await readProfileMiddleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      // Reset mocks
      jest.clearAllMocks();

      // Tenant should NOT have create:bill permission
      const createBillMiddleware = authorize('create:bill');
      await createBillMiddleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Permission Hierarchy Validation', () => {
    test('should validate admin has all permissions others have', () => {
      const adminPerms = new Set(permissions.admin);
      const managerPerms = permissions.manager;
      const tenantPerms = permissions.tenant;
      const residentPerms = permissions.resident;

      // Admin should have all manager permissions
      managerPerms.forEach(permission => {
        expect(adminPerms.has(permission)).toBe(true);
      });

      // Admin should have all tenant permissions
      tenantPerms.forEach(permission => {
        expect(adminPerms.has(permission)).toBe(true);
      });

      // Admin should have all resident permissions
      residentPerms.forEach(permission => {
        expect(adminPerms.has(permission)).toBe(true);
      });
    });

    test('should validate critical permissions are assigned correctly', () => {
      // Critical admin permissions
      expect(permissions.admin).toContain('delete:user');
      expect(permissions.admin).toContain('manage:user_roles');
      expect(permissions.admin).toContain('manage:security_settings');

      // Critical manager permissions
      expect(permissions.manager).toContain('read:building');
      expect(permissions.manager).toContain('create:bill');
      expect(permissions.manager).toContain('read:maintenance_request');

      // Critical resident permissions
      expect(permissions.resident).toContain('read:profile');
      expect(permissions.resident).toContain('read:residence');
      expect(permissions.resident).toContain('read:bill');

      // Critical tenant permissions
      expect(permissions.tenant).toContain('read:profile');
      expect(permissions.tenant).toContain('update:profile');
      expect(permissions.tenant).toContain('create:maintenance_request');
    });

    test('should validate restrictive permissions are not given to lower roles', () => {
      // Tenant should not have management permissions
      expect(permissions.tenant).not.toContain('delete:user');
      expect(permissions.tenant).not.toContain('create:organization');
      expect(permissions.tenant).not.toContain('delete:building');

      // Resident should not have user management permissions
      expect(permissions.resident).not.toContain('delete:user');
      expect(permissions.resident).not.toContain('manage:user_roles');

      // Manager should not have system-level permissions
      expect(permissions.manager).not.toContain('backup:system');
      expect(permissions.manager).not.toContain('restore:system');
    });
  });
});