/**
 * Organizations API endpoints for admin operations.
 * Provides CRUD operations for organization management.
 */

import { Express } from 'express';
import { db } from '../db';
import {
  organizations,
  buildings,
  residences,
  users,
  userOrganizations,
  userResidences,
  invitations,
} from '@shared/schema';
import { and, eq, count, sql, or, inArray, isNull, ne } from 'drizzle-orm';
import { requireAuth } from '../auth';
import { ObjectStorageService } from '../objectStorage';

/**
 *
 * @param app
 */
/**
 * RegisterOrganizationRoutes function.
 * @param app
 * @returns Function result.
 */
export function registerOrganizationRoutes(app: Express): void {
  /**
   * GET /api/organizations - Retrieves organizations accessible to the current user
   * Returns array of organizations directly for frontend components.
   */
  app.get('/api/organizations', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      console.warn(
        `📊 Fetching organizations for user ${currentUser.id} with role ${currentUser.role}`
      );

      // Get organizations based on user role
      let organizationsQuery;

      if (currentUser.role === 'admin') {
        // Admin can see all organizations
        organizationsQuery = db
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
      } else {
        // Other users see organizations they have access to through user_organizations
        organizationsQuery = db
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
          .innerJoin(userOrganizations, eq(organizations.id, userOrganizations.organizationId))
          .where(
            and(
              eq(organizations.isActive, true),
              eq(userOrganizations.userId, currentUser.id),
              eq(userOrganizations.isActive, true)
            )
          )
          .orderBy(organizations.name);
      }

      const accessibleOrganizations = await organizationsQuery;
      console.warn(
        `✅ Found ${accessibleOrganizations.length} organizations for user ${currentUser.id}`
      );

      // Return array directly (not wrapped in object)
      res.json(accessibleOrganizations);
    } catch (_error) {
      console.error('❌ Error fetching organizations:', _error);
      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to fetch organizations',
      });
    }
  });

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
          code: 'AUTH_REQUIRED',
        });
      }

      if (currentUser.role !== 'admin') {
        return res.status(403).json({
          message: 'Admin access required',
          code: 'ADMIN_REQUIRED',
        });
      }

      console.warn(`📊 Fetching all organizations for admin user ${currentUser.id}`);

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

      console.warn(`✅ Found ${allOrganizations.length} organizations`);

      res.json({
        organizations: allOrganizations,
      });
    } catch (_error) {
      console.error('❌ Error fetching organizations:', _error);
      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to fetch organizations',
      });
    }
  });

  /**
   * POST /api/organizations - Create a new organization
   * Allows authorized users to create organizations.
   */
  app.post('/api/organizations', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Only admin users can create organizations for now
      if (currentUser.role !== 'admin') {
        return res.status(403).json({
          message: 'Admin access required to create organizations',
          code: 'ADMIN_REQUIRED',
        });
      }

      const organizationData = req.body;
      console.warn('📥 Creating organization with _data:', organizationData);

      // Insert new organization
      const [newOrganization] = await db
        .insert(organizations)
        .values({
          name: organizationData.name,
          type: organizationData.type,
          address: organizationData.address,
          city: organizationData.city,
          province: organizationData.province || 'QC',
          postalCode: organizationData.postalCode,
          phone: organizationData.phone || null,
          email: organizationData.email || null,
          website: organizationData.website || null,
          registrationNumber: organizationData.registrationNumber || null,
        })
        .returning({
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
        });

      console.warn('✅ Created organization:', newOrganization.name);

      // Create object storage hierarchy for the new organization
      const objectStorageService = new ObjectStorageService();
      await objectStorageService.createOrganizationHierarchy(newOrganization.id);

      res.status(201).json(newOrganization);
    } catch (_error) {
      console.error('❌ Error creating organization:', _error);
      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to create organization',
      });
    }
  });

  /**
   * PUT /api/organizations/:id - Update an existing organization
   * Allows authorized users to update organization details.
   */
  app.put('/api/organizations/:id', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Only admin users can update organizations
      if (currentUser.role !== 'admin') {
        return res.status(403).json({
          message: 'Admin access required to update organizations',
          code: 'ADMIN_REQUIRED',
        });
      }

      const organizationId = req.params.id;
      const updateData = req.body;

      console.warn('📝 Updating organization:', organizationId, 'with data:', updateData);

      // Check if organization exists
      const existingOrg = await db
        .select()
        .from(organizations)
        .where(and(eq(organizations.id, organizationId), eq(organizations.isActive, true)))
        .limit(1);

      if (existingOrg.length === 0) {
        return res.status(404).json({
          message: 'Organization not found',
          code: 'NOT_FOUND',
        });
      }

      // Update organization
      const [updatedOrganization] = await db
        .update(organizations)
        .set({
          name: updateData.name,
          type: updateData.type,
          address: updateData.address,
          city: updateData.city,
          province: updateData.province || 'QC',
          postalCode: updateData.postalCode,
          phone: updateData.phone || null,
          email: updateData.email || null,
          website: updateData.website || null,
          registrationNumber: updateData.registrationNumber || null,
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, organizationId))
        .returning({
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
          updatedAt: organizations.updatedAt,
        });

      console.warn('✅ Organization updated successfully:', updatedOrganization.name);
      res.json(updatedOrganization);
    } catch (error) {
      console.error('❌ Error updating organization:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update organization',
      });
    }
  });

  /**
   * GET /api/organizations/:id/deletion-impact - Get deletion impact analysis
   * Shows what will be deleted when removing an organization.
   */
  app.get('/api/organizations/:id/deletion-impact', requireAuth, async (req: any, res) => {
    const organizationId = req.params.id;

    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      if (currentUser.role !== 'admin') {
        return res.status(403).json({
          message: 'Admin access required',
          code: 'ADMIN_REQUIRED',
        });
      }

      // Check if organization exists
      const organization = await db
        .select({ id: organizations.id, name: organizations.name })
        .from(organizations)
        .where(and(eq(organizations.id, organizationId), eq(organizations.isActive, true)))
        .limit(1);

      if (organization.length === 0) {
        return res.status(404).json({
          _error: 'Not found',
          message: 'Organization not found',
        });
      }

      // Count buildings in this organization
      const buildingsCount = await db
        .select({ count: count() })
        .from(buildings)
        .where(and(eq(buildings.organizationId, organizationId), eq(buildings.isActive, true)));

      // Count residences in buildings of this organization
      const residencesCount = await db
        .select({ count: count() })
        .from(residences)
        .innerJoin(buildings, eq(residences.buildingId, buildings.id))
        .where(
          and(
            eq(buildings.organizationId, organizationId),
            eq(buildings.isActive, true),
            eq(residences.isActive, true)
          )
        );

      // Count invitations associated with this organization
      let totalInvitations = 0;
      try {
        const invitationsCount = await db
          .select({ count: count() })
          .from(invitations)
          .where(eq(invitations.organizationId, organizationId));

        totalInvitations = invitationsCount[0]?.count || 0;
      } catch (___invError) {
        console.warn('Invitations table access failed, skipping invitation count');
        totalInvitations = 0;
      }

      // Count users who will become orphaned (only belong to this organization)
      const potentialOrphansCount = await db
        .select({ count: count() })
        .from(userOrganizations)
        .innerJoin(users, eq(userOrganizations.userId, users.id))
        .where(
          and(
            eq(userOrganizations.organizationId, organizationId),
            eq(userOrganizations.isActive, true),
            eq(users.isActive, true)
          )
        );

      const impact = {
        organization: organization[0],
        buildings: buildingsCount[0]?.count || 0,
        residences: residencesCount[0]?.count || 0,
        invitations: totalInvitations,
        potentialOrphanedUsers: potentialOrphansCount[0]?.count || 0,
      };

      res.json(impact);
    } catch (_error) {
      console.error('❌ Error analyzing deletion impact:', _error);

      // Return partial data if we can get basic counts
      try {
        const organization = await db
          .select({ id: organizations.id, name: organizations.name })
          .from(organizations)
          .where(and(eq(organizations.id, organizationId), eq(organizations.isActive, true)))
          .limit(1);

        if (organization.length > 0) {
          const buildingsCount = await db
            .select({ count: count() })
            .from(buildings)
            .where(and(eq(buildings.organizationId, organizationId), eq(buildings.isActive, true)));

          res.json({
            organization: organization[0],
            buildings: buildingsCount[0]?.count || 0,
            residences: 0,
            invitations: 0,
            potentialOrphanedUsers: 0,
            note: 'Some data may not be available due to database schema issues',
          });
          return;
        }
      } catch (___fallbackError) {
        console.error('Fallback also failed:', ___fallbackError);
      }

      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to analyze deletion impact',
      });
    }
  });

  /**
   * DELETE /api/organizations/:id - Cascade delete an organization
   * Deletes organization and all related entities (buildings, residences, documents, orphaned users).
   */
  app.delete('/api/organizations/:id', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      if (currentUser.role !== 'admin') {
        return res.status(403).json({
          message: 'Admin access required',
          code: 'ADMIN_REQUIRED',
        });
      }

      const organizationId = req.params.id;
      console.warn(`🗑️ Admin ${currentUser.id} cascading delete organization: ${organizationId}`);

      // Check if organization exists
      const organization = await db
        .select({ id: organizations.id, name: organizations.name })
        .from(organizations)
        .where(and(eq(organizations.id, organizationId), eq(organizations.isActive, true)))
        .limit(1);

      if (organization.length === 0) {
        return res.status(404).json({
          _error: 'Not found',
          message: 'Organization not found',
        });
      }

      // With cascade delete relationships, we can now do a true cascade delete
      // First cleanup orphaned records to ensure data integrity
      const { cleanupOrphans } = await import('../utils/cleanup-orphans');
      const report = await cleanupOrphans();
      console.log(`🧹 Orphan cleanup report:`, report);

      // Start transaction for cascading delete
      await db.transaction(async (tx) => {
        console.log(`🗑️ Deleting organization ${organizationId} with cascade delete...`);

        // With proper cascade delete relationships in schema, we can now perform
        // a true cascade delete instead of manual transaction management
        // This will automatically delete all related buildings, residences, and relationships

        // Delete organization - cascade relationships will handle the rest
        await tx.delete(organizations).where(eq(organizations.id, organizationId));

        console.log(`✅ Organization ${organizationId} deleted with automatic cascade`);

        // Cascade delete will handle user-organization relationships automatically
        const orphanedUsers = await tx
          .select({ id: users.id })
          .from(users)
          .leftJoin(
            userOrganizations,
            and(eq(users.id, userOrganizations.userId), eq(userOrganizations.isActive, true))
          )
          .where(and(eq(users.isActive, true), isNull(userOrganizations.userId)));

        if (orphanedUsers.length > 0) {
          const orphanedUserIds = orphanedUsers.map((u) => u.id);
          await tx
            .update(users)
            .set({ isActive: false, updatedAt: new Date() })
            .where(inArray(users.id, orphanedUserIds));
        }

        // 9. Finally, soft delete the organization
        await tx
          .update(organizations)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(organizations.id, organizationId));
      });

      console.warn(`✅ Organization cascading delete completed: ${organizationId}`);

      // Clean up object storage hierarchy for the deleted organization
      const objectStorageService = new ObjectStorageService();
      await objectStorageService.deleteOrganizationHierarchy(organizationId);

      res.json({
        message: 'Organization and related entities deleted successfully',
        deletedOrganization: organization[0].name,
      });
    } catch (_error) {
      console.error('❌ Error cascading delete organization:', _error);
      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to delete organization and related entities',
      });
    }
  });
}
