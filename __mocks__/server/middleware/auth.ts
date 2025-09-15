/**
 * Mock for server/middleware/auth.ts
 * Provides authentication middleware mocks for integration tests
 */

// Mock authentication middleware
export const isAuthenticated = jest.fn().mockImplementation((req: any, res: any, next: any) => {
  // Mock authenticated user
  req.user = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'admin',
    isActive: true
  };
  next();
});

// Mock role-based middleware
export const requireRole = jest.fn().mockImplementation((role: string) => {
  return (req: any, res: any, next: any) => {
    // Always allow for tests
    next();
  };
});

export const requireAdmin = jest.fn().mockImplementation((req: any, res: any, next: any) => {
  next();
});

export const requireManager = jest.fn().mockImplementation((req: any, res: any, next: any) => {
  next();
});

export const requireTenant = jest.fn().mockImplementation((req: any, res: any, next: any) => {
  next();
});

// Mock optional authentication
export const optionalAuth = jest.fn().mockImplementation((req: any, res: any, next: any) => {
  // Set user if available, but don't require it
  req.user = req.user || null;
  next();
});

// Mock session validation
export const validateSession = jest.fn().mockImplementation((req: any, res: any, next: any) => {
  // Mock valid session
  req.session = {
    id: 'mock-session-id',
    userId: '123e4567-e89b-12d3-a456-426614174000',
    isValid: true
  };
  next();
});

// Export default for backward compatibility
export default {
  isAuthenticated,
  requireRole,
  requireAdmin,
  requireManager,
  requireTenant,
  optionalAuth,
  validateSession
};