import { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { storage } from './storage';
import type { User } from '@shared/schema';
// Database-based permission checking - no config files needed
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import { EmailService } from './services/email-service';

/**
 * Check if a user role has a specific permission via database lookup.
 * @param userRole - The user's role (admin, manager, tenant, resident).
 * @param permissionName - The permission name (e.g., 'read:user', 'create:building').
 * @returns Promise<boolean> - True if user has permission.
 */
async function checkUserPermission(userRole: string, permissionName: string): Promise<boolean> {
  try {
    const result = await db
      .select()
      .from(schema.rolePermissions)
      .leftJoin(schema.permissions, eq(schema.rolePermissions.permissionId, schema.permissions.id))
      .where(
        and(
          eq(schema.rolePermissions.role, userRole as any),
          eq(schema.permissions.name, permissionName)
        )
      )
      .limit(1);

    return result.length > 0;
  } catch (error) {
    console.error('Error checking user permission:', error);
    return false;
  }
}

// Initialize email service
const emailService = new EmailService();

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
 * Enhanced password hashing using bcrypt with salt for Quebec Law 25 compliance.
 * Provides strong security using industry-standard bcrypt algorithm
 * with configurable salt rounds (default: 12).
 * 
 * @param {string} password - Plain text password to hash.
 * @returns {Promise<string>} Promise resolving to bcrypt hashed password.
 * 
 * @example
 * ```typescript
 * const hashedPassword = await hashPassword('userPassword123');
 * // Store hashed password securely in database
 * await storage.createUser({ ...userData, password: hashedPassword });
 * ```
 */
/**
 * HashPassword function.
 * @param password
 * @returns Function result.
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12; // Recommended for production
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Verifies a password against stored bcrypt hash using constant-time comparison.
 * Uses bcrypt.compare for secure password verification.
 * 
 * @param {string} password - Plain text password to verify.
 * @param {string} hashedPassword - Stored bcrypt hash from user record.
 * @returns {Promise<boolean>} Promise resolving to true if password matches, false otherwise.
 * 
 * @example
 * ```typescript
 * const user = await storage.getUserByEmail(email);
 * const isValid = await verifyPassword(inputPassword, user.password);
 * if (isValid) {
 *   // Grant access
 * }
 * ```
 */
/**
 * VerifyPassword function.
 * @param password
 * @param hashedPassword
 * @returns Function result.
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

/**
 * Legacy PBKDF2 password verification for backward compatibility during migration.
 * Used to verify old PBKDF2 passwords and migrate them to bcrypt.
 * 
 * @param {string} password - Plain text password to verify.
 * @param {string} salt - Stored hexadecimal salt value.
 * @param {string} hash - Stored hexadecimal hash value.
 * @returns {boolean} True if password matches, false otherwise.
 */
export function verifyLegacyPassword(password: string, salt: string, hash: string): boolean {
  const { pbkdf2Sync } = require('crypto');
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
/**
 * RequireAuth function.
 * @param req
 * @param res
 * @param next
 * @returns Function result.
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
        if (err) {console.error('Session destruction _error:', err);}
      });
      return res.status(401).json({ 
        message: 'User account not found or inactive',
        code: 'USER_INACTIVE' 
      });
    }

    // Set session role (permissions handled via database)
    req.session.role = user.role;

    // Add organization information to the user object - temporarily simplified due to relations issue
    const userOrganizations = await db.select({
      organizationId: schema.userOrganizations.organizationId,
      canAccessAllOrganizations: schema.userOrganizations.canAccessAllOrganizations
    })
    .from(schema.userOrganizations)
    .where(and(
      eq(schema.userOrganizations.userId, user.id),
      eq(schema.userOrganizations.isActive, true)
    ));

    // Enhanced user object with organization access information
    req.user = {
      ...user,
      organizations: userOrganizations.map(uo => uo.organizationId),
      canAccessAllOrganizations: userOrganizations.some(uo => uo.canAccessAllOrganizations)
    } as any;
    
    next();
  } catch (_error) {
    console.error('Authentication _error:', _error);
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
/**
 * RequireRole function.
 * @param allowedRoles
 * @returns Function result.
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
 * Validates user permissions based on the database RBAC system.
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
/**
 * Authorize function.
 * @param permission
 * @returns Function result.
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
      // Check if the user's role has the required permission via database
      const hasPermission = await checkUserPermission(req.user.role as any, permission);

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
    } catch (_error) {
      console.error('Authorization _error:', _error);
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
/**
 * SetupAuthRoutes function.
 * @param app
 * @returns Function result.
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

      // Handle bcrypt hashes, legacy PBKDF2 (salt:hash), and plain text passwords
      let isValidPassword = false;
      
      if (user.password.startsWith('$2')) {
        // Modern format: bcrypt hash
        isValidPassword = await verifyPassword(password, user.password);
      } else if (user.password.includes(':')) {
        // Legacy PBKDF2 format: salt:hash (migrate to bcrypt)
        const [salt, hash] = user.password.split(':');
        isValidPassword = verifyLegacyPassword(password, salt, hash);
        
        if (isValidPassword) {
          // Automatically upgrade to bcrypt
          const hashedPassword = await hashPassword(password);
          await storage.updateUser(user.id, { password: hashedPassword });
          console.warn(`Password upgraded from PBKDF2 to bcrypt for user: ${user.id}`);
        }
      } else {
        // Legacy format: plain text (migrate to bcrypt)
        if (user.password === password) {
          isValidPassword = true;
          
          // Automatically upgrade to bcrypt
          const hashedPassword = await hashPassword(password);
          await storage.updateUser(user.id, { password: hashedPassword });
          console.warn(`Password upgraded from plain text to bcrypt for user: ${user.id}`);
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

      // Set session with user data
      req.session.userId = user.id;
      req.session.userRole = user.role;
      req.session.role = user.role;

      // Return user data (without password)
      const { password: _, ...userData } = user;
      res.json({
        user: userData,
        message: 'Login successful'
      });

    } catch (_error) {
      console.error('Login _error:', _error);
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
        console.error('Logout _error:', err);
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

      // Create user with bcrypt hashed password
      const hashedPassword = await hashPassword(password);
      
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

    } catch (_error) {
      console.error('Registration _error:', _error);
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
      } as any);

      // Send password reset email
      const frontendUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
      const cleanUrl = frontendUrl.endsWith('/') ? frontendUrl.slice(0, -1) : frontendUrl;
      const resetUrl = `${cleanUrl}/reset-password?token=${resetToken}`;
      
      console.warn('Generated reset URL:', resetUrl);
      
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

    } catch (_error) {
      console.error('Password reset request _error:', _error);
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

      // Validate password strength
      if (password.length < 8) {
        return res.status(400).json({ 
          message: 'Password must be at least 8 characters long',
          code: 'PASSWORD_TOO_SHORT' 
        });
      }

      // Check password complexity requirements
      const hasUpperCase = /[A-Z]/.test(password);
      const hasLowerCase = /[a-z]/.test(password);
      const hasNumbers = /\d/.test(password);
      
      if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
        return res.status(400).json({ 
          message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
          code: 'PASSWORD_TOO_WEAK' 
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

      // Update user password with bcrypt hashed version
      const hashedPassword = await hashPassword(password);
      
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

    } catch (_error) {
      console.error('Password reset _error:', _error);
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