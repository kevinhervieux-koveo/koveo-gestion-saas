/**
 * Authentication Test Setup
 * Configures Jest environment for authentication and security testing
 */

import { jest } from '@jest/globals';

// Enhanced test environment setup for authentication
beforeAll(async () => {
  // Set up global test data store for consistent test state
  (global as any).__authTestData = {
    users: new Map(),
    sessions: new Map(),
    permissions: new Map(),
    organizations: new Map(),
    
    // Add demo users for testing
    demoUsers: {
      'admin@demo.com': {
        id: 'demo-admin-id',
        username: 'admin-demo',
        email: 'admin@demo.com',
        role: 'admin',
        password: '$2b$12$demo.admin.hash', // Pre-hashed for consistency
        firstName: 'Demo',
        lastName: 'Admin',
        isActive: true,
      },
      'manager@demo.com': {
        id: 'demo-manager-id', 
        username: 'manager-demo',
        email: 'manager@demo.com',
        role: 'manager',
        password: '$2b$12$demo.manager.hash',
        firstName: 'Demo',
        lastName: 'Manager',
        isActive: true,
      },
      'tenant@demo.com': {
        id: 'demo-tenant-id',
        username: 'tenant-demo', 
        email: 'tenant@demo.com',
        role: 'tenant',
        password: '$2b$12$demo.tenant.hash',
        firstName: 'Demo',
        lastName: 'Tenant',
        isActive: true,
      },
    },
    
    // Permission matrix for testing RBAC
    permissions: {
      admin: ['*'], // All permissions
      manager: [
        'read:users', 'read:buildings', 'read:residences', 'read:bills',
        'write:buildings', 'write:residences', 'write:maintenance',
        'manage:tenants', 'manage:bills'
      ],
      tenant: [
        'read:own_data', 'read:building', 'read:residence',
        'write:maintenance_request', 'write:own_profile'
      ],
      resident: [
        'read:own_data', 'read:building', 'read:residence'
      ],
      demo_manager: [
        'read:demo_data', 'write:demo_data', 'read:buildings', 'read:residences'
      ],
    },
  };
});

beforeEach(async () => {
  // Clear session state between tests
  const authTestData = (global as any).__authTestData;
  if (authTestData) {
    authTestData.sessions.clear();
  }
  
  // Reset all auth-related mocks
  jest.clearAllMocks();
  
  // Reset fetch mock if it exists
  if ((global as any).fetch && (global as any).fetch.mockClear) {
    (global as any).fetch.mockClear();
  }
});

afterEach(async () => {
  // Clean up any test sessions or temporary data
  const authTestData = (global as any).__authTestData;
  if (authTestData) {
    authTestData.sessions.clear();
  }
  
  // Force garbage collection if available (helps with memory leaks in tests)
  if (global.gc) {
    global.gc();
  }
});

afterAll(async () => {
  // Clean up global test data
  delete (global as any).__authTestData;
  
  // Wait for any pending timers or async operations
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Custom matchers for authentication testing
expect.extend({
  toBeValidSession(received) {
    const pass = received && 
                 typeof received.userId === 'string' &&
                 received.userId.length > 0 &&
                 received.createdAt instanceof Date;
    
    return {
      message: () => `expected ${JSON.stringify(received)} to be a valid session object`,
      pass,
    };
  },
  
  toBeValidUser(received) {
    const pass = received &&
                 typeof received.id === 'string' &&
                 typeof received.email === 'string' &&
                 typeof received.role === 'string' &&
                 ['admin', 'manager', 'tenant', 'resident', 'demo_manager'].includes(received.role);
    
    return {
      message: () => `expected ${JSON.stringify(received)} to be a valid user object`,
      pass,
    };
  },
  
  toHavePermission(received, permission) {
    const authTestData = (global as any).__authTestData;
    const userPermissions = authTestData?.permissions[received.role] || [];
    const pass = userPermissions.includes(permission) || userPermissions.includes('*');
    
    return {
      message: () => `expected user with role ${received.role} to have permission ${permission}`,
      pass,
    };
  },
});

// Extend Jest types
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidSession(): R;
      toBeValidUser(): R;
      toHavePermission(permission: string): R;
    }
  }
}

// Helper functions for authentication tests
export const createTestSession = (userId: string, role: string = 'admin') => {
  const sessionId = `test-session-${userId}-${Date.now()}`;
  const session = {
    id: sessionId,
    userId,
    role,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  };
  
  const authTestData = (global as any).__authTestData;
  if (authTestData) {
    authTestData.sessions.set(sessionId, session);
  }
  
  return session;
};

export const createTestUser = (overrides: any = {}) => {
  return {
    id: 'test-user-' + Math.random().toString(36).substr(2, 9),
    username: 'testuser',
    email: 'test@example.com',
    role: 'admin',
    firstName: 'Test',
    lastName: 'User',
    isActive: true,
    ...overrides,
  };
};

export const createTestRequest = (overrides: any = {}) => {
  return {
    headers: {},
    body: {},
    session: {},
    user: null,
    ...overrides,
  };
};

export const createTestResponse = () => {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
    headers: {},
    statusCode: 200,
  };
  
  return res;
};

// Test data helpers
export const getTestUser = (email: string) => {
  const authTestData = (global as any).__authTestData;
  return authTestData?.demoUsers[email] || null;
};

export const getAllTestUsers = () => {
  const authTestData = (global as any).__authTestData;
  return authTestData?.demoUsers || {};
};

export const getUserPermissions = (role: string) => {
  const authTestData = (global as any).__authTestData;
  return authTestData?.permissions[role] || [];
};