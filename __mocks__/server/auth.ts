/**
 * Mock for server/auth.ts - Prevents real authentication imports during tests
 * Provides mock authentication functions and middleware for testing
 */

// Mock session store
export const sessionStore = {
  get: jest.fn(),
  set: jest.fn(),
  destroy: jest.fn(),
  all: jest.fn(),
  clear: jest.fn(),
  length: jest.fn(),
  touch: jest.fn()
};

// Mock authentication middleware
export const authenticate = jest.fn().mockImplementation((req: any, res: any, next: any) => {
  // Mock user authentication - set a test user
  req.user = {
    id: 'mock-user-id',
    email: 'test@example.com',
    role: 'admin',
    firstName: 'Test',
    lastName: 'User'
  };
  next();
});

// Mock authorization middleware
export const authorize = jest.fn().mockImplementation((permission: string) => {
  return (req: any, res: any, next: any) => {
    // Mock authorization - always allow for tests
    next();
  };
});

// Mock RBAC functions
export const checkPermission = jest.fn().mockReturnValue(true);
export const getUserPermissions = jest.fn().mockReturnValue(['read', 'write', 'manage']);
export const hasRole = jest.fn().mockReturnValue(true);

// Mock session management functions
export const createSession = jest.fn().mockImplementation(async (userId: string) => {
  return {
    id: 'mock-session-id',
    userId,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 3600000) // 1 hour
  };
});

export const destroySession = jest.fn().mockResolvedValue(undefined);
export const validateSession = jest.fn().mockResolvedValue(true);

// Mock password utilities
export const hashPassword = jest.fn().mockImplementation(async (password: string) => {
  return `hashed_${password}`;
});

export const verifyPassword = jest.fn().mockImplementation(async (password: string, hash: string) => {
  return hash === `hashed_${password}`;
});

// Mock token utilities
export const generateToken = jest.fn().mockReturnValue('mock-token-123');
export const verifyToken = jest.fn().mockReturnValue({ valid: true, data: { userId: 'mock-user-id' } });

// Mock database connection info
export const getDatabaseUrl = jest.fn().mockReturnValue('mock://test-database-url');

// Mock session store creation
export const createSessionStore = jest.fn().mockReturnValue(sessionStore);

// Mock auth configuration
export const authConfig = {
  sessionSecret: 'test-session-secret',
  tokenExpiry: 3600,
  passwordMinLength: 8,
  maxLoginAttempts: 5
};

// Mock middleware for various auth scenarios
export const requireAuth = jest.fn().mockImplementation((req: any, res: any, next: any) => next());
export const requireAdmin = jest.fn().mockImplementation((req: any, res: any, next: any) => next());
export const requireManager = jest.fn().mockImplementation((req: any, res: any, next: any) => next());

// Mock invitation functions
export const validateInvitation = jest.fn().mockResolvedValue({
  valid: true,
  invitation: {
    id: 'mock-invitation-id',
    email: 'test@example.com',
    role: 'manager',
    status: 'pending'
  }
});

export const acceptInvitation = jest.fn().mockResolvedValue({
  success: true,
  user: {
    id: 'mock-user-id',
    email: 'test@example.com',
    role: 'manager'
  }
});

// Export default session store for compatibility
export default sessionStore;