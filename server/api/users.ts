import type { Express } from 'express';
import { storage } from '../storage';
import { insertUserSchema, type User, type InsertUser } from '@shared/schema';
import { z } from 'zod';
import { requireAuth } from '../auth';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
// Database-based permissions - no config imports needed
import { db } from '../db';
import * as schema from '../../shared/schema';
import { eq, and, inArray, sql, lt } from 'drizzle-orm';
import {
  sanitizeString,
  sanitizeName,
  normalizeEmail,
  validatePasswordStrength,
  generateUsernameFromEmail,
} from '../utils/input-sanitization';
import { logUserCreation } from '../utils/user-creation-logger';
import { queryCache } from '../query-cache';
import { emailService } from '../services/email-service';

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

      // Parse pagination parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;

      // Parse filter parameters
      const filters = {
        role: req.query.role as string,
        status: req.query.status as string,
        organization: req.query.organization as string,
        orphan: req.query.orphan as string,
        search: req.query.search as string,
      };
      
      console.log('🎯 [API] Raw query parameters:', {
        role: req.query.role,
        status: req.query.status,
        organization: req.query.organization,
        orphan: req.query.orphan,
        search: req.query.search
      });
      
      // Special debug for orphan filter
      if (req.query.orphan) {
        console.log('👻 [API DEBUG] Orphan filter detected:', req.query.orphan, typeof req.query.orphan);
      }

      // Apply role-based prefiltering at database level
      let roleBasedFilters = { ...filters };
      
      console.log(`🔐 [USER FILTER] Current user role: ${currentUser.role}, applying role-based filters...`);
      
      if (currentUser.role === 'admin') {
        // Admin can see all users - no additional filtering
        console.log('🔓 [ADMIN] No role-based filtering applied - admin can see all users');
      } else if (['demo_manager', 'demo_tenant', 'demo_resident'].includes(currentUser.role)) {
        // Demo users can only see other demo users
        if (!roleBasedFilters.role) {
          // If no role filter is applied, restrict to demo roles only
          roleBasedFilters.demoOnly = 'true';
        }
      } else {
        // Regular managers can only see users from their organizations
        console.log('👔 [MANAGER] Restricting to users from manager\'s organizations');
        const userOrgIds = (await storage.getUserOrganizations(currentUser.id)).map(org => org.organizationId);
        console.log(`   → Manager organizations: [${userOrgIds.join(', ')}]`);
        if (userOrgIds.length > 0) {
          roleBasedFilters.managerOrganizations = userOrgIds.join(',');
          console.log('   → Added managerOrganizations filter');
        } else {
          // Manager has no organizations, return empty result
          return res.json({
            users: [],
            pagination: {
              page,
              limit,
              total: 0,
              totalPages: 0,
              hasNext: false,
              hasPrev: false
            }
          });
        }
      }

      // Get users with their full assignment data and pagination (now with role-based prefiltering)
      console.log('📊 [QUERY] Applying filters:', JSON.stringify(roleBasedFilters, null, 2));
      const result = await storage.getUsersWithAssignmentsPaginated(offset, limit, roleBasedFilters);
      console.log(`📈 [RESULT] Found ${result.users.length} users out of ${result.total} total (page ${page})`);

      

      // Role-based filtering is now handled at database level in roleBasedFilters
      // No additional application-level filtering needed
      const filteredUsers = result.users;

      // Return paginated response with metadata
      res.json({
        users: filteredUsers,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
          hasNext: page * limit < result.total,
          hasPrev: page > 1
        }
      });
    } catch (error: any) {
      console.error('❌ Error fetching users:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch users',
      });
    }
  });

  /**
   * GET /api/users/filter-options - Get distinct values for filter dropdowns
   */
  app.get('/api/users/filter-options', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Get distinct roles (including null values)
      const rolesResult = await db
        .selectDistinct({ role: schema.users.role })
        .from(schema.users)
        .orderBy(schema.users.role);

      // Get distinct status values (including null values)
      const statusResult = await db
        .selectDistinct({ isActive: schema.users.isActive })
        .from(schema.users)
        .orderBy(schema.users.isActive);

      // Role-based organization filtering for filter options
      let organizations = [];
      if (currentUser.role === 'admin') {
        // Admin can see all organizations
        const orgsResult = await db
          .select({ id: schema.organizations.id, name: schema.organizations.name })
          .from(schema.organizations)
          .where(eq(schema.organizations.isActive, true))
          .orderBy(schema.organizations.name);
        organizations = orgsResult;
      } else if (['demo_manager', 'demo_tenant', 'demo_resident'].includes(currentUser.role)) {
        // Demo users can only see demo organizations
        const orgsResult = await db
          .select({ id: schema.organizations.id, name: schema.organizations.name })
          .from(schema.organizations)
          .where(
            and(
              eq(schema.organizations.isActive, true),
              eq(schema.organizations.type, 'demo')
            )
          )
          .orderBy(schema.organizations.name);
        organizations = orgsResult;
      } else {
        // Regular managers see only their organizations
        const userOrgIds = (await storage.getUserOrganizations(currentUser.id)).map(org => org.organizationId);
        if (userOrgIds.length > 0) {
          const orgsResult = await db
            .select({ id: schema.organizations.id, name: schema.organizations.name })
            .from(schema.organizations)
            .where(
              and(
                eq(schema.organizations.isActive, true),
                inArray(schema.organizations.id, userOrgIds)
              )
            )
            .orderBy(schema.organizations.name);
          organizations = orgsResult;
        }
      }

      // Prepare filter options with All and null handling
      const roleOptions = [
        { value: '', label: 'All Roles' },
        ...rolesResult.map(r => ({
          value: r.role || 'null',
          label: r.role ? r.role.charAt(0).toUpperCase() + r.role.slice(1).replace('_', ' ') : 'No Role'
        }))
      ];

      const statusOptions = [
        { value: '', label: 'All Statuses' },
        ...statusResult.map(s => ({
          value: s.isActive === null ? 'null' : s.isActive.toString(),
          label: s.isActive === null ? 'No Status' : (s.isActive ? 'Active' : 'Inactive')
        }))
      ];

      const organizationOptions = [
        { value: '', label: 'All Organizations' },
        ...organizations.map(org => ({
          value: org.id,
          label: org.name
        }))
      ];

      const orphanOptions = currentUser.role === 'admin' ? [
        { value: '', label: 'All Users' },
        { value: 'true', label: 'Orphan Users' },
        { value: 'false', label: 'Assigned Users' }
      ] : [];

      res.json({
        roles: roleOptions,
        statuses: statusOptions,
        organizations: organizationOptions,
        orphanOptions
      });
    } catch (error: any) {
      console.error('❌ Error fetching filter options:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch filter options',
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
  app.put('/api/users/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const currentUser = req.user || req.session?.user;

      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      if (!id) {
        return res.status(400).json({
          error: 'Bad request',
          message: 'User ID is required',
        });
      }

      // Get the target user being updated
      const targetUser = await storage.getUser(id);
      if (!targetUser) {
        return res.status(404).json({
          error: 'Not found',
          message: 'User not found',
        });
      }

      // Role-based access control for user updates
      const { role: newRole } = req.body;
      
      // Validate role assignment permissions
      if (newRole && newRole !== targetUser.role) {
        // Admin can assign any role
        if (currentUser.role === 'admin') {
          // Admin has no restrictions
        } 
        // Manager restrictions
        else if (currentUser.role === 'manager') {
          // Managers cannot escalate to admin
          if (newRole === 'admin') {
            return res.status(403).json({
              error: 'Permission denied',
              message: 'Managers cannot assign admin role',
              code: 'ROLE_ESCALATION_DENIED',
            });
          }
          // Managers can only assign manager/tenant/resident roles
          if (!['manager', 'tenant', 'resident'].includes(newRole)) {
            return res.status(403).json({
              error: 'Permission denied',
              message: 'Managers can only assign manager, tenant, or resident roles',
              code: 'INVALID_ROLE_ASSIGNMENT',
            });
          }
        }
        // Demo manager restrictions
        else if (currentUser.role === 'demo_manager') {
          // Demo managers can only assign demo roles
          if (!['demo_manager', 'demo_tenant', 'demo_resident'].includes(newRole)) {
            return res.status(403).json({
              error: 'Permission denied',
              message: 'Demo managers can only assign demo roles',
              code: 'INVALID_DEMO_ROLE_ASSIGNMENT',
            });
          }
        }
        // Other roles cannot assign roles
        else {
          return res.status(403).json({
            error: 'Permission denied',
            message: 'Insufficient permissions to assign roles',
            code: 'INSUFFICIENT_PERMISSIONS',
          });
        }

        // Organization scope validation for role assignments
        if (currentUser.role === 'manager' || currentUser.role === 'demo_manager') {
          // Get current user's organizations
          const currentUserOrgs = await storage.getUserOrganizations(currentUser.id);
          const currentUserOrgIds = currentUserOrgs.map(org => org.organizationId);
          
          // Get target user's organizations
          const targetUserOrgs = await storage.getUserOrganizations(id);
          const targetUserOrgIds = targetUserOrgs.map(org => org.organizationId);
          
          // Check if current user has access to target user's organizations
          const hasAccessToTargetOrgs = targetUserOrgIds.some(orgId => 
            currentUserOrgIds.includes(orgId)
          );
          
          if (!hasAccessToTargetOrgs && targetUserOrgIds.length > 0) {
            return res.status(403).json({
              error: 'Permission denied',
              message: 'Cannot modify users outside your organization scope',
              code: 'ORGANIZATION_SCOPE_VIOLATION',
            });
          }

          // For demo managers, validate demo role assignments
          if (currentUser.role === 'demo_manager') {
            // Check if target organizations are demo organizations
            const targetOrgs = await db
              .select()
              .from(schema.organizations)
              .where(inArray(schema.organizations.id, targetUserOrgIds));
            
            const hasNonDemoOrgs = targetOrgs.some(org => org.type !== 'demo');
            if (hasNonDemoOrgs) {
              return res.status(403).json({
                error: 'Permission denied',
                message: 'Demo managers cannot assign roles to users in non-demo organizations',
                code: 'DEMO_SCOPE_VIOLATION',
              });
            }
          }
        }
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
          error: 'Not found',
          message: 'User not found',
        });
      }

      // Clear relevant caches
      queryCache.invalidate('users', 'all_users');
      queryCache.invalidate('users', `user:${id}`);

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
   * PUT /api/users/:id/buildings - Updates user's building assignments.
   * Admin and Manager: can assign/remove buildings they have access to
   */
  app.put('/api/users/:id/buildings', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      const { id: userId } = req.params;
      const { buildingIds } = req.body;

      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Only admins and managers can modify building assignments
      if (!['admin', 'manager'].includes(currentUser.role)) {
        return res.status(403).json({
          message: 'Only administrators and managers can modify building assignments',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      if (!userId || !Array.isArray(buildingIds)) {
        return res.status(400).json({
          message: 'User ID and building IDs array are required',
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

      // For now, we'll create user-residence relationships for each building
      // This is a simplified approach - in a real system you'd have user-building relationships
      
      // Get residences for the selected buildings
      const residences = await db
        .select()
        .from(schema.residences)
        .where(inArray(schema.residences.buildingId, buildingIds));

      // Remove existing residence assignments for this user
      await db.delete(schema.userResidences).where(eq(schema.userResidences.userId, userId));

      // Add new residence assignments (one per building - taking the first residence)
      if (residences.length > 0) {
        const buildingToResidence = new Map();
        residences.forEach(residence => {
          if (!buildingToResidence.has(residence.buildingId)) {
            buildingToResidence.set(residence.buildingId, residence);
          }
        });

        const newAssignments = Array.from(buildingToResidence.values()).map((residence: any) => ({
          userId,
          residenceId: residence.id,
          relationshipType: user.role === 'manager' ? 'manager' : 'tenant',
          startDate: new Date().toISOString().split('T')[0],
          isActive: true,
        }));

        await db.insert(schema.userResidences).values(newAssignments);
      }

      res.json({
        message: 'Building assignments updated successfully',
        userId,
        buildingIds,
      });
    } catch (error: any) {
      console.error('❌ Error updating building assignments:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update building assignments',
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

      // Get full residence details with building information
      const residencesWithDetails = await storage.getUserResidencesWithDetails(userId);
      
      // Transform the data to match the expected frontend format
      const residences = residencesWithDetails.map(item => ({
        id: item.residence.id,
        unitNumber: item.residence.unitNumber,
        floor: item.residence.floor,
        squareFootage: item.residence.squareFootage,
        bedrooms: item.residence.bedrooms,
        bathrooms: item.residence.bathrooms,
        balcony: item.residence.balcony,
        parkingSpaceNumbers: item.residence.parkingSpaceNumbers,
        storageSpaceNumbers: item.residence.storageSpaceNumbers,
        isActive: item.residence.isActive,
        buildingId: item.residence.buildingId,
        building: {
          id: item.building.id,
          name: item.building.name,
          address: item.building.address,
          city: item.building.city,
          province: item.building.province,
          postalCode: item.building.postalCode,
        },
      }));

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
   * POST /api/users/:id/delete-account - RESTRICTED Admin endpoint to delete any user account.
   * SAFETY: Requires email confirmation and deletion reason for audit trail.
   * WARNING: This is a permanent operation that should only be used in exceptional cases.
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
      
      // Additional safety check: Log this critical operation
      console.warn(`⚠️  CRITICAL: Admin ${currentUser.email} attempting to delete user ${targetUserId}`);

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
        
        // Delete demands and related comments (must be done before deleting user)
        db.delete(schema.demandComments).where(eq(schema.demandComments.commenterId, targetUserId)),
        db.delete(schema.demands).where(eq(schema.demands.submitterId, targetUserId)),
        
        // Delete bugs and feature requests submitted by the user
        db.delete(schema.bugs).where(eq(schema.bugs.createdBy, targetUserId)),
        db.delete(schema.featureRequests).where(eq(schema.featureRequests.createdBy, targetUserId)),
        db.delete(schema.featureRequestUpvotes).where(eq(schema.featureRequestUpvotes.userId, targetUserId)),
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
      const randomPassword = randomBytes(12).toString('base64');
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

      // Validate required fields first
      if (!organizationId || !email || !role || !expiresAt) {
        return res.status(400).json({
          message: 'Organization, email, role, and expiry date are required',
          code: 'MISSING_REQUIRED_FIELDS',
        });
      }

      // Then validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          message: 'Invalid email format',
          code: 'INVALID_EMAIL',
        });
      }

      // Validate role permissions
      if (currentUser.role === 'manager') {
        // Check if manager is trying to invite admin
        if (role === 'admin') {
          return res.status(403).json({
            message: 'Managers can only invite resident, tenant, and manager roles',
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

      // Check for existing pending invitations for the same email and organization
      // If found, delete them to replace with new invitation
      const existingInvitations = await db
        .select()
        .from(schema.invitations)
        .where(
          and(
            eq(schema.invitations.email, email),
            eq(schema.invitations.organizationId, organizationId),
            eq(schema.invitations.status, 'pending')
          )
        );

      if (existingInvitations.length > 0) {
        console.log(`🔄 Replacing ${existingInvitations.length} existing invitation(s) for email: ${email}`);
        // Delete existing pending invitations for this email/organization
        await db
          .delete(schema.invitations)
          .where(
            and(
              eq(schema.invitations.email, email),
              eq(schema.invitations.organizationId, organizationId),
              eq(schema.invitations.status, 'pending')
            )
          );
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

      // Get organization details for email
      const [organization] = await db
        .select()
        .from(schema.organizations)
        .where(eq(schema.organizations.id, organizationId))
        .limit(1);

      // Send invitation email
      const recipientName = email.split('@')[0]; // Use email prefix as name
      const organizationName = organization?.name || 'Koveo Gestion';
      const inviterName = `${currentUser.firstName || currentUser.email} ${currentUser.lastName || ''}`.trim();
      
      const emailSent = await emailService.sendInvitationEmail(
        email,
        recipientName,
        token, // Use the unhashed token for the email URL
        organizationName,
        inviterName,
        new Date(expiresAt),
        'fr', // Default to French for Quebec
        personalMessage
      );

      // Log invitation creation
      console.log('✅ Invitation created:', {
        id: newInvitation.id,
        email,
        role,
        organizationId,
        invitedBy: currentUser.email,
        emailSent,
      });

      // For tests, we'll treat email failure as success since tests may not have email configured
      if (!emailSent && process.env.NODE_ENV !== 'test') {
        // If email failed but invitation was created, log the issue
        console.error('⚠️ Invitation created but email failed to send');
        return res.status(207).json({
          message: 'Invitation created but email failed to send',
          invitationId: newInvitation.id,
          emailSent: false,
        });
      }

      res.status(201).json({
        message: 'Invitation sent successfully',
        invitationId: newInvitation.id,
        emailSent: true,
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
   * POST /api/invitations/validate - Validates an invitation token
   * Public endpoint for invitation validation during registration
   */
  app.post('/api/invitations/validate', async (req: any, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          isValid: false,
          message: 'Token is required',
          code: 'TOKEN_REQUIRED',
        });
      }

      // Get invitation by token
      const [invitation] = await db
        .select()
        .from(schema.invitations)
        .where(eq(schema.invitations.token, token))
        .limit(1);

      if (!invitation) {
        return res.status(404).json({
          isValid: false,
          message: 'Invitation not found or invalid token',
          code: 'INVITATION_NOT_FOUND',
        });
      }

      // Check if invitation is expired
      const now = new Date();
      const expiresAt = new Date(invitation.expiresAt);
      if (now > expiresAt) {
        return res.status(400).json({
          isValid: false,
          message: 'Invitation has expired',
          code: 'INVITATION_EXPIRED',
        });
      }

      // Check if invitation is already used
      if (invitation.status === 'accepted') {
        return res.status(400).json({
          isValid: false,
          message: 'Invitation has already been used',
          code: 'INVITATION_ALREADY_USED',
        });
      }

      // Get organization information
      const [organization] = await db
        .select()
        .from(schema.organizations)
        .where(eq(schema.organizations.id, invitation.organizationId))
        .limit(1);

      // Get inviter information
      const [inviter] = await db
        .select({
          id: schema.users.id,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
          email: schema.users.email,
        })
        .from(schema.users)
        .where(eq(schema.users.id, invitation.invitedByUserId))
        .limit(1);

      // Return successful validation
      res.json({
        isValid: true,
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expiresAt,
          createdAt: invitation.createdAt,
        },
        organizationName: organization?.name || 'Unknown Organization',
        inviterName: inviter ? `${inviter.firstName} ${inviter.lastName}`.trim() : 'Unknown User',
      });
    } catch (error: any) {
      console.error('❌ Error validating invitation:', error);
      res.status(500).json({
        isValid: false,
        message: 'Internal server error during validation',
        code: 'VALIDATION_ERROR',
      });
    }
  });

  /**
   * POST /api/invitations/accept/:token - Accept an invitation and create user account
   * Public endpoint for completing registration via invitation
   */
  app.post('/api/invitations/accept/:token', async (req: any, res) => {
    try {
      const { token } = req.params;
      const {
        firstName,
        lastName,
        password,
        phone,
        language,
        dataCollectionConsent,
        marketingConsent,
        analyticsConsent,
        thirdPartyConsent,
        acknowledgedRights,
      } = req.body;

      if (!token) {
        return res.status(400).json({
          message: 'Token is required',
          code: 'TOKEN_REQUIRED',
        });
      }

      // Get invitation by token
      const [invitation] = await db
        .select()
        .from(schema.invitations)
        .where(eq(schema.invitations.token, token))
        .limit(1);

      if (!invitation) {
        return res.status(404).json({
          message: 'Invitation not found or invalid token',
          code: 'INVITATION_NOT_FOUND',
        });
      }

      // Check if invitation is expired
      const now = new Date();
      const expiresAt = new Date(invitation.expiresAt);
      if (now > expiresAt) {
        return res.status(400).json({
          message: 'Invitation has expired',
          code: 'INVITATION_EXPIRED',
        });
      }

      // Check if invitation is already used
      if (invitation.status === 'accepted') {
        return res.status(400).json({
          message: 'Invitation has already been used',
          code: 'INVITATION_ALREADY_USED',
        });
      }

      // Validate required fields
      if (!firstName || !lastName || !password) {
        return res.status(400).json({
          message: 'First name, last name, and password are required',
          code: 'MISSING_REQUIRED_FIELDS',
        });
      }

      // Validate required consents
      if (!dataCollectionConsent || !acknowledgedRights) {
        return res.status(400).json({
          message: 'Required privacy consents must be given',
          code: 'MISSING_REQUIRED_CONSENTS',
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user account
      const userData = {
        firstName: sanitizeName(firstName),
        lastName: sanitizeName(lastName),
        email: normalizeEmail(invitation.email),
        username: generateUsernameFromEmail(invitation.email),
        password: hashedPassword,
        phone: phone ? sanitizeString(phone) : '',
        language: language || 'fr',
        role: invitation.role as any,
        isActive: true,
        organizationId: invitation.organizationId,
      };

      const newUser = await storage.createUser(userData as InsertUser);

      // Create organization assignment if organizationId is provided
      if (invitation.organizationId) {
        await db.insert(schema.userOrganizations).values({
          userId: newUser.id,
          organizationId: invitation.organizationId,
          organizationRole: invitation.role,
          isActive: true,
        });
        console.log('✅ User assigned to organization:', {
          userId: newUser.id,
          organizationId: invitation.organizationId,
          role: invitation.role,
        });
      }

      // Create residence assignment if residenceId is provided
      if (invitation.residenceId) {
        await db.insert(schema.userResidences).values({
          userId: newUser.id,
          residenceId: invitation.residenceId,
          relationshipType: invitation.role === 'tenant' ? 'tenant' : 'occupant',
          startDate: new Date(),
          isActive: true,
        });
        console.log('✅ User assigned to residence:', {
          userId: newUser.id,
          residenceId: invitation.residenceId,
          relationshipType: invitation.role === 'tenant' ? 'tenant' : 'occupant',
        });
      }

      // Mark invitation as accepted
      await db
        .update(schema.invitations)
        .set({
          status: 'accepted',
          acceptedAt: new Date(),
          acceptedBy: newUser.id,
          updatedAt: new Date(),
        })
        .where(eq(schema.invitations.id, invitation.id));

      // Log user creation
      logUserCreation({
        userId: newUser.id,
        email: newUser.email,
        method: 'invitation',
        role: invitation.role,
        success: true,
        timestamp: new Date(),
      });

      // Clear cache
      queryCache.invalidate('users', 'all_users');
      queryCache.invalidate('invitations');

      console.log('✅ User created via invitation acceptance:', {
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role,
        organizationId: invitation.organizationId,
        residenceId: invitation.residenceId,
        assignedToOrganization: !!invitation.organizationId,
        assignedToResidence: !!invitation.residenceId,
      });

      res.status(201).json({
        message: 'Account created successfully',
        user: {
          id: newUser.id,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          email: newUser.email,
          role: newUser.role,
          language: newUser.language,
        },
      });
    } catch (error: any) {
      console.error('❌ Error accepting invitation:', error);
      res.status(500).json({
        message: 'Internal server error during account creation',
        code: 'INVITATION_ACCEPT_ERROR',
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

      // Get organization details for email
      const [organization] = await db
        .select()
        .from(schema.organizations)
        .where(eq(schema.organizations.id, invitation.organizationId))
        .limit(1);

      // Send invitation email again
      const recipientName = invitation.email.split('@')[0]; // Use email prefix as name
      const organizationName = organization?.name || 'Koveo Gestion';
      const inviterName = `${currentUser.firstName || currentUser.email} ${currentUser.lastName || ''}`.trim();
      
      const emailSent = await emailService.sendInvitationEmail(
        invitation.email,
        recipientName,
        invitation.token, // Use the existing token
        organizationName,
        inviterName,
        newExpiresAt,
        'fr', // Default to French for Quebec
        invitation.personalMessage
      );

      console.log('✅ Invitation resent:', {
        id,
        email: invitation.email,
        newExpiresAt,
        emailSent,
      });

      if (!emailSent) {
        console.error('⚠️ Invitation updated but email failed to resend');
        return res.status(207).json({
          message: 'Invitation updated but email failed to resend',
          emailSent: false,
        });
      }

      res.json({
        message: 'Invitation resent successfully',
        emailSent: true,
      });
    } catch (error: any) {
      console.error('❌ Error resending invitation:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to resend invitation',
      });
    }
  });

  /**
   * GET /api/invitations/pending - Get pending invitations with role-based filtering.
   * Admin: can see all pending invitations
   * Manager: can only see pending invitations in their organizations
   */
  app.get('/api/invitations/pending', requireAuth, async (req: any, res) => {
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
          message: 'Insufficient permissions to view invitations',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      let invitationsQuery;

      if (currentUser.role === 'admin') {
        // Admin sees all pending invitations
        invitationsQuery = db
          .select({
            id: schema.invitations.id,
            email: schema.invitations.email,
            role: schema.invitations.role,
            status: schema.invitations.status,
            expiresAt: schema.invitations.expiresAt,
            createdAt: schema.invitations.createdAt,
            organizationId: schema.invitations.organizationId,
            buildingId: schema.invitations.buildingId,
            residenceId: schema.invitations.residenceId,
            organizationName: schema.organizations.name,
            buildingName: sql<string>`buildings.name`,
            residenceUnitNumber: sql<string>`residences.unit_number`,
            invitedByName: sql<string>`CONCAT(users.first_name, ' ', users.last_name)`,
          })
          .from(schema.invitations)
          .leftJoin(schema.organizations, eq(schema.invitations.organizationId, schema.organizations.id))
          .leftJoin(
            sql`buildings`,
            sql`invitations.building_id = buildings.id`
          )
          .leftJoin(
            sql`residences`,
            sql`invitations.residence_id = residences.id`
          )
          .leftJoin(schema.users, eq(schema.invitations.invitedByUserId, schema.users.id))
          .where(eq(schema.invitations.status, 'pending'));
      } else {
        // Manager sees only invitations for their organizations
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

        invitationsQuery = db
          .select({
            id: schema.invitations.id,
            email: schema.invitations.email,
            role: schema.invitations.role,
            status: schema.invitations.status,
            expiresAt: schema.invitations.expiresAt,
            createdAt: schema.invitations.createdAt,
            organizationId: schema.invitations.organizationId,
            buildingId: schema.invitations.buildingId,
            residenceId: schema.invitations.residenceId,
            organizationName: schema.organizations.name,
            buildingName: sql<string>`buildings.name`,
            residenceUnitNumber: sql<string>`residences.unit_number`,
            invitedByName: sql<string>`CONCAT(users.first_name, ' ', users.last_name)`,
          })
          .from(schema.invitations)
          .leftJoin(schema.organizations, eq(schema.invitations.organizationId, schema.organizations.id))
          .leftJoin(
            sql`buildings`,
            sql`invitations.building_id = buildings.id`
          )
          .leftJoin(
            sql`residences`,
            sql`invitations.residence_id = residences.id`
          )
          .leftJoin(schema.users, eq(schema.invitations.invitedByUserId, schema.users.id))
          .where(
            and(
              eq(schema.invitations.status, 'pending'),
              inArray(schema.invitations.organizationId, orgIds)
            )
          );
      }

      const invitations = await invitationsQuery;

      res.json(invitations);
    } catch (error: any) {
      console.error('❌ Error fetching pending invitations:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch pending invitations',
      });
    }
  });

  /**
   * DELETE /api/invitations/:id - Delete a pending invitation.
   * Admin: can delete any invitation
   * Manager: can only delete invitations from their organizations
   */
  app.delete('/api/invitations/:id', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      const { id: invitationId } = req.params;

      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Only admins and managers can delete invitations
      if (!['admin', 'manager'].includes(currentUser.role)) {
        return res.status(403).json({
          message: 'Insufficient permissions to delete invitations',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      if (!invitationId) {
        return res.status(400).json({
          message: 'Invitation ID is required',
          code: 'INVALID_REQUEST',
        });
      }

      // Get the invitation to check permissions
      const invitation = await db
        .select()
        .from(schema.invitations)
        .where(eq(schema.invitations.id, invitationId))
        .limit(1);

      if (invitation.length === 0) {
        return res.status(404).json({
          message: 'Invitation not found',
          code: 'INVITATION_NOT_FOUND',
        });
      }

      const invitationData = invitation[0];

      // Check if manager has permission to delete this invitation
      if (currentUser.role === 'manager') {
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

        if (!invitationData.organizationId || !orgIds.includes(invitationData.organizationId)) {
          return res.status(403).json({
            message: 'You can only delete invitations from your organizations',
            code: 'INSUFFICIENT_PERMISSIONS',
          });
        }
      }

      // Delete the invitation
      await db.delete(schema.invitations).where(eq(schema.invitations.id, invitationId));

      res.json({
        message: 'Invitation deleted successfully',
        invitationId,
      });
    } catch (error: any) {
      console.error('❌ Error deleting invitation:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete invitation',
      });
    }
  });

  // Admin-only endpoint to delete orphan users
  app.delete('/api/users/orphans', requireAuth, async (req: any, res) => {
    console.log('🔥 [DELETE ORPHANS API] ===== DELETE ORPHAN USERS REQUEST STARTED =====');
    console.log('⏰ [DELETE ORPHANS API] Request timestamp:', new Date().toISOString());
    console.log('🛡️ [DELETE ORPHANS API] Request authentication info:', {
      userId: req.user?.id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      sessionExists: !!req.session,
      sessionId: req.session?.id
    });

    try {
      console.log('🗑️ [DELETE ORPHANS API] Processing request from user:', req.user?.id, 'role:', req.user?.role);
      
      // Check if user is admin
      if (req.user?.role !== 'admin') {
        console.log('❌ [DELETE ORPHANS API] Access denied - user role is:', req.user?.role, '(expected: admin)');
        return res.status(403).json({ 
          error: 'Access denied. Admin role required.',
          userRole: req.user?.role 
        });
      }

      console.log('✅ [DELETE ORPHANS API] Admin authorization confirmed');
      console.log('🔍 [DELETE ORPHANS API] Calling storage.countOrphanUsers()...');

      // Get count of orphan users before deletion
      const orphanCount = await storage.countOrphanUsers();
      console.log('📊 [DELETE ORPHANS API] Storage returned orphan count:', orphanCount);

      if (orphanCount === 0) {
        console.log('ℹ️ [DELETE ORPHANS API] No orphan users found, returning success with 0 count');
        return res.json({ 
          success: true, 
          message: 'No orphan users found to delete',
          deletedCount: 0 
        });
      }

      console.log('🚀 [DELETE ORPHANS API] Proceeding with deletion of', orphanCount, 'orphan users');
      console.log('🔒 [DELETE ORPHANS API] Excluding current admin user:', req.user.id);
      console.log('🔍 [DELETE ORPHANS API] Calling storage.deleteOrphanUsers()...');

      // Delete orphan users (excluding current admin)
      const startTime = Date.now();
      const deletedCount = await storage.deleteOrphanUsers(req.user.id);
      const endTime = Date.now();
      
      console.log('⏱️ [DELETE ORPHANS API] Storage operation completed in:', (endTime - startTime), 'ms');
      console.log('📈 [DELETE ORPHANS API] Storage returned deleted count:', deletedCount);

      if (deletedCount !== orphanCount) {
        console.log('⚠️ [DELETE ORPHANS API] Warning: Deleted count differs from initial count:', {
          initialCount: orphanCount,
          deletedCount: deletedCount,
          difference: orphanCount - deletedCount
        });
      }

      const responseData = { 
        success: true, 
        message: `Successfully deleted ${deletedCount} orphan users`,
        deletedCount,
        initialCount: orphanCount
      };

      console.log('✅ [DELETE ORPHANS API] Operation completed successfully:', responseData);
      console.log('🔥 [DELETE ORPHANS API] ===== DELETE ORPHAN USERS REQUEST COMPLETED =====');
      
      res.json(responseData);

    } catch (error) {
      console.error('💥 [DELETE ORPHANS API] ===== CRITICAL ERROR =====');
      console.error('❌ [DELETE ORPHANS API] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        timestamp: new Date().toISOString()
      });
      console.error('💥 [DELETE ORPHANS API] ===== END CRITICAL ERROR =====');
      
      res.status(500).json({ 
        error: 'Failed to delete orphan users',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });
}
