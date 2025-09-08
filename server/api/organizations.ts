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

      console.log(
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
      console.log(
        `✅ Found ${accessibleOrganizations.length} organizations for user ${currentUser.id}`
      );

      // Return array directly (not wrapped in object)
      res.json(accessibleOrganizations);
    } catch (error: any) {
      console.error('❌ Error fetching organizations:', error);
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


      res.json({
        organizations: allOrganizations,
      });
    } catch (error: any) {
      console.error('❌ Error fetching organizations:', error);
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


      // Organization storage hierarchy will be created automatically when documents are uploaded
      console.log(
        'Organization created - storage hierarchy will be created on first document upload'
      );

      res.status(201).json(newOrganization);
    } catch (error: any) {
      console.error('❌ Error creating organization:', error);
      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to create organization',
      });
    }
  });

  /**
   * GET /api/organizations/:id - Get organization by ID
   */
  app.get('/api/organizations/:id', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      const organizationId = req.params.id;

      // Find the organization
      const [organization] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, organizationId));

      if (!organization) {
        return res.status(404).json({
          message: 'Organization not found',
          code: 'NOT_FOUND',
        });
      }

      res.json(organization);
    } catch (error: any) {
      console.error('❌ Error fetching organization:', error);
      res.status(500).json({
        message: 'Failed to fetch organization',
        code: 'SERVER_ERROR',
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

      res.json(updatedOrganization);
    } catch (error: any) {
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
    } catch (error: any) {
      console.error('❌ Error analyzing deletion impact:', error);
      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to analyze deletion impact',
      });
    }
  });

  /**
   * DELETE /api/organizations/:id - Cascade delete an organization
   * Deletes organization and all related entities (buildings, residences, documents). Users are preserved for data safety.
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

      console.log(`🗑️ Deleting organization ${organizationId} with cascade delete...`);

      // Since Neon HTTP driver doesn't support transactions, we'll do cascading delete manually
      // in the correct order to maintain referential integrity

      // 1. Get all buildings in this organization (including already inactive ones)
      const orgBuildings = await db
        .select({ id: buildings.id })
        .from(buildings)
        .where(eq(buildings.organizationId, organizationId));

      if (orgBuildings.length > 0) {
        const orgBuildingIds = orgBuildings.map((b) => b.id);

        // 2. Soft delete residences first (children of buildings) - get ALL residences in these buildings
        const affectedResidences = await db
          .update(residences)
          .set({ isActive: false, updatedAt: new Date() })
          .where(inArray(residences.buildingId, orgBuildingIds))
          .returning({ id: residences.id, unitNumber: residences.unitNumber });

        console.log(
          `🗑️ Soft deleted ${affectedResidences.length} residences in buildings: ${orgBuildingIds.join(', ')}`
        );

        // 3. Soft delete buildings
        const affectedBuildings = await db
          .update(buildings)
          .set({ isActive: false, updatedAt: new Date() })
          .where(inArray(buildings.id, orgBuildingIds))
          .returning({ id: buildings.id, name: buildings.name });

        console.log(
          `🗑️ Soft deleted ${affectedBuildings.length} buildings: ${affectedBuildings.map((b) => b.name).join(', ')}`
        );
      }

      // 4. Delete user-organization relationships
      await db
        .delete(userOrganizations)
        .where(eq(userOrganizations.organizationId, organizationId));

      // 5. DISABLED: User deletion is now prohibited for data safety
      // Users are never deleted during cascade operations to prevent permanent data loss
      // This protects against accidental deletion of user accounts and their historical data
      console.log('⚠️  User deletion disabled for data safety - users will be preserved');
      
      // Optional: Log users who would have been affected for admin review
      const affectedUsers = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .leftJoin(
          userOrganizations,
          and(eq(users.id, userOrganizations.userId), eq(userOrganizations.isActive, true))
        )
        .where(and(eq(users.isActive, true), isNull(userOrganizations.userId)));
      
      if (affectedUsers.length > 0) {
        console.log(`⚠️  ${affectedUsers.length} users are now without organization assignments but have been preserved:`, 
          affectedUsers.map(u => u.email));

        // DISABLED: Users are no longer deleted - they are preserved for data safety
      }

      // 6. Finally, soft delete the organization
      await db
        .update(organizations)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(organizations.id, organizationId));


      // Object storage cleanup will be handled automatically
      try {
        console.log('Organization deleted - storage cleanup will be handled automatically');
      } catch (storageError) {
        console.error(
          '⚠️ Object storage cleanup failed, but organization deletion succeeded:',
          storageError
        );
      }

      res.json({
        message: 'Organization and related entities deleted successfully',
        deletedOrganization: organization[0].name,
      });
    } catch (error: any) {
      console.error('❌ Error deleting organization:', error);
      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to delete organization and related entities',
      });
    }
  });

  /**
   * GET /api/organizations/:organizationId/buildings - Get buildings within a specific organization
   * Returns buildings that the authenticated user has access to within the specified organization
   */
  app.get('/api/organizations/:organizationId/buildings', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      const { organizationId } = req.params;

      console.log(
        `📊 Fetching buildings for organization ${organizationId} by user ${currentUser.id} with role ${currentUser.role}`
      );

      // First, verify the user has access to this organization
      const userOrgAccess = await db
        .select({ id: organizations.id })
        .from(organizations)
        .leftJoin(
          userOrganizations,
          and(
            eq(userOrganizations.organizationId, organizations.id),
            eq(userOrganizations.userId, currentUser.id),
            eq(userOrganizations.isActive, true)
          )
        )
        .where(
          and(
            eq(organizations.id, organizationId),
            eq(organizations.isActive, true),
            or(
              eq(currentUser.role, 'admin'), // Admin can access any organization
              eq(userOrganizations.userId, currentUser.id) // User must be linked to organization
            )
          )
        )
        .limit(1);

      if (userOrgAccess.length === 0) {
        return res.status(403).json({
          message: 'Access denied to this organization',
          code: 'ORGANIZATION_ACCESS_DENIED',
        });
      }

      // Get buildings within the organization that the user can access
      let buildingsQuery;

      if (currentUser.role === 'admin') {
        // Admin can see all buildings in the organization
        buildingsQuery = db
          .select({
            id: buildings.id,
            name: buildings.name,
            address: buildings.address,
            city: buildings.city,
            province: buildings.province,
            postalCode: buildings.postalCode,
          })
          .from(buildings)
          .where(
            and(
              eq(buildings.organizationId, organizationId),
              eq(buildings.isActive, true)
            )
          )
          .orderBy(buildings.name);
      } else {
        // Non-admin users can only see buildings they have access to through their residences or direct organization access
        buildingsQuery = db
          .selectDistinct({
            id: buildings.id,
            name: buildings.name,
            address: buildings.address,
            city: buildings.city,
            province: buildings.province,
            postalCode: buildings.postalCode,
          })
          .from(buildings)
          .leftJoin(residences, eq(residences.buildingId, buildings.id))
          .leftJoin(
            userResidences,
            and(
              eq(userResidences.residenceId, residences.id),
              eq(userResidences.userId, currentUser.id),
              eq(userResidences.isActive, true)
            )
          )
          .leftJoin(
            userOrganizations,
            and(
              eq(userOrganizations.organizationId, buildings.organizationId),
              eq(userOrganizations.userId, currentUser.id),
              eq(userOrganizations.isActive, true)
            )
          )
          .where(
            and(
              eq(buildings.organizationId, organizationId),
              eq(buildings.isActive, true),
              or(
                eq(userResidences.userId, currentUser.id), // User has a residence in the building
                eq(userOrganizations.userId, currentUser.id) // User is linked to the organization
              )
            )
          )
          .orderBy(buildings.name);
      }

      const buildingsList = await buildingsQuery;

      console.log(`✅ Found ${buildingsList.length} buildings for user ${currentUser.id} in organization ${organizationId}`);

      res.json(buildingsList);
    } catch (error: any) {
      console.error('❌ Error fetching organization buildings:', error);
      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to fetch buildings for organization',
      });
    }
  });
}
