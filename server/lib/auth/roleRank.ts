import type { Request, Response, NextFunction } from 'express';

/**
 * Canonical role hierarchy for the Koveo Gestion property management system.
 * Five distinct ranks ordered from least to most privileged.
 *
 * Demo roles are mapped to their equivalent production rank so that
 * requireMinRole checks work uniformly without special-casing demo users.
 */
const RANK: Record<string, number> = {
  tenant: 0,
  demo_tenant: 0,
  resident: 1,
  demo_resident: 1,
  manager: 2,
  demo_manager: 2,
  admin: 3,
  super_admin: 4,
};

/**
 * Returns the numeric rank for a role string.
 * Unknown roles return -1 so they fail every minimum-rank check.
 */
export function roleRank(role: string): number {
  return RANK[role] ?? -1;
}

/**
 * Express middleware factory that allows access only when the authenticated
 * user's role is at least as privileged as `min`.
 *
 * Must be placed after `requireAuth` so that `req.user` is populated.
 *
 * @example
 * app.get('/api/buildings', requireAuth, requireMinRole('manager'), handler);
 */
export function requireMinRole(min: keyof typeof RANK) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }
    if (roleRank(user.role) >= roleRank(min)) {
      next();
    } else {
      res.status(403).json({
        message: 'Access denied. Insufficient permissions.',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }
  };
}
