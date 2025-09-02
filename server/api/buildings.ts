import { Express } from 'express';
import { db } from '../db';
import {
  buildings,
  organizations,
  residences,
  userResidences,
  userOrganizations,
  users,
  documents,
} from '@shared/schema';
import { eq, and, or, inArray, sql, isNull, count } from 'drizzle-orm';
import { requireAuth } from '../auth';
import crypto from 'crypto';

/**
 * Handles creating or deleting residences when building totalUnits changes
 */
async function handleResidenceChanges(
  buildingId: string,
  organizationId: string,
  newTotalUnits: number,
  currentResidenceCount: number,
  totalFloors?: number
): Promise<void> {
  try {
    // Object storage hierarchy will be created automatically when documents are uploaded

    if (newTotalUnits > currentResidenceCount) {
      // Need to create more residences
      const residencesToCreate = newTotalUnits - currentResidenceCount;

      // Get existing residence numbers to avoid conflicts
      const existingResidences = await db
        .select({ unitNumber: residences.unitNumber })
        .from(residences)
        .where(eq(residences.buildingId, buildingId));

      const existingUnitNumbers = new Set(existingResidences.map((r) => r.unitNumber));

      const floors = totalFloors || 1;
      const unitsPerFloor = Math.ceil(newTotalUnits / floors);

      const newResidences = [];
      let unitCounter = 1;

      for (let residenceIndex = 0; residenceIndex < residencesToCreate; residenceIndex++) {
        // Find next available unit number
        while (existingUnitNumbers.has(unitCounter.toString())) {
          unitCounter++;
        }

        const floor = Math.ceil(unitCounter / unitsPerFloor);
        const unitNumber = unitCounter.toString();

        newResidences.push({
          buildingId,
          unitNumber,
          floor: floor,
          isActive: true,
        });

        existingUnitNumbers.add(unitNumber);
        unitCounter++;
      }

      // Create residences in batch
      if (newResidences.length > 0) {
        const createdResidences = await db.insert(residences).values(newResidences).returning();

        // Create object storage hierarchy for each new residence
        for (const residence of createdResidences) {
          try {
            await objectStorageService.createResidenceHierarchy(
              organizationId,
              buildingId,
              residence.id
            );
          } catch (storageError) {
            console.error(
              `⚠️ Error creating storage hierarchy for residence ${residence.id}:`,
              storageError
            );
            // Don't fail the whole operation for storage errors
          }
        }

        console.log(
          `✅ Created ${createdResidences.length} new residences for building ${buildingId}`
        );
      }
    } else if (newTotalUnits < currentResidenceCount) {
      // Need to delete some residences
      const residencesToDelete = currentResidenceCount - newTotalUnits;
      console.log(
        `📉 Marking ${residencesToDelete} residences as inactive for building ${buildingId}`
      );

      // Get residences that can be safely deleted (no active user relationships)
      const deletableResidences = await db
        .select({ id: residences.id, unitNumber: residences.unitNumber })
        .from(residences)
        .leftJoin(
          userResidences,
          and(eq(userResidences.residenceId, residences.id), eq(userResidences.isActive, true))
        )
        .where(
          and(
            eq(residences.buildingId, buildingId),
            eq(residences.isActive, true),
            isNull(userResidences.id) // No active user relationships
          )
        )
        .orderBy(sql`${residences.unitNumber}::integer DESC`) // Delete highest unit numbers first
        .limit(residencesToDelete);

      if (deletableResidences.length > 0) {
        const residenceIdsToDelete = deletableResidences.map((r) => r.id);

        // Soft delete residences (mark as inactive)
        await db
          .update(residences)
          .set({
            isActive: false,
            updatedAt: new Date(),
          })
          .where(inArray(residences.id, residenceIdsToDelete));

        console.log(
          `✅ Marked ${deletableResidences.length} residences as inactive for building ${buildingId}`
        );

        // Log which residences couldn't be deleted due to user relationships
        const protectedCount = residencesToDelete - deletableResidences.length;
        if (protectedCount > 0) {
          console.log(
            `⚠️ Could not delete ${protectedCount} residences - they have active user relationships`
          );
        }
      } else {
      }
    } else {
      console.log(
        `✓ No residence changes needed - building ${buildingId} already has ${currentResidenceCount} residences`
      );
    }
    // Don't throw the error to avoid breaking the building update
  }
}

/**
 *
 * @param app
 */
/**
 * RegisterBuildingRoutes function.
 * @param app
 * @returns Function result.
 */
export function registerBuildingRoutes(app: Express): void {
  /**
   * GET /api/buildings - Retrieves buildings based on user role and organization access.
   * Used by bills page and other components.
   *
   * Access Control Logic:
   * - Admin: Can see all buildings if they have global access, or buildings in their organizations
   * - Manager: Can see only buildings in their organizations
   * - Others: No access to buildings list.
   */
  app.get('/api/buildings', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Role-based access control for buildings
      if (
        ![
          'admin',
          'manager',
          'demo_manager',
          'demo_tenant',
          'demo_resident',
          'tenant',
          'resident',
        ].includes(user.role)
      ) {
        return res.status(403).json({
          message: 'Access denied. Insufficient permissions.',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

        id: user.id,
        role: user.role,
        organizations: user.organizations,
        canAccessAllOrganizations: user.canAccessAllOrganizations,
      });

      let buildingsQuery;

      if (user.role === 'admin' && user.canAccessAllOrganizations) {
        // Admin with global access can see all buildings
        buildingsQuery = db
          .select({
            id: buildings.id,
            name: buildings.name,
            address: buildings.address,
            city: buildings.city,
            province: buildings.province,
            postalCode: buildings.postalCode,
            buildingType: buildings.buildingType,
            yearBuilt: buildings.yearBuilt,
            totalUnits: buildings.totalUnits,
            totalFloors: buildings.totalFloors,
            parkingSpaces: buildings.parkingSpaces,
            storageSpaces: buildings.storageSpaces,
            organizationId: buildings.organizationId,
            isActive: buildings.isActive,
            createdAt: buildings.createdAt,
            organizationName: organizations.name,
          })
          .from(buildings)
          .innerJoin(organizations, eq(buildings.organizationId, organizations.id))
          .where(eq(buildings.isActive, true))
          .orderBy(organizations.name, buildings.name);
      } else {
        // Manager or admin without global access: only buildings from their organizations
          `🔍 [BUILDINGS DEBUG] Taking ELSE path - User ${user.id} organizations:`,
          user.organizations
        );
        if (!user.organizations || user.organizations.length === 0) {
          console.log(
            `🔍 [BUILDINGS DEBUG] User ${user.id} has no organizations, checking residence access...`
          );

          // For tenant/resident roles: Get buildings through their residences
          if (['tenant', 'resident', 'demo_tenant', 'demo_resident'].includes(user.role)) {
            const userResidencesList = await db
              .select({
                buildingId: residences.buildingId,
              })
              .from(userResidences)
              .innerJoin(residences, eq(userResidences.residenceId, residences.id))
              .where(and(eq(userResidences.userId, user.id), eq(userResidences.isActive, true)));

            console.log(
              `🔍 [BUILDINGS DEBUG] Found ${userResidencesList.length} residences for user ${user.id}`
            );

            if (userResidencesList.length === 0) {
              return res.json([]); // No residences = no buildings
            }

            const accessibleBuildingIds = [
              ...new Set(userResidencesList.map((ur) => ur.buildingId)),
            ];
            console.log(`🔍 [BUILDINGS DEBUG] Accessible building IDs:`, accessibleBuildingIds);

            buildingsQuery = db
              .select({
                id: buildings.id,
                name: buildings.name,
                address: buildings.address,
                city: buildings.city,
                province: buildings.province,
                postalCode: buildings.postalCode,
                buildingType: buildings.buildingType,
                yearBuilt: buildings.yearBuilt,
                totalUnits: buildings.totalUnits,
                totalFloors: buildings.totalFloors,
                parkingSpaces: buildings.parkingSpaces,
                storageSpaces: buildings.storageSpaces,
                organizationId: buildings.organizationId,
                isActive: buildings.isActive,
                createdAt: buildings.createdAt,
                organizationName: organizations.name,
              })
              .from(buildings)
              .innerJoin(organizations, eq(buildings.organizationId, organizations.id))
              .where(
                and(eq(buildings.isActive, true), inArray(buildings.id, accessibleBuildingIds))
              )
              .orderBy(organizations.name, buildings.name);
          } else {
            return res.json([]); // No organizations = no buildings for managers/admins
          }
        } else {
          // User has organizations - use organization-based access
          buildingsQuery = db
            .select({
              id: buildings.id,
              name: buildings.name,
              address: buildings.address,
              city: buildings.city,
              province: buildings.province,
              postalCode: buildings.postalCode,
              buildingType: buildings.buildingType,
              yearBuilt: buildings.yearBuilt,
              totalUnits: buildings.totalUnits,
              totalFloors: buildings.totalFloors,
              parkingSpaces: buildings.parkingSpaces,
              storageSpaces: buildings.storageSpaces,
              organizationId: buildings.organizationId,
              isActive: buildings.isActive,
              createdAt: buildings.createdAt,
              organizationName: organizations.name,
            })
            .from(buildings)
            .innerJoin(organizations, eq(buildings.organizationId, organizations.id))
            .where(
              and(
                eq(buildings.isActive, true),
                inArray(buildings.organizationId, user.organizations)
              )
            )
            .orderBy(organizations.name, buildings.name);
        }
      }

      const result = await buildingsQuery;

      res.json(result);
      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to fetch buildings',
      });
    }
  });

  /**
   * GET /api/manager/buildings - Retrieves buildings based on user role and associations.
   *
   * Access Control Logic:
   * - Admin: Can see all buildings in their organization + buildings where they have residences
   * - Manager: Can see all buildings in their organization + buildings where they have residences
   * - Resident/Tenant: Can see only buildings where they have residences (role is not used, only residence links).
   */
  app.get('/api/manager/buildings', async (req: any, res) => {
    // Authentication check
    if (!req.session?.userId && !req.session?.user) {
      return res.status(401).json({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    try {
      // Use session data directly for now
      let currentUser = req.user || req.session?.user;

      // If we only have userId, we need to fetch the user
      if (!currentUser && req.session?.userId) {
        // Import storage from the auth route pattern
        const { storage } = await import('../storage');
        currentUser = await storage.getUser(req.session.userId);
      }

      if (!currentUser) {
        return res.status(401).json({
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

        `📊 Fetching buildings for user ${currentUser.id} with role ${currentUser.role}`
      );

      const accessibleBuildings: any[] = [];
      const buildingIds = new Set<string>();

      // Check if user belongs to Koveo organization (special global access)
      const userOrgs = await db
        .select({
          organizationId: userOrganizations.organizationId,
          organizationName: organizations.name,
          canAccessAllOrganizations: userOrganizations.canAccessAllOrganizations,
        })
        .from(userOrganizations)
        .innerJoin(organizations, eq(userOrganizations.organizationId, organizations.id))
        .where(
          and(eq(userOrganizations.userId, currentUser.id), eq(userOrganizations.isActive, true))
        );

      const hasGlobalAccess =
        currentUser.role === 'admin' ||
        userOrgs.some((org) => org.organizationName === 'Koveo' || org.canAccessAllOrganizations);

      if (hasGlobalAccess) {
          `🌟 Admin user or user with global access detected - granting access to ALL buildings`
        );

        // Koveo users can see ALL buildings from ALL organizations
        const allBuildings = await db
          .select({
            id: buildings.id,
            name: buildings.name,
            address: buildings.address,
            city: buildings.city,
            province: buildings.province,
            postalCode: buildings.postalCode,
            buildingType: buildings.buildingType,
            yearBuilt: buildings.yearBuilt,
            totalUnits: buildings.totalUnits,
            totalFloors: buildings.totalFloors,
            parkingSpaces: buildings.parkingSpaces,
            storageSpaces: buildings.storageSpaces,
            amenities: buildings.amenities,
            managementCompany: buildings.managementCompany,
            organizationId: buildings.organizationId,
            isActive: buildings.isActive,
            createdAt: buildings.createdAt,
            updatedAt: buildings.updatedAt,
            organizationName: organizations.name,
            organizationType: organizations.type,
          })
          .from(buildings)
          .innerJoin(organizations, eq(buildings.organizationId, organizations.id))
          .where(eq(buildings.isActive, true))
          .orderBy(organizations.name, buildings.name);

        // Add all buildings with special Koveo access type
        allBuildings.forEach((building) => {
          if (!buildingIds.has(building.id)) {
            buildingIds.add(building.id);
            accessibleBuildings.push({
              ...building,
              accessType: 'koveo-global', // Special access type for Koveo users
            });
          }
        });
      } else {
        // Regular users: For Admin and Manager roles: Get buildings from their organizations only
        if (currentUser.role === 'admin' || currentUser.role === 'manager') {
          if (userOrgs.length > 0) {
            const orgIds = userOrgs.map((uo) => uo.organizationId);

            // Get all buildings from these organizations only
            const orgBuildings = await db
              .select({
                id: buildings.id,
                name: buildings.name,
                address: buildings.address,
                city: buildings.city,
                province: buildings.province,
                postalCode: buildings.postalCode,
                buildingType: buildings.buildingType,
                yearBuilt: buildings.yearBuilt,
                totalUnits: buildings.totalUnits,
                totalFloors: buildings.totalFloors,
                parkingSpaces: buildings.parkingSpaces,
                storageSpaces: buildings.storageSpaces,
                amenities: buildings.amenities,
                managementCompany: buildings.managementCompany,
                organizationId: buildings.organizationId,
                isActive: buildings.isActive,
                createdAt: buildings.createdAt,
                updatedAt: buildings.updatedAt,
                organizationName: organizations.name,
                organizationType: organizations.type,
              })
              .from(buildings)
              .innerJoin(organizations, eq(buildings.organizationId, organizations.id))
              .where(and(inArray(buildings.organizationId, orgIds), eq(buildings.isActive, true)));

            orgBuildings.forEach((building) => {
              if (!buildingIds.has(building.id)) {
                buildingIds.add(building.id);
                accessibleBuildings.push({
                  ...building,
                  accessType: 'organization', // Track how user has access
                });
              }
            });
          }
        }
      }

      // For ALL roles (Admin, Manager, Resident, Tenant): Get buildings from their residences
      // This is the many-to-many relationship - users can have residences in different buildings
      const userResidenceRecords = await db
        .select({
          residenceId: userResidences.residenceId,
          relationshipType: userResidences.relationshipType,
        })
        .from(userResidences)
        .where(and(eq(userResidences.userId, currentUser.id), eq(userResidences.isActive, true)));

      if (userResidenceRecords.length > 0) {
        const residenceIds = userResidenceRecords.map((ur) => ur.residenceId);

        // Get buildings through residences
        const residenceBuildings = await db
          .select({
            id: buildings.id,
            name: buildings.name,
            address: buildings.address,
            city: buildings.city,
            province: buildings.province,
            postalCode: buildings.postalCode,
            buildingType: buildings.buildingType,
            yearBuilt: buildings.yearBuilt,
            totalUnits: buildings.totalUnits,
            totalFloors: buildings.totalFloors,
            parkingSpaces: buildings.parkingSpaces,
            storageSpaces: buildings.storageSpaces,
            amenities: buildings.amenities,
            managementCompany: buildings.managementCompany,
            organizationId: buildings.organizationId,
            isActive: buildings.isActive,
            createdAt: buildings.createdAt,
            updatedAt: buildings.updatedAt,
            organizationName: organizations.name,
            organizationType: organizations.type,
            residenceId: residences.id,
            unitNumber: residences.unitNumber,
            floor: residences.floor,
          })
          .from(residences)
          .innerJoin(buildings, eq(residences.buildingId, buildings.id))
          .innerJoin(organizations, eq(buildings.organizationId, organizations.id))
          .where(and(inArray(residences.id, residenceIds), eq(buildings.isActive, true)));

        // Add residence-based buildings (avoid duplicates)
        residenceBuildings.forEach((building) => {
          if (!buildingIds.has(building.id)) {
            buildingIds.add(building.id);
            accessibleBuildings.push({
              id: building.id,
              name: building.name,
              address: building.address,
              city: building.city,
              province: building.province,
              postalCode: building.postalCode,
              buildingType: building.buildingType,
              yearBuilt: building.yearBuilt,
              totalUnits: building.totalUnits,
              totalFloors: building.totalFloors,
              parkingSpaces: building.parkingSpaces,
              storageSpaces: building.storageSpaces,
              amenities: building.amenities,
              managementCompany: building.managementCompany,
              organizationId: building.organizationId,
              isActive: building.isActive,
              createdAt: building.createdAt,
              updatedAt: building.updatedAt,
              organizationName: building.organizationName,
              organizationType: building.organizationType,
              accessType: 'residence', // Track how user has access
              userResidence: {
                residenceId: building.residenceId,
                unitNumber: building.unitNumber,
                floor: building.floor,
              },
            });
          } else {
            // Building already exists, but we might want to add residence info
            const existingBuilding = accessibleBuildings.find((b) => b.id === building.id);
            if (existingBuilding && !existingBuilding.userResidence) {
              existingBuilding.userResidence = {
                residenceId: building.residenceId,
                unitNumber: building.unitNumber,
                floor: building.floor,
              };
              // Update access type if this is from both organization and residence
              if (existingBuilding.accessType === 'organization') {
                existingBuilding.accessType = 'both';
              }
            }
          }
        });
      }

      // Get statistics for each building
      const buildingsWithStats = await Promise.all(
        accessibleBuildings.map(async (building) => {
          // Get residence count
          const residenceCount = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(residences)
            .where(and(eq(residences.buildingId, building.id), eq(residences.isActive, true)));

          // Calculate occupancy rate
          const occupiedUnits = residenceCount[0]?.count || 0;
          const occupancyRate =
            building.totalUnits > 0 ? Math.round((occupiedUnits / building.totalUnits) * 100) : 0;

          return {
            ...building,
            statistics: {
              totalUnits: building.totalUnits,
              occupiedUnits,
              occupancyRate,
              vacantUnits: building.totalUnits - occupiedUnits,
            },
          };
        })
      );

      // Sort buildings by name
      buildingsWithStats.sort((a, b) => a.name.localeCompare(b.name));

        `✅ Found ${buildingsWithStats.length} accessible buildings for user ${currentUser.id}`
      );

      res.json({
        buildings: buildingsWithStats,
        meta: {
          total: buildingsWithStats.length,
          userRole: currentUser.role,
          userId: currentUser.id,
        },
      });
      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to fetch buildings',
      });
    }
  });

  /**
   * GET /api/manager/buildings/:id - Get a specific building with detailed information
   * Uses the same access control logic as the list endpoint.
   */
  app.get('/api/manager/buildings/:id', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user;
      const buildingId = req.params.id;

      if (!currentUser) {
        return res.status(401).json({
          _error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

        `📊 Fetching building ${buildingId} for user ${currentUser.id} with role ${currentUser.role}`
      );

      let hasAccess = false;
      let accessType = '';

      // Check if user belongs to Koveo organization (special global access)
      const userOrgs = await db
        .select({
          organizationId: userOrganizations.organizationId,
          organizationName: organizations.name,
          canAccessAllOrganizations: userOrganizations.canAccessAllOrganizations,
        })
        .from(userOrganizations)
        .innerJoin(organizations, eq(userOrganizations.organizationId, organizations.id))
        .where(
          and(eq(userOrganizations.userId, currentUser.id), eq(userOrganizations.isActive, true))
        );

      const hasGlobalAccess =
        currentUser.role === 'admin' ||
        userOrgs.some((org) => org.organizationName === 'Koveo' || org.canAccessAllOrganizations);

      if (hasGlobalAccess) {
        hasAccess = true;
        accessType = 'global';
      } else {
        // Check organization-based access for Admin and Manager
        if (currentUser.role === 'admin' || currentUser.role === 'manager') {
          if (userOrgs.length > 0) {
            const orgIds = userOrgs.map((uo) => uo.organizationId);

            // Check if building belongs to user's organizations
            const buildingOrg = await db
              .select({ id: buildings.id })
              .from(buildings)
              .where(
                and(
                  eq(buildings.id, buildingId),
                  inArray(buildings.organizationId, orgIds),
                  eq(buildings.isActive, true)
                )
              );

            if (buildingOrg.length > 0) {
              hasAccess = true;
              accessType = 'organization';
            }
          }
        }
      }

      // Check residence-based access for all roles
      if (!hasAccess) {
        const userResidenceAccess = await db
          .select({ residenceId: userResidences.residenceId })
          .from(userResidences)
          .innerJoin(residences, eq(userResidences.residenceId, residences.id))
          .where(
            and(
              eq(userResidences.userId, currentUser.id),
              eq(residences.buildingId, buildingId),
              eq(userResidences.isActive, true)
            )
          );

        if (userResidenceAccess.length > 0) {
          hasAccess = true;
          accessType = accessType ? 'both' : 'residence';
        }
      }

      if (!hasAccess) {
        return res.status(403).json({
          _error: 'Forbidden',
          message: 'You do not have access to this building',
        });
      }

      // Get building details
      const buildingData = await db
        .select({
          id: buildings.id,
          name: buildings.name,
          address: buildings.address,
          city: buildings.city,
          province: buildings.province,
          postalCode: buildings.postalCode,
          buildingType: buildings.buildingType,
          yearBuilt: buildings.yearBuilt,
          totalUnits: buildings.totalUnits,
          totalFloors: buildings.totalFloors,
          parkingSpaces: buildings.parkingSpaces,
          storageSpaces: buildings.storageSpaces,
          amenities: buildings.amenities,
          managementCompany: buildings.managementCompany,
          organizationId: buildings.organizationId,
          isActive: buildings.isActive,
          createdAt: buildings.createdAt,
          updatedAt: buildings.updatedAt,
          organizationName: organizations.name,
          organizationType: organizations.type,
          organizationAddress: organizations.address,
          organizationCity: organizations.city,
          organizationPhone: organizations.phone,
          organizationEmail: organizations.email,
        })
        .from(buildings)
        .innerJoin(organizations, eq(buildings.organizationId, organizations.id))
        .where(eq(buildings.id, buildingId));

      if (buildingData.length === 0) {
        return res.status(404).json({
          _error: 'Not found',
          message: 'Building not found',
        });
      }

      const building = buildingData[0];

      // Get all residences for this building
      const buildingResidences = await db
        .select({
          id: residences.id,
          unitNumber: residences.unitNumber,
          floor: residences.floor,
          squareFootage: residences.squareFootage,
          bedrooms: residences.bedrooms,
          bathrooms: residences.bathrooms,
          balcony: residences.balcony,
          parkingSpaceNumbers: residences.parkingSpaceNumbers,
          storageSpaceNumbers: residences.storageSpaceNumbers,
          monthlyFees: residences.monthlyFees,
          isActive: residences.isActive,
        })
        .from(residences)
        .where(and(eq(residences.buildingId, buildingId), eq(residences.isActive, true)));

      // Get user's residences in this building if any
      let userResidencesInBuilding: unknown[] = [];
      const userResidenceRecords = await db
        .select({
          residenceId: userResidences.residenceId,
          relationshipType: userResidences.relationshipType,
          startDate: userResidences.startDate,
          endDate: userResidences.endDate,
        })
        .from(userResidences)
        .innerJoin(residences, eq(userResidences.residenceId, residences.id))
        .where(
          and(
            eq(userResidences.userId, currentUser.id),
            eq(residences.buildingId, buildingId),
            eq(userResidences.isActive, true)
          )
        );

      if (userResidenceRecords.length > 0) {
        userResidencesInBuilding = userResidenceRecords.map((ur) => {
          const residence = buildingResidences.find((r) => r.id === ur.residenceId);
          return {
            ...residence,
            relationshipType: ur.relationshipType,
            startDate: ur.startDate,
            endDate: ur.endDate,
          };
        });
      }

      // Calculate statistics
      const occupiedUnits = buildingResidences.length;
      const occupancyRate =
        building.totalUnits > 0 ? Math.round((occupiedUnits / building.totalUnits) * 100) : 0;

      res.json({
        ...building,
        accessType,
        statistics: {
          totalUnits: building.totalUnits,
          occupiedUnits,
          occupancyRate,
          vacantUnits: building.totalUnits - occupiedUnits,
          totalResidences: buildingResidences.length,
        },
        userResidences: userResidencesInBuilding,
        // Only include full residence list for managers/admins
        residences:
          currentUser.role === 'admin' || currentUser.role === 'manager'
            ? buildingResidences
            : undefined,
      });
      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to fetch building details',
      });
    }
  });

  /**
   * POST /api/admin/buildings - Create a new building (Admin only).
   */
  app.post('/api/admin/buildings', requireAuth, async (req: any, res) => {
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

      const buildingData = req.body;

      // Validate required fields
      if (!buildingData.name || !buildingData.organizationId) {
        return res.status(400).json({
          _error: 'Validation error',
          message: 'Building name and organization are required',
        });
      }

      // Create building with ID
      const buildingId = crypto.randomUUID();

      const newBuilding = await db
        .insert(buildings)
        .values({
          id: buildingId,
          name: buildingData.name,
          address: buildingData.address || '',
          city: buildingData.city || '',
          province: buildingData.province || 'QC',
          postalCode: buildingData.postalCode || '',
          buildingType: buildingData.buildingType || 'condo',
          yearBuilt: buildingData.yearBuilt,
          totalUnits: buildingData.totalUnits || 0,
          totalFloors: buildingData.totalFloors,
          parkingSpaces: buildingData.parkingSpaces,
          storageSpaces: buildingData.storageSpaces,
          amenities: buildingData.amenities ? JSON.stringify(buildingData.amenities) : null,
          managementCompany: buildingData.managementCompany,
          organizationId: buildingData.organizationId,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();


      // Building storage hierarchy will be created automatically when documents are uploaded
      console.log('Building created - storage hierarchy will be created on first document upload');

      // Auto-generate residences if totalUnits is specified and <= 300
      if (
        buildingData.totalUnits &&
        buildingData.totalUnits > 0 &&
        buildingData.totalUnits <= 300
      ) {
        try {
          const totalUnits = buildingData.totalUnits;
          const totalFloors = buildingData.totalFloors || 1;
          const unitsPerFloor = Math.ceil(totalUnits / totalFloors);

          const residencesToCreate = [];
          for (let unit = 1; unit <= totalUnits; unit++) {
            const floor = Math.ceil(unit / unitsPerFloor);
            const unitOnFloor = ((unit - 1) % unitsPerFloor) + 1;
            const unitNumber = `${floor}${unitOnFloor.toString().padStart(2, '0')}`;

            residencesToCreate.push({
              buildingId: buildingId,
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

            `✅ Auto-generated ${createdResidences.length} residences for building ${buildingId}`
          );

          // Create object storage hierarchy for each residence
          for (const residence of createdResidences) {
            await objectStorageService.createResidenceHierarchy(
              buildingData.organizationId,
              buildingId,
              residence.id
            );
          }
        } catch (___residenceError) {
          console.error('⚠️ Error auto-generating residences:', ___residenceError);
          // Don't fail the building creation if residence generation fails
        }
      }

      res.status(201).json({
        message: 'Building created successfully',
        building: newBuilding[0],
      });
      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to create building',
      });
    }
  });

  /**
   * PUT /api/admin/buildings/:id - Update a building (Admin and Manager).
   */
  app.put('/api/admin/buildings/:id', requireAuth, async (req: any, res) => {
    try {
      // Check if user is admin or manager
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
        return res.status(403).json({
          message: 'Admin or Manager access required',
          code: 'ADMIN_MANAGER_REQUIRED',
        });
      }

      const buildingId = req.params.id;
      const buildingData = req.body;

      // Validate required fields
      if (!buildingData.name || !buildingData.organizationId) {
        return res.status(400).json({
          _error: 'Validation error',
          message: 'Building name and organization are required',
        });
      }

      // Check if building exists
      const existingBuilding = await db
        .select()
        .from(buildings)
        .where(eq(buildings.id, buildingId))
        .limit(1);

      if (existingBuilding.length === 0) {
        return res.status(404).json({
          _error: 'Not found',
          message: 'Building not found',
        });
      }

      // Check current number of active residences
      const currentResidences = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(residences)
        .where(and(eq(residences.buildingId, buildingId), eq(residences.isActive, true)));

      const currentResidenceCount = currentResidences[0]?.count || 0;
      const newTotalUnits = buildingData.totalUnits || 0;
      const previousTotalUnits = existingBuilding[0].totalUnits || 0;

        `🔄 Building ${buildingId}: ${previousTotalUnits} → ${newTotalUnits} units (currently has ${currentResidenceCount} active residences)`
      );

      // Update building
      const updatedBuilding = await db
        .update(buildings)
        .set({
          name: buildingData.name,
          address: buildingData.address || '',
          city: buildingData.city || '',
          province: buildingData.province || 'QC',
          postalCode: buildingData.postalCode || '',
          buildingType: buildingData.buildingType || 'condo',
          yearBuilt: buildingData.yearBuilt,
          totalUnits: newTotalUnits,
          totalFloors: buildingData.totalFloors,
          parkingSpaces: buildingData.parkingSpaces,
          storageSpaces: buildingData.storageSpaces,
          amenities: buildingData.amenities ? JSON.stringify(buildingData.amenities) : null,
          managementCompany: buildingData.managementCompany,
          organizationId: buildingData.organizationId,
          updatedAt: new Date(),
        })
        .where(eq(buildings.id, buildingId))
        .returning();

      // Handle residence creation/deletion based on totalUnits change
      await handleResidenceChanges(
        buildingId,
        buildingData.organizationId,
        newTotalUnits,
        currentResidenceCount,
        buildingData.totalFloors
      );


      res.json({
        message: 'Building updated successfully',
        building: updatedBuilding[0],
      });
      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to update building',
      });
    }
  });

  /**
   * DELETE /api/admin/buildings/:id - Delete a building (Admin only).
   */
  app.delete('/api/admin/buildings/:id', requireAuth, async (req: any, res) => {
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

      const buildingId = req.params.id;

      // Check if building exists
      const existingBuilding = await db
        .select()
        .from(buildings)
        .where(eq(buildings.id, buildingId))
        .limit(1);

      if (existingBuilding.length === 0) {
        return res.status(404).json({
          _error: 'Not found',
          message: 'Building not found',
        });
      }

      // Soft delete by setting isActive to false
      await db
        .update(buildings)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(buildings.id, buildingId));


      // Object storage cleanup will be handled automatically
      console.log('Building deleted - storage cleanup will be handled automatically');

      res.json({
        message: 'Building deleted successfully',
      });
      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to delete building',
      });
    }
  });

  /**
   * GET /api/admin/buildings/:id/deletion-impact - Get deletion impact analysis
   * Shows what will be deleted when removing a building.
   */
  app.get('/api/admin/buildings/:id/deletion-impact', requireAuth, async (req: any, res) => {
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

      const buildingId = req.params.id;

      // Check if building exists
      const building = await db
        .select({ id: buildings.id, name: buildings.name })
        .from(buildings)
        .where(and(eq(buildings.id, buildingId), eq(buildings.isActive, true)))
        .limit(1);

      if (building.length === 0) {
        return res.status(404).json({
          _error: 'Not found',
          message: 'Building not found',
        });
      }

      // Count residences in this building
      const residencesCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(residences)
        .where(and(eq(residences.buildingId, buildingId), eq(residences.isActive, true)));

      // Count documents associated with this building or its residences
      const documentsCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(documents)
        .where(
          or(
            eq(documents.buildings, buildingId),
            sql`${documents.residence} IN (SELECT id FROM residences WHERE building_id = ${buildingId})`
          )
        );

      // Count users who will become orphaned (only have relationships with residences in this building)
      const potentialOrphansCount = await db
        .select({ count: sql<number>`count(distinct ${userResidences.userId})` })
        .from(userResidences)
        .innerJoin(residences, eq(userResidences.residenceId, residences.id))
        .innerJoin(users, eq(userResidences.userId, users.id))
        .where(
          and(
            eq(residences.buildingId, buildingId),
            eq(residences.isActive, true),
            eq(userResidences.isActive, true),
            eq(users.isActive, true)
          )
        );

      const impact = {
        building: building[0],
        residences: residencesCount[0]?.count || 0,
        documents: documentsCount[0]?.count || 0,
        potentialOrphanedUsers: potentialOrphansCount[0]?.count || 0,
      };

      res.json(impact);
      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to analyze deletion impact',
      });
    }
  });

  /**
   * DELETE /api/admin/buildings/:id/cascade - Cascade delete a building
   * Replaces the simple delete with cascading delete that removes residences, documents, and orphaned users.
   */
  app.delete('/api/admin/buildings/:id/cascade', requireAuth, async (req: any, res) => {
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

      const buildingId = req.params.id;

      // Check if building exists
      const building = await db
        .select({ id: buildings.id, name: buildings.name })
        .from(buildings)
        .where(and(eq(buildings.id, buildingId), eq(buildings.isActive, true)))
        .limit(1);

      if (building.length === 0) {
        return res.status(404).json({
          _error: 'Not found',
          message: 'Building not found',
        });
      }

      // Start transaction for cascading delete
      await db.transaction(async (tx) => {
        // 1. Get all residences in this building
        const buildingResidences = await tx
          .select({ id: residences.id })
          .from(residences)
          .where(and(eq(residences.buildingId, buildingId), eq(residences.isActive, true)));

        const residenceIds = buildingResidences.map((r) => r.id);

        if (residenceIds.length > 0) {
          // 2. Delete documents associated with building or its residences
          await tx
            .delete(documents)
            .where(
              or(eq(documents.buildings, buildingId), inArray(documents.residence, residenceIds))
            );

          // 3. Soft delete user-residence relationships
          await tx
            .update(userResidences)
            .set({ isActive: false, updatedAt: new Date() })
            .where(inArray(userResidences.residenceId, residenceIds));

          // 4. Find and soft delete orphaned users (users who now have no active relationships)
          const orphanedUsers = await tx
            .select({ id: users.id })
            .from(users)
            .leftJoin(
              userOrganizations,
              and(eq(users.id, userOrganizations.userId), eq(userOrganizations.isActive, true))
            )
            .leftJoin(
              userResidences,
              and(eq(users.id, userResidences.userId), eq(userResidences.isActive, true))
            )
            .where(
              and(
                eq(users.isActive, true),
                isNull(userOrganizations.userId),
                isNull(userResidences.userId)
              )
            );

          if (orphanedUsers.length > 0) {
            const orphanedUserIds = orphanedUsers.map((u) => u.id);
            await tx
              .update(users)
              .set({ isActive: false, updatedAt: new Date() })
              .where(inArray(users.id, orphanedUserIds));
          }

          // 5. Soft delete residences
          await tx
            .update(residences)
            .set({ isActive: false, updatedAt: new Date() })
            .where(inArray(residences.id, residenceIds));
        } else {
          // Still delete documents associated directly with the building
          await tx.delete(documents).where(eq(documents.buildings, buildingId));
        }

        // 6. Finally, soft delete the building
        await tx
          .update(buildings)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(buildings.id, buildingId));
      });


      // Clean up object storage hierarchy for the deleted building
      // Get organization ID from building before deletion
      const buildingOrg = await db
        .select({ organizationId: buildings.organizationId })
        .from(buildings)
        .where(eq(buildings.id, buildingId))
        .limit(1);

      if (buildingOrg.length > 0) {
        // Object storage cleanup will be handled automatically
        console.log('Building deleted - storage cleanup will be handled automatically');
      }

      res.json({
        message: 'Building and related entities deleted successfully',
        deletedBuilding: building[0].name,
      });
      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to delete building and related entities',
      });
    }
  });
}
