import type { Express } from 'express';
import { storage } from '../storage';
import { insertUserSchema, type User, type InsertUser } from '@shared/schema';
import { z } from 'zod';
import { requireAuth } from '../auth';
import { createHash, randomBytes } from 'crypto';
// Database-based permissions - no config imports needed
import { db } from '../db';
import * as schema from '../../shared/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import {
  sanitizeString,
  sanitizeName,
  normalizeEmail,
  validatePasswordStrength,
  generateUsernameFromEmail,
} from '../utils/input-sanitization';
import { logUserCreation } from '../utils/user-creation-logger';
import { queryCache } from '../query-cache';

/**
 * Registers all user-related API endpoints.
 *
 * @param app - Express application instance.
 */
/**
 * RegisterUserRoutes function.
 * @param app
 * @returns Function result.
 */
export function registerUserRoutes(app: Express): void {
  /**
   * GET /api/users - Retrieves users with their assignments based on current user's role and organizations.
   */
  app.get('/api/users', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }


      // Get users with their full assignment data
      const usersWithAssignments = await storage.getUsersWithAssignments();

      

      // Filter users based on current user's role and permissions
      let filteredUsers;
      if (currentUser.role === 'admin') {
        // Admin can see all users
        filteredUsers = usersWithAssignments;
      } else {
        // Managers and other users can only see users from their organizations
        // Get the organization IDs that the current user has access to
        const userOrgIds = (await storage.getUserOrganizations(currentUser.id)).map(org => org.organizationId);
        
        
        // Filter users to only include those from accessible organizations
        filteredUsers = usersWithAssignments.filter(user => {
          const hasAccess = user.organizations?.some(org => userOrgIds.includes(org.id)) || false;
          return hasAccess;
        });
      }


      res.json(filteredUsers);
    } catch (error: any) {
      console.error('❌ Error fetching users:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch users',
      });
    }
  });


  /**
   * GET /api/users/:id - Retrieves a specific user by ID.
   */
  app.get('/api/users/:id', async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          _error: 'Bad request',
          message: 'User ID is required',
        });
      }

      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({
          _error: 'Not found',
          message: 'User not found',
        });
      }

      // Remove sensitive information before sending response
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      console.error('❌ Error fetching user:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch user',
      });
    }
  });

  /**
   * GET /api/users/email/:email - Retrieves a user by email address.
   */
  app.get('/api/users/email/:email', async (req, res) => {
    try {
      const { email } = req.params;

      if (!email) {
        return res.status(400).json({
          _error: 'Bad request',
          message: 'Email is required',
        });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({
          _error: 'Not found',
          message: 'User not found',
        });
      }

      // Remove sensitive information before sending response
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      console.error('❌ Error fetching user by email:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch user',
      });
    }
  });

  /**
   * POST /api/users - Creates a new user.
   */
  app.post('/api/users', async (req, res) => {
    try {
      // Enhanced password validation using utility
      if (req.body.password) {
        const passwordValidation = validatePasswordStrength(req.body.password);
        if (!passwordValidation.isValid) {
          return res.status(400).json({
            error: 'Validation error',
            message: passwordValidation.message,
            code: 'WEAK_PASSWORD',
          });
        }
      }

      // Sanitize and normalize all input data
      const normalizedData = {
        ...req.body,
        email: normalizeEmail(req.body.email || ''),
        firstName: sanitizeName(req.body.firstName || ''),
        lastName: sanitizeName(req.body.lastName || ''),
        phone: req.body.phone ? sanitizeString(req.body.phone) : '',
        language: req.body.language || 'fr',
      };

      // Generate unique username if not provided
      if (!normalizedData.username && normalizedData.email) {
        const baseUsername = generateUsernameFromEmail(normalizedData.email);
        let username = baseUsername;

        // Ensure username uniqueness
        let usernameCounter = 1;
        let existingUsername = await db
          .select({ username: schema.users.username })
          .from(schema.users)
          .where(eq(schema.users.username, username))
          .limit(1);

        while (existingUsername.length > 0) {
          username = `${baseUsername}${usernameCounter}`;
          usernameCounter++;
          existingUsername = await db
            .select({ username: schema.users.username })
            .from(schema.users)
            .where(eq(schema.users.username, username))
            .limit(1);
        }

        normalizedData.username = username;
      }

      const validatedData = insertUserSchema.parse(normalizedData);

      // Check if user with email already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(409).json({
          _error: 'Conflict',
          message: 'User with this email already exists',
        });
      }

      const user = await storage.createUser(validatedData);

      // Log successful user creation
      logUserCreation({
        userId: user.id,
        email: user.email,
        role: user.role,
        method: 'direct',
        success: true,
        timestamp: new Date(),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      // Remove sensitive information before sending response
      const { password, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error: any) {
      // Log failed user creation attempt
      logUserCreation({
        email: req.body.email || 'unknown',
        role: req.body.role || 'unknown',
        method: 'direct',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Invalid user data',
          details: error.issues,
        });
      }

      console.error('❌ Error creating user:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to create user',
      });
    }
  });

  /**
   * PUT /api/users/:id - Updates an existing user.
   */
  app.put('/api/users/:id', async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          _error: 'Bad request',
          message: 'User ID is required',
        });
      }

      // Validate the update data (excluding password updates for security)
      const updateSchema = insertUserSchema.partial().omit({ password: true });
      const validatedData = updateSchema.parse(req.body);

      const user = await storage.updateUser(id, {
        ...validatedData,
        updatedAt: new Date(),
      } as any);

      if (!user) {
        return res.status(404).json({
          _error: 'Not found',
          message: 'User not found',
        });
      }

      // Remove sensitive information before sending response
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Invalid user data',
          details: error.issues,
        });
      }

      console.error('❌ Error updating user:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update user',
      });
    }
  });

  /**
   * DELETE /api/users/:id - Deactivates a user (soft delete).
   */
  app.delete('/api/users/:id', async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          _error: 'Bad request',
          message: 'User ID is required',
        });
      }

      // Soft delete by setting isActive to false
      const user = await storage.updateUser(id, {
        isActive: false,
        updatedAt: new Date(),
      });

      if (!user) {
        return res.status(404).json({
          _error: 'Not found',
          message: 'User not found',
        });
      }

      res.json({
        message: 'User deactivated successfully',
        id: user.id,
      });
    } catch (error: any) {
      console.error('❌ Error deactivating user:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to deactivate user',
      });
    }
  });

  /**
   * GET /api/user-organizations - Get current user's organizations.
   */
  app.get('/api/user-organizations', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      const organizations = await storage.getUserOrganizations(currentUser.id);
      res.json(organizations);
    } catch (error: any) {
      console.error('❌ Error getting user organizations:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to get user organizations',
      });
    }
  });

  /**
   * GET /api/user-residences - Get current user's residences.
   */
  app.get('/api/user-residences', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      const residences = await storage.getUserResidences(currentUser.id);
      res.json(residences);
    } catch (error: any) {
      console.error('❌ Error getting user residences:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to get user residences',
      });
    }
  });

  /**
   * GET /api/admin/all-user-organizations - Get user-organization relationships (admin: all, manager: filtered by their orgs).
   */
  app.get('/api/admin/all-user-organizations', requireAuth, async (req: any, res) => {
    console.log('🔍 [API] all-user-organizations endpoint called by user:', req.user?.email);
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Only admins and managers can access user assignments
      if (!['admin', 'manager'].includes(currentUser.role)) {
        return res.status(403).json({
          message: 'Insufficient permissions to view user assignments',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      let userOrganizations;

      if (currentUser.role === 'admin') {
        // Admin sees all user-organization relationships
        userOrganizations = await db
          .select({
            userId: schema.userOrganizations.userId,
            organizationId: schema.userOrganizations.organizationId,
            organizationRole: schema.userOrganizations.organizationRole,
            isActive: schema.userOrganizations.isActive,
          })
          .from(schema.userOrganizations)
          .where(eq(schema.userOrganizations.isActive, true));
      } else {
        // Manager sees only relationships for their organizations
        const managerOrgs = await db
          .select({ organizationId: schema.userOrganizations.organizationId })
          .from(schema.userOrganizations)
          .where(
            and(
              eq(schema.userOrganizations.userId, currentUser.id),
              eq(schema.userOrganizations.isActive, true)
            )
          );

        const orgIds = managerOrgs.map((org) => org.organizationId);

        if (orgIds.length === 0) {
          return res.json([]);
        }

        userOrganizations = await db
          .select({
            userId: schema.userOrganizations.userId,
            organizationId: schema.userOrganizations.organizationId,
            organizationRole: schema.userOrganizations.organizationRole,
            isActive: schema.userOrganizations.isActive,
          })
          .from(schema.userOrganizations)
          .where(
            and(
              eq(schema.userOrganizations.isActive, true),
              inArray(schema.userOrganizations.organizationId, orgIds)
            )
          );
      }

      res.json(userOrganizations);
    } catch (error: any) {
      console.error('❌ Error getting all user organizations:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to get user organizations',
      });
    }
  });

  /**
   * GET /api/admin/all-user-residences - Get user-residence relationships (admin: all, manager: filtered by their orgs).
   */
  app.get('/api/admin/all-user-residences', requireAuth, async (req: any, res) => {
    console.log('🔍 [API] all-user-residences endpoint called by user:', req.user?.email);
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Only admins and managers can access user assignments
      if (!['admin', 'manager'].includes(currentUser.role)) {
        return res.status(403).json({
          message: 'Insufficient permissions to view user assignments',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      let userResidences;

      if (currentUser.role === 'admin') {
        // Admin sees all user-residence relationships
        userResidences = await db
          .select({
            userId: schema.userResidences.userId,
            residenceId: schema.userResidences.residenceId,
            relationshipType: schema.userResidences.relationshipType,
            startDate: schema.userResidences.startDate,
            endDate: schema.userResidences.endDate,
            isActive: schema.userResidences.isActive,
          })
          .from(schema.userResidences)
          .where(eq(schema.userResidences.isActive, true));
      } else {
        // Manager sees only relationships for residences in their organizations
        const managerOrgs = await db
          .select({ organizationId: schema.userOrganizations.organizationId })
          .from(schema.userOrganizations)
          .where(
            and(
              eq(schema.userOrganizations.userId, currentUser.id),
              eq(schema.userOrganizations.isActive, true)
            )
          );

        const orgIds = managerOrgs.map((org) => org.organizationId);

        if (orgIds.length === 0) {
          return res.json([]);
        }

        // Get residences in manager's organizations
        const accessibleResidences = await db
          .select({ residenceId: schema.residences.id })
          .from(schema.residences)
          .innerJoin(schema.buildings, eq(schema.residences.buildingId, schema.buildings.id))
          .where(
            and(
              inArray(schema.buildings.organizationId, orgIds),
              eq(schema.residences.isActive, true)
            )
          );

        const residenceIds = accessibleResidences.map((res) => res.residenceId);

        if (residenceIds.length === 0) {
          return res.json([]);
        }

        userResidences = await db
          .select({
            userId: schema.userResidences.userId,
            residenceId: schema.userResidences.residenceId,
            relationshipType: schema.userResidences.relationshipType,
            startDate: schema.userResidences.startDate,
            endDate: schema.userResidences.endDate,
            isActive: schema.userResidences.isActive,
          })
          .from(schema.userResidences)
          .where(
            and(
              eq(schema.userResidences.isActive, true),
              inArray(schema.userResidences.residenceId, residenceIds)
            )
          );
      }

      res.json(userResidences);
    } catch (error: any) {
      console.error('❌ Error getting all user residences:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to get user residences',
      });
    }
  });

  /**
   * GET /api/user/permissions - Retrieves the current user's permissions based on their role.
   * Protected endpoint that requires authentication.
   */
  app.get('/api/user/permissions', requireAuth, async (req: any, res) => {
    try {
      // Get user role from session
      const userRole = req.user?.role;

      if (!userRole) {
        return res.status(400).json({
          _error: 'Bad request',
          message: 'User role not found in session',
        });
      }

      // Get permissions for the user's role from database
      const rolePermissions = await storage.getRolePermissions();
      const userPermissions = rolePermissions
        .filter((rp: any) => rp.role === userRole)
        .map((rp: any) => rp.permission?.name)
        .filter(Boolean);

      // Create response with Zod validation
      const responseData = {
        role: userRole,
        permissions: userPermissions,
        permissionCount: userPermissions.length,
      };

      // Validate response with Zod schema
      const permissionsResponseSchema = z.object({
        role: z.enum(['admin', 'manager', 'tenant', 'resident']),
        permissions: z.array(z.string()),
        permissionCount: z.number(),
      });

      const validatedResponse = permissionsResponseSchema.parse(responseData);

      res.json(validatedResponse);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to validate permissions response',
          details: error.issues,
        });
      }

      console.error('❌ Error fetching user permissions:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch user permissions',
      });
    }
  });

  /**
   * PUT /api/users/:id/organizations - Updates user's organization assignments.
   * Admin: can assign/remove any organization
   * Manager: cannot modify organization assignments.
   */
  app.put('/api/users/:id/organizations', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      const { id: userId } = req.params;
      const { organizationIds } = req.body;

      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Only admins can modify organization assignments
      if (currentUser.role !== 'admin') {
        return res.status(403).json({
          message: 'Only administrators can modify organization assignments',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      if (!userId || !Array.isArray(organizationIds)) {
        return res.status(400).json({
          message: 'User ID and organization IDs array are required',
          code: 'INVALID_REQUEST',
        });
      }

      // Verify user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      // Remove existing organization assignments
      await db.delete(schema.userOrganizations).where(eq(schema.userOrganizations.userId, userId));

      // Add new organization assignments
      if (organizationIds.length > 0) {
        const newAssignments = organizationIds.map((orgId: string) => ({
          userId,
          organizationId: orgId,
          organizationRole: user.role,
          isActive: true,
        }));

        await db.insert(schema.userOrganizations).values(newAssignments);
      }

      res.json({
        message: 'Organization assignments updated successfully',
        userId,
        organizationIds,
      });
    } catch (error: any) {
      console.error('❌ Error updating organization assignments:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update organization assignments',
      });
    }
  });

  /**
   * GET /api/users/:id/residences - Get user's accessible residences.
   */
  app.get('/api/users/:id/residences', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      const { id: userId } = req.params;

      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Users can only access their own residences unless they're admin/manager
      if (currentUser.id !== userId && !['admin', 'manager'].includes(currentUser.role)) {
        return res.status(403).json({
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      const residences = await storage.getUserResidences(userId);
      res.json(residences);
    } catch (error: any) {
      console.error('❌ Error getting user residences:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to get user residences',
      });
    }
  });

  /**
   * GET /api/users/:id/buildings - Get user's accessible buildings based on their residences.
   */
  app.get('/api/users/:id/buildings', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      const { id: userId } = req.params;

      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Users can only access their own buildings unless they're admin/manager
      if (currentUser.id !== userId && !['admin', 'manager'].includes(currentUser.role)) {
        return res.status(403).json({
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      // Get user's residences with building information
      const userResidences = await db
        .select({
          residenceId: schema.userResidences.residenceId,
          buildingId: schema.residences.buildingId,
        })
        .from(schema.userResidences)
        .innerJoin(schema.residences, eq(schema.userResidences.residenceId, schema.residences.id))
        .where(and(
          eq(schema.userResidences.userId, userId),
          eq(schema.userResidences.isActive, true),
          eq(schema.residences.isActive, true)
        ));
      
      if (!userResidences || userResidences.length === 0) {
        return res.json({ buildings: [] });
      }

      // Get unique building IDs from user's residences
      const buildingIds = [...new Set(userResidences.map(ur => ur.buildingId).filter(Boolean))];
      
      if (buildingIds.length === 0) {
        return res.json({ buildings: [] });
      }

      // Fetch building details with stats using the existing logic from /api/manager/buildings
      const buildingDetails = await db
        .select({
          id: schema.buildings.id,
          name: schema.buildings.name,
          address: schema.buildings.address,
          city: schema.buildings.city,
          province: schema.buildings.province,
          postalCode: schema.buildings.postalCode,
          buildingType: schema.buildings.buildingType,
          yearBuilt: schema.buildings.yearBuilt,
          totalFloors: schema.buildings.totalFloors,
          parkingSpaces: schema.buildings.parkingSpaces,
          storageSpaces: schema.buildings.storageSpaces,
          managementCompany: schema.buildings.managementCompany,
          amenities: schema.buildings.amenities,
          organizationId: schema.buildings.organizationId,
          organizationName: schema.organizations.name,
          organizationType: schema.organizations.type,
        })
        .from(schema.buildings)
        .leftJoin(schema.organizations, eq(schema.buildings.organizationId, schema.organizations.id))
        .where(and(
          inArray(schema.buildings.id, buildingIds),
          eq(schema.buildings.isActive, true)
        ));

      // Calculate stats for each building
      const buildingsWithStats = await Promise.all(
        buildingDetails.map(async (building) => {
          const [totalUnits, occupiedUnits] = await Promise.all([
            db
              .select({ count: sql<number>`count(*)` })
              .from(schema.residences)
              .where(and(eq(schema.residences.buildingId, building.id), eq(schema.residences.isActive, true)))
              .then(result => result[0]?.count || 0),
            
            db
              .select({ count: sql<number>`count(distinct ${schema.residences.id})` })
              .from(schema.residences)
              .leftJoin(schema.userResidences, eq(schema.userResidences.residenceId, schema.residences.id))
              .where(and(
                eq(schema.residences.buildingId, building.id),
                eq(schema.residences.isActive, true),
                eq(schema.userResidences.isActive, true)
              ))
              .then(result => result[0]?.count || 0),
          ]);

          const vacantUnits = totalUnits - occupiedUnits;
          const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

          return {
            ...building,
            totalUnits,
            occupiedUnits,
            vacantUnits,
            occupancyRate,
          };
        })
      );

      res.json({ buildings: buildingsWithStats });
    } catch (error: any) {
      console.error('❌ Error getting user buildings:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to get user buildings',
      });
    }
  });

  /**
   * PUT /api/users/:id/residences - Updates user's residence assignments.
   * Admin: can assign/remove any residence
   * Manager: can assign/remove residences within their organizations only.
   */
  app.put('/api/users/:id/residences', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      const { id: userId } = req.params;
      const { residenceAssignments } = req.body; // Array of { residenceId, relationshipType, startDate, endDate }

      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Only admins and managers can modify residence assignments
      if (!['admin', 'manager'].includes(currentUser.role)) {
        return res.status(403).json({
          message: 'Insufficient permissions to modify residence assignments',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      if (!userId || !Array.isArray(residenceAssignments)) {
        return res.status(400).json({
          message: 'User ID and residence assignments array are required',
          code: 'INVALID_REQUEST',
        });
      }

      // Verify user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      // For managers, verify they can access all requested residences
      if (currentUser.role === 'manager') {
        for (const assignment of residenceAssignments) {
          // Get the building for this residence
          const residence = await db
            .select({ buildingId: schema.residences.buildingId })
            .from(schema.residences)
            .where(eq(schema.residences.id, assignment.residenceId))
            .limit(1);

          if (residence.length === 0) {
            return res.status(404).json({
              message: `Residence ${assignment.residenceId} not found`,
              code: 'RESIDENCE_NOT_FOUND',
            });
          }

          // Check if manager has access to this building
          // Get buildings accessible to this manager through their organizations
          const managerOrgs = await db
            .select({ organizationId: schema.userOrganizations.organizationId })
            .from(schema.userOrganizations)
            .where(
              and(
                eq(schema.userOrganizations.userId, currentUser.id),
                eq(schema.userOrganizations.isActive, true)
              )
            );

          const orgIds = managerOrgs.map((org) => org.organizationId);

          const accessibleBuildings =
            orgIds.length > 0
              ? await db
                  .select({ id: schema.buildings.id })
                  .from(schema.buildings)
                  .where(
                    and(
                      inArray(schema.buildings.organizationId, orgIds),
                      eq(schema.buildings.isActive, true)
                    )
                  )
              : [];

          const hasAccess = accessibleBuildings.some((b) => b.id === residence[0].buildingId);
          if (!hasAccess) {
            return res.status(403).json({
              message: `Insufficient permissions for residence ${assignment.residenceId}`,
              code: 'INSUFFICIENT_PERMISSIONS',
            });
          }
        }
      }

      // Remove existing residence assignments
      await db.delete(schema.userResidences).where(eq(schema.userResidences.userId, userId));

      // Add new residence assignments
      if (residenceAssignments.length > 0) {
        const newAssignments = residenceAssignments.map((assignment: any) => ({
          userId,
          residenceId: assignment.residenceId,
          relationshipType: assignment.relationshipType || 'tenant',
          startDate: assignment.startDate || new Date().toISOString().split('T')[0],
          endDate: assignment.endDate || null,
          isActive: true,
        }));

        await db.insert(schema.userResidences).values(newAssignments);
      }

      res.json({
        message: 'Residence assignments updated successfully',
        userId,
        assignmentCount: residenceAssignments.length,
      });
    } catch (error: any) {
      console.error('❌ Error updating residence assignments:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update residence assignments',
      });
    }
  });

  /**
   * GET /api/users/me/organizations - Get organizations accessible to current user.
   * Used by invite form to populate organization dropdown.
   */
  app.get('/api/users/me/organizations', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      console.log(`📊 Fetching user-accessible organizations for ${currentUser.email} (${currentUser.role})`);

      // Get organizations based on user role - same logic as /api/organizations
      let organizationsQuery;

      if (currentUser.role === 'admin') {
        // Admin can see all organizations
        organizationsQuery = db
          .select({
            id: schema.organizations.id,
            name: schema.organizations.name,
            type: schema.organizations.type,
            address: schema.organizations.address,
            city: schema.organizations.city,
            province: schema.organizations.province,
            postalCode: schema.organizations.postalCode,
            phone: schema.organizations.phone,
            email: schema.organizations.email,
            website: schema.organizations.website,
            registrationNumber: schema.organizations.registrationNumber,
            isActive: schema.organizations.isActive,
            createdAt: schema.organizations.createdAt,
          })
          .from(schema.organizations)
          .where(eq(schema.organizations.isActive, true))
          .orderBy(schema.organizations.name);
      } else {
        // Other users see organizations they have access to through user_organizations
        organizationsQuery = db
          .select({
            id: schema.organizations.id,
            name: schema.organizations.name,
            type: schema.organizations.type,
            address: schema.organizations.address,
            city: schema.organizations.city,
            province: schema.organizations.province,
            postalCode: schema.organizations.postalCode,
            phone: schema.organizations.phone,
            email: schema.organizations.email,
            website: schema.organizations.website,
            registrationNumber: schema.organizations.registrationNumber,
            isActive: schema.organizations.isActive,
            createdAt: schema.organizations.createdAt,
          })
          .from(schema.organizations)
          .innerJoin(schema.userOrganizations, eq(schema.organizations.id, schema.userOrganizations.organizationId))
          .where(
            and(
              eq(schema.organizations.isActive, true),
              eq(schema.userOrganizations.userId, currentUser.id),
              eq(schema.userOrganizations.isActive, true)
            )
          )
          .orderBy(schema.organizations.name);
      }

      const accessibleOrganizations = await organizationsQuery;
      console.log(`✅ Found ${accessibleOrganizations.length} organizations for user ${currentUser.id}`);

      // Return array directly (not wrapped in object) - same format as /api/organizations
      res.json(accessibleOrganizations);
    } catch (error: any) {
      console.error('❌ Error fetching user organizations:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch user organizations',
      });
    }
  });

  /**
   * GET /api/users/me/data-export - Download user data for Law 25 compliance.
   */
  app.get('/api/users/me/data-export', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Get all user data for export
      const userData = await storage.getUser(currentUser.id);
      if (!userData) {
        return res.status(404).json({
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      // Remove sensitive fields
      const { password, ...userDataExport } = userData;

      // Get related data
      const [organizations, residences, bills, documents, notifications, maintenanceRequests] =
        await Promise.all([
          db
            .select()
            .from(schema.userOrganizations)
            .where(eq(schema.userOrganizations.userId, currentUser.id)),
          db
            .select()
            .from(schema.userResidences)
            .where(eq(schema.userResidences.userId, currentUser.id)),
          db
            .select()
            .from(schema.bills)
            .innerJoin(
              schema.userResidences,
              eq(schema.bills.residenceId, schema.userResidences.residenceId)
            )
            .where(eq(schema.userResidences.userId, currentUser.id)),
          db
            .select()
            .from(schema.documents)
            .where(eq(schema.documents.uploadedById, currentUser.id)),
          db
            .select()
            .from(schema.notifications)
            .where(eq(schema.notifications.userId, currentUser.id)),
          db
            .select()
            .from(schema.maintenanceRequests)
            .where(eq(schema.maintenanceRequests.submittedBy, currentUser.id)),
        ]);

      const exportData = {
        personalInformation: userDataExport,
        organizations,
        residences,
        bills: bills.map((b) => b.bills),
        documents: documents,
        notifications,
        maintenanceRequests,
        exportDate: new Date().toISOString(),
        note: 'This export contains all personal data we have on file for you in compliance with Quebec Law 25.',
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="user-data-export-${currentUser.id}-${new Date().toISOString().split('T')[0]}.json"`
      );
      res.json(exportData);
    } catch (error: any) {
      console.error('❌ Error exporting user data:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to export user data',
      });
    }
  });

  /**
   * POST /api/users/me/delete-account - Complete account deletion for Law 25 compliance.
   */
  app.post('/api/users/me/delete-account', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      const { confirmEmail, reason } = req.body;

      // Verify email confirmation
      if (confirmEmail !== currentUser.email) {
        return res.status(400).json({
          message: 'Email confirmation does not match',
          code: 'EMAIL_MISMATCH',
        });
      }

      // Delete all related data in the correct order to handle foreign key constraints
      await Promise.all([
        // Delete user relationships
        db
          .delete(schema.userOrganizations)
          .where(eq(schema.userOrganizations.userId, currentUser.id)),
        db.delete(schema.userResidences).where(eq(schema.userResidences.userId, currentUser.id)),
        db
          .delete(schema.documents)
          .where(eq(schema.documents.uploadedById, currentUser.id)),

        // Delete user-created content
        db.delete(schema.notifications).where(eq(schema.notifications.userId, currentUser.id)),
        db
          .delete(schema.maintenanceRequests)
          .where(eq(schema.maintenanceRequests.submittedBy, currentUser.id)),

        // Delete invitations
        db.delete(schema.invitations).where(eq(schema.invitations.email, currentUser.email)),
      ]);

      // Finally, delete the user account
      await db.delete(schema.users).where(eq(schema.users.id, currentUser.id));

      // Log the deletion for audit purposes
      console.log(
        `User account deleted: ${currentUser.email} (${currentUser.id}). Reason: ${reason || 'Not provided'}`
      );

      // Clear session
      if (req.session) {
        req.session.destroy((err: any) => {
          if (err) {
            console.error('Failed to destroy session after account deletion:', err);
          }
        });
      }

      res.json({
        message:
          'Account successfully deleted. All personal data has been permanently removed from our systems.',
        deletionDate: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('❌ Error deleting account:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete account. Please contact support.',
      });
    }
  });

  /**
   * PUT /api/users/me - Update current user's profile.
   */
  app.put('/api/users/me', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Validate the update data (excluding password updates for security)
      const updateSchema = insertUserSchema
        .partial()
        .omit({ password: true, id: true, role: true });
      const validatedData = updateSchema.parse(req.body);

      const user = await storage.updateUser(currentUser.id, {
        ...validatedData,
        updatedAt: new Date(),
      } as any);

      if (!user) {
        return res.status(404).json({
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      // Remove sensitive information before sending response
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      console.error('❌ Error updating user profile:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update profile',
      });
    }
  });

  /**
   * POST /api/users/:id/delete-account - Admin endpoint to delete any user account.
   */
  app.post('/api/users/:id/delete-account', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      const { id: targetUserId } = req.params;

      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Only admins can delete other users' accounts
      if (currentUser.role !== 'admin') {
        return res.status(403).json({
          message: 'Only administrators can delete user accounts',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      if (!targetUserId) {
        return res.status(400).json({
          message: 'User ID is required',
          code: 'INVALID_REQUEST',
        });
      }

      // Verify target user exists
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(404).json({
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      const { confirmEmail, reason } = req.body;

      // Verify email confirmation
      if (confirmEmail !== targetUser.email) {
        return res.status(400).json({
          message: 'Email confirmation does not match',
          code: 'EMAIL_MISMATCH',
        });
      }

      // Delete all related data in the correct order to handle foreign key constraints
      const deletionPromises = [
        // Delete user relationships
        db
          .delete(schema.userOrganizations)
          .where(eq(schema.userOrganizations.userId, targetUserId)),
        db.delete(schema.userResidences).where(eq(schema.userResidences.userId, targetUserId)),
        db
          .delete(schema.documents)
          .where(eq(schema.documents.uploadedById, targetUserId)),

        // Delete invitations
        db.delete(schema.invitations).where(eq(schema.invitations.email, targetUser.email)),
      ];

      // Try to delete from optional tables that might not exist
      const optionalDeletions = [
        async () => {
          try {
            await db
              .delete(schema.notifications)
              .where(eq(schema.notifications.userId, targetUserId));
          } catch (error: any) {
            if (error.cause?.code === '42P01') {
              console.log('Notifications table not found, skipping...');
            } else {
              throw error;
            }
          }
        },
        async () => {
          try {
            await db
              .delete(schema.maintenanceRequests)
              .where(eq(schema.maintenanceRequests.submittedBy, targetUserId));
          } catch (error: any) {
            if (error.cause?.code === '42P01') {
              console.log('Maintenance requests table not found, skipping...');
            } else {
              throw error;
            }
          }
        },
      ];

      // Execute core deletions first
      await Promise.all(deletionPromises);

      // Execute optional deletions
      await Promise.all(optionalDeletions.map((fn) => fn()));

      // Finally, delete the user account
      await db.delete(schema.users).where(eq(schema.users.id, targetUserId));

      // Clear all caches to ensure the user list updates immediately
      queryCache.invalidate('users', 'all_users');
      queryCache.invalidate('users', `user:${targetUserId}`);
      queryCache.invalidate('users', `user_email:${targetUser.email}`);

      // Log the deletion for audit purposes
      console.log(
        `User account deleted by admin ${currentUser.email} (${currentUser.id}): ${targetUser.email} (${targetUserId}). Reason: ${reason || 'Not provided'}`
      );

      res.json({
        message: 'User account and all associated data have been permanently deleted',
        deletedUserId: targetUserId,
        deletedUserEmail: targetUser.email,
      });
    } catch (error: any) {
      console.error('❌ Error deleting user account:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete user account',
      });
    }
  });

  /**
   * POST /api/users/me/change-password - Change current user's password.
   */
  app.post('/api/users/me/change-password', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          message: 'Current password and new password are required',
          code: 'INVALID_INPUT',
        });
      }

      // Verify current password
      const bcrypt = require('bcryptjs');
      const user = await storage.getUser(currentUser.id);
      if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
        return res.status(400).json({
          message: 'Current password is incorrect',
          code: 'INVALID_PASSWORD',
        });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Update password
      await storage.updateUser(currentUser.id, {
        password: hashedPassword,
        updatedAt: new Date(),
      } as any);

      res.json({
        message: 'Password changed successfully',
      });
    } catch (error: any) {
      console.error('❌ Error changing password:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to change password',
      });
    }
  });

  /**
   * POST /api/users/demo - Creates a demo user directly without invitation
   */
  app.post('/api/users/demo', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Only admins and managers can create demo users
      if (!['admin', 'manager'].includes(currentUser.role)) {
        return res.status(403).json({
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      const { firstName, lastName, role, organizationId, residenceId } = req.body;

      // Validate demo role
      if (!['demo_manager', 'demo_tenant', 'demo_resident'].includes(role)) {
        return res.status(400).json({
          message: 'Invalid demo role',
          code: 'INVALID_ROLE',
        });
      }

      // Validate required fields
      if (!firstName || !lastName || !organizationId) {
        return res.status(400).json({
          message: 'First name, last name, and organization are required',
          code: 'MISSING_REQUIRED_FIELDS',
        });
      }

      // Generate demo email
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@demo.com`;

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          message: 'Demo user with this name already exists',
          code: 'USER_EXISTS',
        });
      }

      // Create demo user with secure random password
      const bcrypt = require('bcryptjs');
      const crypto = require('crypto');
      const randomPassword = crypto.randomBytes(12).toString('base64');
      const hashedPassword = await bcrypt.hash(`Demo${randomPassword}!`, 12);

      const userData = {
        firstName: sanitizeName(firstName),
        lastName: sanitizeName(lastName),
        email: normalizeEmail(email),
        username: generateUsernameFromEmail(email),
        password: hashedPassword,
        language: 'fr', // Default to French for Quebec
        role: role as any,
        isActive: true,
      };

      const newUser = await storage.createUser(userData as InsertUser);

      // Log the user creation
      logUserCreation({
        userId: newUser.id,
        email: newUser.email,
        method: 'direct',
        role,
        success: true,
        timestamp: new Date(),
      });

      // Clear cache
      queryCache.invalidate('users', 'all_users');

      res.status(201).json({
        message: 'Demo user created successfully',
        user: {
          id: newUser.id,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          email: newUser.email,
          role: newUser.role,
        },
      });
    } catch (error: any) {
      console.error('❌ Error creating demo user:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to create demo user',
      });
    }
  });

  /**
   * POST /api/invitations - Creates a new invitation
   */
  app.post('/api/invitations', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Only admins and managers can send invitations
      if (!['admin', 'manager'].includes(currentUser.role)) {
        return res.status(403).json({
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      const {
        organizationId,
        residenceId,
        email,
        role,
        invitedByUserId,
        expiresAt,
        personalMessage,
      } = req.body;

      // Validate required fields
      if (!organizationId || !email || !role || !expiresAt) {
        return res.status(400).json({
          message: 'Organization, email, role, and expiry date are required',
          code: 'MISSING_REQUIRED_FIELDS',
        });
      }

      // Validate role permissions
      if (currentUser.role === 'manager') {
        // Check if manager is trying to invite admin
        if (role === 'admin') {
          return res.status(403).json({
            message: 'Managers cannot invite admin users',
            code: 'ROLE_PERMISSION_DENIED',
          });
        }

        // Get the demo organization to check if it's a demo org
        const targetOrg = await db
          .select()
          .from(schema.organizations)
          .where(eq(schema.organizations.id, organizationId))
          .limit(1);

        if (targetOrg.length > 0 && targetOrg[0].type === 'Demo') {
          // For demo organizations, allow normal roles (resident, tenant, manager)
          if (!['resident', 'tenant', 'manager'].includes(role)) {
            return res.status(403).json({
              message: 'Invalid role for demo organization',
              code: 'INVALID_DEMO_ROLE',
            });
          }
        } else {
          // For regular organizations, managers can invite resident, tenant, manager
          if (!['resident', 'tenant', 'manager'].includes(role)) {
            return res.status(403).json({
              message: 'Managers can only invite resident, tenant, and manager roles',
              code: 'ROLE_PERMISSION_DENIED',
            });
          }
        }
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          message: 'User with this email already exists',
          code: 'USER_EXISTS',
        });
      }

      // Generate secure invitation token
      const token = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(token).digest('hex');

      // Create invitation record
      const invitationData = {
        organizationId,
        residenceId: residenceId || null,
        email,
        token,
        tokenHash,
        role: role as any,
        invitedByUserId: currentUser.id,
        expiresAt: new Date(expiresAt),
        personalMessage: personalMessage || null,
      };

      const [newInvitation] = await db
        .insert(schema.invitations)
        .values(invitationData)
        .returning();

      // Log invitation creation
      console.log('✅ Invitation created:', {
        id: newInvitation.id,
        email,
        role,
        organizationId,
        invitedBy: currentUser.email,
      });

      res.status(201).json({
        message: 'Invitation sent successfully',
        invitationId: newInvitation.id,
      });
    } catch (error: any) {
      console.error('❌ Error creating invitation:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to create invitation',
      });
    }
  });

  /**
   * GET /api/invitations - Gets all invitations (admin/manager only)
   */
  app.get('/api/invitations', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Only admins and managers can view invitations
      if (!['admin', 'manager'].includes(currentUser.role)) {
        return res.status(403).json({
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      let invitations;
      if (currentUser.role === 'admin') {
        // Admin can see all invitations
        invitations = await db
          .select()
          .from(schema.invitations)
          .orderBy(schema.invitations.createdAt);
      } else {
        // Managers can only see invitations they sent
        invitations = await db
          .select()
          .from(schema.invitations)
          .where(eq(schema.invitations.invitedByUserId, currentUser.id))
          .orderBy(schema.invitations.createdAt);
      }

      res.json(invitations);
    } catch (error: any) {
      console.error('❌ Error fetching invitations:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch invitations',
      });
    }
  });

  /**
   * POST /api/invitations/:id/resend - Resends an invitation
   */
  app.post('/api/invitations/:id/resend', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      const { id } = req.params;

      // Get invitation
      const [invitation] = await db
        .select()
        .from(schema.invitations)
        .where(eq(schema.invitations.id, id))
        .limit(1);

      if (!invitation) {
        return res.status(404).json({
          message: 'Invitation not found',
          code: 'INVITATION_NOT_FOUND',
        });
      }

      // Check permissions
      if (currentUser.role !== 'admin' && invitation.invitedByUserId !== currentUser.id) {
        return res.status(403).json({
          message: 'Can only resend your own invitations',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      // Update invitation with new expiry
      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + 7); // Extend by 7 days

      await db
        .update(schema.invitations)
        .set({
          expiresAt: newExpiresAt,
          status: 'pending',
          updatedAt: new Date(),
        })
        .where(eq(schema.invitations.id, id));

      console.log('✅ Invitation resent:', {
        id,
        email: invitation.email,
        newExpiresAt,
      });

      res.json({
        message: 'Invitation resent successfully',
      });
    } catch (error: any) {
      console.error('❌ Error resending invitation:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to resend invitation',
      });
    }
  });
}
