/**
 * Selective Authentication Mock for Higher-Fidelity Testing
 * This mock allows selective unmocking of auth components for more realistic testing
 */

import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';

// Environment-based mock control
const shouldMockAuth = process.env.TEST_TYPE === 'unit';
const shouldMockPasswords = process.env.MOCK_PASSWORDS !== 'false';

// Real bcrypt functions for password testing (when not mocked)
export const hashPassword = shouldMockPasswords 
  ? jest.fn().mockImplementation(async (password: string) => `hashed_${password}`)
  : async (password: string): Promise<string> => {
      const saltRounds = 12;
      return await bcrypt.hash(password, saltRounds);
    };

export const verifyPassword = shouldMockPasswords
  ? jest.fn().mockImplementation(async (password: string, hash: string) => hash === `hashed_${password}`)
  : async (password: string, hashedPassword: string): Promise<boolean> => {
      return await bcrypt.compare(password, hashedPassword);
    };

// Enhanced session store with more realistic behavior
export const sessionStore = {
  sessions: new Map<string, any>(),
  
  get: jest.fn().mockImplementation(function(sid: string, callback: Function) {
    const session = this.sessions.get(sid);
    callback(null, session || null);
  }),
  
  set: jest.fn().mockImplementation(function(sid: string, session: any, callback: Function) {
    this.sessions.set(sid, { ...session, _sessionId: sid });
    callback(null);
  }),
  
  destroy: jest.fn().mockImplementation(function(sid: string, callback: Function) {
    this.sessions.delete(sid);
    callback(null);
  }),
  
  all: jest.fn().mockImplementation(function(callback: Function) {
    callback(null, Array.from(this.sessions.values()));
  }),
  
  clear: jest.fn().mockImplementation(function(callback: Function) {
    this.sessions.clear();
    callback(null);
  }),
  
  length: jest.fn().mockImplementation(function(callback: Function) {
    callback(null, this.sessions.size);
  }),
  
  touch: jest.fn().mockImplementation(function(sid: string, session: any, callback: Function) {
    if (this.sessions.has(sid)) {
      this.sessions.set(sid, { ...session, lastAccess: new Date() });
    }
    callback(null);
  })
};

// Enhanced user permission checking with real logic
export const checkPermission = shouldMockAuth 
  ? jest.fn().mockReturnValue(true)
  : async (userRole: string, permissionName: string): Promise<boolean> => {
      // Real permission logic for integration tests
      const rolePermissions = {
        admin: ['*'], // Admin has all permissions
        manager: ['read:*', 'write:building', 'write:residence', 'write:maintenance', 'read:user'],
        tenant: ['read:own_data', 'write:maintenance_request', 'read:building'],
        resident: ['read:own_data', 'read:building'],
        demo_manager: ['read:*', 'write:demo_data'], // Limited demo permissions
      };
      
      const permissions = rolePermissions[userRole as keyof typeof rolePermissions] || [];
      
      // Check if user has the specific permission or wildcard permission
      return permissions.includes(permissionName) || 
             permissions.includes('*') ||
             permissions.some(p => p.endsWith('*') && permissionName.startsWith(p.slice(0, -1)));
    };

export const getUserPermissions = shouldMockAuth
  ? jest.fn().mockReturnValue(['read', 'write', 'manage'])
  : (userRole: string): string[] => {
      const rolePermissions = {
        admin: ['*'],
        manager: ['read:*', 'write:building', 'write:residence', 'write:maintenance', 'read:user'],
        tenant: ['read:own_data', 'write:maintenance_request', 'read:building'],
        resident: ['read:own_data', 'read:building'],
        demo_manager: ['read:*', 'write:demo_data'],
      };
      
      return rolePermissions[userRole as keyof typeof rolePermissions] || [];
    };

export const hasRole = shouldMockAuth
  ? jest.fn().mockReturnValue(true)
  : (userRole: string, requiredRole: string): boolean => {
      const roleHierarchy = {
        admin: ['admin', 'manager', 'tenant', 'resident'],
        manager: ['manager', 'tenant', 'resident'], 
        tenant: ['tenant'],
        resident: ['resident'],
        demo_manager: ['demo_manager'],
      };
      
      return roleHierarchy[userRole as keyof typeof roleHierarchy]?.includes(requiredRole) || false;
    };

// Enhanced authentication middleware
export const authenticate = jest.fn().mockImplementation((req: any, res: any, next: any) => {
  // Check for test authentication header
  const testUserId = req.headers['x-test-user-id'];
  const testRole = req.headers['x-test-role'];
  
  if (testUserId) {
    req.user = {
      id: testUserId,
      email: `${testUserId}@test.com`,
      role: testRole || 'admin',
      firstName: 'Test',
      lastName: 'User',
      isActive: true,
    };
    req.session = req.session || {};
    req.session.userId = testUserId;
    req.session.role = testRole || 'admin';
    return next();
  }
  
  // Check for real session
  if (req.session?.userId) {
    // For mocked sessions, create a mock user
    req.user = {
      id: req.session.userId,
      email: req.session.user?.email || 'test@example.com',
      role: req.session.role || 'admin',
      firstName: req.session.user?.firstName || 'Test',
      lastName: req.session.user?.lastName || 'User',
      isActive: true,
    };
    return next();
  }
  
  return res.status(401).json({
    message: 'Authentication required',
    code: 'AUTH_REQUIRED'
  });
});

// Enhanced authorization middleware
export const authorize = jest.fn().mockImplementation((permission: string) => {
  return async (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }
    
    // Use real permission checking when not fully mocked
    const hasPermission = await checkPermission(req.user.role, permission);
    
    if (!hasPermission) {
      return res.status(403).json({
        message: 'Insufficient permissions',
        code: 'PERMISSION_DENIED',
        required: permission,
        userRole: req.user.role,
      });
    }
    
    next();
  };
});

// Enhanced session management
export const createSession = jest.fn().mockImplementation(async (userId: string, userData?: any) => {
  const sessionId = `session_${userId}_${Date.now()}`;
  const session = {
    id: sessionId,
    userId,
    user: userData,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  };
  
  sessionStore.sessions.set(sessionId, session);
  return session;
});

export const destroySession = jest.fn().mockImplementation(async (sessionId: string) => {
  sessionStore.sessions.delete(sessionId);
});

export const validateSession = jest.fn().mockImplementation(async (sessionId: string) => {
  const session = sessionStore.sessions.get(sessionId);
  if (!session) return false;
  
  // Check if session is expired
  if (session.expiresAt && new Date() > session.expiresAt) {
    sessionStore.sessions.delete(sessionId);
    return false;
  }
  
  return true;
});

// Mock token utilities
export const generateToken = jest.fn().mockReturnValue('mock-token-123');
export const verifyToken = jest.fn().mockReturnValue({ valid: true, data: { userId: 'mock-user-id' } });

// Enhanced demo user detection and restrictions
export const isDemoUser = (user: any): boolean => {
  return user?.username?.startsWith('demo-') || 
         user?.email?.includes('demo') || 
         user?.role?.startsWith('demo_');
};

export const enforceDemoRestrictions = (req: any, res: any, next: any) => {
  if (req.user && isDemoUser(req.user)) {
    const restrictedMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    const restrictedPaths = ['/api/users', '/api/organizations', '/api/bills', '/api/financial'];
    
    if (restrictedMethods.includes(req.method) || 
        restrictedPaths.some(path => req.path.startsWith(path))) {
      return res.status(403).json({
        error: 'Demo users cannot perform this action',
        code: 'DEMO_RESTRICTION'
      });
    }
  }
  next();
};

// Role-based middleware
export const requireAuth = authenticate;
export const requireAdmin = jest.fn().mockImplementation((req: any, res: any, next: any) => next());
export const requireManager = jest.fn().mockImplementation((req: any, res: any, next: any) => next());

// Invitation functions
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

// Enhanced auth routes setup for testing
export const setupAuthRoutes = jest.fn().mockImplementation((app: any) => {
  // Mock login route with realistic behavior
  app.post('/api/auth/login', async (req: any, res: any) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required',
        code: 'MISSING_CREDENTIALS'
      });
    }
    
    // Realistic demo users for testing
    const demoUsers = {
      'admin@demo.com': { id: 'admin-demo-id', role: 'admin', password: 'demo123' },
      'manager@demo.com': { id: 'manager-demo-id', role: 'manager', password: 'demo123' },
      'tenant@demo.com': { id: 'tenant-demo-id', role: 'tenant', password: 'demo123' },
      'test@example.com': { id: 'test-user-id', role: 'admin', password: 'test123' },
    };
    
    const user = demoUsers[email as keyof typeof demoUsers];
    if (!user) {
      return res.status(401).json({
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }
    
    // Use real password verification when not mocked
    const isValidPassword = shouldMockPasswords 
      ? user.password === password
      : await verifyPassword(password, user.password);
      
    if (!isValidPassword) {
      return res.status(401).json({
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }
    
    // Create session
    const session = await createSession(user.id, { email, role: user.role });
    req.session = req.session || {};
    req.session.userId = user.id;
    req.session.user = { email, role: user.role };
    req.session.role = user.role;
    
    res.json({
      message: 'Login successful',
      user: { id: user.id, email, role: user.role }
    });
  });
  
  // Mock user info route
  app.get('/api/auth/user', authenticate, (req: any, res: any) => {
    res.json(req.user);
  });
  
  // Mock logout route
  app.post('/api/auth/logout', (req: any, res: any) => {
    if (req.session) {
      req.session.destroy((err: any) => {
        if (err) {
          return res.status(500).json({ message: 'Logout failed' });
        }
        res.clearCookie('koveo.sid');
        res.json({ message: 'Logout successful' });
      });
    } else {
      res.json({ message: 'Logout successful' });
    }
  });
});

// Auth configuration
export const authConfig = {
  sessionSecret: 'test-session-secret',
  tokenExpiry: 3600,
  passwordMinLength: 8,
  maxLoginAttempts: 5
};

// Database connection mock
export const getDatabaseUrl = jest.fn().mockReturnValue('mock://test-database-url');
export const createSessionStore = jest.fn().mockReturnValue(sessionStore);

// Export default session store for compatibility
export default sessionStore;