import { Express } from 'express';
import { db } from '../db';
import { 
  buildings, 
  organizations, 
  residences, 
  userResidences,
  userOrganizations,
  users
} from '@shared/schema';
import { eq, and, or, inArray, sql } from 'drizzle-orm';
import { requireAuth } from '../auth';

export function registerBuildingRoutes(app: Express): void {
  /**
   * GET /api/manager/buildings - Retrieves buildings based on user role and associations
   * 
   * Access Control Logic:
   * - Admin: Can see all buildings in their organization + buildings where they have residences
   * - Manager: Can see all buildings in their organization + buildings where they have residences  
   * - Resident/Tenant: Can see only buildings where they have residences (role is not used, only residence links)
   */
  app.get('/api/manager/buildings', async (req: any, res) => {
    console.log('🔍 Session Debug:', {
      hasSession: !!req.session,
      sessionUserId: req.session?.userId,
      sessionUser: req.session?.user ? 'exists' : 'missing',
      hasUser: !!req.user
    });
    
    // Quick authentication check like other routes
    if (!req.session?.userId && !req.session?.user) {
      return res.status(401).json({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
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
          code: 'USER_NOT_FOUND'
        });
      }
      
      console.log(`📊 Fetching buildings for user ${currentUser.id} with role ${currentUser.role}`);

      console.log(`📊 Fetching buildings for user ${currentUser.id} with role ${currentUser.role}`);

      let accessibleBuildings: any[] = [];
      const buildingIds = new Set<string>();

      // Check if user belongs to Koveo organization (special global access)
      const userOrgs = await db
        .select({
          organizationId: userOrganizations.organizationId,
          organizationName: organizations.name,
          canAccessAllOrganizations: userOrganizations.canAccessAllOrganizations
        })
        .from(userOrganizations)
        .innerJoin(organizations, eq(userOrganizations.organizationId, organizations.id))
        .where(
          and(
            eq(userOrganizations.userId, currentUser.id),
            eq(userOrganizations.isActive, true)
          )
        );

      const isKoveoUser = userOrgs.some(org => org.organizationName === 'Koveo');
      
      if (isKoveoUser) {
        console.log(`🌟 Koveo organization user detected - granting access to ALL buildings`);
        
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
            organizationType: organizations.type
          })
          .from(buildings)
          .innerJoin(organizations, eq(buildings.organizationId, organizations.id))
          .where(eq(buildings.isActive, true))
          .orderBy(organizations.name, buildings.name);

        // Add all buildings with special Koveo access type
        allBuildings.forEach(building => {
          if (!buildingIds.has(building.id)) {
            buildingIds.add(building.id);
            accessibleBuildings.push({
              ...building,
              accessType: 'koveo-global' // Special access type for Koveo users
            });
          }
        });
        
      } else {
        // Regular users: For Admin and Manager roles: Get buildings from their organizations only
        if (currentUser.role === 'admin' || currentUser.role === 'manager') {
          if (userOrgs.length > 0) {
            const orgIds = userOrgs.map(uo => uo.organizationId);
            
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
                organizationType: organizations.type
              })
              .from(buildings)
              .innerJoin(organizations, eq(buildings.organizationId, organizations.id))
              .where(
                and(
                  inArray(buildings.organizationId, orgIds),
                  eq(buildings.isActive, true)
                )
              );

            orgBuildings.forEach(building => {
              if (!buildingIds.has(building.id)) {
                buildingIds.add(building.id);
                accessibleBuildings.push({
                  ...building,
                  accessType: 'organization' // Track how user has access
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
          relationshipType: userResidences.relationshipType
        })
        .from(userResidences)
        .where(
          and(
            eq(userResidences.userId, currentUser.id),
            eq(userResidences.isActive, true)
          )
        );

      if (userResidenceRecords.length > 0) {
        const residenceIds = userResidenceRecords.map(ur => ur.residenceId);
        
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
            floor: residences.floor
          })
          .from(residences)
          .innerJoin(buildings, eq(residences.buildingId, buildings.id))
          .innerJoin(organizations, eq(buildings.organizationId, organizations.id))
          .where(
            and(
              inArray(residences.id, residenceIds),
              eq(buildings.isActive, true)
            )
          );

        // Add residence-based buildings (avoid duplicates)
        residenceBuildings.forEach(building => {
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
                floor: building.floor
              }
            });
          } else {
            // Building already exists, but we might want to add residence info
            const existingBuilding = accessibleBuildings.find(b => b.id === building.id);
            if (existingBuilding && !existingBuilding.userResidence) {
              existingBuilding.userResidence = {
                residenceId: building.residenceId,
                unitNumber: building.unitNumber,
                floor: building.floor
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
            .where(
              and(
                eq(residences.buildingId, building.id),
                eq(residences.isActive, true)
              )
            );

          // Calculate occupancy rate
          const occupiedUnits = residenceCount[0]?.count || 0;
          const occupancyRate = building.totalUnits > 0 
            ? Math.round((occupiedUnits / building.totalUnits) * 100) 
            : 0;

          return {
            ...building,
            statistics: {
              totalUnits: building.totalUnits,
              occupiedUnits,
              occupancyRate,
              vacantUnits: building.totalUnits - occupiedUnits
            }
          };
        })
      );

      // Sort buildings by name
      buildingsWithStats.sort((a, b) => a.name.localeCompare(b.name));

      console.log(`✅ Found ${buildingsWithStats.length} accessible buildings for user ${currentUser.id}`);

      res.json({
        buildings: buildingsWithStats,
        meta: {
          total: buildingsWithStats.length,
          userRole: currentUser.role,
          userId: currentUser.id
        }
      });

    } catch (error) {
      console.error('Failed to fetch manager buildings:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch buildings'
      });
    }
  });

  /**
   * GET /api/manager/buildings/:id - Get a specific building with detailed information
   * Uses the same access control logic as the list endpoint
   */
  app.get('/api/manager/buildings/:id', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user;
      const buildingId = req.params.id;
      
      if (!currentUser) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      console.log(`📊 Fetching building ${buildingId} for user ${currentUser.id} with role ${currentUser.role}`);

      let hasAccess = false;
      let accessType = '';

      // Check organization-based access for Admin and Manager
      if (currentUser.role === 'admin' || currentUser.role === 'manager') {
        const userOrgs = await db
          .select({
            organizationId: userOrganizations.organizationId
          })
          .from(userOrganizations)
          .where(
            and(
              eq(userOrganizations.userId, currentUser.id),
              eq(userOrganizations.isActive, true)
            )
          );

        if (userOrgs.length > 0) {
          const orgIds = userOrgs.map(uo => uo.organizationId);
          
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
          error: 'Forbidden',
          message: 'You do not have access to this building'
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
          organizationEmail: organizations.email
        })
        .from(buildings)
        .innerJoin(organizations, eq(buildings.organizationId, organizations.id))
        .where(eq(buildings.id, buildingId));

      if (buildingData.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Building not found'
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
          parkingSpaceNumber: residences.parkingSpaceNumber,
          storageSpaceNumber: residences.storageSpaceNumber,
          monthlyFees: residences.monthlyFees,
          isActive: residences.isActive
        })
        .from(residences)
        .where(
          and(
            eq(residences.buildingId, buildingId),
            eq(residences.isActive, true)
          )
        );

      // Get user's residences in this building if any
      let userResidencesInBuilding: any[] = [];
      const userResidenceRecords = await db
        .select({
          residenceId: userResidences.residenceId,
          relationshipType: userResidences.relationshipType,
          startDate: userResidences.startDate,
          endDate: userResidences.endDate
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
        userResidencesInBuilding = userResidenceRecords.map(ur => {
          const residence = buildingResidences.find(r => r.id === ur.residenceId);
          return {
            ...residence,
            relationshipType: ur.relationshipType,
            startDate: ur.startDate,
            endDate: ur.endDate
          };
        });
      }

      // Calculate statistics
      const occupiedUnits = buildingResidences.length;
      const occupancyRate = building.totalUnits > 0 
        ? Math.round((occupiedUnits / building.totalUnits) * 100) 
        : 0;

      res.json({
        ...building,
        accessType,
        statistics: {
          totalUnits: building.totalUnits,
          occupiedUnits,
          occupancyRate,
          vacantUnits: building.totalUnits - occupiedUnits,
          totalResidences: buildingResidences.length
        },
        userResidences: userResidencesInBuilding,
        // Only include full residence list for managers/admins
        residences: (currentUser.role === 'admin' || currentUser.role === 'manager') ? buildingResidences : undefined
      });

    } catch (error) {
      console.error('Failed to fetch building details:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch building details'
      });
    }
  });
}