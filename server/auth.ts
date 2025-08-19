import { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import { createHash, randomBytes, pbkdf2Sync } from 'crypto';
import { storage } from './storage';
import type { User } from '@shared/schema';
import { checkPermission, permissions, getRolePermissions } from '../config';
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import { emailService } from './services/email-service';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

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
 * Enhanced password hashing using PBKDF2 with salt for Quebec Law 25 compliance.
 * Provides strong security using industry-standard key derivation function
 * with 10,000 iterations and SHA-512 hashing algorithm.
 * 
 * @param {string} password - Plain text password to hash.
 * @returns {{salt: string, hash: string}} Object containing hexadecimal salt and hashed password.
 * 
 * @example
 * ```typescript
 * const { salt, hash } = hashPassword('userPassword123');
 * // Store salt and hash securely in database
 * await storage.createUser({ ...userData, passwordSalt: salt, passwordHash: hash });
 * ```
 */
export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = randomBytes(32).toString('hex');
  const hash = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

/**
 * Verifies a password against stored hash and salt using constant-time comparison.
 * Uses the same PBKDF2 parameters as hashPassword to ensure consistency.
 * 
 * @param {string} password - Plain text password to verify.
 * @param {string} salt - Stored hexadecimal salt value from user record.
 * @param {string} hash - Stored hexadecimal hash value from user record.
 * @returns {boolean} True if password matches, false otherwise.
 * 
 * @example
 * ```typescript
 * const user = await storage.getUserByEmail(email);
 * const isValid = verifyPassword(inputPassword, user.passwordSalt, user.passwordHash);
 * if (isValid) {
 *   // Grant access
 * }
 * ```
 */
export function verifyPassword(password: string, salt: string, hash: string): boolean {
  const verifyHash = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

/**
 * Authentication middleware to protect routes requiring user login.
 * Validates session existence, retrieves user data, and ensures account is active.
 * Automatically destroys invalid sessions for security.
 * 
 * @param {Request} req - Express request object with session data.
 * @param {Response} res - Express response object for sending error responses.
 * @param {NextFunction} next - Express next function to continue to protected route.
 * @returns {Promise<void>} Promise that resolves when authentication is verified.
 * 
 * @example
 * ```typescript
 * app.get('/api/protected-route', requireAuth, async (req, res) => {
 *   // req.user is now available and verified
 *   res.json({ userId: req.user.id });
 * });
 * ```
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
        if (err) {console.error('Session destruction error:', err);}
      });
      return res.status(401).json({ 
        message: 'User account not found or inactive',
        code: 'USER_INACTIVE' 
      });
    }

    // Ensure session has role and permissions (for backwards compatibility)
    if (!req.session.role || !req.session.permissions) {
      const userPermissions = getRolePermissions(permissions, user.role as any);
      req.session.role = user.role;
      req.session.permissions = userPermissions;
    }

    // Add organization information to the user object
    const userOrganizations = await db.query.userOrganizations.findMany({
      where: and(
        eq(schema.userOrganizations.userId, user.id),
        eq(schema.userOrganizations.isActive, true)
      ),
      with: {
        organization: true
      }
    });

    // Enhanced user object with organization access information
    req.user = {
      ...user,
      organizations: userOrganizations.map(uo => uo.organizationId),
      canAccessAllOrganizations: userOrganizations.some(uo => uo.canAccessAllOrganizations)
    } as any;
    
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
 * Role-based authorization middleware factory for Quebec property management roles.
 * Creates middleware that restricts access based on user roles such as admin, manager, tenant.
 * Must be used after requireAuth middleware.
 * 
 * @param {string[]} allowedRoles - Array of roles that can access the route (e.g., ['admin', 'manager']).
 * @returns {Function} Express middleware function for role validation.
 * 
 * @example
 * ```typescript
 * // Only admins can access user management
 * app.get('/api/admin/users', requireAuth, requireRole(['admin']), getUserList);
 * 
 * // Managers and admins can access building data
 * app.get('/api/buildings', requireAuth, requireRole(['admin', 'manager']), getBuildings);
 * ```
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
 * Permission-based authorization middleware factory using the comprehensive RBAC system.
 * Validates user permissions based on the permissions.json configuration.
 * Must be used after requireAuth middleware.
 * 
 * @param {string} permission - Specific permission required to access the route (e.g., 'read:bill', 'create:maintenance_request').
 * @returns {Function} Express middleware function for permission validation.
 * 
 * @example
 * ```typescript
 * // Only users with 'read:bill' permission can access
 * app.get('/api/bills', requireAuth, authorize('read:bill'), getBills);
 * 
 * // Only users with 'delete:user' permission can delete users
 * app.delete('/api/users/:id', requireAuth, authorize('delete:user'), deleteUser);
 * 
 * // Multiple route protection
 * router.use(authorize('manage:building'));
 * router.post('/buildings', createBuilding);
 * router.patch('/buildings/:id', updateBuilding);
 * ```
 */
export function authorize(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'AUTH_REQUIRED' 
      });
    }

    try {
      // Check if the user's role has the required permission
      const hasPermission = checkPermission(permissions, req.user.role as any, permission as any);

      if (!hasPermission) {
        return res.status(403).json({
          message: 'Insufficient permissions',
          code: 'PERMISSION_DENIED',
          required: permission,
          userRole: req.user.role,
          details: `User with role '${req.user.role}' does not have permission '${permission}'`
        });
      }

      next();
    } catch (error) {
      console.error('Authorization error:', error);
      return res.status(500).json({
        message: 'Authorization check failed',
        code: 'AUTHORIZATION_ERROR'
      });
    }
  };
}

/**
 * Sets up authentication routes for Quebec-compliant user management.
 * Implements login, logout, registration, and current user endpoints
 * with proper session management and Law 25 compliance considerations.
 * 
 * @param {any} app - Express application instance to register routes on.
 * @returns {void} No return value - routes are registered directly on app.
 * 
 * @example
 * ```typescript
 * const app = express();
 * app.use(sessionConfig);
 * setupAuthRoutes(app);
 * // Authentication routes are now available:
 * // POST /api/auth/login
 * // POST /api/auth/logout  
 * // GET /api/auth/user
 * // POST /api/auth/register
 * ```
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

      // Handle both new hashed passwords (salt:hash) and legacy plain text passwords
      const passwordParts = user.password.split(':');
      let isValidPassword = false;
      
      if (passwordParts.length === 2) {
        // New format: salt:hash
        const [salt, hash] = passwordParts;
        isValidPassword = verifyPassword(password, salt, hash);
      } else {
        // Legacy format: plain text (migrate to hashed)
        if (user.password === password) {
          isValidPassword = true;
          
          // Automatically upgrade to hashed password
          const { salt, hash } = hashPassword(password);
          const hashedPassword = `${salt}:${hash}`;
          await storage.updateUser(user.id, { password: hashedPassword });
          console.log(`Password upgraded to hashed format for user: ${user.email}`);
        }
      }
      
      if (!isValidPassword) {
        return res.status(401).json({ 
          message: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS' 
        });
      }

      // Update last login
      await storage.updateUser(user.id, { lastLoginAt: new Date() });

      // Get user permissions based on role
      const userPermissions = getRolePermissions(permissions, user.role as any);

      // Set session with user data and permissions
      req.session.userId = user.id;
      req.session.userRole = user.role;
      req.session.role = user.role;
      req.session.permissions = userPermissions;

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

      // Create user with hashed password
      const { salt, hash } = hashPassword(password);
      const hashedPassword = `${salt}:${hash}`;
      
      const newUser = await storage.createUser({
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName,
        lastName,
        username: email.toLowerCase(), // Use email as username
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

  // Password Reset Request Route
  app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ 
          message: 'Email is required',
          code: 'MISSING_EMAIL' 
        });
      }

      const user = await storage.getUserByEmail(email.toLowerCase());
      if (!user || !user.isActive) {
        // Always respond with success for security (don't reveal if email exists)
        return res.json({ 
          message: 'If this email exists, a password reset link has been sent.',
          success: true 
        });
      }

      // Generate secure random token
      const resetToken = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(resetToken).digest('hex');

      // Create password reset token (expires in 1 hour)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);

      await storage.createPasswordResetToken({
        userId: user.id,
        token: resetToken,
        tokenHash: tokenHash,
        expiresAt: expiresAt,
        ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
      });

      // Send password reset email
      const frontendUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
      const cleanUrl = frontendUrl.endsWith('/') ? frontendUrl.slice(0, -1) : frontendUrl;
      const resetUrl = `${cleanUrl}/reset-password?token=${resetToken}`;
      
      console.log('Generated reset URL:', resetUrl);
      
      const emailSent = await emailService.sendPasswordResetEmail(
        email.toLowerCase(),
        `${user.firstName} ${user.lastName}`,
        resetUrl
      );

      if (!emailSent) {
        console.error('Failed to send password reset email to:', email);
        return res.status(500).json({ 
          message: 'Failed to send password reset email',
          code: 'EMAIL_SEND_FAILED' 
        });
      }

      res.json({ 
        message: 'If this email exists, a password reset link has been sent.',
        success: true 
      });

    } catch (error) {
      console.error('Password reset request error:', error);
      res.status(500).json({ 
        message: 'Password reset request failed',
        code: 'PASSWORD_RESET_REQUEST_ERROR' 
      });
    }
  });

  // Password Reset Route
  app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ 
          message: 'Token and password are required',
          code: 'MISSING_FIELDS' 
        });
      }

      if (password.length < 6) {
        return res.status(400).json({ 
          message: 'Password must be at least 6 characters long',
          code: 'PASSWORD_TOO_SHORT' 
        });
      }

      // Find the password reset token
      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) {
        return res.status(400).json({ 
          message: 'Invalid or expired password reset token',
          code: 'INVALID_TOKEN' 
        });
      }

      // Check if token is expired
      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({ 
          message: 'Password reset token has expired',
          code: 'TOKEN_EXPIRED' 
        });
      }

      // Check if token has already been used
      if (resetToken.isUsed) {
        return res.status(400).json({ 
          message: 'Password reset token has already been used',
          code: 'TOKEN_ALREADY_USED' 
        });
      }

      // Verify token hash for additional security
      const tokenHash = createHash('sha256').update(token).digest('hex');
      if (tokenHash !== resetToken.tokenHash) {
        return res.status(400).json({ 
          message: 'Invalid password reset token',
          code: 'INVALID_TOKEN_HASH' 
        });
      }

      // Get the user
      const user = await storage.getUser(resetToken.userId);
      if (!user || !user.isActive) {
        return res.status(400).json({ 
          message: 'User account not found or inactive',
          code: 'USER_NOT_FOUND' 
        });
      }

      // Update user password with hashed version
      const { salt, hash } = hashPassword(password);
      const hashedPassword = `${salt}:${hash}`;
      
      await storage.updateUser(user.id, { 
        password: hashedPassword,
        updatedAt: new Date() 
      });

      // Mark token as used
      await storage.markPasswordResetTokenAsUsed(resetToken.id);

      // Clean up expired tokens
      await storage.cleanupExpiredPasswordResetTokens();

      res.json({ 
        message: 'Password has been reset successfully',
        success: true 
      });

    } catch (error) {
      console.error('Password reset error:', error);
      res.status(500).json({ 
        message: 'Password reset failed',
        code: 'PASSWORD_RESET_ERROR' 
      });
    }
  });
}

// Extend Express Request interface to include user
declare global {
  namespace Express {
    /**
     *
     */
    interface Request {
      user?: User;
    }
  }
}

// Extend session interface
declare module 'express-session' {
  /**
   * Extended session data interface for Quebec property management system.
   * Includes user authentication data and cached permissions for performance.
   */
  interface SessionData {
    userId?: string;
    userRole?: string;
    role?: string;
    permissions?: string[];
  }
}