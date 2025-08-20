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
  invitations
} from '@shared/schema';
import { and, eq, count, sql, or, inArray, isNull, ne } from 'drizzle-orm';
import { requireAuth } from '../auth';

/**
 *
 * @param app
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
          code: 'AUTH_REQUIRED'
        });
      }

      console.log(`📊 Fetching organizations for user ${currentUser.id} with role ${currentUser.role}`);

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
        // Other users see organizations they have access to
        // For now, return empty array for non-admin users
        // This can be extended later with proper RBAC
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
          .orderBy(organizations.name)
          .limit(0); // For now, limit to 0 for non-admin users
      }

      const userOrganizations = await organizationsQuery;
      console.log(`✅ Found ${userOrganizations.length} organizations for user ${currentUser.id}`);

      // Return array directly (not wrapped in object)
      res.json(userOrganizations);

    } catch (error) {
      console.error('❌ Error fetching organizations:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch organizations'
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
          code: 'AUTH_REQUIRED'
        });
      }

      // Only admin users can create organizations for now
      if (currentUser.role !== 'admin') {
        return res.status(403).json({
          message: 'Admin access required to create organizations',
          code: 'ADMIN_REQUIRED'
        });
      }

      const organizationData = req.body;
      console.log('📥 Creating organization with data:', organizationData);

      // Insert new organization
      const [newOrganization] = await db.insert(organizations).values({
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
      }).returning({
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

      console.log('✅ Created organization:', newOrganization.name);
      res.status(201).json(newOrganization);

    } catch (error) {
      console.error('❌ Error creating organization:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to create organization'
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
          code: 'AUTH_REQUIRED'
        });
      }

      if (currentUser.role !== 'admin') {
        return res.status(403).json({
          message: 'Admin access required',
          code: 'ADMIN_REQUIRED'
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
          error: 'Not found',
          message: 'Organization not found'
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
        .where(and(
          eq(buildings.organizationId, organizationId),
          eq(buildings.isActive, true),
          eq(residences.isActive, true)
        ));

      // Count invitations associated with this organization
      let totalInvitations = 0;
      try {
        const invitationsCount = await db
          .select({ count: count() })
          .from(invitations)
          .where(eq(invitations.organizationId, organizationId));

        totalInvitations = invitationsCount[0]?.count || 0;
      } catch (invError) {
        console.log('Invitations table access failed, skipping invitation count');
        totalInvitations = 0;
      }

      // Count users who will become orphaned (only belong to this organization)
      const potentialOrphansCount = await db
        .select({ count: count() })
        .from(userOrganizations)
        .innerJoin(users, eq(userOrganizations.userId, users.id))
        .where(and(
          eq(userOrganizations.organizationId, organizationId),
          eq(userOrganizations.isActive, true),
          eq(users.isActive, true)
        ));

      const impact = {
        organization: organization[0],
        buildings: buildingsCount[0]?.count || 0,
        residences: residencesCount[0]?.count || 0,
        invitations: totalInvitations,
        potentialOrphanedUsers: potentialOrphansCount[0]?.count || 0
      };

      res.json(impact);

    } catch (error) {
      console.error('❌ Error analyzing deletion impact:', error);
      
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
            note: 'Some data may not be available due to database schema issues'
          });
          return;
        }
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
      
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to analyze deletion impact'
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
          code: 'AUTH_REQUIRED'
        });
      }

      if (currentUser.role !== 'admin') {
        return res.status(403).json({
          message: 'Admin access required',
          code: 'ADMIN_REQUIRED'
        });
      }

      const organizationId = req.params.id;
      console.log(`🗑️ Admin ${currentUser.id} cascading delete organization: ${organizationId}`);

      // Check if organization exists
      const organization = await db
        .select({ id: organizations.id, name: organizations.name })
        .from(organizations)
        .where(and(eq(organizations.id, organizationId), eq(organizations.isActive, true)))
        .limit(1);

      if (organization.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Organization not found'
        });
      }

      // Start transaction for cascading delete
      await db.transaction(async (tx) => {
        // 1. Get all buildings in this organization
        const orgBuildings = await tx
          .select({ id: buildings.id })
          .from(buildings)
          .where(and(eq(buildings.organizationId, organizationId), eq(buildings.isActive, true)));

        const buildingIds = orgBuildings.map(b => b.id);

        if (buildingIds.length > 0) {
          // 2. Get all residences in these buildings
          const buildingResidences = await tx
            .select({ id: residences.id })
            .from(residences)
            .where(and(inArray(residences.buildingId, buildingIds), eq(residences.isActive, true)));

          const residenceIds = buildingResidences.map(r => r.id);

          // 3. Delete invitations associated with this organization
          await tx.delete(invitations)
            .where(eq(invitations.organizationId, organizationId));

          // Note: Documents table doesn't have foreign keys to organizations/buildings/residences
          // Documents are managed separately and don't need cascading deletion

          // 4. Soft delete user-residence relationships
          if (residenceIds.length > 0) {
            await tx.update(userResidences)
              .set({ isActive: false, updatedAt: new Date() })
              .where(inArray(userResidences.residenceId, residenceIds));
          }

          // 5. Soft delete residences
          if (residenceIds.length > 0) {
            await tx.update(residences)
              .set({ isActive: false, updatedAt: new Date() })
              .where(inArray(residences.id, residenceIds));
          }

          // 6. Soft delete buildings
          await tx.update(buildings)
            .set({ isActive: false, updatedAt: new Date() })
            .where(inArray(buildings.id, buildingIds));
        }

        // 7. Soft delete user-organization relationships
        await tx.update(userOrganizations)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(userOrganizations.organizationId, organizationId));

        // 8. Find and soft delete orphaned users (users who now have no active organization relationships)
        const orphanedUsers = await tx
          .select({ id: users.id })
          .from(users)
          .leftJoin(userOrganizations, and(
            eq(users.id, userOrganizations.userId),
            eq(userOrganizations.isActive, true)
          ))
          .where(and(
            eq(users.isActive, true),
            isNull(userOrganizations.userId)
          ));

        if (orphanedUsers.length > 0) {
          const orphanedUserIds = orphanedUsers.map(u => u.id);
          await tx.update(users)
            .set({ isActive: false, updatedAt: new Date() })
            .where(inArray(users.id, orphanedUserIds));
        }

        // 9. Finally, soft delete the organization
        await tx.update(organizations)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(organizations.id, organizationId));
      });

      console.log(`✅ Organization cascading delete completed: ${organizationId}`);

      res.json({
        message: 'Organization and related entities deleted successfully',
        deletedOrganization: organization[0].name
      });

    } catch (error) {
      console.error('❌ Error cascading delete organization:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete organization and related entities'
      });
    }
  });
}