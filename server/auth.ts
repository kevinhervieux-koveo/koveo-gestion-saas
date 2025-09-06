import { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { storage } from './storage';
import { sql, db, pool } from './db';
import { config } from './config/index';
import type { User } from '@shared/schema';
// Database-based permission checking - no config files needed
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import { EmailService } from './services/email-service';
import { queryCache } from './query-cache';

/**
 * Check if a user role has a specific permission via database lookup.
 * @param userRole - The user's role (admin, manager, tenant, resident).
 * @param permissionName - The permission name (e.g., 'read:user', 'create:building').
 * @returns Promise<boolean> - True if user has permission.
 */
async function checkUserPermission(userRole: string, permissionName: string): Promise<boolean> {
  try {
    // Debug logging removed for production security

    // First check if permission exists at all
    const permissionExists = await db
      .select()
      .from(schema.permissions)
      .where(eq(schema.permissions.name, permissionName))
      .limit(1);

    // Permission exists check complete

    // Check role permissions
    const rolePermissions = await db
      .select()
      .from(schema.rolePermissions)
      .where(eq(schema.rolePermissions.role, userRole as any));

    // Role permissions checked

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

    // Permission check completed

    if (result.length === 0) {
      // Permission not found
      // Debug: list all admin permissions
      if (userRole === 'admin') {
        const adminPerms = await db
          .select({ name: schema.permissions.name })
          .from(schema.rolePermissions)
          .leftJoin(
            schema.permissions,
            eq(schema.rolePermissions.permissionId, schema.permissions.id)
          )
          .where(eq(schema.rolePermissions.role, 'admin'));
        // Admin permissions debug removed for security
      }
    }

    return result.length > 0;
  } catch (error: any) {
    console.error('❌ Permission check failed:', error);
    return false;
  }
}

// Initialize email service
const emailService = new EmailService();

// Database connection already imported at top of file

// Configure session store with PostgreSQL
const PostgreSqlStore = connectPg(session);

/**
 * Get the correct database URL based on environment and request domain.
 * Uses centralized configuration to determine the appropriate database.
 */
function getDatabaseUrl(requestDomain?: string): string {
  // Use the centralized database configuration
  const selectedUrl = config.database.getRuntimeDatabaseUrl(requestDomain);
  const isKoveoRequest = requestDomain?.includes('koveo-gestion.com');
  const isProduction = config.server.isProduction || isKoveoRequest;
  
  console.log(`🔗 Session store using ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} database: ${selectedUrl?.substring(0, 50)}... (domain: ${requestDomain || 'unknown'})`);
  
  if (!selectedUrl) {
    throw new Error('No database URL available for session store');
  }
  
  return selectedUrl;
}

/**
 * Session configuration for Quebec-compliant user authentication.
 * Uses PostgreSQL session store for scalability and Law 25 compliance.
 * Includes fallback for database connection issues in production.
 */
function createSessionStore(requestDomain?: string) {
  try {
    // Create a proper PostgreSQL pool for the session store
    // connect-pg-simple needs a real PostgreSQL pool, not the Neon HTTP client
    const sessionPool = new Pool({ 
      connectionString: getDatabaseUrl(requestDomain),
      max: 2, // Small pool for sessions
      min: 1,
      maxUses: 7500, // Maximum number of times a connection can be reused
      idleTimeoutMillis: 30000, // 30 seconds idle timeout
      allowExitOnIdle: true, // Allow pool to close when idle
    });
    
    // Use PostgreSQL session store for persistent sessions
    const store = new PostgreSqlStore({
      pool: sessionPool,
      tableName: 'session',
      createTableIfMissing: true, // Auto-create table in production if missing
      errorLog: process.env.NODE_ENV === 'test' ? () => {} : console.error, // Suppress error logging in tests
      
      // Add explicit configuration for session retrieval
      pruneSessionInterval: process.env.NODE_ENV === 'test' ? false : 60 * 1000, // Disable pruning in tests
      schemaName: 'public', // Explicitly set schema
    });
    
    console.log('✅ Session store: PostgreSQL session store created with proper pool');
    
    // Test the store connection (skip in test environment)
    if (process.env.NODE_ENV !== 'test') {
      store.get('test-session-id', (err, session) => {
        if (err) {
          console.error('❌ Session store connection test failed:', err);
        } else {
          console.log('✅ Session store connection test passed');
        }
      });
    }
    
    return store;
  } catch (error: any) {
    console.error('❌ Session store creation failed:', error);
    console.log('⚠️ Falling back to memory store (sessions will not persist)');
    return undefined; // Will use default memory store as fallback
  }
}

// Create session store with better database detection  
let sessionStore: any;
try {
  // Try to create session store with automatic database detection
  sessionStore = createSessionStore();
} catch (error) {
  console.error('❌ Failed to create initial session store:', error);
  sessionStore = undefined; // Will fall back to memory store
}

export const sessionConfig = session({
  store: sessionStore, // Use PostgreSQL session store for persistence
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
  resave: false, // Don't save unchanged sessions
  saveUninitialized: false,
  rolling: true, // Reset expiry on each request
  cookie: {
    secure: false, // Keep false for development to ensure cookies work
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days - longer session duration
    sameSite: 'lax',
    path: '/', // Explicitly set path
  },
  name: 'koveo.sid',
  proxy: false,
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
      code: 'AUTH_REQUIRED',
    });
  }

  try {
    // Optimized session touch - only touch when session is close to expiring
    if (req.session && req.session.touch && req.session.cookie) {
      const now = Date.now();
      const sessionAge = now - (req.session.cookie.originalMaxAge || 0) + (req.session.cookie.maxAge || 0);
      const sessionLifetime = req.session.cookie.originalMaxAge || (7 * 24 * 60 * 60 * 1000);
      
      // Only touch session if more than 25% of its lifetime has passed
      if (sessionAge > sessionLifetime * 0.25) {
        req.session.touch();
      }
    }

    // Loading user session

    // Clear any cached user data for this ID to ensure fresh load
    queryCache.invalidate('users', `user:${req.session.userId}`);
    queryCache.invalidate('users', `user_email:*`);

    const user = await storage.getUser(req.session.userId);
    // User loaded from session
    if (!user || !user.isActive) {
      req.session.destroy((err) => {
        if (err) {
          // Session destruction error handled
        }
      });
      return res.status(401).json({
        message: 'User account not found or inactive',
        code: 'USER_INACTIVE',
      });
    }

    // Set session role (permissions handled via database)
    req.session.role = user.role;

    // Add organization information to the user object - with error handling for resilience
    let userOrganizations: any[] = [];
    try {
      userOrganizations = await db
        .select({
          organizationId: schema.userOrganizations.organizationId,
          canAccessAllOrganizations: schema.userOrganizations.canAccessAllOrganizations,
        })
        .from(schema.userOrganizations)
        .where(
          and(
            eq(schema.userOrganizations.userId, user.id),
            eq(schema.userOrganizations.isActive, true)
          )
        );
    } catch (orgError) {
      // Organization lookup error handled gracefully
      // Continue with empty organizations - user can still authenticate
      userOrganizations = [];
    }

    // Enhanced user object with organization access information
    req.user = {
      ...user,
      organizations: userOrganizations.map((uo) => uo.organizationId),
      canAccessAllOrganizations: userOrganizations.some((uo) => uo.canAccessAllOrganizations),
    } as any;

    // Special handling for hardcoded demo users - ensure they have proper organization access
    // Check if the user record has organization access configured
    if (
      user.role?.startsWith('demo_') &&
      (!req.user.organizations || req.user.organizations.length === 0)
    ) {
      // Demo users should get access to demo organizations
      try {
        const demoOrgs = await db
          .select({ id: schema.organizations.id })
          .from(schema.organizations)
          .where(eq(schema.organizations.type, 'demo'))
          .limit(1);
        
        if (demoOrgs.length > 0) {
          // Adding organization access for demo user
          req.user.organizations = [demoOrgs[0].id];
          req.user.canAccessAllOrganizations = false;
        }
      } catch (demoOrgError) {
        // Demo organization lookup failed, continue without access
      }
    }

    next();
  } catch (error: any) {
    // Authentication error handled
    console.error('❌ Authentication error:', error);
    return res.status(500).json({
      message: 'Authentication error',
      code: 'AUTH_ERROR',
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
        code: 'AUTH_REQUIRED',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: allowedRoles,
        current: req.user.role,
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
        code: 'AUTH_REQUIRED',
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
          details: `User with role '${req.user.role}' does not have permission '${permission}'`,
        });
      }

      next();
    } catch (error: any) {
      // Authorization error handled
      console.error('❌ Authorization error:', error);
      return res.status(500).json({
        message: 'Authorization check failed',
        code: 'AUTHORIZATION_ERROR',
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
      // Login attempt initiated

      if (!email || !password) {
        return res.status(400).json({
          message: 'Email and password are required',
          code: 'MISSING_CREDENTIALS',
        });
      }

      // Retrieving user by email
      const user = await storage.getUserByEmail(email.toLowerCase());

      if (!user) {
        return res.status(401).json({
          message: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS',
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          message: 'Account is inactive',
          code: 'ACCOUNT_INACTIVE',
        });
      }

      // Use bcrypt for password verification
      // Verifying password for user
      // Password verification initiated
      const isValidPassword = await verifyPassword(password, user.password);
      // Password verification completed

      if (!isValidPassword) {
        return res.status(401).json({
          message: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS',
        });
      }

      // Update last login
      await storage.updateUser(user.id, { lastLoginAt: new Date() });

      // Set session with user data
      req.session.userId = user.id;
      req.session.userRole = user.role;
      req.session.role = user.role;
      req.session.user = user; // Add complete user object for middleware compatibility

      // Save session explicitly to ensure it's persisted
      req.session.save((err) => {
        if (err) {
          console.error('❌ Session save error:', err);
          return res.status(500).json({
            message: 'Session save failed',
            code: 'SESSION_SAVE_ERROR',
          });
        }

        
        // Return user data (without password)
        const { password: _, ...userData } = user;
        res.json({
          user: userData,
          message: 'Login successful',
        });
      });
    } catch (_error: any) {
      console.error('Login error:', {
        error: _error,
        email: req.body?.email,
        hasPassword: !!req.body?.password,
        databaseUrl: !!process.env.DATABASE_URL,
        sessionSecret: !!process.env.SESSION_SECRET,
      });
      res.status(500).json({
        message: 'Login failed',
        code: 'LOGIN_ERROR',
        ...(process.env.NODE_ENV === 'development' && { details: _error }),
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
          code: 'LOGOUT_ERROR',
        });
      }

      // Clear cookie with same settings as when it was set
      const cookieOptions: any = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      };

      res.clearCookie('koveo.sid', cookieOptions);
      res.json({ message: 'Logout successful' });
    });
  });

  // Get current user route
  app.get('/api/auth/user', async (req: Request, res: Response) => {
    try {
      // Check user session
      console.log('🔍 Auth check - Session exists:', !!req.session);
      console.log('🔍 Auth check - Session ID:', req.session?.id?.substring(0, 8) + '...');
      console.log('🔍 Auth check - User ID in session:', req.session?.userId);

      // Check if we have a valid session with user ID
      if (!req.session?.userId) {
        // No session found
        console.log('❌ No valid session found');
        return res.status(401).json({
          message: 'Not authenticated',
          code: 'NOT_AUTHENTICATED',
        });
      }

      // Try to get user from database
      try {
        const user = await storage.getUser(req.session.userId);
        // User lookup completed

        if (!user || !user.isActive) {
          // User not found or inactive, destroying session
          req.session.destroy((err) => {
            if (err) {
              console.error('Session destruction error:', err);
            }
          });
          return res.status(401).json({
            message: 'User account not found or inactive',
            code: 'USER_INACTIVE',
          });
        }

        // Optimized session touch - only when needed
        if (req.session && req.session.touch && req.session.cookie) {
          const now = Date.now();
          const sessionAge = now - (req.session.cookie.originalMaxAge || 0) + (req.session.cookie.maxAge || 0);
          const sessionLifetime = req.session.cookie.originalMaxAge || (7 * 24 * 60 * 60 * 1000);
          
          // Only touch session if more than 25% of its lifetime has passed
          if (sessionAge > sessionLifetime * 0.25) {
            req.session.touch();
          }
        }

        // Return user data without password
        const { password: _, ...userData } = user;
        // Successfully authenticated user
        res.json(userData);

      } catch (userError) {
        console.error('Database error getting user:', userError);
        return res.status(500).json({
          message: 'Authentication check failed',
          code: 'AUTH_CHECK_ERROR',
        });
      }
    } catch (error: any) {
      console.error('❌ Auth check error:', error);
      res.status(500).json({
        message: 'Authentication check failed',
        code: 'AUTH_CHECK_ERROR',
      });
    }
  });

  // Debug endpoint to check auth configuration (production only, temporary)
  app.get('/api/auth/debug', async (req: Request, res: Response) => {
    const debugInfo = {
      hasSession: !!req.session,
      sessionId: req.sessionID,
      userId: req.session?.userId,
      userRole: req.session?.userRole,
      nodeEnv: process.env.NODE_ENV,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasSessionSecret: !!process.env.SESSION_SECRET,
      cookies: req.headers.cookie ? 'present' : 'missing',
      cookieHeader: req.headers.cookie,
      sessionStore: req.session?.store?.constructor?.name || 'unknown',
      userAgent: req.headers['user-agent'],
      host: req.headers.host,
      protocol: req.protocol,
      secure: req.secure,
      trustProxy: !!req.app.get('trust proxy'),
    };

    console.log('Auth debug info:', debugInfo);
    res.json(debugInfo);
  });

  // Test cookie setting endpoint
  app.post('/api/auth/test-cookie', (req: Request, res: Response) => {
    // Set a test session value
    req.session.testValue = 'test-' + Date.now();

    req.session.save((err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to save session', details: err.message });
      }

      res.json({
        message: 'Test cookie set',
        sessionId: req.sessionID,
        testValue: req.session.testValue,
        cookieSettings: {
          secure: process.env.NODE_ENV === 'production',
          httpOnly: true,
          sameSite: 'lax',
        },
      });
    });
  });

  // Register route (admin only for now)
  app.post(
    '/api/auth/register',
    requireAuth,
    requireRole(['admin']),
    async (req: Request, res: Response) => {
      try {
        const { email, password, firstName, lastName, role = 'tenant', language = 'fr' } = req.body;

        if (!email || !password || !firstName || !lastName) {
          return res.status(400).json({
            message: 'All fields are required',
            code: 'MISSING_FIELDS',
          });
        }

        // Check if user already exists
        const existingUser = await storage.getUserByEmail(email.toLowerCase());
        if (existingUser) {
          return res.status(409).json({
            message: 'User already exists',
            code: 'USER_EXISTS',
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
          message: 'User created successfully',
        });
      } catch (error: any) {
        console.error('❌ Registration error:', error);
        res.status(500).json({
          message: 'Registration failed',
          code: 'REGISTRATION_ERROR',
        });
      }
    }
  );

  // Password Reset Request Route
  app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          message: 'Email is required',
          code: 'MISSING_EMAIL',
        });
      }

      const user = await storage.getUserByEmail(email.toLowerCase());
      if (!user || !user.isActive) {
        // Always respond with success for security (don't reveal if email exists)
        return res.json({
          message: 'If this email exists, a password reset link has been sent.',
          success: true,
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
      const host = req.get('host') || '';

      // Use development URL for Replit environments, production URL otherwise
      let frontendUrl;
      if (
        host.includes('replit.dev') ||
        host.includes('replit.com') ||
        host.includes('replit.co') ||
        process.env.NODE_ENV === 'development'
      ) {
        // Use the actual Replit development URL
        frontendUrl = `${req.protocol}://${host}`;
      } else {
        // Use production URL - prioritize koveo-gestion.com for production
        if (host.includes('koveo-gestion.com')) {
          frontendUrl = `https://${host}`;
        } else {
          frontendUrl = process.env.FRONTEND_URL || 'https://koveo-gestion.com';
        }
      }

      const cleanUrl = frontendUrl.endsWith('/') ? frontendUrl.slice(0, -1) : frontendUrl;
      const resetUrl = `${cleanUrl}/reset-password?token=${resetToken}`;


      const emailSent = await emailService.sendPasswordResetEmail(
        email.toLowerCase(),
        `${user.firstName} ${user.lastName}`,
        resetUrl
      );

      if (!emailSent) {
        console.error('Failed to send password reset email to:', email);
        return res.status(500).json({
          message: 'Failed to send password reset email',
          code: 'EMAIL_SEND_FAILED',
        });
      }

      res.json({
        message: 'If this email exists, a password reset link has been sent.',
        success: true,
      });
    } catch (error: any) {
      console.error('❌ Password reset request error:', error);
      res.status(500).json({
        message: 'Password reset request failed',
        code: 'PASSWORD_RESET_REQUEST_ERROR',
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
          code: 'MISSING_FIELDS',
        });
      }

      // Validate password strength
      if (password.length < 8) {
        return res.status(400).json({
          message: 'Password must be at least 8 characters long',
          code: 'PASSWORD_TOO_SHORT',
        });
      }

      // Check password complexity requirements
      const hasUpperCase = /[A-Z]/.test(password);
      const hasLowerCase = /[a-z]/.test(password);
      const hasNumbers = /\d/.test(password);

      if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
        return res.status(400).json({
          message:
            'Password must contain at least one uppercase letter, one lowercase letter, and one number',
          code: 'PASSWORD_TOO_WEAK',
        });
      }

      // Find the password reset token
      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) {
        return res.status(400).json({
          message: 'Invalid or expired password reset token',
          code: 'INVALID_TOKEN',
        });
      }

      // Check if token is expired
      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({
          message: 'Password reset token has expired',
          code: 'TOKEN_EXPIRED',
        });
      }

      // Check if token has already been used
      if (resetToken.isUsed) {
        return res.status(400).json({
          message: 'Password reset token has already been used',
          code: 'TOKEN_ALREADY_USED',
        });
      }

      // Verify token hash for additional security
      const tokenHash = createHash('sha256').update(token).digest('hex');
      if (tokenHash !== resetToken.tokenHash) {
        return res.status(400).json({
          message: 'Invalid password reset token',
          code: 'INVALID_TOKEN_HASH',
        });
      }

      // Get the user
      const user = await storage.getUser(resetToken.userId);
      if (!user || !user.isActive) {
        return res.status(400).json({
          message: 'User account not found or inactive',
          code: 'USER_NOT_FOUND',
        });
      }

      // Update user password with bcrypt hashed version
      const hashedPassword = await hashPassword(password);

      await storage.updateUser(user.id, {
        password: hashedPassword,
        updatedAt: new Date(),
      });

      // Mark token as used
      await storage.markPasswordResetTokenAsUsed(resetToken.id);

      // Clean up expired tokens
      await storage.cleanupExpiredPasswordResetTokens();

      res.json({
        message: 'Password has been reset successfully',
        success: true,
      });
    } catch (error: any) {
      console.error('❌ Password reset error:', error);
      res.status(500).json({
        message: 'Password reset failed',
        code: 'PASSWORD_RESET_ERROR',
      });
    }
  });
}

/**
 * Document RBAC Functions - Role-Based Access Control for Documents
 * Implements the four-tier permission system: Admin > Manager > Resident > Tenant
 */

/**
 * Check if user can view a specific document based on RBAC rules
 * @param user - The authenticated user
 * @param document - The document to check access for
 * @param userResidences - User's residence associations
 * @returns Promise<boolean> - True if user can view document
 */
export async function canViewDocument(
  user: AuthenticatedUser, 
  document: any, 
  userResidences?: any[]
): Promise<boolean> {
  try {
    // Admin: Can view all documents
    if (user.role === 'admin') {
      return true;
    }

    // Manager: Can view all documents in their organization
    if (user.role === 'manager') {
      // Check if document belongs to manager's organization
      if (document.buildingId) {
        const building = await storage.getBuilding(document.buildingId);
        return building?.organizationId === user.organizationId;
      }
      if (document.residenceId) {
        const residence = await storage.getResidence(document.residenceId);
        if (residence) {
          const building = await storage.getBuilding(residence.buildingId);
          return building?.organizationId === user.organizationId;
        }
      }
      return true; // Manager can view organization-level docs
    }

    // Resident: Can view documents in their residence/building
    if (user.role === 'resident') {
      if (document.residenceId) {
        return userResidences?.some(ur => ur.residenceId === document.residenceId) || false;
      }
      if (document.buildingId) {
        // Can view building docs if they live in that building
        const userBuildingIds = userResidences?.map(async ur => {
          const residence = await storage.getResidence(ur.residenceId);
          return residence?.buildingId;
        });
        const buildingIds = await Promise.all(userBuildingIds || []);
        return buildingIds.includes(document.buildingId);
      }
      return false;
    }

    // Tenant: Can only view documents marked as visible to tenants
    if (user.role === 'tenant') {
      if (!document.isVisibleToTenants) {
        return false;
      }
      
      if (document.residenceId) {
        return userResidences?.some(ur => ur.residenceId === document.residenceId) || false;
      }
      if (document.buildingId) {
        const userBuildingIds = userResidences?.map(async ur => {
          const residence = await storage.getResidence(ur.residenceId);
          return residence?.buildingId;
        });
        const buildingIds = await Promise.all(userBuildingIds || []);
        return buildingIds.includes(document.buildingId);
      }
      return false;
    }

    return false;
  } catch (error) {
    console.error('Document view permission check failed:', error);
    return false;
  }
}

/**
 * Check if user can edit a specific document
 * @param user - The authenticated user
 * @param document - The document to check
 * @param userResidences - User's residence associations
 * @returns Promise<boolean> - True if user can edit document
 */
export async function canEditDocument(
  user: AuthenticatedUser, 
  document: any, 
  userResidences?: any[]
): Promise<boolean> {
  try {
    // Admin: Can edit all documents
    if (user.role === 'admin') {
      return true;
    }

    // Manager: Can edit all documents in their organization
    if (user.role === 'manager') {
      if (document.buildingId) {
        const building = await storage.getBuilding(document.buildingId);
        return building?.organizationId === user.organizationId;
      }
      if (document.residenceId) {
        const residence = await storage.getResidence(document.residenceId);
        if (residence) {
          const building = await storage.getBuilding(residence.buildingId);
          return building?.organizationId === user.organizationId;
        }
      }
      return true;
    }

    // Resident: Can edit documents they created or in their residence
    if (user.role === 'resident') {
      // Can edit own documents
      if (document.uploadedBy === user.id) {
        return true;
      }
      
      // Can edit residence documents
      if (document.residenceId) {
        return userResidences?.some(ur => ur.residenceId === document.residenceId) || false;
      }
      return false;
    }

    // Tenant: Cannot edit documents (read-only access)
    return false;
  } catch (error) {
    console.error('Document edit permission check failed:', error);
    return false;
  }
}

/**
 * Check if user can delete a specific document
 * @param user - The authenticated user
 * @param document - The document to check
 * @param userResidences - User's residence associations
 * @returns Promise<boolean> - True if user can delete document
 */
export async function canDeleteDocument(
  user: AuthenticatedUser, 
  document: any, 
  userResidences?: any[]
): Promise<boolean> {
  try {
    // Admin: Can delete all documents
    if (user.role === 'admin') {
      return true;
    }

    // Manager: Can delete documents in their organization
    if (user.role === 'manager') {
      if (document.buildingId) {
        const building = await storage.getBuilding(document.buildingId);
        return building?.organizationId === user.organizationId;
      }
      if (document.residenceId) {
        const residence = await storage.getResidence(document.residenceId);
        if (residence) {
          const building = await storage.getBuilding(residence.buildingId);
          return building?.organizationId === user.organizationId;
        }
      }
      return true;
    }

    // Resident: Can only delete documents they uploaded
    if (user.role === 'resident') {
      return document.uploadedBy === user.id;
    }

    // Tenant: Cannot delete documents
    return false;
  } catch (error) {
    console.error('Document delete permission check failed:', error);
    return false;
  }
}

/**
 * Check if user can create documents in a specific context
 * @param user - The authenticated user
 * @param context - The context (buildingId, residenceId, or organization)
 * @returns Promise<boolean> - True if user can create documents
 */
export async function canCreateDocument(
  user: AuthenticatedUser,
  context: { buildingId?: string; residenceId?: string; organizationId?: string }
): Promise<boolean> {
  try {
    // Admin: Can create documents anywhere
    if (user.role === 'admin') {
      return true;
    }

    // Manager: Can create documents in their organization
    if (user.role === 'manager') {
      if (context.organizationId) {
        return context.organizationId === user.organizationId;
      }
      if (context.buildingId) {
        const building = await storage.getBuilding(context.buildingId);
        return building?.organizationId === user.organizationId;
      }
      if (context.residenceId) {
        const residence = await storage.getResidence(context.residenceId);
        if (residence) {
          const building = await storage.getBuilding(residence.buildingId);
          return building?.organizationId === user.organizationId;
        }
      }
      return true;
    }

    // Resident: Can create documents in their residence
    if (user.role === 'resident') {
      if (context.residenceId) {
        // Check if user lives in this residence
        const userResidences = await storage.getUserResidences(user.id);
        return userResidences.some(ur => ur.residenceId === context.residenceId);
      }
      return false;
    }

    // Tenant: Cannot create documents
    return false;
  } catch (error) {
    console.error('Document create permission check failed:', error);
    return false;
  }
}

// Extended user interface for authentication context
interface AuthenticatedUser extends User {
  organizations?: string[];
  canAccessAllOrganizations?: boolean;
  organizationId?: string;
}

// Extend Express Request interface to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

// Extend express-session to include custom properties
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    userRole?: string;
    role?: string;
    user?: AuthenticatedUser;
    permissions?: string[];
    store?: any;
    testValue?: any;
    organizationId?: string;
    organizations?: string[];
    canAccessAllOrganizations?: boolean;
  }
}
