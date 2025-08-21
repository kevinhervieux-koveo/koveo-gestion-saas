/**
 * Authentication middleware for protecting routes.
 */
import { Request, Response, NextFunction } from 'express';

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
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session && 'user' in req.session && req.session.user) {
    next();
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
    if (roles.includes(user.role)) {
      next();
    } else {
      res.status(403).json({ message: 'Insufficient permissions', code: 'INSUFFICIENT_PERMISSIONS' });
    }
  };
}