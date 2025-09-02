import { Express } from 'express';
import { db } from '../db.js';
import {
  residences,
  buildings,
  organizations,
  userResidences,
  users,
  userOrganizations,
} from '../../shared/schema.js';
import { eq, and, or, ilike, inArray, sql } from 'drizzle-orm';
import { requireAuth } from '../auth/index.js';
import { delayedUpdateService } from '../services/delayed-update-service.js';

/**
 *
 * @param app
 */
/**
 * RegisterResidenceRoutes function.
 * @param app
 * @returns Function result.
 */
export function registerResidenceRoutes(app: Express) {
  // Get user's residences
  app.get('/api/user/residences', requireAuth, async (req: any, res: any) => {
    try {
      const user = req.user;
      const userResidencesList = await db
        .select({
          residenceId: userResidences.residenceId,
        })
        .from(userResidences)
        .where(and(eq(userResidences.userId, user.id), eq(userResidences.isActive, true)));
      res.json(userResidencesList);
    } catch (error: any) {
      console.error('❌ Error fetching user residences:', error);
      res.status(500).json({ message: 'Failed to fetch user residences' });
    }
  });

  // Get assigned users for a specific residence
  app.get(
    '/api/residences/:residenceId/assigned-users',
    requireAuth,
    async (req: any, res: any) => {
      try {
        const { residenceId } = req.params;
        const currentUser = req.user;

        // Get assigned users with their details
        const assignedUsers = await db
          .select({
            id: users.id,
            username: users.username,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            phone: users.phone,
            relationshipType: userResidences.relationshipType,
            startDate: userResidences.startDate,
            endDate: userResidences.endDate,
            isActive: userResidences.isActive,
          })
          .from(userResidences)
          .innerJoin(users, eq(userResidences.userId, users.id))
          .where(
            and(eq(userResidences.residenceId, residenceId), eq(userResidences.isActive, true))
          );

        res.json(assignedUsers);
      } catch (error: any) {
        console.error('❌ Error fetching assigned users:', error);
        res.status(500).json({ message: 'Failed to fetch assigned users' });
      }
    }
  );

  // Update assigned user information
  app.put(
    '/api/residences/:residenceId/assigned-users/:userId',
    requireAuth,
    async (req: any, res: any) => {
      try {
        const { userId } = req.params;
        const { firstName, lastName, email, phone } = req.body;
        const currentUser = req.user;

        // Update user information
        await db
          .update(users)
          .set({
            firstName,
            lastName,
            email,
            phone,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId));

        res.json({ message: 'User updated successfully' });
      } catch (error: any) {
        console.error('❌ Error updating assigned user:', error);
        res.status(500).json({ message: 'Failed to update assigned user' });
      }
    }
  );

  // Get all residences with filtering and search
  app.get('/api/residences', requireAuth, async (req: any, res: any) => {
    try {
      const user = req.user;
      const { search, buildingId, floor } = req.query;


      // Start with base conditions
      const conditions = [eq(residences.isActive, true)];

      // Apply filters
      if (buildingId) {
        conditions.push(eq(residences.buildingId, buildingId));
      }

      if (floor) {
        conditions.push(eq(residences.floor, parseInt(floor)));
      }

      // Use the same access control logic as /api/manager/buildings
      const accessibleBuildingIds = new Set<string>();

      // Check if user belongs to Koveo organization (special global access)
      const userOrgs = await db
        .select({
          organizationId: organizations.id,
          organizationName: organizations.name,
          canAccessAllOrganizations: userOrganizations.canAccessAllOrganizations,
        })
        .from(organizations)
        .innerJoin(userOrganizations, eq(userOrganizations.organizationId, organizations.id))
        .where(and(eq(userOrganizations.userId, user.id), eq(userOrganizations.isActive, true)));

      const hasGlobalAccess =
        user.role === 'admin' ||
        userOrgs.some((org) => org.organizationName === 'Koveo' || org.canAccessAllOrganizations);

      if (hasGlobalAccess) {
        console.log(
          `🌟 Admin user or user with global access detected - granting access to ALL residences`
        );

        // Koveo users can see ALL residences from ALL buildings
        const allBuildings = await db
          .select({ id: buildings.id })
          .from(buildings)
          .where(eq(buildings.isActive, true));

        allBuildings.forEach((building) => {
          accessibleBuildingIds.add(building.id);
        });
      } else {
        // Regular users: Get buildings from their organizations
        if (user.role === 'admin' || user.role === 'manager' || user.role === 'demo_manager') {
          if (userOrgs.length > 0) {
            const orgIds = userOrgs.map((uo) => uo.organizationId);

            // Get all buildings from these organizations
            const orgBuildings = await db
              .select({ id: buildings.id })
              .from(buildings)
              .where(and(inArray(buildings.organizationId, orgIds), eq(buildings.isActive, true)));

            orgBuildings.forEach((building) => {
              accessibleBuildingIds.add(building.id);
            });
          }
        }

        // For ALL roles (Admin, Manager, Resident, Tenant): Get buildings from their residences
        console.log(
          `🔍 [ACCESS DEBUG] Checking residence access for user ${user.id} with role ${user.role}`
        );
        const userResidenceRecords = await db
          .select({
            residenceId: userResidences.residenceId,
          })
          .from(userResidences)
          .where(and(eq(userResidences.userId, user.id), eq(userResidences.isActive, true)));

        console.log(
          `🔍 [ACCESS DEBUG] Found ${userResidenceRecords.length} residence records for user ${user.id}`
        );

        if (userResidenceRecords.length > 0) {
          const residenceIds = userResidenceRecords.map((ur) => ur.residenceId);

          // Get buildings through residences
          const residenceBuildings = await db
            .select({ id: buildings.id })
            .from(residences)
            .innerJoin(buildings, eq(residences.buildingId, buildings.id))
            .where(and(inArray(residences.id, residenceIds), eq(buildings.isActive, true)));

          residenceBuildings.forEach((building) => {
            accessibleBuildingIds.add(building.id);
          });
        }
      }

      // Add building access filter to conditions
      console.log(
        `🔍 [ACCESS DEBUG] User ${user.id} has access to ${accessibleBuildingIds.size} buildings:`,
        Array.from(accessibleBuildingIds)
      );
      if (accessibleBuildingIds.size > 0) {
        conditions.push(inArray(residences.buildingId, Array.from(accessibleBuildingIds)));
      } else {
        // User has no access to any buildings, return empty result
        return res.json([]);
      }

      // Get residences with building and organization info
      const baseQuery = db
        .select({
          residence: residences,
          building: buildings,
          organization: organizations,
        })
        .from(residences)
        .leftJoin(buildings, eq(residences.buildingId, buildings.id))
        .leftJoin(organizations, eq(buildings.organizationId, organizations.id))
        .where(and(...conditions));

      let results = await baseQuery;

      // Apply search filter
      if (search) {
        const searchLower = search.toLowerCase();
        results = results.filter(
          (result) =>
            result.residence.unitNumber.toLowerCase().includes(searchLower) ||
            result.building?.name.toLowerCase().includes(searchLower)
        );
      }

      // Get tenants for each residence
      const residenceIds = results.map((r) => r.residence.id);
      const tenants =
        residenceIds.length > 0
          ? await db
              .select({
                residenceId: userResidences.residenceId,
                tenant: users,
              })
              .from(userResidences)
              .innerJoin(users, eq(userResidences.userId, users.id))
              .where(
                and(
                  inArray(userResidences.residenceId, residenceIds),
                  eq(userResidences.isActive, true)
                )
              )
          : [];

      // Group tenants by residence
      const tenantsByResidence = tenants.reduce(
        (acc, { residenceId, tenant }) => {
          if (!acc[residenceId]) {
            acc[residenceId] = [];
          }
          acc[residenceId].push({
            id: tenant.id,
            firstName: tenant.firstName,
            lastName: tenant.lastName,
            email: tenant.email,
          });
          return acc;
        },
        {} as Record<string, any[]>
      );

      // Combine results
      const residencesList = results.map((result) => ({
        ...result.residence,
        building: result.building,
        organization: result.organization,
        tenants: tenantsByResidence[result.residence.id] || [],
      }));

      res.json(residencesList);
    } catch (error: any) {
      console.error('❌ Error fetching residences:', error);
      res.status(500).json({ message: 'Failed to fetch residences' });
    }
  });

  // Get a specific residence by ID
  app.get('/api/residences/:id', requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const user = req.user;

      const result = await db
        .select({
          residence: residences,
          building: buildings,
          organization: organizations,
        })
        .from(residences)
        .leftJoin(buildings, eq(residences.buildingId, buildings.id))
        .leftJoin(organizations, eq(buildings.organizationId, organizations.id))
        .where(and(eq(residences.id, id), eq(residences.isActive, true)));

      if (result.length === 0) {
        return res.status(404).json({ message: 'Residence not found' });
      }

      const residence = result[0];

      // Apply RBAC check
      if (user.role !== 'admin' && !user.canAccessAllOrganizations) {
        // Check if user has access to this residence's organization
        const userHasAccess = await db
          .select({ count: sql<number>`count(*)` })
          .from(userResidences)
          .leftJoin(residences, eq(userResidences.residenceId, residences.id))
          .leftJoin(buildings, eq(residences.buildingId, buildings.id))
          .where(
            and(
              eq(userResidences.userId, user.id),
              eq(buildings.organizationId, residence.organization.id)
            )
          );

        if (userHasAccess[0].count === 0) {
          return res.status(403).json({ message: 'Access denied' });
        }
      }

      // Get tenants for this residence
      const tenants = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          relationshipType: userResidences.relationshipType,
          startDate: userResidences.startDate,
          endDate: userResidences.endDate,
        })
        .from(userResidences)
        .leftJoin(users, eq(userResidences.userId, users.id))
        .where(and(eq(userResidences.residenceId, id), eq(userResidences.isActive, true)));

      res.json({
        ...residence.residence,
        building: residence.building,
        organization: residence.organization,
        tenants,
      });
    } catch (error: any) {
      console.error('❌ Error fetching residence:', error);
      res.status(500).json({ message: 'Failed to fetch residence' });
    }
  });

  // Update a residence
  app.put('/api/residences/:id', requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Remove readonly fields
      delete updateData.id;
      delete updateData.createdAt;
      delete updateData.buildingId; // Don't allow changing building

      const updated = await db
        .update(residences)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(residences.id, id))
        .returning();

      if (updated.length === 0) {
        return res.status(404).json({ message: 'Residence not found' });
      }

      // Schedule delayed money flow and budget update for the updated residence
      try {
        delayedUpdateService.scheduleResidenceUpdate(id);
        // Don't fail the residence update if scheduling fails
      } catch (e) {
        console.warn('⚠️ Failed to schedule residence update:', e);
      }

      res.json(updated[0]);
    } catch (error: any) {
      console.error('❌ Error updating residence:', error);
      res.status(500).json({ message: 'Failed to update residence' });
    }
  });

  // Create residences when a building is created (called internally)
  app.post(
    '/api/buildings/:buildingId/generate-residences',
    requireAuth,
    async (req: any, res: any) => {
      try {
        const { buildingId } = req.params;

        // Get building details
        const building = await db
          .select()
          .from(buildings)
          .where(eq(buildings.id, buildingId))
          .limit(1);

        if (building.length === 0) {
          return res.status(404).json({ message: 'Building not found' });
        }

        const buildingData = building[0];
        const totalUnits = buildingData.totalUnits;
        const totalFloors = buildingData.totalFloors || 1;

        if (totalUnits > 300) {
          return res
            .status(400)
            .json({ message: 'Cannot create more than 300 residences per building' });
        }

        // Check if residences already exist for this building
        const existingResidences = await db
          .select({ count: sql<number>`count(*)` })
          .from(residences)
          .where(eq(residences.buildingId, buildingId));

        if (existingResidences[0].count > 0) {
          return res.status(400).json({ message: 'Residences already exist for this building' });
        }

        // Generate residences
        const residencesToCreate = [];
        const unitsPerFloor = Math.ceil(totalUnits / totalFloors);

        for (let unit = 1; unit <= totalUnits; unit++) {
          const floor = Math.ceil(unit / unitsPerFloor);
          const unitOnFloor = ((unit - 1) % unitsPerFloor) + 1;
          const unitNumber = `${floor}${unitOnFloor.toString().padStart(2, '0')}`;

          residencesToCreate.push({
            buildingId,
            unitNumber,
            floor,
            isActive: true,
          });
        }

        // Insert all residences at once
        const createdResidences = await db
          .insert(residences)
          .values(residencesToCreate)
          .returning();

        res.json({
          message: `Successfully created ${createdResidences.length} residences`,
          residences: createdResidences,
        });
      } catch (error: any) {
        console.error('❌ Error generating residences:', error);
        res.status(500).json({ message: 'Failed to generate residences' });
      }
    }
  );
}
