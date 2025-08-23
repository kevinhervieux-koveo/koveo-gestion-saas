import type { Express } from 'express';
import { storage } from '../storage';
import { insertUserSchema, type User, type InsertUser } from '@shared/schema';
import { z } from 'zod';
import { requireAuth } from '../auth';
import { permissions, getRolePermissions } from '../../config';
import { db } from '../db';
import * as schema from '../../shared/schema';
import { eq, and, inArray } from 'drizzle-orm';

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
   * GET /api/users - Retrieves users based on current user's role and organizations.
   */
  app.get('/api/users', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      console.warn(`📊 Fetching users for user ${currentUser.id} with role ${currentUser.role}`);
      
      let users;
      
      if (currentUser.role === 'admin') {
        // Admin can see all users
        users = await storage.getUsers();
      } else {
        // Managers and other users can only see users from their organizations
        users = await storage.getUsersByOrganizations(currentUser.id);
      }
      
      console.warn(`✅ Found ${users.length} users for user ${currentUser.id}`);
      res.json(users);
    } catch (error) {
      console.error('Failed to fetch users:', error);
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
    } catch (error) {
      console.error('Failed to fetch user:', error);
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
    } catch (error) {
      console.error('Failed to fetch user by email:', error);
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
      const validatedData = insertUserSchema.parse(req.body);

      // Check if user with email already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(409).json({
          _error: 'Conflict',
          message: 'User with this email already exists',
        });
      }

      const user = await storage.createUser(validatedData);

      // Remove sensitive information before sending response
      const { password, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Invalid user data',
          details: error.issues,
        });
      }

      console.error('Failed to create user:', error);
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
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Invalid user data',
          details: error.issues,
        });
      }

      console.error('Failed to update user:', error);
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
    } catch (error) {
      console.error('Failed to deactivate user:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to deactivate user',
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

      // Validate the role exists in permissions
      if (!permissions[userRole as keyof typeof permissions]) {
        return res.status(400).json({
          _error: 'Bad request', 
          message: 'Invalid user role',
        });
      }

      // Get permissions for the user's role
      const userPermissions = getRolePermissions(permissions as any, userRole as any);
      
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
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to validate permissions response',
          details: error.issues,
        });
      }

      console.error('Failed to fetch user permissions:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch user permissions',
      });
    }
  });

  /**
   * PUT /api/users/:id/organizations - Updates user's organization assignments.
   * Admin: can assign/remove any organization
   * Manager: cannot modify organization assignments
   */
  app.put('/api/users/:id/organizations', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      const { id: userId } = req.params;
      const { organizationIds } = req.body;

      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Only admins can modify organization assignments
      if (currentUser.role !== 'admin') {
        return res.status(403).json({
          message: 'Only administrators can modify organization assignments',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      if (!userId || !Array.isArray(organizationIds)) {
        return res.status(400).json({
          message: 'User ID and organization IDs array are required',
          code: 'INVALID_REQUEST'
        });
      }

      // Verify user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // Remove existing organization assignments
      await db
        .delete(schema.userOrganizations)
        .where(eq(schema.userOrganizations.userId, userId));

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
        organizationIds
      });
    } catch (error) {
      console.error('Failed to update user organizations:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update organization assignments',
      });
    }
  });

  /**
   * PUT /api/users/:id/residences - Updates user's residence assignments.
   * Admin: can assign/remove any residence
   * Manager: can assign/remove residences within their organizations only
   */
  app.put('/api/users/:id/residences', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      const { id: userId } = req.params;
      const { residenceAssignments } = req.body; // Array of { residenceId, relationshipType, startDate, endDate }

      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Only admins and managers can modify residence assignments
      if (!['admin', 'manager'].includes(currentUser.role)) {
        return res.status(403).json({
          message: 'Insufficient permissions to modify residence assignments',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      if (!userId || !Array.isArray(residenceAssignments)) {
        return res.status(400).json({
          message: 'User ID and residence assignments array are required',
          code: 'INVALID_REQUEST'
        });
      }

      // Verify user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({
          message: 'User not found',
          code: 'USER_NOT_FOUND'
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
              code: 'RESIDENCE_NOT_FOUND'
            });
          }

          // Check if manager has access to this building
          // Get buildings accessible to this manager through their organizations
          const managerOrgs = await db
            .select({ organizationId: schema.userOrganizations.organizationId })
            .from(schema.userOrganizations)
            .where(and(
              eq(schema.userOrganizations.userId, currentUser.id),
              eq(schema.userOrganizations.isActive, true)
            ));
          
          const orgIds = managerOrgs.map(org => org.organizationId);
          
          const accessibleBuildings = orgIds.length > 0 ? await db
            .select({ id: schema.buildings.id })
            .from(schema.buildings)
            .where(and(
              inArray(schema.buildings.organizationId, orgIds),
              eq(schema.buildings.isActive, true)
            )) : [];
          
          const hasAccess = accessibleBuildings.some(b => b.id === residence[0].buildingId);
          if (!hasAccess) {
            return res.status(403).json({
              message: `Insufficient permissions for residence ${assignment.residenceId}`,
              code: 'INSUFFICIENT_PERMISSIONS'
            });
          }
        }
      }

      // Remove existing residence assignments
      await db
        .delete(schema.userResidences)
        .where(eq(schema.userResidences.userId, userId));

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
        assignmentCount: residenceAssignments.length
      });
    } catch (error) {
      console.error('Failed to update user residences:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update residence assignments',
      });
    }
  });
}
