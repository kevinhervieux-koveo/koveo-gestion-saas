import { Express } from 'express';
import { db } from '../db';
import {
  residences,
  buildings,
  organizations,
  userResidences,
  users,
  userOrganizations,
} from '../../shared/schema';
import { eq, and, or, ilike, inArray, sql } from 'drizzle-orm';
import { requireAuth } from '../auth/index';
import { delayedUpdateService } from '../services/delayed-update-service';
import { cacheInvalidationService, createInvalidationMiddleware } from '../services/cache-invalidation-service';

import { asyncHandler } from '../utils/async-handler';
import { resolveOrgScope } from '../utils/org-scope';

/**
 * Resolves the organization ID that owns a given building.
 * Returns null when the building does not exist.
 */
async function getBuildingOrganizationId(buildingId: string): Promise<string | null> {
  const row = await db
    .select({ organizationId: buildings.organizationId })
    .from(buildings)
    .where(eq(buildings.id, buildingId))
    .limit(1);
  return row[0]?.organizationId ?? null;
}

/**
 * Returns true when the caller is allowed to manage the given building's data.
 * Permitted when:
 *   - user.role === 'admin', OR
 *   - user.canAccessAllOrganizations is true, OR
 *   - user is an active manager/demo_manager of the building's organization.
 */
async function userCanManageBuilding(user: any, buildingId: string): Promise<boolean> {
  if (user.role === 'admin' || user.canAccessAllOrganizations) return true;

  const isManager = user.role === 'manager' || user.role === 'demo_manager';
  if (!isManager) return false;

  const organizationId = await getBuildingOrganizationId(buildingId);
  if (!organizationId) return false;

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(userOrganizations)
    .where(
      and(
        eq(userOrganizations.userId, user.id),
        eq(userOrganizations.organizationId, organizationId),
        eq(userOrganizations.isActive, true)
      )
    );
  return Number(result[0].count) > 0;
}

/**
 * RegisterResidenceRoutes function.
 * @param app
 * @returns Function result.
 */
export function registerResidenceRoutes(app: Express) {
  // Get user's residences (enriched for profile widget)
  app.get('/api/user/residences', requireAuth, asyncHandler(async (req: any, res: any) => {
      const user = req.user;
      const userResidencesList = await db
        .select({
          id: userResidences.id,
          residenceId: userResidences.residenceId,
          relationshipType: userResidences.relationshipType,
          startDate: userResidences.startDate,
          unitNumber: residences.unitNumber,
          buildingName: buildings.name,
          organizationName: organizations.name,
        })
        .from(userResidences)
        .innerJoin(residences, eq(userResidences.residenceId, residences.id))
        .innerJoin(buildings, eq(residences.buildingId, buildings.id))
        .innerJoin(organizations, eq(buildings.organizationId, organizations.id))
        .where(and(eq(userResidences.userId, user.id), eq(userResidences.isActive, true)));
      res.json(userResidencesList);
    }, { errorMessage: 'Failed to fetch user residences', errorLogPrefix: '❌ Error fetching user residences' }));

  // Get assigned users for a specific residence
  app.get(
    '/api/residences/:residenceId/assigned-users',
    requireAuth,
    asyncHandler(async (req: any, res: any) => {
        const { residenceId } = req.params;
        const currentUser = req.user;

        // Verify the caller has scope access to this residence:
        // - admin or global-access user, OR
        // - a manager of the building's organization, OR
        // - a user directly assigned to this residence

        // First, resolve the building for this residence (needed for manager check)
        const residenceRow = await db
          .select({ buildingId: residences.buildingId })
          .from(residences)
          .where(eq(residences.id, residenceId))
          .limit(1);

        if (residenceRow.length === 0) {
          return res.status(404).json({ message: 'Residence not found' });
        }

        const canManage = await userCanManageBuilding(currentUser, residenceRow[0].buildingId);

        if (!canManage) {
          // Fall back to checking direct residence assignment
          const callerAssignment = await db
            .select({ count: sql<number>`count(*)` })
            .from(userResidences)
            .where(
              and(
                eq(userResidences.residenceId, residenceId),
                eq(userResidences.userId, currentUser.id),
                eq(userResidences.isActive, true)
              )
            );

          if (Number(callerAssignment[0].count) === 0) {
            return res.status(403).json({ message: 'Access denied' });
          }
        }

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
      }, { errorMessage: 'Failed to fetch assigned users', errorLogPrefix: '❌ Error fetching assigned users' })
  );

  // Update assigned user information
  app.put(
    '/api/residences/:residenceId/assigned-users/:userId',
    requireAuth,
    createInvalidationMiddleware('userResidence', {
      extractEntityId: (req) => `${req.params.residenceId}-${req.params.userId}`,
      extractAffectedUsers: async (req) => [req.params.userId],
      operation: 'update'
    }),
    asyncHandler(async (req: any, res: any) => {
        const { residenceId, userId } = req.params;
        const { firstName, lastName, email, phone } = req.body;
        const currentUser = req.user;

        // Authorization: only admins, global-access users, or managers of the
        // building's organization may update assigned-user profiles.
        const residenceRowForAuth = await db
          .select({ buildingId: residences.buildingId })
          .from(residences)
          .where(eq(residences.id, residenceId))
          .limit(1);

        if (residenceRowForAuth.length === 0) {
          return res.status(404).json({ message: 'Residence not found' });
        }

        const canManage = await userCanManageBuilding(currentUser, residenceRowForAuth[0].buildingId);
        if (!canManage) {
          return res.status(403).json({ message: 'Access denied' });
        }

        // Verify the target user is actually assigned to the given residence
        const targetAssignment = await db
          .select({ count: sql<number>`count(*)` })
          .from(userResidences)
          .where(
            and(
              eq(userResidences.residenceId, residenceId),
              eq(userResidences.userId, userId),
              eq(userResidences.isActive, true)
            )
          );

        if (Number(targetAssignment[0].count) === 0) {
          return res.status(404).json({ message: 'User not found in this residence' });
        }

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
      }, { errorMessage: 'Failed to update assigned user', errorLogPrefix: '❌ Error updating assigned user' })
  );

  // Get all residences with filtering and search
  app.get('/api/residences', requireAuth, async (req: any, res: any) => {
    try {
      const user = req.user;
      const { search, buildingId, floor } = req.query;

      // Validate and resolve the organization scope. Admins are no longer
      // exempt from scoping — when no organizationId is supplied, results are
      // restricted to the caller's accessible org set. When supplied, the
      // helper validates the UUID and the caller's access.
      const scope = await resolveOrgScope(req, res);
      if (!scope) return;

      // Start with base conditions
      const conditions = [eq(residences.isActive, true)];

      // Apply filters
      if (buildingId) {
        conditions.push(eq(residences.buildingId, buildingId));
      }

      if (floor) {
        conditions.push(eq(residences.floor, parseInt(floor)));
      }

      // Role-aware building access:
      // - Admin/manager (and demo-equivalents) can see every residence in the
      //   buildings owned by the resolved org scope.
      // - Tenants and residents are limited to buildings reached through their
      //   own residence assignments, intersected with the resolved org scope.
      // The `inArray(...)` constraint added below keeps results within the
      // resolved organization set for every role, matching the strict scoping
      // applied by the other flat list endpoints.
      const accessibleBuildingIds = new Set<string>();
      const isManagerLikeRole = ['admin', 'manager', 'demo_manager'].includes(user.role);

      if (isManagerLikeRole && scope.orgIds.length > 0) {
        const orgBuildings = await db
          .select({ id: buildings.id })
          .from(buildings)
          .where(
            and(inArray(buildings.organizationId, scope.orgIds), eq(buildings.isActive, true))
          );
        orgBuildings.forEach((building) => accessibleBuildingIds.add(building.id));
      }

      if (!isManagerLikeRole && scope.orgIds.length > 0) {
        const userResidenceRecords = await db
          .select({ residenceId: userResidences.residenceId })
          .from(userResidences)
          .where(and(eq(userResidences.userId, user.id), eq(userResidences.isActive, true)));

        if (userResidenceRecords.length > 0) {
          const residenceIds = userResidenceRecords.map((ur) => ur.residenceId);
          const residenceBuildings = await db
            .select({ id: buildings.id })
            .from(residences)
            .innerJoin(buildings, eq(residences.buildingId, buildings.id))
            .where(
              and(
                inArray(residences.id, residenceIds),
                eq(buildings.isActive, true),
                inArray(buildings.organizationId, scope.orgIds)
              )
            );

          residenceBuildings.forEach((building) => accessibleBuildingIds.add(building.id));
        }
      }

      // Add building access filter to conditions
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔍 [ACCESS DEBUG] User ${user.id} has access to ${accessibleBuildingIds.size} buildings:`, Array.from(accessibleBuildingIds));
      }
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
        .where(and(...conditions))
        // Sort numerically when unit_number is purely digits, otherwise
        // fall back to lexicographic order. Using CAST(... AS INTEGER)
        // unconditionally throws on values like "P1", "RDC", "101A".
        .orderBy(
          sql`CASE WHEN ${residences.unitNumber} ~ '^[0-9]+$' THEN ${residences.unitNumber}::integer ELSE NULL END NULLS LAST`,
          sql`${residences.unitNumber}`
        );

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
      // Always log so production failures are visible in deployment logs.
      console.error('❌ Error fetching residences:', error?.message || error);
      if (process.env.NODE_ENV === 'development' && error?.stack) {
        console.error(error.stack);
      }
      res.status(500).json({ message: 'Failed to fetch residences' });
    }
  });

  // Get a specific residence by ID
  app.get('/api/residences/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
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
        // Check if user has access to this residence's organization.
        // Per Task #144, "current tenancy" reads MUST require an
        // active link (`userResidences.isActive = true`).
        const userHasAccess = await db
          .select({ count: sql<number>`count(*)` })
          .from(userResidences)
          .leftJoin(residences, eq(userResidences.residenceId, residences.id))
          .leftJoin(buildings, eq(residences.buildingId, buildings.id))
          .where(
            and(
              eq(userResidences.userId, user.id),
              eq(userResidences.isActive, true),
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
    }, { errorMessage: 'Failed to fetch residence', errorLogPrefix: '❌ Error fetching residence' }));

  // Update a residence
  app.put('/api/residences/:id', requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const currentUser = req.user;
      const updateData = req.body;

      if (process.env.NODE_ENV === 'development') console.log(`🏠 Updating residence ${id} with data:`, updateData);

      // Authorization: only admins, global-access users, or managers of the
      // building's organization may update residence records.
      const residenceRowForAuth = await db
        .select({ buildingId: residences.buildingId })
        .from(residences)
        .where(eq(residences.id, id))
        .limit(1);

      if (residenceRowForAuth.length === 0) {
        return res.status(404).json({ message: 'Residence not found' });
      }

      const canManage = await userCanManageBuilding(currentUser, residenceRowForAuth[0].buildingId);
      if (!canManage) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Remove readonly fields
      delete updateData.id;
      delete updateData.createdAt;
      delete updateData.buildingId; // Don't allow changing building

      // Validate and sanitize numeric fields
      const processedData = {
        ...updateData,
        updatedAt: new Date(),
      };

      // Convert null/empty values to null for optional fields
      if (processedData.squareFootage === null || processedData.squareFootage === '') {
        processedData.squareFootage = null;
      }
      if (processedData.bathrooms === null || processedData.bathrooms === '') {
        processedData.bathrooms = null;
      }
      if (processedData.ownershipPercentage === null || processedData.ownershipPercentage === '') {
        processedData.ownershipPercentage = null;
      }
      if (processedData.monthlyFees === null || processedData.monthlyFees === '') {
        processedData.monthlyFees = null;
      }

      if (process.env.NODE_ENV === 'development') console.log(`🏠 Processed data for residence ${id}:`, processedData);

      const updated = await db
        .update(residences)
        .set(processedData)
        .where(eq(residences.id, id))
        .returning();

      if (updated.length === 0) {
        return res.status(404).json({ message: 'Residence not found' });
      }

      if (process.env.NODE_ENV === 'development') console.log(`✅ Successfully updated residence ${id}`);

      // Schedule delayed money flow and budget update for the updated residence
      try {
        delayedUpdateService.scheduleResidenceUpdate(id);
        // Don't fail the residence update if scheduling fails
      } catch (e) {
        console.warn('⚠️ Failed to schedule residence update:', e);
      }

      res.json(updated[0]);
    } catch (error: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error updating residence:', error);
      }
      res.status(500).json({ 
        message: 'Failed to update residence',
        error: 'internal_error',
      });
    }
  });

  // Create residences when a building is created (called internally)
  app.post(
    '/api/buildings/:buildingId/generate-residences',
    requireAuth,
    asyncHandler(async (req: any, res: any) => {
        const { buildingId } = req.params;
        const currentUser = req.user;

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

        // Authorization: only admins, global-access users, or managers of the
        // building's organization may generate residences.
        const canManage = await userCanManageBuilding(currentUser, buildingId);
        if (!canManage) {
          return res.status(403).json({ message: 'Access denied' });
        }

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
      }, { errorMessage: 'Failed to generate residences', errorLogPrefix: '❌ Error generating residences' })
  );
}
