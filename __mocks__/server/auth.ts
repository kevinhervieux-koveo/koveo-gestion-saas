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
export const requireRole = jest.fn().mockImplementation((roles: string[]) => (req: any, res: any, next: any) => next());
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

// Mock setupAuthRoutes function for integration tests
export const setupAuthRoutes = jest.fn().mockImplementation((app: any) => {
  // Mock login route
  app.post('/api/auth/login', (req: any, res: any) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required',
        code: 'MISSING_CREDENTIALS'
      });
    }
    
    // Mock demo users
    const demoUsers = {
      'admin@demo.com': { role: 'admin', password: 'demo123' },
      'manager@demo.com': { role: 'manager', password: 'demo123' },
      'tenant@demo.com': { role: 'tenant', password: 'demo123' }
    };
    
    const user = demoUsers[email as keyof typeof demoUsers];
    if (!user || user.password !== password) {
      return res.status(401).json({
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }
    
    // Set session
    req.session = req.session || {};
    req.session.userId = `user-${email.split('@')[0]}`;
    req.session.user = { email, role: user.role };
    
    res.json({
      message: 'Login successful',
      user: { email, role: user.role }
    });
  });
  
  // Mock user info route
  app.get('/api/auth/user', (req: any, res: any) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    res.json(req.session.user);
  });
  
  // Mock logout route
  app.post('/api/auth/logout', (req: any, res: any) => {
    req.session = null;
    res.json({ message: 'Logout successful' });
  });
});

// Export default session store for compatibility
export default sessionStore;