import type { Express } from 'express';
import { storage } from '../storage';
import { insertUserSchema, type User, type InsertUser } from '@shared/schema';
import { z } from 'zod';
import { requireAuth } from '../auth';
import { permissions, getRolePermissions } from '../../config';

/**
 * Registers all user-related API endpoints.
 *
 * @param app - Express application instance.
 */
export function registerUserRoutes(app: Express): void {
  /**
   * GET /api/users - Retrieves all users.
   */
  app.get('/api/users', async (req, res) => {
    try {
      const users = await storage.getUsers();
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
          error: 'Bad request',
          message: 'User ID is required',
        });
      }

      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({
          error: 'Not found',
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
          error: 'Bad request',
          message: 'Email is required',
        });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({
          error: 'Not found',
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
          error: 'Conflict',
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
          details: error.errors,
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
          error: 'Bad request',
          message: 'User ID is required',
        });
      }

      // Validate the update data (excluding password updates for security)
      const updateSchema = insertUserSchema.partial().omit({ password: true });
      const validatedData = updateSchema.parse(req.body);

      const user = await storage.updateUser(id, {
        ...validatedData,
        updatedAt: new Date(),
      });

      if (!user) {
        return res.status(404).json({
          error: 'Not found',
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
          details: error.errors,
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
          error: 'Bad request',
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
          error: 'Not found',
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
          error: 'Bad request',
          message: 'User role not found in session',
        });
      }

      // Validate the role exists in permissions
      if (!permissions[userRole as keyof typeof permissions]) {
        return res.status(400).json({
          error: 'Bad request', 
          message: 'Invalid user role',
        });
      }

      // Get permissions for the user's role
      const userPermissions = getRolePermissions(permissions as any, userRole as keyof typeof permissions);
      
      // Create response with Zod validation
      const responseData = {
        role: userRole,
        permissions: userPermissions,
        permissionCount: userPermissions.length,
      };

      // Validate response with Zod schema
      const permissionsResponseSchema = z.object({
        role: z.enum(['admin', 'manager', 'owner', 'tenant']),
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
          details: error.errors,
        });
      }

      console.error('Failed to fetch user permissions:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch user permissions',
      });
    }
  });
}
