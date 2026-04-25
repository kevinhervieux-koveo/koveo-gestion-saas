// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
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
import { eq, and, or, inArray, isNull, sql, lt, count, desc } from 'drizzle-orm';
import {
  sanitizeString,
  sanitizeName,
  normalizeEmail,
  validatePasswordStrength,
  generateUsernameFromEmail,
} from '../utils/input-sanitization';
import { logUserCreation } from '../utils/user-creation-logger';
import { queryCache, CacheInvalidator } from '../query-cache';
import { emailService } from '../services/email-service';
import {
  createInvitationWithSoftReplace,
  InvitationAlreadyPendingError,
  type InvitationRole,
} from '../services/invitation-soft-replace';
import { cacheInvalidationService, createInvalidationMiddleware } from '../services/cache-invalidation-service';
import { logDebug, logInfo, logWarn, logError } from '../utils/logger';

import { asyncHandler } from '../utils/async-handler';
import { buildContentDisposition } from '../utils/content-disposition';
import { sendDbWriteError } from '../utils/rest-db-error';
import { resolveOrgScope } from '../utils/org-scope';
/**
 * Helper function to get the correct base URL from REPLIT_DOMAINS.
 * REPLIT_DOMAINS can contain multiple domains separated by commas.
 * We prefer custom domains (non-replit.app) over replit.app domains.
 */
function getBaseUrlFromReplitDomains(): string | null {
  const replitDomains = process.env.REPLIT_DOMAINS;
  if (!replitDomains) return null;

  // Split by comma and trim whitespace
  const domains = replitDomains.split(',').map(d => d.trim()).filter(d => d);
  
  if (domains.length === 0) return null;
  
  // Prefer custom domains (non-replit.app) over replit.app domains
  const customDomain = domains.find(d => !d.includes('.replit.app'));
  const selectedDomain = customDomain || domains[0];
  
  return `https://${selectedDomain}`;
}

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
  app.get('/api/users', requireAuth, asyncHandler(async (req: any, res) => {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Validate and resolve the organization scope. Admins are no longer
      // exempt from scoping — when no organizationId is supplied, results are
      // restricted to the caller's accessible org set.
      const scope = await resolveOrgScope(req, res);
      if (!scope) return;

      // Parse pagination parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;

      // Parse filter parameters
      const filters: {
        role?: string;
        status?: string;
        organization?: string;
        orphan?: string;
        search?: string;
        demoOnly?: string;
        managerOrganizations?: string;
      } = {
        role: req.query.role as string,
        status: req.query.status as string,
        organization: req.query.organization as string,
        orphan: req.query.orphan as string,
        search: req.query.search as string,
      };
      
      logDebug('[API] Raw query parameters', { metadata: { role: req.query.role, status: req.query.status, organization: req.query.organization, orphan: req.query.orphan, search: req.query.search } });
      

      // Apply role-based prefiltering at database level
      let roleBasedFilters = { ...filters };
      
      logDebug('[USER FILTER] Applying role-based filters', { metadata: { role: currentUser.role } });
      
      if (currentUser.role === 'admin') {
        // Admins are no longer exempt: scope to the resolved org set.
        if (scope.orgIds.length > 0) {
          roleBasedFilters.managerOrganizations = scope.orgIds.join(',');
          logDebug('[ADMIN] Restricting to users from resolved org scope', { metadata: { organizationIds: scope.orgIds } });
        } else {
          // Admin with no accessible orgs - return empty result
          return res.json({
            users: [],
            pagination: {
              page,
              limit,
              total: 0,
              totalPages: 0,
              hasNext: false,
              hasPrev: false,
            },
          });
        }
      } else if (['demo_manager', 'demo_tenant', 'demo_resident'].includes(currentUser.role)) {
        // All demo users (including demo_manager) can only see other demo users in their organizations
        // SECURITY: Validate role parameter against whitelist for demo users
        const allowedDemoRoles = ['demo_manager', 'demo_tenant', 'demo_resident'];
        
        if (roleBasedFilters.role) {
          // If demo user provided a role filter, validate it against whitelist
          if (!allowedDemoRoles.includes(roleBasedFilters.role)) {
            // SECURITY: Demo user trying to access non-demo role - block and force demo-only
            logWarn('[SECURITY] Demo user attempted to access non-demo role - blocking', { userId: currentUser.id, metadata: { role: currentUser.role, attemptedRole: roleBasedFilters.role } });
            roleBasedFilters.role = undefined; // Remove invalid role filter
            roleBasedFilters.demoOnly = 'true'; // Force demo-only restriction
          } else {
            // Valid demo role requested, but still restrict to demo users only
            logDebug('[SECURITY] Demo user requesting valid demo role', { metadata: { role: currentUser.role, requestedRole: roleBasedFilters.role } });
            roleBasedFilters.demoOnly = 'true'; // Ensure demo-only restriction is always applied
          }
        } else {
          // If no role filter is applied, restrict to demo roles only
          roleBasedFilters.demoOnly = 'true';
        }
        
        // Restrict to users from the resolved org scope (already validates
        // explicit organizationId param against the caller's accessible orgs).
        logDebug('[DEMO] Restricting to users from demo user resolved org scope', { metadata: { organizationIds: scope.orgIds } });
        if (scope.orgIds.length > 0) {
          roleBasedFilters.managerOrganizations = scope.orgIds.join(',');
        } else {
          // Demo user has no organizations, return empty result
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
      } else {
        // Regular managers: scope to the resolved org set.
        logDebug('[MANAGER] Restricting to users from resolved org scope', { metadata: { organizationIds: scope.orgIds } });
        if (scope.orgIds.length > 0) {
          roleBasedFilters.managerOrganizations = scope.orgIds.join(',');
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
      logDebug('[QUERY] Applying filters', { metadata: { filters: roleBasedFilters } });
      const result = await storage.getUsersWithAssignmentsPaginated(offset, limit, roleBasedFilters);
      logDebug('[RESULT] Users found', { metadata: { count: result.users.length, total: result.total, page } });

      

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
    }, { errorMessage: 'Failed to fetch users', errorLogPrefix: '❌ Error fetching users', extraErrorFields: { error: 'Internal server error' } }));

  /**
   * GET /api/users/filter-options - Get distinct values for filter dropdowns
   */
  app.get('/api/users/filter-options', requireAuth, asyncHandler(async (req: any, res) => {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Get distinct status values (including null values)
      const statusResult = await db
        .selectDistinct({ isActive: schema.users.isActive })
        .from(schema.users)
        .orderBy(schema.users.isActive);

      // Role-based filtering for roles and organizations
      let organizations = [];
      let allowedRoles = [];
      
      if (currentUser.role === 'admin') {
        // Only admin can see all organizations and all roles
        const orgsResult = await db
          .select({ id: schema.organizations.id, name: schema.organizations.name })
          .from(schema.organizations)
          .where(eq(schema.organizations.isActive, true))
          .orderBy(schema.organizations.name);
        organizations = orgsResult;
        
        // Admin sees all roles
        const rolesResult = await db
          .selectDistinct({ role: schema.users.role })
          .from(schema.users)
          .orderBy(schema.users.role);
        allowedRoles = rolesResult.map(r => r.role).filter(Boolean);
        
      } else if (['demo_manager', 'demo_tenant', 'demo_resident'].includes(currentUser.role)) {
        // All demo users (including demo_manager) can only see demo organizations and demo roles
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
        
        // All demo users only see demo roles
        allowedRoles = ['demo_manager', 'demo_tenant', 'demo_resident'];
        
      } else {
        // Regular managers see only their organizations and non-admin roles
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
        
        // Regular managers can't see admin role
        allowedRoles = ['manager', 'tenant', 'resident'];
      }

      // Prepare filter options with role-based filtering
      // Return translation keys for client-side i18n
      const roleOptions = [
        { value: '', label: 'allRoles', translationKey: true },
        ...allowedRoles.map(role => ({
          value: role,
          label: role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' '),
          translationKey: false
        }))
      ];

      const statusOptions = [
        { value: '', label: 'allStatuses', translationKey: true },
        ...statusResult.map(s => ({
          value: s.isActive === null ? 'null' : s.isActive.toString(),
          label: s.isActive === null ? 'noStatus' : (s.isActive ? 'statusActive' : 'statusInactive'),
          translationKey: true
        }))
      ];

      const organizationOptions = [
        { value: '', label: 'allOrganizations', translationKey: true },
        ...organizations.map(org => ({
          value: org.id,
          label: org.name,
          translationKey: false
        }))
      ];

      const orphanOptions = (currentUser.role === 'admin') ? [
        { value: '', label: 'allUsers', translationKey: true },
        { value: 'true', label: 'orphanUsers', translationKey: true },
        { value: 'false', label: 'assignedUsers', translationKey: true }
      ] : [];

      res.json({
        roles: roleOptions,
        statuses: statusOptions,
        organizations: organizationOptions,
        orphanOptions
      });
    }, { errorMessage: 'Failed to fetch filter options', errorLogPrefix: '❌ Error fetching filter options', extraErrorFields: { error: 'Internal server error' } }));

  /**
   * GET /api/users/:id - Retrieves a specific user by ID.
   */
  app.get('/api/users/:id', requireAuth, asyncHandler(async (req, res) => {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          _error: 'Bad request',
          message: 'User ID is required',
        });
      }

      const currentUser = (req as any).user;
      const isSelf = currentUser?.id === id;
      const isPrivileged = ['admin', 'manager', 'demo_manager'].includes(currentUser?.role);
      if (!isSelf && !isPrivileged) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You can only view your own profile',
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
    }, { errorMessage: 'Failed to fetch user', errorLogPrefix: '❌ Error fetching user', extraErrorFields: { error: 'Internal server error' } }));

  /**
   * GET /api/users/email/:email - Retrieves a user by email address.
   */
  app.get('/api/users/email/:email', requireAuth, asyncHandler(async (req, res) => {
      const { email } = req.params;

      if (!email) {
        return res.status(400).json({
          _error: 'Bad request',
          message: 'Email is required',
        });
      }

      const currentUser = (req as any).user;
      const isPrivileged = ['admin', 'manager', 'demo_manager'].includes(currentUser?.role);
      const isSelf = currentUser?.email?.toLowerCase() === email.toLowerCase();
      if (!isSelf && !isPrivileged) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You can only look up your own email',
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
    }, { errorMessage: 'Failed to fetch user', errorLogPrefix: '❌ Error fetching user by email', extraErrorFields: { error: 'Internal server error' } }));

  /**
   * POST /api/users - Creates a new user (public self-registration).
   * Privileged roles (admin, manager) require an authenticated admin session.
   */
  app.post('/api/users', async (req, res) => {
    try {
      const requestedRole = req.body.role;
      const privilegedRoles = ['admin', 'manager', 'demo_manager'];
      if (requestedRole && privilegedRoles.includes(requestedRole)) {
        const sessionUserId = (req as any).session?.userId;
        if (!sessionUserId) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Creating users with privileged roles requires authentication',
          });
        }
        const requestingUser = await storage.getUser(sessionUserId);
        if (!requestingUser || requestingUser.role !== 'admin') {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Only admins can create users with privileged roles',
          });
        }
      }

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

      // Hash password before storing
      if (validatedData.password) {
        const saltRounds = 12;
        validatedData.password = await bcrypt.hash(validatedData.password, saltRounds);
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

      logError('Error creating user', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to create user',
      });
    }
  });

  /**
   * PUT /api/users/me - Update current user's profile.
   * NOTE: This route MUST be defined before /api/users/:id to prevent Express from matching "me" as an ID
   */
  app.put('/api/users/me', requireAuth, asyncHandler(async (req: any, res) => {
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
    }, { errorMessage: 'Failed to update profile', errorLogPrefix: '❌ Error updating user profile', extraErrorFields: { error: 'Internal server error' } }));

  /**
   * PUT /api/users/:id - Updates an existing user.
   */
  app.put('/api/users/:id', requireAuth,
    createInvalidationMiddleware('user', {
      extractEntityId: (req) => req.params.id,
      extractAffectedUsers: async (req) => [req.params.id],
      operation: 'update'
    }),
    async (req: any, res) => {
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

      logError('Error updating user', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update user',
      });
    }
  });

  // Admin-only endpoint to delete orphan users
  app.delete('/api/users/orphans', requireAuth, async (req: any, res) => {
    try {
      // Check if user is admin
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ 
          error: 'Access denied. Admin role required.',
          userRole: req.user?.role 
        });
      }

      // Get count of orphan users before deletion
      const orphanCount = await storage.countOrphanUsers();

      if (orphanCount === 0) {
        return res.json({ 
          success: true, 
          message: 'No orphan users found to delete',
          deletedCount: 0 
        });
      }

      // Delete orphan users (excluding current admin)
      const deletedCount = await storage.deleteOrphanUsers(req.user.id);

      const responseData = { 
        success: true, 
        message: `Successfully deleted ${deletedCount} orphan users`,
        deletedCount,
        initialCount: orphanCount
      };
      
      res.json(responseData);

    } catch (error) {
      logError('[DELETE ORPHANS API] Critical error deleting orphan users', error instanceof Error ? error : new Error('Unknown error'));
      
      res.status(500).json({ 
        error: 'Failed to delete orphan users',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * DELETE /api/users/:id - Deletes a user account with proper authorization and data cleanup.
   * - Admin: Can delete any user (hard delete)
   * - Manager: Can only delete users within their organizations (hard delete)
   * - Other roles: Cannot delete users
   */
  app.delete('/api/users/:id', requireAuth, async (req: any, res) => {
    const startTime = Date.now();
    const deleteId = `DELETE_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    logInfo('[DELETE USER API] Delete user request started', { requestId: deleteId });
    
    try {
      const { id } = req.params;
      const currentUser = req.user || req.session?.user;

      if (!currentUser) {
        logWarn('[DELETE USER API] No authenticated user found', { requestId: deleteId });
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      logDebug('[DELETE USER API] Request authentication info', { requestId: deleteId, userId: currentUser.id, metadata: { role: currentUser.role, targetUserId: id } });

      if (!id) {
        logWarn('[DELETE USER API] Missing user ID parameter', { requestId: deleteId });
        return res.status(400).json({
          error: 'Bad request',
          message: 'User ID is required',
        });
      }

      // Validate user ID format
      if (typeof id !== 'string' || id.trim().length === 0) {
        logWarn('[DELETE USER API] Invalid user ID format', { requestId: deleteId });
        return res.status(400).json({
          error: 'Bad request',
          message: 'Invalid user ID format',
        });
      }

      // Get the target user to delete
      const targetUser = await storage.getUser(id);
      if (!targetUser) {
        logDebug('[DELETE USER API] Target user not found', { requestId: deleteId });
        return res.status(404).json({
          error: 'Not found',
          message: 'User not found',
        });
      }

      logDebug('[DELETE USER API] Target user found', { requestId: deleteId, metadata: { targetRole: targetUser.role, targetIsActive: targetUser.isActive } });

      // Prevent self-deletion
      if (targetUser.id === currentUser.id) {
        logWarn('[DELETE USER API] Self-deletion attempt blocked', { requestId: deleteId, userId: currentUser.id });
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You cannot delete your own account',
        });
      }

      // Role-based authorization
      const hasDeletePermission = await checkDeletePermission(currentUser, targetUser, deleteId);
      if (!hasDeletePermission.allowed) {
        logWarn('[DELETE USER API] Authorization failed', { requestId: deleteId, metadata: { reason: hasDeletePermission.reason } });
        return res.status(403).json({
          error: 'Forbidden',
          message: hasDeletePermission.reason,
        });
      }

      logInfo('[DELETE USER API] Authorization passed', { requestId: deleteId, metadata: { reason: hasDeletePermission.reason } });

      // Perform hard delete with comprehensive cleanup
      logInfo('[DELETE USER API] Starting hard delete process', { requestId: deleteId });
      const deletionResult = await performHardDelete(targetUser.id, currentUser.id, deleteId);

      const endTime = Date.now();
      const duration = endTime - startTime;

      logInfo('[DELETE USER API] Deletion completed successfully', { requestId: deleteId, metadata: { duration: `${duration}ms` } });

      logInfo('[SECURITY AUDIT] User deletion completed', { requestId: deleteId, userId: currentUser.id, action: 'delete_user', metadata: { deletedUserRole: targetUser.role, duration: `${duration}ms` } });

      res.json({
        success: true,
        message: 'User deleted successfully',
        deletedUserId: targetUser.id,
        deletedUserEmail: targetUser.email,
        operationId: deleteId,
        timestamp: new Date().toISOString(),
        ...deletionResult,
      });
      
    } catch (error: any) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      logError('[DELETE USER API] Critical error during user deletion', error instanceof Error ? error : new Error('Unknown error'), { requestId: deleteId, metadata: { duration: `${duration}ms` } });
      
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete user',
        operationId: deleteId,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * Check if the current user has permission to delete the target user.
   */
  async function checkDeletePermission(currentUser: User, targetUser: User, operationId: string): Promise<{allowed: boolean, reason: string}> {
    logDebug('[PERMISSION CHECK] Checking delete permissions', { requestId: operationId });
    
    // Admin can delete any user
    if (currentUser.role === 'admin') {
      logDebug('[PERMISSION CHECK] Admin access granted', { requestId: operationId });
      return { allowed: true, reason: 'Admin has full delete access' };
    }

    // Only admin, manager, and demo_manager can delete users
    if (!['manager', 'demo_manager'].includes(currentUser.role)) {
      logDebug('[PERMISSION CHECK] Role has no delete permissions', { requestId: operationId, metadata: { role: currentUser.role } });
      return { allowed: false, reason: 'Your role does not have permission to delete users' };
    }

    // Managers can only delete users within their organizations
    if (currentUser.role === 'manager' || currentUser.role === 'demo_manager') {
      logDebug('[PERMISSION CHECK] Checking manager permissions', { requestId: operationId });
      
      // Get manager's organizations
      const managerOrgs = await storage.getUserOrganizations(currentUser.id);
      const managerOrgIds = managerOrgs.map(org => org.organizationId);
      
      logDebug('[PERMISSION CHECK] Manager organizations', { requestId: operationId, metadata: { organizationIds: managerOrgIds } });
      
      if (managerOrgIds.length === 0) {
        logDebug('[PERMISSION CHECK] Manager has no organizations', { requestId: operationId });
        return { allowed: false, reason: 'Manager has no assigned organizations' };
      }

      // Get target user's organizations
      const targetOrgs = await storage.getUserOrganizations(targetUser.id);
      const targetOrgIds = targetOrgs.map(org => org.organizationId);
      
      logDebug('[PERMISSION CHECK] Target user organizations', { requestId: operationId, metadata: { organizationIds: targetOrgIds } });

      // Check if any of the target user's organizations match the manager's organizations
      const hasCommonOrg = targetOrgIds.some(orgId => managerOrgIds.includes(orgId));
      
      if (!hasCommonOrg) {
        logDebug('[PERMISSION CHECK] No common organizations between manager and target user', { requestId: operationId });
        return { allowed: false, reason: 'You can only delete users within your assigned organizations' };
      }

      // Demo managers can only delete demo users
      if (currentUser.role === 'demo_manager') {
        const demoRoles = ['demo_manager', 'demo_tenant', 'demo_resident'];
        if (!demoRoles.includes(targetUser.role)) {
          logWarn('[PERMISSION CHECK] Demo manager trying to delete non-demo user', { requestId: operationId });
          return { allowed: false, reason: 'Demo managers can only delete demo users' };
        }
      }
      
      // Regular managers cannot delete admin users
      if (currentUser.role === 'manager' && targetUser.role === 'admin') {
        logWarn('[PERMISSION CHECK] Manager trying to delete admin user', { requestId: operationId });
        return { allowed: false, reason: 'Managers cannot delete admin users' };
      }

      logInfo('[PERMISSION CHECK] Manager permission granted for common organization', { requestId: operationId });
      return { allowed: true, reason: 'Manager has access to user within shared organization' };
    }

    return { allowed: false, reason: 'Permission denied' };
  }

  /**
   * Perform hard delete of user and all associated data.
   * The database handles most cascading deletes automatically via foreign key constraints.
   */
  async function performHardDelete(userId: string, deletedByUserId: string, operationId: string): Promise<any> {
    logInfo('[HARD DELETE] Starting hard delete for user', { requestId: operationId });

    const deletionSummary = {
      userDeleted: false,
      cascadeTablesAffected: [],
      manualCleanupPerformed: [],
      errors: [] as string[],
    };

    try {
      // Get user data before deletion for logging
      const userData = await storage.getUser(userId);
      if (!userData) {
        throw new Error('User not found at deletion time');
      }

      logDebug('[HARD DELETE] User data before deletion', { requestId: operationId, metadata: { role: userData.role, isActive: userData.isActive } });

      // The database will automatically handle cascade deletes for:
      // - userOrganizations (onDelete: 'cascade')
      // - passwordResetTokens (onDelete: 'cascade') 
      // - userResidences (onDelete: 'cascade')
      // - bookings (onDelete: 'cascade')
      // - userBookingRestrictions (onDelete: 'cascade')
      // - userTimeLimits (onDelete: 'cascade')
      // - userPermissions (references users.id)
      // - commonSpaces.contactPersonId (onDelete: 'set null')

      deletionSummary.cascadeTablesAffected = [
        'userOrganizations',
        'passwordResetTokens',
        'userResidences', 
        'bookings',
        'userBookingRestrictions',
        'userTimeLimits',
        'userPermissions',
        'invitations (invitedByUserId, acceptedBy)',
        'invitationAuditLog (performedBy)',
        'commonSpaces (contactPersonId set to null)',
      ];

      // Manually clean up tables that reference users.id but don't have CASCADE deletes
      logDebug('[HARD DELETE] Cleaning up foreign key references', { requestId: operationId });
      
      try {
        // Delete from improvement suggestions (suggestedBy, assignedTo)
        const improvementSuggestionsDeleted = await db
          .delete(schema.improvementSuggestions)
          .where(
            or(
              eq(schema.improvementSuggestions.suggestedBy, userId),
              eq(schema.improvementSuggestions.assignedTo, userId)
            )
          );
        deletionSummary.manualCleanupPerformed.push('improvementSuggestions');
        logDebug('[HARD DELETE] Deleted improvement suggestions', { requestId: operationId });

        // Delete from actionable items (assignedTo)
        const actionableItemsDeleted = await db
          .delete(schema.actionableItems)
          .where(eq(schema.actionableItems.assignedTo, userId));
        deletionSummary.manualCleanupPerformed.push('actionableItems');
        logDebug('[HARD DELETE] Deleted actionable items', { requestId: operationId });

        // Delete from notifications
        const notificationsDeleted = await db
          .delete(schema.notifications)
          .where(eq(schema.notifications.userId, userId));
        deletionSummary.manualCleanupPerformed.push('notifications');
        logDebug('[HARD DELETE] Deleted notifications', { requestId: operationId });

        // Delete from user notification preferences
        const userNotificationPreferencesDeleted = await db
          .delete(schema.userNotificationPreferences)
          .where(eq(schema.userNotificationPreferences.userId, userId));
        deletionSummary.manualCleanupPerformed.push('userNotificationPreferences');
        logDebug('[HARD DELETE] Deleted user notification preferences', { requestId: operationId });

        // Nullify bills.createdBy (preserve bills)
        await db
          .update(schema.bills)
          .set({ createdBy: null })
          .where(eq(schema.bills.createdBy, userId));
        deletionSummary.manualCleanupPerformed.push('bills (createdBy nullified)');
        logDebug('[HARD DELETE] Nullified bills createdBy', { requestId: operationId });

        // Nullify budgets.createdBy and approvedBy (preserve budgets)
        await db
          .update(schema.budgets)
          .set({ createdBy: null })
          .where(eq(schema.budgets.createdBy, userId));
        await db
          .update(schema.budgets)
          .set({ approvedBy: null })
          .where(eq(schema.budgets.approvedBy, userId));
        deletionSummary.manualCleanupPerformed.push('budgets (createdBy/approvedBy nullified)');
        logDebug('[HARD DELETE] Nullified budgets createdBy and approvedBy', { requestId: operationId });

        // Nullify maintenanceRequests.submittedBy and assignedTo (preserve requests)
        await db
          .update(schema.maintenanceRequests)
          .set({ submittedBy: null })
          .where(eq(schema.maintenanceRequests.submittedBy, userId));
        await db
          .update(schema.maintenanceRequests)
          .set({ assignedTo: null })
          .where(eq(schema.maintenanceRequests.assignedTo, userId));
        deletionSummary.manualCleanupPerformed.push('maintenanceRequests (submittedBy/assignedTo nullified)');
        logDebug('[HARD DELETE] Nullified maintenance requests submittedBy and assignedTo', { requestId: operationId });

        // Nullify demands.submitterId and reviewedBy (preserve demands)
        await db
          .update(schema.demands)
          .set({ submitterId: null })
          .where(eq(schema.demands.submitterId, userId));
        await db
          .update(schema.demands)
          .set({ reviewedBy: null })
          .where(eq(schema.demands.reviewedBy, userId));
        deletionSummary.manualCleanupPerformed.push('demands (submitterId/reviewedBy nullified)');
        logDebug('[HARD DELETE] Nullified demands submitterId and reviewedBy', { requestId: operationId });

        // Nullify documents.uploadedById (preserve documents)
        await db
          .update(schema.documents)
          .set({ uploadedById: null })
          .where(eq(schema.documents.uploadedById, userId));
        deletionSummary.manualCleanupPerformed.push('documents (uploadedById nullified)');
        logDebug('[HARD DELETE] Nullified documents uploadedById', { requestId: operationId });

        // Nullify invoices.createdBy (preserve invoices)
        const invoices = await import('@shared/schemas/invoices');
        await db
          .update(invoices.invoices)
          .set({ createdBy: null })
          .where(eq(invoices.invoices.createdBy, userId));
        deletionSummary.manualCleanupPerformed.push('invoices (createdBy nullified)');
        logDebug('[HARD DELETE] Nullified invoices createdBy', { requestId: operationId });

        // Delete demand comments (these are user-generated comments, not preserved)
        const demandCommentsDeleted = await db
          .delete(schema.demandComments)
          .where(eq(schema.demandComments.commenterId, userId));
        deletionSummary.manualCleanupPerformed.push('demandComments');
        logDebug('[HARD DELETE] Deleted demand comments', { requestId: operationId });

        logInfo('[HARD DELETE] Foreign key reference cleanup completed', { requestId: operationId });
      } catch (cleanupError) {
        logWarn('[HARD DELETE] Some cleanup operations failed', { requestId: operationId });
        deletionSummary.errors.push(`Cleanup warning: ${cleanupError.message}`);
        // Continue with deletion even if some cleanup fails
      }

      // Perform the hard delete using raw database query to ensure complete removal
      logInfo('[HARD DELETE] Executing hard delete from database', { requestId: operationId });
      
      const deleteResult = await db
        .delete(schema.users)
        .where(eq(schema.users.id, userId))
        .returning({ id: schema.users.id, email: schema.users.email });

      if (deleteResult.length === 0) {
        throw new Error('Failed to delete user from database');
      }

      deletionSummary.userDeleted = true;
      logInfo('[HARD DELETE] User successfully deleted from database', { requestId: operationId });

      // Clear any cached data related to this user
      try {
        CacheInvalidator.invalidateUserCaches(userId);
        deletionSummary.manualCleanupPerformed.push('Query cache cleared');
        logDebug('[HARD DELETE] User cache invalidated', { requestId: operationId });
      } catch (cacheError) {
        logWarn('[HARD DELETE] Cache invalidation failed', { requestId: operationId });
        deletionSummary.errors.push('Cache invalidation failed');
      }

      logInfo('[HARD DELETE] Hard delete completed successfully', { requestId: operationId });
      return deletionSummary;

    } catch (error: any) {
      logError('[HARD DELETE] Hard delete failed', error);
      deletionSummary.errors.push(error.message || 'Unknown error during deletion');
      throw new Error(`Hard delete failed: ${error.message}`);
    }
  }

  /**
   * GET /api/user-organizations - Get current user's organizations.
   */
  app.get('/api/user-organizations', requireAuth, asyncHandler(async (req: any, res) => {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      const organizations = await storage.getUserOrganizations(currentUser.id);
      res.json(organizations);
    }, { errorMessage: 'Failed to get user organizations', errorLogPrefix: '❌ Error getting user organizations', extraErrorFields: { error: 'Internal server error' } }));

  /**
   * GET /api/user-residences - Get current user's residences.
   */
  app.get('/api/user-residences', requireAuth, asyncHandler(async (req: any, res) => {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      const residences = await storage.getUserResidences(currentUser.id);
      res.json(residences);
    }, { errorMessage: 'Failed to get user residences', errorLogPrefix: '❌ Error getting user residences', extraErrorFields: { error: 'Internal server error' } }));

  /**
   * GET /api/admin/all-user-organizations - Get user-organization relationships (admin: all, manager: filtered by their orgs).
   */
  app.get('/api/admin/all-user-organizations', requireAuth, async (req: any, res) => {
    logDebug('[API] all-user-organizations endpoint called');
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
      logError('Error getting all user organizations', error);
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
    logDebug('[API] all-user-residences endpoint called', { userId: req.user?.id });
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
      logError('Error getting all user residences', error);
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

      logError('Error fetching user permissions', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch user permissions',
      });
    }
  });

  /**
   * PUT /api/users/:id/organizations - Updates user's organization assignments.
   * SECURITY FIX: Implements proper scope validation for managers
   * Admin: can assign/remove any organization
   * Manager: can only assign/remove organizations within their scope, preserves out-of-scope assignments
   */
  app.put('/api/users/:id/organizations', requireAuth, 
    createInvalidationMiddleware('userOrganization', {
      extractEntityId: (req) => req.params.id,
      extractAffectedUsers: async (req) => [req.params.id],
      operation: 'update'
    }),
    asyncHandler(async (req: any, res) => {
      const currentUser = req.user || req.session?.user;
      const { id: userId } = req.params;
      const { organizationIds } = req.body;

      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Only admins and managers can modify organization assignments
      if (!['admin', 'manager', 'demo_manager'].includes(currentUser.role)) {
        return res.status(403).json({
          message: 'Only administrators and managers can modify organization assignments',
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

      // SECURITY FIX: For managers, validate they can modify this user and validate scope
      if (['manager', 'demo_manager'].includes(currentUser.role)) {
        // Get current user's accessible organizations
        const currentUserOrgs = await storage.getUserOrganizations(currentUser.id);
        const currentUserOrgIds = currentUserOrgs.map(org => org.organizationId);
        
        if (currentUserOrgIds.length === 0) {
          return res.status(403).json({
            message: 'Manager has no organization access',
            code: 'NO_ORGANIZATION_ACCESS',
          });
        }

        // SECURITY FIX: Validate manager can modify this user - target user must have overlap with manager's organizations
        const targetUserOrgs = await storage.getUserOrganizations(userId);
        const targetUserOrgIds = targetUserOrgs.map(org => org.organizationId);
        
        const hasOverlap = targetUserOrgIds.some(orgId => currentUserOrgIds.includes(orgId));
        
        if (!hasOverlap && targetUserOrgIds.length > 0) {
          logWarn('[SECURITY] Manager attempted to modify user with no organizational overlap', { userId: currentUser.id, metadata: { targetUserId: userId } });
          return res.status(403).json({
            message: 'Cannot modify users outside your organization scope',
            code: 'USER_SCOPE_VIOLATION',
          });
        }

        // SECURITY FIX: Validate new assignments are within manager's scope
        if (organizationIds.length > 0) {
          const invalidOrgIds = organizationIds.filter((orgId: string) => 
            !currentUserOrgIds.includes(orgId)
          );
          
          if (invalidOrgIds.length > 0) {
            logWarn('[SECURITY] Manager attempted to assign out-of-scope organizations', { userId: currentUser.id, metadata: { invalidOrgIds } });
            return res.status(403).json({
              message: 'Cannot assign organizations outside your scope',
              code: 'ORGANIZATION_SCOPE_VIOLATION',
              invalidOrganizations: invalidOrgIds,
            });
          }
        }

        // SECURITY FIX: Scoped deletion - only delete assignments within manager's scope, preserve out-of-scope assignments
        logInfo('[SECURITY] Manager updating user organizations - using scoped deletion', { userId: currentUser.id, metadata: { targetUserId: userId } });
        
        // Get current user's organization assignments to understand what can be modified
        const currentAssignments = await db
          .select()
          .from(schema.userOrganizations)
          .where(eq(schema.userOrganizations.userId, userId));

        // Separate assignments into in-scope and out-of-scope
        const inScopeAssignments = currentAssignments.filter(assignment => 
          currentUserOrgIds.includes(assignment.organizationId)
        );
        const outOfScopeAssignments = currentAssignments.filter(assignment => 
          !currentUserOrgIds.includes(assignment.organizationId)
        );

        logDebug('[SECURITY] User assignment scope analysis', { userId, metadata: { inScopeCount: inScopeAssignments.length, outOfScopeCount: outOfScopeAssignments.length } });

        // Delete only in-scope assignments - preserve out-of-scope assignments
        // Wrap delete + reinsert in a transaction so a partial failure
        // (e.g. duplicate-row violation on the insert) doesn't leave the
        // user with their previous in-scope assignments wiped out and
        // nothing in their place.
        if (inScopeAssignments.length > 0 || organizationIds.length > 0) {
          const inScopeOrgIds = inScopeAssignments.map(assignment => assignment.organizationId);
          await db.transaction(async (tx) => {
            if (inScopeAssignments.length > 0) {
              await tx
                .delete(schema.userOrganizations)
                .where(
                  and(
                    eq(schema.userOrganizations.userId, userId),
                    inArray(schema.userOrganizations.organizationId, inScopeOrgIds)
                  )
                );
            }
            if (organizationIds.length > 0) {
              const newAssignments = organizationIds.map((orgId: string) => ({
                userId,
                organizationId: orgId,
                organizationRole: user.role,
                isActive: true,
              }));
              await tx.insert(schema.userOrganizations).values(newAssignments);
            }
          });
          logInfo('[SECURITY] Replaced in-scope assignments atomically', { metadata: { deletedCount: inScopeAssignments.length, preservedCount: outOfScopeAssignments.length, addedCount: organizationIds.length } });
        }

        logInfo('[SECURITY] Manager successfully updated user organizations within scope', { userId: currentUser.id, metadata: { targetUserId: userId } });
      } else {
        // Admin can modify any assignments - original behavior preserved
        logInfo('[ADMIN] Admin updating user organizations - full access', { userId: currentUser.id, metadata: { targetUserId: userId } });

        // Wrap the delete-all + reinsert in a transaction so an admin
        // assignment update is all-or-nothing.
        await db.transaction(async (tx) => {
          await tx.delete(schema.userOrganizations).where(eq(schema.userOrganizations.userId, userId));
          if (organizationIds.length > 0) {
            const newAssignments = organizationIds.map((orgId: string) => ({
              userId,
              organizationId: orgId,
              organizationRole: user.role,
              isActive: true,
            }));
            await tx.insert(schema.userOrganizations).values(newAssignments);
          }
        });
      }

      res.json({
        message: 'Organization assignments updated successfully',
        userId,
        organizationIds,
      });
    }, { errorMessage: 'Failed to update organization assignments', errorLogPrefix: '❌ Error updating organization assignments', extraErrorFields: { error: 'Internal server error' } }));

  /**
   * PUT /api/users/:id/buildings - Updates user's building assignments.
   * Admin and Manager: can assign/remove buildings they have access to
   */
  app.put('/api/users/:id/buildings', requireAuth, asyncHandler(async (req: any, res) => {
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

      // Remove existing assignments and add the new set atomically so a
      // partial failure (e.g. duplicate (userId, buildingId) row) does
      // not wipe out the user's prior assignments without replacing them.
      await db.transaction(async (tx) => {
        await tx.delete(schema.userBuildings).where(eq(schema.userBuildings.userId, userId));
        if (buildingIds.length > 0) {
          const newAssignments = buildingIds.map((buildingId: string) => ({
            userId,
            buildingId,
            relationshipType: user.role === 'manager' ? 'manager' : 'tenant',
            isActive: true,
          }));
          await tx.insert(schema.userBuildings).values(newAssignments);
        }
      });

      res.json({
        message: 'Building assignments updated successfully',
        userId,
        buildingIds,
      });
    }, { errorMessage: 'Failed to update building assignments', errorLogPrefix: '❌ Error updating building assignments', extraErrorFields: { error: 'Internal server error' } }));

  /**
   * GET /api/users/me/residences - Get current user's accessible residences, optionally filtered by building
   */
  app.get('/api/users/me/residences', requireAuth, asyncHandler(async (req: any, res) => {
      logDebug('[RESIDENCES API] /api/users/me/residences called', { userId: req.user?.id, metadata: { role: req.user?.role, queryParams: req.query } });
      
      const userId = req.user.id;
      const { building_id } = req.query;
      logDebug('[USER_MANAGEMENT] Fetching residences for user', { userId, metadata: { role: req.user.role, buildingId: building_id } });

      // For all user roles, get only their assigned residences from user_residences table
      // This ensures strict access control: users can only see residences they're explicitly assigned to
      let whereConditions = [
        eq(schema.userResidences.userId, userId),
        eq(schema.userResidences.isActive, true),
        eq(schema.residences.isActive, true)
      ];

      // Add building filter if specified
      if (building_id) {
        whereConditions.push(eq(schema.residences.buildingId, building_id));
      }

      const userResidences = await db
        .select({
          id: schema.residences.id,
          unitNumber: schema.residences.unitNumber,
          floor: schema.residences.floor,
          buildingId: schema.residences.buildingId,
          buildingName: schema.buildings.name,
        })
        .from(schema.userResidences)
        .innerJoin(schema.residences, eq(schema.userResidences.residenceId, schema.residences.id))
        .innerJoin(schema.buildings, eq(schema.residences.buildingId, schema.buildings.id))
        .where(and(...whereConditions))
        .orderBy(schema.buildings.name, sql`CAST(${schema.residences.unitNumber} AS INTEGER)`);

      logDebug('[USER_MANAGEMENT] Returning residences for user', { userId, metadata: { count: userResidences.length, role: req.user.role } });
      return res.json(userResidences);
    }, { errorMessage: 'Failed to get user residences', errorLogPrefix: '❌ Error getting user residences', extraErrorFields: { error: 'Internal server error' } }));

  /**
   * GET /api/users/:id/residences - Get user's accessible residences.
   */
  app.get('/api/users/:id/residences', requireAuth, asyncHandler(async (req: any, res) => {
      const currentUser = req.user || req.session?.user;
      const { id: userId } = req.params;

      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // All users can only access their own residences
      if (currentUser.id !== userId) {
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
    }, { errorMessage: 'Failed to get user residences', errorLogPrefix: '❌ Error getting user residences', extraErrorFields: { error: 'Internal server error' } }));

  /**
   * GET /api/users/me/buildings - Get current user's accessible buildings based on their residences.
   */
  app.get('/api/users/me/buildings', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { has_common_spaces, organization_id } = req.query;
      logDebug('[USER_MANAGEMENT] Fetching buildings for user', { userId, metadata: { role: req.user.role, hasCommonSpaces: has_common_spaces, organizationId: organization_id } });

      // For residents and tenants (including demo roles), get buildings through their residences  
      // Note: demo_manager uses userBuildings table like regular managers, so it falls through to the manager path
      if (['resident', 'tenant', 'demo_resident', 'demo_tenant'].includes(req.user.role)) {
        
        // Get user's residences with building information using Drizzle
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
          return res.json([]);
        }

        // Get unique building IDs from user's residences
        const buildingIds = [...new Set(userResidences.map(ur => ur.buildingId).filter(Boolean))];
        
        if (buildingIds.length === 0) {
          return res.json([]);
        }

        // Fetch building details with optional common spaces and organization filtering
        let buildingQuery;
        
        // Build the base where conditions
        const whereConditions = [
          inArray(schema.buildings.id, buildingIds),
          eq(schema.buildings.isActive, true)
        ];
        
        // Add organization filter if specified
        if (organization_id) {
          whereConditions.push(eq(schema.buildings.organizationId, organization_id));
        }
        
        if (has_common_spaces === 'true') {
          // Only buildings with common spaces
          buildingQuery = db
            .selectDistinct({
              id: schema.buildings.id,
              name: schema.buildings.name,
              address: schema.buildings.address,
              city: schema.buildings.city,
              province: schema.buildings.province,
              postalCode: schema.buildings.postalCode,
              buildingType: schema.buildings.buildingType,
              totalUnits: schema.buildings.totalUnits,
              organizationId: schema.buildings.organizationId,
              isActive: schema.buildings.isActive,
            })
            .from(schema.buildings)
            .innerJoin(schema.commonSpaces, eq(schema.commonSpaces.buildingId, schema.buildings.id))
            .where(and(...whereConditions))
            .orderBy(schema.buildings.name);
        } else {
          // All buildings
          buildingQuery = db
            .select({
              id: schema.buildings.id,
              name: schema.buildings.name,
              address: schema.buildings.address,
              city: schema.buildings.city,
              province: schema.buildings.province,
              postalCode: schema.buildings.postalCode,
              buildingType: schema.buildings.buildingType,
              totalUnits: schema.buildings.totalUnits,
              organizationId: schema.buildings.organizationId,
              isActive: schema.buildings.isActive,
            })
            .from(schema.buildings)
            .where(and(...whereConditions))
            .orderBy(schema.buildings.name);
        }

        const buildingDetails = await buildingQuery;
        logDebug('[USER_MANAGEMENT] Returning buildings for resident/tenant', { userId, metadata: { count: buildingDetails.length } });
        return res.json(buildingDetails);
      }

      // For admins, get ALL buildings
      if (req.user.role === 'admin') {
        let buildingQuery;
        
        const whereConditions = [eq(schema.buildings.isActive, true)];
        
        // Add organization filter if specified
        if (organization_id) {
          whereConditions.push(eq(schema.buildings.organizationId, organization_id));
        }
        
        if (has_common_spaces === 'true') {
          // Only buildings with common spaces
          buildingQuery = db
            .selectDistinct({
              id: schema.buildings.id,
              name: schema.buildings.name,
              address: schema.buildings.address,
              city: schema.buildings.city,
              province: schema.buildings.province,
              postalCode: schema.buildings.postalCode,
              buildingType: schema.buildings.buildingType,
              totalUnits: schema.buildings.totalUnits,
              organizationId: schema.buildings.organizationId,
              isActive: schema.buildings.isActive,
            })
            .from(schema.buildings)
            .innerJoin(schema.commonSpaces, eq(schema.commonSpaces.buildingId, schema.buildings.id))
            .where(and(...whereConditions))
            .orderBy(schema.buildings.name);
        } else {
          // All buildings
          buildingQuery = db
            .select({
              id: schema.buildings.id,
              name: schema.buildings.name,
              address: schema.buildings.address,
              city: schema.buildings.city,
              province: schema.buildings.province,
              postalCode: schema.buildings.postalCode,
              buildingType: schema.buildings.buildingType,
              totalUnits: schema.buildings.totalUnits,
              organizationId: schema.buildings.organizationId,
              isActive: schema.buildings.isActive,
            })
            .from(schema.buildings)
            .where(and(...whereConditions))
            .orderBy(schema.buildings.name);
        }
        
        const buildingDetails = await buildingQuery;

        logDebug('[USER_MANAGEMENT] Returning buildings for admin', { userId, metadata: { count: buildingDetails.length } });
        return res.json(buildingDetails);
      }

      // For managers, get buildings from userBuildings table
      const userBuildingsData = await db
        .select({
          buildingId: schema.userBuildings.buildingId,
        })
        .from(schema.userBuildings)
        .where(and(
          eq(schema.userBuildings.userId, userId),
          eq(schema.userBuildings.isActive, true)
        ));

      if (userBuildingsData.length === 0) {
        return res.json([]);
      }

      // Get unique building IDs
      const buildingIds = [...new Set(userBuildingsData.map(ub => ub.buildingId).filter(Boolean))];

      if (buildingIds.length === 0) {
        return res.json([]);
      }

      // Build the where conditions
      const whereConditions = [
        inArray(schema.buildings.id, buildingIds),
        eq(schema.buildings.isActive, true)
      ];

      // Add organization filter if specified
      if (organization_id) {
        whereConditions.push(eq(schema.buildings.organizationId, organization_id));
      }

      // Build the query with optional common spaces filtering
      let buildingQuery;
      
      if (has_common_spaces === 'true') {
        // Only buildings with common spaces
        buildingQuery = db
          .selectDistinct({
            id: schema.buildings.id,
            name: schema.buildings.name,
            address: schema.buildings.address,
            city: schema.buildings.city,
            province: schema.buildings.province,
            postalCode: schema.buildings.postalCode,
            buildingType: schema.buildings.buildingType,
            totalUnits: schema.buildings.totalUnits,
            organizationId: schema.buildings.organizationId,
            isActive: schema.buildings.isActive,
          })
          .from(schema.buildings)
          .innerJoin(schema.commonSpaces, eq(schema.commonSpaces.buildingId, schema.buildings.id))
          .where(and(...whereConditions))
          .orderBy(schema.buildings.name);
      } else {
        // All buildings
        buildingQuery = db
          .select({
            id: schema.buildings.id,
            name: schema.buildings.name,
            address: schema.buildings.address,
            city: schema.buildings.city,
            province: schema.buildings.province,
            postalCode: schema.buildings.postalCode,
            buildingType: schema.buildings.buildingType,
            totalUnits: schema.buildings.totalUnits,
            organizationId: schema.buildings.organizationId,
            isActive: schema.buildings.isActive,
          })
          .from(schema.buildings)
          .where(and(...whereConditions))
          .orderBy(schema.buildings.name);
      }

      const buildingDetails = await buildingQuery;

      logDebug('[USER_MANAGEMENT] Returning buildings for manager', { userId, metadata: { count: buildingDetails.length, source: 'userBuildings table' } });
      res.json(buildingDetails);

    } catch (error) {
      logError('Error fetching user buildings', error);
      res.status(500).json({ 
        error: 'Failed to fetch user buildings',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  /**
   * GET /api/users/:id/buildings - Get user's accessible buildings based on their residences.
   */
  app.get('/api/users/:id/buildings', requireAuth, asyncHandler(async (req: any, res) => {
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
          constructionDate: schema.buildings.constructionDate,
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
        ))
        .orderBy(schema.buildings.name);

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
    }, { errorMessage: 'Failed to get user buildings', errorLogPrefix: '❌ Error getting user buildings', extraErrorFields: { error: 'Internal server error' } }));

  /**
   * PUT /api/users/:id/residences - Updates user's residence assignments.
   * Admin: can assign/remove any residence
   * Manager: can assign/remove residences within their organizations only.
   */
  app.put('/api/users/:id/residences', requireAuth,
    createInvalidationMiddleware('userResidence', {
      extractEntityId: (req) => req.params.id,
      extractAffectedUsers: async (req) => [req.params.id],
      operation: 'update'
    }),
    asyncHandler(async (req: any, res) => {
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

      // Replace residence assignments atomically so a partial failure
      // (e.g. duplicate (userId, residenceId) row, FK violation) doesn't
      // strip a user of their existing residences with no replacement.
      await db.transaction(async (tx) => {
        await tx.delete(schema.userResidences).where(eq(schema.userResidences.userId, userId));
        if (residenceAssignments.length > 0) {
          const newAssignments = residenceAssignments.map((assignment: any) => ({
            userId,
            residenceId: assignment.residenceId,
            relationshipType: assignment.relationshipType || 'tenant',
            startDate: assignment.startDate || new Date().toISOString().split('T')[0],
            endDate: assignment.endDate || null,
            isActive: true,
          }));
          await tx.insert(schema.userResidences).values(newAssignments);
        }
      });

      res.json({
        message: 'Residence assignments updated successfully',
        userId,
        assignmentCount: residenceAssignments.length,
      });
    }, { errorMessage: 'Failed to update residence assignments', errorLogPrefix: '❌ Error updating residence assignments', extraErrorFields: { error: 'Internal server error' } }));

  /**
   * GET /api/users/me/organizations - Get organizations accessible to current user.
   * Used by invite form to populate organization dropdown.
   */
  app.get('/api/users/me/organizations', requireAuth, asyncHandler(async (req: any, res) => {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      logDebug('Fetching user-accessible organizations', { userId: currentUser.id, metadata: { role: currentUser.role } });

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
      logDebug('Found accessible organizations for user', { userId: currentUser.id, metadata: { count: accessibleOrganizations.length } });

      // Return array directly (not wrapped in object) - same format as /api/organizations
      res.json(accessibleOrganizations);
    }, { errorMessage: 'Failed to fetch user organizations', errorLogPrefix: '❌ Error fetching user organizations', extraErrorFields: { error: 'Internal server error' } }));

  /**
   * GET /api/users/me/data-export - Download user data for Law 25 compliance.
   */
  app.get('/api/users/me/data-export', requireAuth, asyncHandler(async (req: any, res) => {
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
        buildContentDisposition(
          `user-data-export-${currentUser.id}-${new Date().toISOString().split('T')[0]}.json`,
          { type: 'attachment' }
        )
      );
      res.json(exportData);
    }, { errorMessage: 'Failed to export user data', errorLogPrefix: '❌ Error exporting user data', extraErrorFields: { error: 'Internal server error' } }));

  /**
   * POST /api/users/me/delete-account - Complete account deletion for Law 25 compliance.
   */
  app.post('/api/users/me/delete-account', requireAuth, asyncHandler(async (req: any, res) => {
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

      // Wrap the full account-deletion sequence in one transaction so
      // a mid-way failure cannot leave the user partially nullified.
      // Statements are serialised because a drizzle transaction shares
      // one connection and cannot multiplex Promise.all writes.
      await db.transaction(async (tx) => {
        // Step 1: Delete comments made by the user on demands
        await tx.delete(schema.demandComments).where(eq(schema.demandComments.commenterId, currentUser.id));

        // Step 2: SET NULL for all user references to preserve bills, demands, documents, and maintenance requests
        // Preserve demands - nullify submitter and reviewer references
        await tx.update(schema.demands).set({ submitterId: null }).where(eq(schema.demands.submitterId, currentUser.id));
        await tx.update(schema.demands).set({ reviewedBy: null }).where(eq(schema.demands.reviewedBy, currentUser.id));

        // Preserve maintenance requests - nullify submitter and assignee references
        await tx.update(schema.maintenanceRequests).set({ submittedBy: null }).where(eq(schema.maintenanceRequests.submittedBy, currentUser.id));
        await tx.update(schema.maintenanceRequests).set({ assignedTo: null }).where(eq(schema.maintenanceRequests.assignedTo, currentUser.id));

        // Preserve documents - nullify uploader reference
        await tx.update(schema.documents).set({ uploadedById: null }).where(eq(schema.documents.uploadedById, currentUser.id));

        // Preserve bills - nullify creator reference
        await tx.update(schema.bills).set({ createdBy: null }).where(eq(schema.bills.createdBy, currentUser.id));

        // Preserve invoices - nullify creator reference
        await tx.update(schema.invoices).set({ createdBy: null }).where(eq(schema.invoices.createdBy, currentUser.id));

        // Preserve budgets - nullify creator and approver references
        await tx.update(schema.budgets).set({ createdBy: null }).where(eq(schema.budgets.createdBy, currentUser.id));
        await tx.update(schema.budgets).set({ approvedBy: null }).where(eq(schema.budgets.approvedBy, currentUser.id));
        await tx.update(schema.monthlyBudgets).set({ approvedBy: null }).where(eq(schema.monthlyBudgets.approvedBy, currentUser.id));

        // Step 3: Delete records with NOT NULL user references (cannot be nullified)
        // Delete communications and meetings created by user (NOT NULL createdBy)
        await tx.delete(schema.generalCommunications).where(eq(schema.generalCommunications.createdBy, currentUser.id));
        await tx.delete(schema.meetings).where(eq(schema.meetings.createdBy, currentUser.id));

        // Delete notification configurations and dispatch logs (NOT NULL user references)
        await tx.delete(schema.notificationDispatchLog).where(eq(schema.notificationDispatchLog.userId, currentUser.id));
        await tx.delete(schema.notificationConfigurations).where(eq(schema.notificationConfigurations.createdBy, currentUser.id));

        // Delete maintenance projects created by user (NOT NULL createdBy)
        await tx.delete(schema.maintenanceProjects).where(eq(schema.maintenanceProjects.createdBy, currentUser.id));

        // Delete element documents and history (NOT NULL user references)
        await tx.delete(schema.elementDocuments).where(eq(schema.elementDocuments.uploadedBy, currentUser.id));
        await tx.delete(schema.elementHistory).where(eq(schema.elementHistory.createdBy, currentUser.id));

        // Delete SSL certificates created by user (NOT NULL createdBy)
        await tx.delete(schema.sslCertificates).where(eq(schema.sslCertificates.createdBy, currentUser.id));

        // Step 4: Delete user-specific data that should be removed with the user
        // Delete user relationships
        await tx.delete(schema.userOrganizations).where(eq(schema.userOrganizations.userId, currentUser.id));
        await tx.delete(schema.userResidences).where(eq(schema.userResidences.userId, currentUser.id));

        // Delete user-specific content
        await tx.delete(schema.notifications).where(eq(schema.notifications.userId, currentUser.id));

        // Delete invitations
        await tx.delete(schema.invitations).where(eq(schema.invitations.email, currentUser.email));

        // Delete user notification preferences
        await tx.delete(schema.userNotificationPreferences).where(eq(schema.userNotificationPreferences.userId, currentUser.id));

        // Finally, delete the user account itself
        await tx.delete(schema.users).where(eq(schema.users.id, currentUser.id));
      });

      // Log the deletion for audit purposes
      logInfo('User account deleted', { userId: currentUser.id, action: 'account_deletion', metadata: { reason: reason || 'Not provided' } });

      // Clear session
      if (req.session) {
        req.session.destroy((err: any) => {
          if (err) {
            logError('Failed to destroy session after account deletion', err);
          }
        });
      }

      res.json({
        message:
          'Account successfully deleted. All personal data has been permanently removed from our systems.',
        deletionDate: new Date().toISOString(),
      });
    }, { errorMessage: 'Failed to delete account. Please contact support.', errorLogPrefix: '❌ Error deleting account', extraErrorFields: { error: 'Internal server error' } }));

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

      // Only admins and managers can delete other users' accounts
      if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
        return res.status(403).json({
          message: 'Only administrators and managers can delete user accounts',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }
      
      // Additional safety check: Log this critical operation
      logWarn('CRITICAL: Admin attempting to delete user', { userId: currentUser.id, action: 'delete_user', metadata: { targetUserId } });

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

      // Validate that confirmEmail is provided
      if (!confirmEmail || typeof confirmEmail !== 'string' || confirmEmail.trim() === '') {
        return res.status(400).json({
          message: 'Email confirmation is required to delete user account',
          code: 'MISSING_EMAIL_CONFIRMATION',
        });
      }

      // Verify email confirmation matches
      if (confirmEmail.trim() !== targetUser.email) {
        return res.status(400).json({
          message: 'Email confirmation does not match',
          code: 'EMAIL_MISMATCH',
        });
      }

      // Wrap the full admin-driven account-deletion sequence in one
      // transaction so a mid-way failure cannot leave the target user
      // half-purged. Statements are serialised because a drizzle
      // transaction shares one connection and cannot multiplex
      // Promise.all writes.
      await db.transaction(async (tx) => {
        // Step 1: Delete comments made by the user on demands
        await tx.delete(schema.demandComments).where(eq(schema.demandComments.commenterId, targetUserId));

        // Step 2: SET NULL for all user references to preserve bills, demands, documents, and maintenance requests
        // Preserve demands - nullify submitter and reviewer references
        await tx.update(schema.demands).set({ submitterId: null }).where(eq(schema.demands.submitterId, targetUserId));
        await tx.update(schema.demands).set({ reviewedBy: null }).where(eq(schema.demands.reviewedBy, targetUserId));

        // Preserve maintenance requests - nullify submitter and assignee references
        await tx.update(schema.maintenanceRequests).set({ submittedBy: null }).where(eq(schema.maintenanceRequests.submittedBy, targetUserId));
        await tx.update(schema.maintenanceRequests).set({ assignedTo: null }).where(eq(schema.maintenanceRequests.assignedTo, targetUserId));

        // Preserve documents - nullify uploader reference
        await tx.update(schema.documents).set({ uploadedById: null }).where(eq(schema.documents.uploadedById, targetUserId));

        // Preserve bills - nullify creator reference
        await tx.update(schema.bills).set({ createdBy: null }).where(eq(schema.bills.createdBy, targetUserId));

        // Preserve invoices - nullify creator reference
        await tx.update(schema.invoices).set({ createdBy: null }).where(eq(schema.invoices.createdBy, targetUserId));

        // Preserve budgets - nullify creator and approver references
        await tx.update(schema.budgets).set({ createdBy: null }).where(eq(schema.budgets.createdBy, targetUserId));
        await tx.update(schema.budgets).set({ approvedBy: null }).where(eq(schema.budgets.approvedBy, targetUserId));
        await tx.update(schema.monthlyBudgets).set({ approvedBy: null }).where(eq(schema.monthlyBudgets.approvedBy, targetUserId));

        // Step 3: Delete records with NOT NULL user references (cannot be nullified)
        // Delete communications and meetings created by user (NOT NULL createdBy)
        await tx.delete(schema.generalCommunications).where(eq(schema.generalCommunications.createdBy, targetUserId));
        await tx.delete(schema.meetings).where(eq(schema.meetings.createdBy, targetUserId));

        // Delete notification configurations and dispatch logs (NOT NULL user references)
        await tx.delete(schema.notificationDispatchLog).where(eq(schema.notificationDispatchLog.userId, targetUserId));
        await tx.delete(schema.notificationConfigurations).where(eq(schema.notificationConfigurations.createdBy, targetUserId));

        // Delete maintenance projects created by user (NOT NULL createdBy)
        await tx.delete(schema.maintenanceProjects).where(eq(schema.maintenanceProjects.createdBy, targetUserId));

        // Delete element documents and history (NOT NULL user references)
        await tx.delete(schema.elementDocuments).where(eq(schema.elementDocuments.uploadedBy, targetUserId));
        await tx.delete(schema.elementHistory).where(eq(schema.elementHistory.createdBy, targetUserId));

        // Delete SSL certificates created by user (NOT NULL createdBy)
        await tx.delete(schema.sslCertificates).where(eq(schema.sslCertificates.createdBy, targetUserId));

        // Step 4: Delete user-specific data that should be removed with the user
        // Delete user relationships
        await tx.delete(schema.userOrganizations).where(eq(schema.userOrganizations.userId, targetUserId));
        await tx.delete(schema.userResidences).where(eq(schema.userResidences.userId, targetUserId));

        // Delete invitations
        await tx.delete(schema.invitations).where(eq(schema.invitations.email, targetUser.email));

        // Delete user notification preferences
        await tx.delete(schema.userNotificationPreferences).where(eq(schema.userNotificationPreferences.userId, targetUserId));

        // Delete notifications
        await tx.delete(schema.notifications).where(eq(schema.notifications.userId, targetUserId));

        // Finally, delete the user account itself
        await tx.delete(schema.users).where(eq(schema.users.id, targetUserId));
      });

      // Clear all caches to ensure the user list updates immediately
      queryCache.invalidate('users', 'all_users');
      queryCache.invalidate('users', `user:${targetUserId}`);
      queryCache.invalidate('users', `user_email:${targetUser.email}`);

      // Log the deletion for audit purposes
      logInfo('User account deleted by admin', { userId: currentUser.id, action: 'admin_delete_user', metadata: { targetUserId, reason: reason || 'Not provided' } });

      res.json({
        message: 'User account and all associated data have been permanently deleted',
        deletedUserId: targetUserId,
        deletedUserEmail: targetUser.email,
      });
    } catch (error: any) {
      logError('Error deleting user account', error, { userId: req.params.id, metadata: { confirmEmailProvided: !!req.body.confirmEmail } });
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete user account',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  });

  /**
   * POST /api/users/me/change-password - Change current user's password.
   */
  app.post('/api/users/me/change-password', requireAuth, asyncHandler(async (req: any, res) => {
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
    }, { errorMessage: 'Failed to change password', errorLogPrefix: '❌ Error changing password', extraErrorFields: { error: 'Internal server error' } }));

  /**
   * POST /api/users/demo - Creates a demo user directly without invitation
   */
  app.post('/api/users/demo', requireAuth, asyncHandler(async (req: any, res) => {
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
    }, { errorMessage: 'Failed to create demo user', errorLogPrefix: '❌ Error creating demo user', extraErrorFields: { error: 'Internal server error' } }));

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

        // SECURITY FIX: Ensure the target organization is within the manager's own scope
        const managerOrgs = await storage.getUserOrganizations(currentUser.id);
        const managerOrgIds = managerOrgs.map((o: any) => o.organizationId);
        if (!managerOrgIds.includes(organizationId)) {
          logWarn('[SECURITY] Manager attempted to invite into out-of-scope organization', {
            userId: currentUser.id,
            metadata: { targetOrganizationId: organizationId },
          });
          return res.status(403).json({
            message: 'Cannot create invitations for organizations outside your scope',
            code: 'ORGANIZATION_SCOPE_VIOLATION',
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

      // Soft-replace prior pending invitations for the same
      // (organization, email, residence) tuple, insert the new invitation
      // row, and write the lifecycle audit log entries. Shared with the MCP
      // `invite_user` tool via createInvitationWithSoftReplace so the two
      // paths cannot drift.
      const ipAddress =
        (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
        req.ip ||
        null;
      const userAgent = (req.headers['user-agent'] as string | undefined) || null;
      const { invitation: newInvitation } =
        await createInvitationWithSoftReplace({
          organizationId,
          residenceId: residenceId || null,
          email,
          role: role as InvitationRole,
          token,
          tokenHash,
          expiresAt: new Date(expiresAt),
          personalMessage: personalMessage || null,
          invitedByUserId: currentUser.id,
          audit: {
            source: 'rest',
            route: 'POST /api/invitations',
            ipAddress,
            userAgent,
          },
          logError: (msg, err) => logError(msg, err),
        });

      // Get organization details for email
      const [organization] = await db
        .select()
        .from(schema.organizations)
        .where(eq(schema.organizations.id, organizationId))
        .limit(1);

      // Send invitation email
      const organizationName = organization?.name || 'Koveo Gestion';
      const inviterName = `${currentUser.firstName || currentUser.email} ${currentUser.lastName || ''}`.trim();
      
      // Construct the base URL - use REPLIT_DOMAINS for dev, APP_URL for production, localhost as fallback
      const baseUrl = getBaseUrlFromReplitDomains() || process.env.APP_URL || 'http://localhost:5000';
      const invitationUrl = `${baseUrl}/accept-invitation?token=${token}`;
      
      const emailSent = await emailService.sendInvitationEmail(
        email,
        inviterName,
        invitationUrl,
        organizationName,
        'fr'
      );

      // Log invitation creation. Email addresses are masked at info level
      // for Quebec Law 25 compliance; full details remain available at
      // debug level for local development.
      logInfo('Invitation created', {
        id: newInvitation.id,
        email,
        role,
        organizationId,
        invitedBy: currentUser.email,
        emailSent,
      });
      logDebug('Invitation created (full email)', {
        metadata: {
          id: newInvitation.id,
          email,
          role,
          organizationId,
          invitedBy: currentUser.email,
          emailSent,
        },
      });

      // For tests, we'll treat email failure as success since tests may not have email configured
      if (!emailSent && process.env.NODE_ENV !== 'test') {
        // If email failed but invitation was created, log the issue
        logWarn('Invitation created but email failed to send');
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
      // Task #250 — duplicate invites are now an explicit 409 conflict.
      // The helper throws `InvitationAlreadyPendingError` whenever a pending
      // invite already exists for the same (organization, email, residence)
      // tuple (or a concurrent invite wins the unique-constraint race).
      // Callers should use `resend_invitation` (extend expiry) or
      // `cancel_invitation` (start fresh) before re-inviting. The full error
      // is still logged server-side for operators.
      if (error instanceof InvitationAlreadyPendingError) {
        logWarn('Invitation create rejected — pending duplicate', {
          metadata: { route: 'POST /api/invitations' },
        });
        return res.status(409).json({
          error: 'Conflict',
          code: 'INVITATION_ALREADY_PENDING',
          message: error.message,
        });
      }
      // Task #257 — route remaining DB errors through the shared MCP
      // classifier so unique/FK conflicts and transient failures get
      // consistent envelopes (and Retry-After) instead of a generic 500.
      if (typeof (error as { code?: unknown })?.code === 'string') {
        return sendDbWriteError(res, error, 'invitation', 'create', {
          logPrefix: '[INVITATIONS] create failed',
        });
      }
      logError('Error creating invitation', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to create invitation',
      });
    }
  });

  /**
   * GET /api/invitations - Gets all invitations (admin/manager only)
   */
  app.get('/api/invitations', requireAuth, asyncHandler(async (req: any, res) => {
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
    }, { errorMessage: 'Failed to fetch invitations', errorLogPrefix: '❌ Error fetching invitations', extraErrorFields: { error: 'Internal server error' } }));

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
      logError('Error validating invitation', error);
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
        // Lazily transition the row to status='expired' the first time we
        // notice it so the audit log captures the lifecycle event. The
        // conditional WHERE (id AND status='pending') gives us
        // single-writer semantics under concurrent accepts: only one
        // request will see a non-zero rowCount and therefore only one
        // audit row will be written, even if two clients race.
        if (invitation.status === 'pending') {
          let didTransition = false;
          try {
            // Use RETURNING so we can detect whether this request was the
            // one that actually flipped status pending -> expired without
            // depending on driver-specific rowCount fields. Concurrent
            // accepts will see an empty returned array on the losing
            // side and skip the audit insert below.
            const transitioned = await db
              .update(schema.invitations)
              .set({ status: 'expired', updatedAt: new Date() })
              .where(
                and(
                  eq(schema.invitations.id, invitation.id),
                  eq(schema.invitations.status, 'pending')
                )
              )
              .returning({ id: schema.invitations.id });
            didTransition = transitioned.length > 0;
          } catch (transitionErr) {
            // Surface (don't swallow) the primary state transition
            // failure — this is business state, not just audit. We log
            // and continue returning the EXPIRED response so the user
            // still sees a meaningful error, but we deliberately skip
            // the audit insert below since the row may not be in
            // 'expired' status.
            logError('Failed to transition invitation to expired', transitionErr);
          }
          if (didTransition) {
            // Audit-only block: failures here must NOT break the
            // primary expired response.
            try {
              await db.insert(schema.invitationAuditLog).values({
                invitationId: invitation.id,
                action: 'expired',
                performedBy: null,
                ipAddress:
                  (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
                  req.ip ||
                  null,
                userAgent: (req.headers['user-agent'] as string | undefined) || null,
                previousStatus: 'pending',
                newStatus: 'expired',
                details: {
                  source: 'rest',
                  route: 'POST /api/invitations/accept/:token',
                  detectedAt: now.toISOString(),
                  expiresAt: expiresAt.toISOString(),
                },
              });
            } catch (auditErr) {
              logError('Failed to write invitation_audit_log entry on EXPIRE', auditErr);
            }
          }
        }
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

      // Soft-replaced invitations retain their token; the user must use the
      // newer invitation that replaced this one.
      if (invitation.status === 'replaced') {
        return res.status(400).json({
          message: 'Invitation has been replaced by a newer invitation. Please use the latest invitation email.',
          code: 'INVITATION_REPLACED',
        });
      }

      if (invitation.status === 'cancelled') {
        return res.status(400).json({
          message: 'Invitation has been cancelled',
          code: 'INVITATION_CANCELLED',
        });
      }

      // SECURITY FIX: Defense-in-depth scope revalidation at redemption time.
      // If the invitation was created by a manager (non-admin), confirm that the
      // inviter still belongs to the target organization. This catches any
      // out-of-scope invitations that slipped through (e.g. pre-patch tokens or
      // future creation-path regressions) before they can grant cross-tenant membership.
      if (invitation.invitedByUserId && invitation.organizationId) {
        const inviter = await storage.getUser(invitation.invitedByUserId);
        if (inviter && inviter.role !== 'admin') {
          const inviterOrgs = await storage.getUserOrganizations(invitation.invitedByUserId);
          const inviterOrgIds = inviterOrgs.map((o: any) => o.organizationId);
          if (!inviterOrgIds.includes(invitation.organizationId)) {
            logWarn('[SECURITY] Invitation acceptance blocked: inviter no longer belongs to target organization', {
              userId: invitation.invitedByUserId,
              metadata: {
                invitationId: invitation.id,
                targetOrganizationId: invitation.organizationId,
              },
            });
            return res.status(403).json({
              message: 'This invitation is no longer valid',
              code: 'INVITATION_SCOPE_VIOLATION',
            });
          }
        }
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

      // Resolve a unique username before opening the transaction. The
      // unique-constraint on users.username will still backstop a race,
      // but pre-checking outside the tx keeps the transaction short and
      // matches the existing storage.createUser behaviour.
      const baseUsername = generateUsernameFromEmail(invitation.email);
      let uniqueUsername = baseUsername;
      {
        let attempts = 0;
        const maxAttempts = 10;
        let collision = await db
          .select({ username: schema.users.username })
          .from(schema.users)
          .where(eq(schema.users.username, uniqueUsername))
          .limit(1);
        while (collision.length > 0 && attempts < maxAttempts) {
          const randomSuffix = Math.floor(1000 + Math.random() * 9000);
          uniqueUsername = `${baseUsername}${randomSuffix}`;
          attempts++;
          collision = await db
            .select({ username: schema.users.username })
            .from(schema.users)
            .where(eq(schema.users.username, uniqueUsername))
            .limit(1);
        }
        if (attempts >= maxAttempts && collision.length > 0) {
          throw new Error('Unable to generate unique username after maximum attempts');
        }
      }

      // Demo roles share a fixed password hash from env, mirroring the
      // legacy storage.createUser logic that previously wrapped this
      // insert.
      const isDemoRole = ['demo_manager', 'demo_tenant', 'demo_resident'].includes(
        invitation.role as string
      );
      const finalPassword =
        isDemoRole && process.env.DEMO_PASSWORD_HASH ? process.env.DEMO_PASSWORD_HASH : hashedPassword;

      const userInsertData = {
        firstName: sanitizeName(firstName),
        lastName: sanitizeName(lastName),
        email: normalizeEmail(invitation.email),
        username: uniqueUsername,
        password: finalPassword,
        phone: phone ? sanitizeString(phone) : '',
        language: language || 'fr',
        role: invitation.role as any,
        isActive: true,
      };

      // Wrap user creation, every assignment row, the invitation status
      // update, and the audit row in a single transaction so a partial
      // failure (e.g. duplicate user_organizations row, residence FK
      // violation) rolls back the entire accept and leaves no orphan
      // user without org/residence links.
      const newUser = await db.transaction(async (tx) => {
        const inserted = await tx.insert(schema.users).values([userInsertData]).returning();
        const createdUser = inserted[0];

        if (invitation.organizationId) {
          await tx.insert(schema.userOrganizations).values({
            userId: createdUser.id,
            organizationId: invitation.organizationId,
            organizationRole: invitation.role,
            isActive: true,
          });

          // For managers, automatically assign ALL buildings in the organization to user_buildings table
          if (invitation.role === 'manager' || invitation.role === 'admin') {
            const organizationBuildings = await tx
              .select({ id: schema.buildings.id })
              .from(schema.buildings)
              .where(
                and(
                  eq(schema.buildings.organizationId, invitation.organizationId),
                  eq(schema.buildings.isActive, true)
                )
              );

            if (organizationBuildings.length > 0) {
              const buildingAssignments = organizationBuildings.map((building) => ({
                userId: createdUser.id,
                buildingId: building.id,
                relationshipType: 'manager',
                isActive: true,
              }));

              await tx.insert(schema.userBuildings).values(buildingAssignments);
            }
          }
        }

        if (invitation.residenceId) {
          // Map invitation role to residence relationship type
          // Valid invitation roles: 'manager', 'tenant' (and demo variants)
          // For residences, only tenants should be assigned (managers don't live in residences)
          const relationshipType =
            invitation.role === 'tenant' || invitation.role === 'demo_tenant'
              ? 'tenant'
              : 'occupant';

          await tx.insert(schema.userResidences).values({
            userId: createdUser.id,
            residenceId: invitation.residenceId,
            relationshipType,
            startDate: new Date().toISOString().split('T')[0],
            isActive: true,
          });
        }

        await tx
          .update(schema.invitations)
          .set({
            status: 'accepted',
            acceptedAt: new Date(),
            acceptedBy: createdUser.id,
            updatedAt: new Date(),
          })
          .where(eq(schema.invitations.id, invitation.id));

        // Audit row participates in the same transaction so the
        // accepted-status flip and the audit trail commit or roll back
        // together. A genuine audit failure here will roll back the
        // accept, which is the desired behaviour now that the rest of
        // the multi-table writes are also atomic.
        await tx.insert(schema.invitationAuditLog).values({
          invitationId: invitation.id,
          action: 'accepted',
          performedBy: createdUser.id,
          ipAddress:
            (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
            req.ip ||
            null,
          userAgent: (req.headers['user-agent'] as string | undefined) || null,
          previousStatus: 'pending',
          newStatus: 'accepted',
          details: {
            source: 'rest',
            route: 'POST /api/invitations/accept/:token',
            acceptedByUserId: createdUser.id,
          },
        });

        return createdUser;
      });

      // Invalidate user caches now that the transaction has committed.
      // (storage.createUser used to do this; we mirror it here since we
      // bypassed the storage layer for atomicity.)
      CacheInvalidator.invalidateUserCaches('*');

      logInfo('User assigned to organization (via invitation)', {
        userId: newUser.id,
        organizationId: invitation.organizationId,
        role: invitation.role,
      });
      if (invitation.residenceId) {
        logInfo('User assigned to residence (via invitation)', {
          userId: newUser.id,
          residenceId: invitation.residenceId,
          role: invitation.role,
        });
      }

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

      logInfo('User created via invitation acceptance', {
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
      logError('Error accepting invitation', error);
      res.status(500).json({
        message: 'Internal server error during account creation',
        code: 'INVITATION_ACCEPT_ERROR',
      });
    }
  });

  /**
   * POST /api/invitations/:id/resend - Resends an invitation
   */
  app.post('/api/invitations/:id/resend', requireAuth, asyncHandler(async (req: any, res) => {
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

      // Reject resend for terminal/replaced states. A 'replaced' invitation
      // was soft-deleted by a newer invite for the same (org, email,
      // residence) tuple; resurrecting it would silently undo the
      // replacement.
      if (invitation.status === 'replaced' || invitation.status === 'accepted' || invitation.status === 'cancelled') {
        return res.status(400).json({
          message: `Cannot resend invitation: status is "${invitation.status}"`,
          code: 'INVITATION_NOT_RESENDABLE',
        });
      }

      // Residence-existence guard (task #630). invitations.residenceId
      // has no FK in the database, so an invitation that survived a
      // residence delete from before the cascade fix (task #383) — or
      // any future row that slips through — would otherwise be
      // resurrected here against a ghost residence. Refuse to resend
      // such an invitation; the operator should cancel it explicitly
      // (or re-invite against a live residence).
      if (invitation.residenceId) {
        const [residenceRow] = await db
          .select({ id: schema.residences.id })
          .from(schema.residences)
          .where(eq(schema.residences.id, invitation.residenceId))
          .limit(1);
        if (!residenceRow) {
          return res.status(422).json({
            message: `Residence not found: ${invitation.residenceId} (cannot resend invitation pointing at a deleted residence)`,
            code: 'INVITATION_RESIDENCE_MISSING',
          });
        }
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

      // Audit trail: record the resend lifecycle event. Status stays
      // 'pending' before/after; the action+details capture the renewed
      // expiry. Failure to write must NOT mask the successful resend.
      try {
        await db.insert(schema.invitationAuditLog).values({
          invitationId: id,
          action: 'resent',
          performedBy: currentUser.id,
          ipAddress:
            (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
            req.ip ||
            null,
          userAgent: (req.headers['user-agent'] as string | undefined) || null,
          previousStatus: invitation.status,
          newStatus: 'pending',
          details: {
            source: 'rest',
            route: 'POST /api/invitations/:id/resend',
            newExpiresAt: newExpiresAt.toISOString(),
          },
        });
      } catch (auditErr) {
        logError('Failed to write invitation_audit_log entry on RESEND', auditErr);
      }

      // Get organization details for email
      const [organization] = await db
        .select()
        .from(schema.organizations)
        .where(eq(schema.organizations.id, invitation.organizationId))
        .limit(1);

      // Send invitation email again
      const organizationName = organization?.name || 'Koveo Gestion';
      const inviterName = `${currentUser.firstName || currentUser.email} ${currentUser.lastName || ''}`.trim();
      
      // Construct the base URL - use REPLIT_DOMAINS for dev, APP_URL for production, localhost as fallback
      const baseUrl = getBaseUrlFromReplitDomains() || process.env.APP_URL || 'http://localhost:5000';
      const invitationUrl = `${baseUrl}/accept-invitation?token=${invitation.token}`;
      
      const emailSent = await emailService.sendInvitationEmail(
        invitation.email,
        inviterName,
        invitationUrl,
        organizationName,
        'fr'
      );

      logInfo('Invitation resent', {
        id,
        email: invitation.email,
        newExpiresAt,
        emailSent,
      });

      if (!emailSent) {
        logWarn('Invitation updated but email failed to resend');
        return res.status(207).json({
          message: 'Invitation updated but email failed to resend',
          emailSent: false,
        });
      }

      res.json({
        message: 'Invitation resent successfully',
        emailSent: true,
      });
    }, { errorMessage: 'Failed to resend invitation', errorLogPrefix: '❌ Error resending invitation', extraErrorFields: { error: 'Internal server error' } }));

  /**
   * GET /api/invitations/pending - Get pending invitations with role-based filtering.
   * Admin: can see all pending invitations
   * Manager: can only see pending invitations in their organizations
   */
  app.get('/api/invitations/pending', requireAuth, asyncHandler(async (req: any, res) => {
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
    }, { errorMessage: 'Failed to fetch pending invitations', errorLogPrefix: '❌ Error fetching pending invitations', extraErrorFields: { error: 'Internal server error' } }));

  /**
   * DELETE /api/invitations/:id - Delete a pending invitation.
   * Admin: can delete any invitation
   * Manager: can only delete invitations from their organizations
   */
  app.delete('/api/invitations/:id', requireAuth, asyncHandler(async (req: any, res) => {
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

      // Status guard: only pending invitations can be cancelled. Mirrors
      // the MCP cancel_invitation handler so we don't transition
      // accepted/expired/already-cancelled rows back to 'cancelled'.
      if (invitationData.status !== 'pending') {
        return res.status(400).json({
          message: `Invitation cannot be cancelled (current status: ${invitationData.status})`,
          code: 'INVALID_INVITATION_STATUS',
        });
      }

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

      // Soft-cancel instead of physical delete so the audit trail row
      // we write below survives. The invitation_audit_log.invitationId
      // FK is `onDelete: cascade`, which means a hard DELETE of the
      // invitation would also wipe out the just-inserted audit record
      // and defeat the purpose of task #151.
      await db
        .update(schema.invitations)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(schema.invitations.id, invitationId));

      // Audit trail: record who cancelled this invitation. Mirrors the
      // MCP cancel_invitation handler so admins see REST and chat
      // cancellations side-by-side. Failure to write the audit row
      // should NOT mask the successful cancellation, so we
      // log-and-swallow.
      try {
        await db.insert(schema.invitationAuditLog).values({
          invitationId: invitationData.id,
          action: 'cancelled',
          performedBy: currentUser.id,
          ipAddress:
            (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
            req.ip ||
            null,
          userAgent: (req.headers['user-agent'] as string | undefined) || null,
          previousStatus: invitationData.status,
          newStatus: 'cancelled',
          details: { source: 'rest', route: 'DELETE /api/invitations/:id' },
        });
      } catch (auditErr) {
        logError('Failed to write invitation_audit_log entry on DELETE', auditErr);
      }

      res.json({
        message: 'Invitation cancelled successfully',
        invitationId,
      });
    }, { errorMessage: 'Failed to delete invitation', errorLogPrefix: '❌ Error deleting invitation', extraErrorFields: { error: 'Internal server error' } }));

  /**
   * GET /api/invitations/:id/history - Returns the audit log entries for a single invitation.
   * Mirrors the MCP `get_invitation_history` tool:
   *   - tenants are denied
   *   - admins can read history for any invitation
   *   - managers can only read history for invitations they themselves originally sent
   * Pagination via `limit` (default 25, max 100) and `offset` (default 0).
   */
  app.get('/api/invitations/:id/history', requireAuth, asyncHandler(async (req: any, res) => {
      const currentUser = req.user || req.session?.user;
      const { id: invitationId } = req.params;

      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      if (!['admin', 'manager'].includes(currentUser.role)) {
        return res.status(403).json({
          message: 'Insufficient permissions to view invitation history',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      const parsedLimit = Number.parseInt(String(req.query.limit ?? ''), 10);
      const parsedOffset = Number.parseInt(String(req.query.offset ?? ''), 10);
      const pageLimit = Number.isFinite(parsedLimit)
        ? Math.min(Math.max(parsedLimit, 1), 100)
        : 25;
      const pageOffset = Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0;

      const [invitation] = await db
        .select({
          id: schema.invitations.id,
          invitedByUserId: schema.invitations.invitedByUserId,
        })
        .from(schema.invitations)
        .where(eq(schema.invitations.id, invitationId))
        .limit(1);

      if (!invitation) {
        return res.status(404).json({
          message: 'Invitation not found',
          code: 'INVITATION_NOT_FOUND',
        });
      }

      if (
        currentUser.role === 'manager' &&
        invitation.invitedByUserId !== currentUser.id
      ) {
        return res.status(403).json({
          message: 'You can only view history for invitations you sent',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      const totalRows = await db
        .select({ value: count() })
        .from(schema.invitationAuditLog)
        .where(eq(schema.invitationAuditLog.invitationId, invitationId));
      const total = Number(totalRows[0]?.value ?? 0);

      const items = await db
        .select({
          id: schema.invitationAuditLog.id,
          invitationId: schema.invitationAuditLog.invitationId,
          action: schema.invitationAuditLog.action,
          previousStatus: schema.invitationAuditLog.previousStatus,
          newStatus: schema.invitationAuditLog.newStatus,
          performedBy: schema.invitationAuditLog.performedBy,
          ipAddress: schema.invitationAuditLog.ipAddress,
          userAgent: schema.invitationAuditLog.userAgent,
          details: schema.invitationAuditLog.details,
          createdAt: schema.invitationAuditLog.createdAt,
          performedByName: sql<
            string | null
          >`CASE WHEN users.first_name IS NULL AND users.last_name IS NULL THEN NULL ELSE CONCAT(COALESCE(users.first_name, ''), ' ', COALESCE(users.last_name, '')) END`,
          performedByEmail: schema.users.email,
        })
        .from(schema.invitationAuditLog)
        .leftJoin(
          schema.users,
          eq(schema.invitationAuditLog.performedBy, schema.users.id)
        )
        .where(eq(schema.invitationAuditLog.invitationId, invitationId))
        .orderBy(desc(schema.invitationAuditLog.createdAt))
        .limit(pageLimit)
        .offset(pageOffset);

      res.json({
        items,
        total,
        limit: pageLimit,
        offset: pageOffset,
        hasMore: pageOffset + items.length < total,
      });
    }, { errorMessage: 'Failed to fetch invitation history', errorLogPrefix: '❌ Error fetching invitation history', extraErrorFields: { error: 'Internal server error' } }));
}