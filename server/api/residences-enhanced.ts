import { Express, Request, Response, NextFunction } from 'express';
import { db } from '../db.js';
import { residences, buildings, organizations, userResidences, users, userOrganizations } from '../../shared/schema.js';
import { eq, and, or, ilike, inArray, sql } from 'drizzle-orm';
import { requireAuth } from '../auth/index.js';
import { delayedUpdateService } from '../services/delayed-update-service.js';
import { ApiError, ValidationError, ErrorCodes } from '../types/errors';
import { withErrorHandling } from '../middleware/error-handler';
import { z } from 'zod';

/**
 * Enhanced residences API with comprehensive error handling
 * Provides clear, user-friendly error messages for Quebec property management.
 */

// Validation schemas
const residenceParamsSchema = z.object({
  residenceId: z.string().uuid('ID de résidence invalide')
});

const userUpdateSchema = z.object({
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom de famille est requis'),
  email: z.string().email('Format de courriel invalide'),
  phone: z.string().optional()
});

const residenceQuerySchema = z.object({
  search: z.string().optional(),
  buildingId: z.string().uuid().optional(),
  floor: z.coerce.number().int().min(0).optional()
});

/**
 * Enhanced residence routes with proper error handling.
 * @param app
 */
export function registerEnhancedResidenceRoutes(app: Express) {
  
  // Get user's residences with enhanced error handling
  app.get('/api/user/residences', requireAuth, withErrorHandling(async (req: any, res: Response) => {
    const user = req.user;
    
    if (!user) {
      throw ApiError.unauthorized(ErrorCodes.AUTHENTICATION_REQUIRED);
    }

    try {
      const userResidencesList = await db
        .select({
          residenceId: userResidences.residenceId,
        })
        .from(userResidences)
        .where(and(
          eq(userResidences.userId, user.id),
          eq(userResidences.isActive, true)
        ));

      res.json(userResidencesList);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal(ErrorCodes.DATABASE_QUERY_FAILED, {
        operation: 'fetch_user_residences',
        userId: user.id
      });
    }
  }));

  // Get assigned users for a residence with validation
  app.get('/api/residences/:residenceId/assigned-users', requireAuth, withErrorHandling(async (req: any, res: Response) => {
    const user = req.user;
    
    if (!user) {
      throw ApiError.unauthorized(ErrorCodes.AUTHENTICATION_REQUIRED);
    }

    // Validate parameters
    const { residenceId } = residenceParamsSchema.parse(req.params);

    try {
      // First verify the residence exists and user has access
      const residence = await db.query.residences.findFirst({
        where: eq(residences.id, residenceId),
        with: {
          building: {
            with: {
              organization: true
            }
          }
        }
      });

      if (!residence) {
        throw ApiError.notFound(ErrorCodes.RESIDENCE_NOT_FOUND, {
          residenceId
        });
      }

      // Check user access (simplified - could be enhanced with RBAC)
      if (user.role !== 'admin' && user.role !== 'manager') {
        throw ApiError.forbidden(ErrorCodes.RESIDENCE_ACCESS_DENIED, {
          residenceId,
          userRole: user.role
        });
      }

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
        .where(and(
          eq(userResidences.residenceId, residenceId),
          eq(userResidences.isActive, true)
        ));

      res.json(assignedUsers);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal(ErrorCodes.DATABASE_QUERY_FAILED, {
        operation: 'fetch_assigned_users',
        residenceId
      });
    }
  }));

  // Update assigned user with comprehensive validation
  app.put('/api/residences/:residenceId/assigned-users/:userId', requireAuth, withErrorHandling(async (req: any, res: Response) => {
    const currentUser = req.user;
    
    if (!currentUser) {
      throw ApiError.unauthorized(ErrorCodes.AUTHENTICATION_REQUIRED);
    }

    // Validate parameters
    const { residenceId } = residenceParamsSchema.parse(req.params);
    const { userId } = z.object({ userId: z.string().uuid('ID utilisateur invalide') }).parse(req.params);
    
    // Validate request body
    const updateData = userUpdateSchema.parse(req.body);

    try {
      // Verify user exists
      const existingUser = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });

      if (!existingUser) {
        throw ApiError.notFound(ErrorCodes.USER_NOT_FOUND, {
          userId
        });
      }

      // Check if user has permission to update
      if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
        throw ApiError.forbidden(ErrorCodes.ACCESS_FORBIDDEN, {
          requiredRole: 'admin or manager',
          userRole: currentUser.role
        });
      }

      // Verify the residence exists
      const residence = await db.query.residences.findFirst({
        where: eq(residences.id, residenceId)
      });

      if (!residence) {
        throw ApiError.notFound(ErrorCodes.RESIDENCE_NOT_FOUND, {
          residenceId
        });
      }

      // Check if email is already taken by another user
      if (updateData.email !== existingUser.email) {
        const emailExists = await db.query.users.findFirst({
          where: and(
            eq(users.email, updateData.email),
            sql`${users.id} != ${userId}`
          )
        });

        if (emailExists) {
          throw ApiError.badRequest(ErrorCodes.USER_ALREADY_EXISTS, {
            email: updateData.email,
            conflictingUserId: emailExists.id
          });
        }
      }

      // Update user information
      await db
        .update(users)
        .set({
          firstName: updateData.firstName,
          lastName: updateData.lastName,
          email: updateData.email,
          phone: updateData.phone,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      res.json({ 
        message: 'Utilisateur mis à jour avec succès',
        userId,
        updatedFields: Object.keys(updateData)
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (error instanceof z.ZodError) {
        throw ValidationError.fromZodError(error);
      }
      throw ApiError.internal(ErrorCodes.DATABASE_QUERY_FAILED, {
        operation: 'update_assigned_user',
        userId,
        residenceId
      });
    }
  }));

  // Get all residences with enhanced filtering and error handling
  app.get('/api/residences', requireAuth, withErrorHandling(async (req: any, res: Response) => {
    const user = req.user;
    
    if (!user) {
      throw ApiError.unauthorized(ErrorCodes.AUTHENTICATION_REQUIRED);
    }

    // Validate query parameters
    const queryParams = residenceQuerySchema.parse(req.query);
    const { search, buildingId, floor } = queryParams;

    try {
      // Start with base conditions
      const conditions = [eq(residences.isActive, true)];

      // Apply filters
      if (buildingId) {
        // Verify building exists
        const building = await db.query.buildings.findFirst({
          where: eq(buildings.id, buildingId)
        });
        
        if (!building) {
          throw ApiError.notFound(ErrorCodes.BUILDING_NOT_FOUND, {
            buildingId
          });
        }
        
        conditions.push(eq(residences.buildingId, buildingId));
      }

      if (floor !== undefined) {
        conditions.push(eq(residences.floor, floor));
      }

      // Access control logic (simplified)
      const accessibleBuildingIds = new Set<string>();

      // Check if user belongs to Koveo organization (special global access)
      const userOrgs = await db
        .select({
          organizationId: userOrganizations.organizationId,
        })
        .from(userOrganizations)
        .where(and(
          eq(userOrganizations.userId, user.id),
          eq(userOrganizations.isActive, true)
        ));

      // Handle different user roles and access patterns
      if (user.role === 'admin' || user.canAccessAllOrganizations) {
        // Admin or global access - can see all active residences
        const allBuildings = await db
          .select({ id: buildings.id })
          .from(buildings)
          .where(eq(buildings.isActive, true));
        
        allBuildings.forEach(building => {
          accessibleBuildingIds.add(building.id);
        });
      } else {
        // Regular users - only buildings from their organizations
        if (userOrgs.length === 0) {
          throw ApiError.forbidden(ErrorCodes.ACCESS_FORBIDDEN, {
            reason: 'No organization access',
            userId: user.id
          });
        }

        const orgIds = userOrgs.map(org => org.organizationId);
        const orgBuildings = await db
          .select({ id: buildings.id })
          .from(buildings)
          .where(and(
            inArray(buildings.organizationId, orgIds),
            eq(buildings.isActive, true)
          ));

        orgBuildings.forEach(building => {
          accessibleBuildingIds.add(building.id);
        });
      }

      if (accessibleBuildingIds.size === 0) {
        throw ApiError.forbidden(ErrorCodes.ACCESS_FORBIDDEN, {
          reason: 'No accessible buildings',
          userId: user.id
        });
      }

      // Add building access condition
      conditions.push(inArray(residences.buildingId, Array.from(accessibleBuildingIds)));

      // Build the main query
      const baseQuery = db
        .select({
          id: residences.id,
          unitNumber: residences.unitNumber,
          floor: residences.floor,
          squareFootage: residences.squareFootage,
          // bedroomCount: residences.bedroomCount,
          // bathroomCount: residences.bathroomCount,
          buildingId: residences.buildingId,
          building: {
            id: buildings.id,
            name: buildings.name,
            address: buildings.address,
            city: buildings.city,
          }
        })
        .from(residences)
        .leftJoin(buildings, eq(residences.buildingId, buildings.id))
        .where(and(...conditions));

      let results = await baseQuery;

      // Apply search filter if provided
      if (search) {
        const searchTerm = search.toLowerCase();
        results = results.filter(residence => 
          residence.unitNumber.toLowerCase().includes(searchTerm) ||
          residence.building?.name?.toLowerCase().includes(searchTerm) ||
          residence.building?.address?.toLowerCase().includes(searchTerm)
        );
      }

      res.json({
        residences: results,
        total: results.length,
        filters: {
          search,
          buildingId,
          floor
        }
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (error instanceof z.ZodError) {
        throw ValidationError.fromZodError(error);
      }
      throw ApiError.internal(ErrorCodes.DATABASE_QUERY_FAILED, {
        operation: 'fetch_residences',
        userId: user.id,
        filters: { search, buildingId, floor }
      });
    }
  }));
}