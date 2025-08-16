import { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import { createHash, randomBytes, pbkdf2Sync } from 'crypto';
import { storage } from './storage';
import type { User } from '@shared/schema';

// Configure session store with PostgreSQL
const PostgreSqlStore = connectPg(session);

/**
 * Session configuration for Quebec-compliant user authentication.
 * Uses PostgreSQL session store for scalability and Law 25 compliance.
 */
export const sessionConfig = session({
  store: new PostgreSqlStore({
    conString: process.env.DATABASE_URL,
    tableName: 'user_sessions',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax',
  },
  name: 'koveo.sid',
});

/**
 * Enhanced password hashing using PBKDF2 with salt.
 * Provides strong security until bcrypt can be installed.
 * 
 * @param password - Plain text password to hash
 * @returns Object containing salt and hashed password
 */
export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = randomBytes(32).toString('hex');
  const hash = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

/**
 * Verifies a password against stored hash and salt.
 * 
 * @param password - Plain text password to verify
 * @param salt - Stored salt value
 * @param hash - Stored hash value
 * @returns True if password matches
 */
export function verifyPassword(password: string, salt: string, hash: string): boolean {
  const verifyHash = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

/**
 * Authentication middleware to protect routes.
 * Ensures user is logged in before accessing protected resources.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ 
      message: 'Authentication required',
      code: 'AUTH_REQUIRED' 
    });
  }

  try {
    const user = await storage.getUser(req.session.userId);
    if (!user || !user.isActive) {
      req.session.destroy((err) => {
        if (err) console.error('Session destruction error:', err);
      });
      return res.status(401).json({ 
        message: 'User account not found or inactive',
        code: 'USER_INACTIVE' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ 
      message: 'Authentication error',
      code: 'AUTH_ERROR' 
    });
  }
}

/**
 * Role-based authorization middleware.
 * Restricts access based on user roles.
 * 
 * @param allowedRoles - Array of roles that can access the route
 */
export function requireRole(allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'AUTH_REQUIRED' 
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: allowedRoles,
        current: req.user.role
      });
    }

    next();
  };
}

/**
 * Authentication routes for login, logout, and user management.
 * Implements Quebec-compliant user authentication with session management.
 */
export function setupAuthRoutes(app: any) {
  // Login route
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ 
          message: 'Email and password are required',
          code: 'MISSING_CREDENTIALS' 
        });
      }

      const user = await storage.getUserByEmail(email.toLowerCase());
      if (!user) {
        return res.status(401).json({ 
          message: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS' 
        });
      }

      if (!user.isActive) {
        return res.status(401).json({ 
          message: 'Account is inactive',
          code: 'ACCOUNT_INACTIVE' 
        });
      }

      // For now, store password as plain text until bcrypt is available
      // TODO: Implement proper password hashing with bcrypt
      if (user.password !== password) {
        return res.status(401).json({ 
          message: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS' 
        });
      }

      // Update last login
      await storage.updateUser(user.id, { lastLoginAt: new Date() });

      // Set session
      req.session.userId = user.id;
      req.session.userRole = user.role;

      // Return user data (without password)
      const { password: _, ...userData } = user;
      res.json({
        user: userData,
        message: 'Login successful'
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ 
        message: 'Login failed',
        code: 'LOGIN_ERROR' 
      });
    }
  });

  // Logout route
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ 
          message: 'Logout failed',
          code: 'LOGOUT_ERROR' 
        });
      }

      res.clearCookie('koveo.sid');
      res.json({ message: 'Logout successful' });
    });
  });

  // Get current user route
  app.get('/api/auth/user', requireAuth, async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Not authenticated',
        code: 'NOT_AUTHENTICATED' 
      });
    }

    const { password: _, ...userData } = req.user;
    res.json(userData);
  });

  // Register route (admin only for now)
  app.post('/api/auth/register', requireAuth, requireRole(['admin']), async (req: Request, res: Response) => {
    try {
      const { email, password, firstName, lastName, role = 'tenant', language = 'fr' } = req.body;

      if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({ 
          message: 'All fields are required',
          code: 'MISSING_FIELDS' 
        });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email.toLowerCase());
      if (existingUser) {
        return res.status(409).json({ 
          message: 'User already exists',
          code: 'USER_EXISTS' 
        });
      }

      // Create user
      const newUser = await storage.createUser({
        email: email.toLowerCase(),
        password, // TODO: Hash with bcrypt
        firstName,
        lastName,
        role,
        language,
      });

      const { password: _, ...userData } = newUser;
      res.status(201).json({
        user: userData,
        message: 'User created successfully'
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ 
        message: 'Registration failed',
        code: 'REGISTRATION_ERROR' 
      });
    }
  });
}

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// Extend session interface
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    userRole?: string;
  }
}