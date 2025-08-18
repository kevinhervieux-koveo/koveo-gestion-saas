/**
 * Organizations API endpoints for admin operations.
 * Provides CRUD operations for organization management.
 */

import { Express } from 'express';
import { db } from '../db';
import { organizations } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../auth';

/**
 *
 * @param app
 */
export function registerOrganizationRoutes(app: Express): void {
  /**
   * GET /api/admin/organizations - Retrieves all organizations for admin users
   * Only admin users can access all organizations.
   */
  app.get('/api/admin/organizations', requireAuth, async (req: any, res) => {
    try {
      // Check if user is admin
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      if (currentUser.role !== 'admin') {
        return res.status(403).json({
          message: 'Admin access required',
          code: 'ADMIN_REQUIRED'
        });
      }

      console.log(`📊 Fetching all organizations for admin user ${currentUser.id}`);

      // Get all organizations for admin
      const allOrganizations = await db
        .select({
          id: organizations.id,
          name: organizations.name,
          type: organizations.type,
          address: organizations.address,
          city: organizations.city,
          province: organizations.province,
          postalCode: organizations.postalCode,
          phone: organizations.phone,
          email: organizations.email,
          website: organizations.website,
          registrationNumber: organizations.registrationNumber,
          isActive: organizations.isActive,
          createdAt: organizations.createdAt,
        })
        .from(organizations)
        .where(eq(organizations.isActive, true))
        .orderBy(organizations.name);

      console.log(`✅ Found ${allOrganizations.length} organizations`);

      res.json({
        organizations: allOrganizations
      });

    } catch (error) {
      console.error('❌ Error fetching organizations:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch organizations'
      });
    }
  });
}