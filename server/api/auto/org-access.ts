/**
 * Admin org-access API — Task #1473 / Task #657.
 *
 * GET /api/admin/org-access
 *
 * Returns the calling admin's organisation memberships so the frontend
 * can explain why a user might only see Demo data and surface a link to
 * the membership flow when cross-org access is missing.
 */

import type { Express } from 'express';
import { db } from '../../db';
import { organizations, userOrganizations } from '../../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../../auth';
import { asyncHandler } from '../../utils/async-handler';

export default function registerOrgAccessRoutes(app: Express): void {
  app.get(
    '/api/admin/org-access',
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const currentUser = req.user ?? req.session?.user;
      if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
        return res.status(403).json({ message: 'Admin access required', code: 'FORBIDDEN' });
      }

      const memberships = await db
        .select({
          orgId: organizations.id,
          orgName: organizations.name,
          orgType: organizations.type,
          isActive: organizations.isActive,
          canAccessAllOrganizations: userOrganizations.canAccessAllOrganizations,
          membershipActive: userOrganizations.isActive,
        })
        .from(userOrganizations)
        .innerJoin(organizations, eq(userOrganizations.organizationId, organizations.id))
        .where(
          and(
            eq(userOrganizations.userId, currentUser.id),
            eq(userOrganizations.isActive, true),
          ),
        );

      const orgs = memberships.map((m) => ({
        id: m.orgId,
        name: m.orgName,
        type: m.orgType,
        isActive: m.isActive,
        canAccessAllOrganizations: m.canAccessAllOrganizations,
      }));

      const isDemoOnly =
        orgs.length === 0 ||
        orgs.every((o) => o.type === 'demo' || o.name.toLowerCase().startsWith('demo'));

      const hasCrossOrgAccess = orgs.some((o) => o.canAccessAllOrganizations);

      return res.json({ orgs, isDemoOnly, hasCrossOrgAccess });
    }),
  );
}
