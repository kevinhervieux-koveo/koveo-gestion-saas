/**
 * Authentication middleware for protecting routes.
 */
import { Request, Response, NextFunction } from 'express';

/**
 *
 * @param req
 * @param res
 * @param next
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session && 'user' in req.session && req.session.user) {
    next();
  } else {
    res.status(401).json({ message: 'Authentication required', code: 'AUTH_REQUIRED' });
  }
}

/**
 *
 * @param roles
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