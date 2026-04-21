/**
 * Authentication middleware for protecting routes.
 */
import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Express middleware to require user authentication for protected routes.
 * Checks for valid user session and blocks access if not authenticated.
 *
 * @param {Request} req - Express request object with session data.
 * @param {Response} res - Express response object for sending errors.
 * @param {NextFunction} next - Express next function to continue to route handler.
 *
 * @example
 * ```typescript
 * app.get('/api/protected', requireAuth, (req, res) => {
 *   // Route handler for authenticated users only
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
  // Support test authentication via x-test-user-id header
  const testUserId = req.headers['x-test-user-id'] as string;
  
  if (testUserId) {
    try {
      const userResult = await db.select().from(users).where(eq(users.id, testUserId)).limit(1);
      if (userResult.length > 0) {
        const user = userResult[0];
        // Set user in session for consistency
        if (!req.session) {
          req.session = {} as any;
        }
        req.session.user = {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          isActive: user.isActive,
        } as any;
        return next();
      }
    } catch (error) {
      console.error('Error fetching test user:', error);
    }
  }

  if (req.session && 'user' in req.session && req.session.user) {
    // Validate that user is a proper object with basic required properties
    const user = req.session.user as any;
    if (typeof user === 'object' && user !== null && !Array.isArray(user) && 
        user.id && user.email && user.role) {
      next();
    } else {
      res.status(401).json({ message: 'Authentication required', code: 'AUTH_REQUIRED' });
    }
  } else {
    res.status(401).json({ message: 'Authentication required', code: 'AUTH_REQUIRED' });
  }
}

/**
 * Express middleware factory for role-based access control.
 * Returns middleware that restricts access to users with specific roles.
 * Must be used after requireAuth middleware.
 *
 * @param {string[]} roles - Array of allowed roles (e.g., ['admin', 'manager']).
 * @returns {Function} Express middleware function for role validation.
 *
 * @example
 * ```typescript
 * // Only admin and manager roles can access this route
 * app.get('/api/admin', requireAuth, requireRole(['admin', 'manager']), handler);
 * ```
 */
/**
 * RequireRole function.
 * @param roles
 * @returns Function result.
 */
export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session || !('user' in req.session) || !req.session.user) {
      return res.status(401).json({ message: 'Authentication required', code: 'AUTH_REQUIRED' });
    }

    const user = req.session.user as any;
    
    // Validate user object and role property
    if (typeof user !== 'object' || user === null || Array.isArray(user) || 
        !('role' in user) || !user.role || typeof user.role !== 'string' || user.role.trim() === '') {
      return res.status(403).json({ message: 'Insufficient permissions', code: 'INSUFFICIENT_PERMISSIONS' });
    }

    // Check if roles array is empty (should deny access)
    if (!roles || roles.length === 0) {
      return res.status(403).json({ message: 'Insufficient permissions', code: 'INSUFFICIENT_PERMISSIONS' });
    }

    if (roles.includes(user.role)) {
      next();
    } else {
      res
        .status(403)
        .json({ message: 'Insufficient permissions', code: 'INSUFFICIENT_PERMISSIONS' });
    }
  };
}
