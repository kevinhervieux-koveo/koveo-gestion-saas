/**
 * Communication API endpoints for managing notifications, general communications, and meetings.
 * Provides comprehensive communication functionality for the dashboard.
 */

import { Express } from 'express';
import { db } from '../db';
import {
  userNotificationPreferences,
  generalCommunications,
  meetings,
  notifications,
  notificationConfigurations,
  users,
  organizations,
  userOrganizations,
  buildings,
  insertUserNotificationPreferenceSchema,
  insertGeneralCommunicationSchema,
  insertMeetingSchema,
  insertNotificationSchema,
  insertNotificationConfigurationSchema,
  notificationTypeEnum,
  frequencyEnum,
  type NotificationConfiguration,
  type InsertNotificationConfiguration,
} from '@shared/schema';
import { and, eq, or, inArray, desc, sql } from 'drizzle-orm';
import { requireAuth } from '../auth';
import { z } from 'zod';
import { communicationService } from '../services/consolidated-communication-service';
import { populateDefaultPreferences } from '../scripts/populate-default-notification-preferences';
import { checkBuildingAccess } from './buildings/access-control';
import { logDebug, logInfo, logWarn, logError } from '../utils/logger';

import { asyncHandler } from '../utils/async-handler';
// In-memory rate limiting store for urgent communications
const urgentRateLimit = new Map<string, { count: number; resetTime: number }>();

// Rate limiting function for urgent communications
function checkUrgentRateLimit(userId: string, orgId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const key = `${userId}:${orgId}`;
  
  // Clean up expired entries
  for (const [k, v] of urgentRateLimit.entries()) {
    if (now > v.resetTime) {
      urgentRateLimit.delete(k);
    }
  }
  
  const limit = urgentRateLimit.get(key);
  const maxPerHour = 3; // Allow 3 urgent communications per hour per user per organization
  const windowMs = 60 * 60 * 1000; // 1 hour
  
  if (!limit) {
    urgentRateLimit.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true };
  }
  
  if (now > limit.resetTime) {
    urgentRateLimit.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true };
  }
  
  if (limit.count >= maxPerHour) {
    return { allowed: false, retryAfter: Math.ceil((limit.resetTime - now) / 1000) };
  }
  
  limit.count++;
  return { allowed: true };
}

/**
 * Centralized building authorization function for notification configurations.
 * Verifies that a user has access to a specific building within an organization.
 * 
 * @param userId - User ID to check access for
 * @param organizationId - Organization ID the building belongs to
 * @param buildingId - Building ID to check access for
 * @param userRole - User's role in the system
 * @returns Promise<boolean> - True if user has access to the building
 */
async function authorizeBuildingAccess(
  userId: string,
  organizationId: string,
  buildingId: string,
  userRole: string
): Promise<boolean> {
  try {
    // First verify user has access to the organization
    const userOrg = await db
      .select()
      .from(userOrganizations)
      .where(and(
        eq(userOrganizations.userId, userId),
        eq(userOrganizations.organizationId, organizationId),
        eq(userOrganizations.isActive, true)
      ))
      .limit(1);

    if (userOrg.length === 0) {
      return false;
    }

    // Then verify building exists and belongs to the organization
    const building = await db
      .select()
      .from(buildings)
      .where(and(
        eq(buildings.id, buildingId),
        eq(buildings.organizationId, organizationId),
        eq(buildings.isActive, true)
      ))
      .limit(1);

    if (building.length === 0) {
      return false;
    }

    // Finally check if user has access to this specific building
    const buildingAccess = await checkBuildingAccess(userId, buildingId, userRole);
    return buildingAccess.hasAccess;
  } catch (error) {
    return false;
  }
}

/**
 * Registers all communication-related API endpoints.
 *
 * @param app - Express application instance.
 */
export function registerCommunicationRoutes(app: import('../utils/lazy-mount').RouteRegistry): void {
  // ==========================================
  // ORGANIZATION CONTEXT ROUTES
  // ==========================================

  /**
   * GET /api/communication/organizations - Get available organizations for communication
   * Returns all organizations that user has access to for sending communications.
   */
  app.get('/api/communication/organizations', requireAuth, asyncHandler(async (req: any, res) => {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Check if user can send communications (managers and admins only)
      if (!['admin', 'manager', 'demo_manager'].includes(currentUser.role)) {
        return res.status(403).json({
          message: 'Only managers and administrators can send general communications',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      // Get all organizations user has access to
      const userOrgs = await db
        .select({
          organizationId: userOrganizations.organizationId,
          canAccessAll: userOrganizations.canAccessAllOrganizations,
        })
        .from(userOrganizations)
        .where(and(
          eq(userOrganizations.userId, currentUser.id),
          eq(userOrganizations.isActive, true)
        ));

      if (userOrgs.length === 0) {
        return res.status(404).json({
          message: 'No organizations found for user',
          code: 'NO_ORGANIZATIONS',
        });
      }

      // Get organization details
      const organizationIds = userOrgs.map(org => org.organizationId);
      const organizationList = await db
        .select({
          id: organizations.id,
          name: organizations.name,
        })
        .from(organizations)
        .where(inArray(organizations.id, organizationIds));

      res.json({
        organizations: organizationList,
        userRole: currentUser.role,
        canAccessAll: userOrgs.some(org => org.canAccessAll),
      });
    }, { errorMessage: 'Failed to fetch organizations', errorLogPrefix: '❌ Error fetch organizations', extraErrorFields: { '_error': 'Internal server error' } }));

  /**
   * GET /api/communication/buildings/:organizationId - Get buildings for an organization
   * Returns buildings that user has access to within a specific organization.
   */
  app.get('/api/communication/buildings/:organizationId', requireAuth, asyncHandler(async (req: any, res) => {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      const { organizationId } = req.params;

      // Check if user can send communications (managers and admins only)
      if (!['admin', 'manager', 'demo_manager'].includes(currentUser.role)) {
        return res.status(403).json({
          message: 'Only managers and administrators can access building information',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      // Verify user has access to this organization
      const userOrg = await db
        .select()
        .from(userOrganizations)
        .where(and(
          eq(userOrganizations.userId, currentUser.id),
          eq(userOrganizations.organizationId, organizationId),
          eq(userOrganizations.isActive, true)
        ))
        .limit(1);

      if (userOrg.length === 0) {
        return res.status(403).json({
          message: 'Access denied to this organization',
          code: 'ACCESS_DENIED',
        });
      }

      // Get all buildings for this organization
      const allBuildings = await db
        .select({
          id: buildings.id,
          name: buildings.name,
          address: buildings.address,
        })
        .from(buildings)
        .where(and(
          eq(buildings.organizationId, organizationId),
          eq(buildings.isActive, true)
        ))
        .orderBy(buildings.name);

      // For admins, return all buildings
      // For managers, filter to only buildings they have access to
      let buildingList = allBuildings;
      if (currentUser.role === 'manager' || currentUser.role === 'demo_manager') {
        const accessibleBuildings = [];
        for (const building of allBuildings) {
          const access = await checkBuildingAccess(currentUser.id, building.id, currentUser.role);
          if (access.hasAccess) {
            accessibleBuildings.push(building);
          }
        }
        buildingList = accessibleBuildings;
      }

      res.json({ buildings: buildingList });
    }, { errorMessage: 'Failed to fetch buildings', errorLogPrefix: '❌ Error fetch buildings', extraErrorFields: { '_error': 'Internal server error' } }));

  /**
   * GET /api/communication/organization-context - Get organization context for communication
   * Returns user's organization information for sending general communications.
   */
  app.get('/api/communication/organization-context', requireAuth, async (req: any, res) => {
    try {
      
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }


      // Check if user can send communications (managers and admins only)
      if (!['admin', 'manager', 'demo_manager'].includes(currentUser.role)) {
        return res.status(403).json({
          message: 'Only managers and administrators can send general communications',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      // Get user's primary organization
      const [userOrgResult] = await db
        .select({
          organizationId: userOrganizations.organizationId,
          canAccessAll: userOrganizations.canAccessAllOrganizations,
        })
        .from(userOrganizations)
        .where(and(
          eq(userOrganizations.userId, currentUser.id),
          eq(userOrganizations.isActive, true)
        ))
        .limit(1);

      if (!userOrgResult) {
        return res.status(404).json({
          message: 'No organization found for user',
          code: 'NO_ORGANIZATION',
        });
      }


      // Get organization details
      const [organization] = await db
        .select({
          id: organizations.id,
          name: organizations.name,
        })
        .from(organizations)
        .where(eq(organizations.id, userOrgResult.organizationId))
        .limit(1);

      if (!organization) {
        // console.log(`❌ [DEBUG] Organization ${userOrgResult.organizationId} not found in database`);
        return res.status(404).json({
          message: 'Organization not found',
          code: 'ORGANIZATION_NOT_FOUND',
        });
      }

      // console.log(`✅ [DEBUG] Returning organization context for ${organization.name} (${organization.id})`);

      res.json({
        id: organization.id,
        name: organization.name,
        canAccessAll: userOrgResult.canAccessAll,
        userRole: currentUser.role,
      });
    } catch (error: any) {
      // console.error('❌ [DEBUG] Error in organization-context endpoint:', error);
      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to fetch organization context',
        details: error.message,
      });
    }
  });

  // ==========================================
  // NOTIFICATION SETTINGS ROUTES
  // ==========================================

  /**
   * GET /api/communication/settings - Get user's global notification settings
   * Returns the global starting date that applies to all notifications.
   */
  app.get('/api/communication/settings', requireAuth, async (req: any, res) => {
    try {
      // console.log('🔍 [DEBUG] GET /api/communication/settings endpoint called');
      
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        // console.log('❌ [DEBUG] No valid session found for settings');
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // console.log(`🔍 [DEBUG] User ${currentUser.id} requesting notification settings`);

      // Get user with notification settings
      const [user] = await db
        .select({
          id: users.id,
          notificationsStartingDate: users.notificationsStartingDate,
        })
        .from(users)
        .where(eq(users.id, currentUser.id))
        .limit(1);

      if (!user) {
        // console.log(`❌ [DEBUG] User ${currentUser.id} not found`);
        return res.status(404).json({
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      const startingDate = user.notificationsStartingDate || new Date().toISOString().split('T')[0];
      
      // console.log(`✅ [DEBUG] Returning notification settings for user ${currentUser.id}, starting date: ${startingDate}`);

      res.json({
        startingDate,
      });
    } catch (error: any) {
      // console.error('❌ [DEBUG] Error in settings endpoint:', error);
      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to fetch notification settings',
        details: error.message,
      });
    }
  });

  /**
   * PUT /api/communication/settings - Update user's global notification settings
   * Updates the global starting date that applies to all notifications.
   */
  app.put('/api/communication/settings', requireAuth, async (req: any, res) => {
    try {
      logDebug('[DEBUG] PUT /api/communication/settings endpoint called');
      
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        logWarn('[DEBUG] No valid session found for settings update');
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Security: Don't log request body to prevent sensitive data exposure

      // Validate request body
      const settingsSchema = z.object({
        startingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Starting date must be in YYYY-MM-DD format'),
      });

      const { startingDate } = settingsSchema.parse(req.body);

      logDebug('[DEBUG] User updating notification settings', { userId: currentUser.id, metadata: { startingDate } });

      // Update user's notification starting date
      const [updatedUser] = await db
        .update(users)
        .set({
          notificationsStartingDate: startingDate,
          updatedAt: sql`now()`,
        })
        .where(eq(users.id, currentUser.id))
        .returning({
          id: users.id,
          notificationsStartingDate: users.notificationsStartingDate,
        });

      if (!updatedUser) {
        logWarn('[DEBUG] Failed to update settings for user', { userId: currentUser.id });
        return res.status(404).json({
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      logInfo('[DEBUG] Updated notification settings for user', { userId: currentUser.id });

      res.json({
        startingDate: updatedUser.notificationsStartingDate,
      });
    } catch (error: any) {
      logError('[DEBUG] Error updating settings', error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({
          _error: 'Validation error',
          message: 'Invalid settings data provided',
          details: error.errors,
        });
      }

      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to update notification settings',
        details: error.message,
      });
    }
  });

  // ==========================================
  // NOTIFICATION PREFERENCES ROUTES
  // ==========================================

  /**
   * GET /api/communication/preferences - Get user's current notification preferences
   * Returns all notification types with user's current preferences, creating defaults if none exist.
   */
  app.get('/api/communication/preferences', requireAuth, asyncHandler(async (req: any, res) => {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // console.log(`📋 Fetching notification preferences for user ${currentUser.id}`);

      // Get existing preferences
      const existingPreferences = await db
        .select()
        .from(userNotificationPreferences)
        .where(eq(userNotificationPreferences.userId, currentUser.id));

      // Define all notification types with defaults
      const allNotificationTypes = [
        'bill_reminder',
        'maintenance_update',
        'announcement',
        'system',
        'upcoming_payment',
        'upcoming_bills',
        'bill_paid_last_month',
        'bills_overdue',
        'payment_overdue',
        'new_building_document',
        'meeting_invite',
        'maintenance_completed',
        'budget_update',
        'policy_change',
        'seasonal_reminder',
      ];

      // Create map of existing preferences
      const existingMap = new Map(
        existingPreferences.map(pref => [pref.notificationType, pref])
      );

      // Build response with all notification types
      const preferences = allNotificationTypes.map(type => {
        const existing = existingMap.get(type as any);
        return existing || {
          id: null,
          userId: currentUser.id,
          notificationType: type,
          frequency: 'monthly',
          isEnabled: false,
          createdAt: null,
          updatedAt: null,
        };
      });

      // If some preferences don't exist, create them with defaults
      const missingTypes = allNotificationTypes.filter(type => !existingMap.has(type as any));
      if (missingTypes.length > 0) {
        // console.log(`📝 Creating default preferences for ${missingTypes.length} notification types`);
        
        const defaultPreferences = missingTypes.map(type => ({
          userId: currentUser.id,
          notificationType: type as any,
          frequency: 'monthly' as any,
          isEnabled: false,
          startingDate: new Date(),
        }));

        await db.insert(userNotificationPreferences).values(defaultPreferences);
        
        // Refetch all preferences to get the created ones with IDs
        const allPreferences = await db
          .select()
          .from(userNotificationPreferences)
          .where(eq(userNotificationPreferences.userId, currentUser.id));

        const finalMap = new Map(
          allPreferences.map(pref => [pref.notificationType, pref])
        );

        const finalPreferences = allNotificationTypes.map(type => finalMap.get(type as any)!);
        
        // console.log(`✅ Returning ${finalPreferences.length} notification preferences`);
        return res.json(finalPreferences);
      }

      // console.log(`✅ Returning ${preferences.length} notification preferences`);
      res.json(preferences);
    }, { errorMessage: 'Failed to fetch notification preferences', errorLogPrefix: '❌ Error fetch notification preferences', extraErrorFields: { '_error': 'Internal server error' } }));

  /**
   * PUT /api/communication/preferences - Update user's notification preferences
   * Accepts array of preference updates and applies them.
   */
  app.put('/api/communication/preferences', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Validate request body
      const updateSchema = z.array(z.object({
        notificationType: z.enum([
          'bill_reminder',
          'maintenance_update',
          'announcement',
          'system',
          'upcoming_payment',
          'upcoming_bills',
          'bill_paid_last_month',
          'bills_overdue',
          'payment_overdue',
          'new_building_document',
          'meeting_invite',
          'maintenance_completed',
          'budget_update',
          'policy_change',
          'seasonal_reminder',
        ]),
        frequency: z.enum(['immediate', 'weekly', 'bi_weekly', 'monthly', 'quarterly', 'bi-annually', 'annually']),
        isEnabled: z.boolean(),
        startingDate: z.coerce.date().optional(),
      }));

      const validatedUpdates = updateSchema.parse(req.body);

      // Update each preference
      for (const update of validatedUpdates) {
        await db
          .insert(userNotificationPreferences)
          .values({
            userId: currentUser.id,
            notificationType: update.notificationType,
            frequency: update.frequency,
            isEnabled: update.isEnabled,
            startingDate: update.startingDate || new Date(),
          })
          .onConflictDoUpdate({
            target: [userNotificationPreferences.userId, userNotificationPreferences.notificationType],
            set: {
              frequency: update.frequency,
              isEnabled: update.isEnabled,
              startingDate: update.startingDate || sql`${userNotificationPreferences.startingDate}`,
              updatedAt: sql`now()`,
            },
          });
      }

      // Fetch updated preferences
      const updatedPreferences = await db
        .select()
        .from(userNotificationPreferences)
        .where(eq(userNotificationPreferences.userId, currentUser.id));

      res.json(updatedPreferences);
    } catch (error: any) {
      logError('Error updating notification preferences', error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({
          _error: 'Validation error',
          message: 'Invalid preference data provided',
          details: error.errors,
        });
      }

      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to update notification preferences',
      });
    }
  });

  /**
   * POST /api/communication/preferences/populate-defaults - Populate default preferences for users without any
   * Creates default preferences for existing users who don't have notification preferences yet.
   * Safe to run multiple times - won't overwrite existing preferences.
   */
  app.post('/api/communication/preferences/populate-defaults', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Only allow admins to populate defaults for all users
      if (currentUser.role !== 'admin') {
        return res.status(403).json({
          message: 'Only administrators can populate default preferences for all users',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      // console.log(`🔧 Admin ${currentUser.email} requesting default preferences population`);

      const result = await populateDefaultPreferences();

      if (result.success) {
        // console.log(`✅ Default preferences populated: ${result.statistics.preferencesCreated} preferences created`);
        res.json(result);
      } else {
        // console.error(`❌ Failed to populate default preferences: ${result.message}`);
        res.status(500).json(result);
      }
    } catch (error: any) {
      // console.error('❌ Error in populate defaults endpoint:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        statistics: {
          totalUsers: 0,
          usersWithPreferences: 0,
          usersNeedingDefaults: 0,
          preferencesCreated: 0,
        },
      });
    }
  });

  /**
   * POST /api/communication/preferences/reset - Reset to default preferences
   * Resets all notification preferences to defaults (monthly frequency, enabled).
   */
  app.post('/api/communication/preferences/reset', requireAuth, asyncHandler(async (req: any, res) => {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // console.log(`🔄 Resetting notification preferences to defaults for user ${currentUser.id}`);

      // Delete existing preferences
      await db
        .delete(userNotificationPreferences)
        .where(eq(userNotificationPreferences.userId, currentUser.id));

      // Create default preferences for all notification types
      const allNotificationTypes = [
        'bill_reminder',
        'maintenance_update',
        'announcement',
        'system',
        'upcoming_payment',
        'upcoming_bills',
        'bill_paid_last_month',
        'bills_overdue',
        'payment_overdue',
        'new_building_document',
        'meeting_invite',
        'maintenance_completed',
        'budget_update',
        'policy_change',
        'seasonal_reminder',
      ];

      const defaultPreferences = allNotificationTypes.map(type => ({
        userId: currentUser.id,
        notificationType: type as any,
        frequency: 'monthly' as any,
        isEnabled: false,
      }));

      await db.insert(userNotificationPreferences).values(defaultPreferences);

      // Fetch the newly created preferences
      const newPreferences = await db
        .select()
        .from(userNotificationPreferences)
        .where(eq(userNotificationPreferences.userId, currentUser.id));

      // console.log(`✅ Reset notification preferences to defaults`);
      res.json(newPreferences);
    }, { errorMessage: 'Failed to reset notification preferences', errorLogPrefix: '❌ Error reset notification preferences', extraErrorFields: { '_error': 'Internal server error' } }));

  // ==========================================
  // GENERAL COMMUNICATIONS ROUTES
  // ==========================================

  /**
   * GET /api/communication/general - Get communications history for user's organization(s)
   * Returns communications based on user's role and organization access.
   */
  /**
   * GET /api/communication/organizations/:id/member-counts - Get organization member counts by role
   */
  app.get('/api/communication/organizations/:id/member-counts', requireAuth, asyncHandler(async (req: any, res) => {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      const organizationId = req.params.id;

      // Verify user has access to this organization
      if (currentUser.role !== 'admin') {
        const userOrg = await db
          .select()
          .from(userOrganizations)
          .where(
            and(
              eq(userOrganizations.userId, currentUser.id),
              eq(userOrganizations.organizationId, organizationId),
              eq(userOrganizations.isActive, true)
            )
          )
          .limit(1);

        if (userOrg.length === 0) {
          return res.status(403).json({
            message: 'Access denied to this organization',
            code: 'ORGANIZATION_ACCESS_DENIED',
          });
        }
      }

      // Get member counts by role
      const memberCounts = await db
        .select({
          organizationRole: userOrganizations.organizationRole,
          count: sql<number>`count(*)`,
        })
        .from(userOrganizations)
        .innerJoin(users, eq(userOrganizations.userId, users.id))
        .where(
          and(
            eq(userOrganizations.organizationId, organizationId),
            eq(userOrganizations.isActive, true),
            eq(users.isActive, true)
          )
        )
        .groupBy(userOrganizations.organizationRole);

      // Convert to a more convenient format
      const counts = memberCounts.reduce((acc, item) => {
        acc[item.organizationRole] = Number(item.count);
        return acc;
      }, {} as Record<string, number>);

      // Calculate total
      const total = memberCounts.reduce((sum, item) => sum + Number(item.count), 0);
      counts.all = total;

      // console.log(`📊 Organization ${organizationId} member counts:`, counts);

      res.json(counts);
    }, { errorMessage: 'Failed to fetch organization member counts', errorLogPrefix: '❌ Error fetch organization member counts', extraErrorFields: { '_error': 'Internal server error' } }));

  app.get('/api/communication/general', requireAuth, asyncHandler(async (req: any, res) => {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // console.log(`📧 Fetching general communications for user ${currentUser.id} with role ${currentUser.role}`);

      // Apply role-based filtering and build complete query
      let communications;
      if (currentUser.role === 'admin') {
        // Admin can see all communications - no additional filtering
        // console.log('🔓 [ADMIN] No filtering applied - admin can see all communications');
        communications = await db
          .select({
            id: generalCommunications.id,
            organizationId: generalCommunications.organizationId,
            createdBy: generalCommunications.createdBy,
            title: generalCommunications.title,
            content: generalCommunications.content,
            isUrgent: generalCommunications.isUrgent,
            scheduledFor: generalCommunications.scheduledFor,
            sentAt: generalCommunications.sentAt,
            recipientRoles: generalCommunications.recipientRoles,
            createdAt: generalCommunications.createdAt,
            organization: {
              id: organizations.id,
              name: organizations.name,
            },
            creator: {
              id: users.id,
              firstName: users.firstName,
              lastName: users.lastName,
              email: users.email,
            },
          })
          .from(generalCommunications)
          .innerJoin(organizations, eq(generalCommunications.organizationId, organizations.id))
          .innerJoin(users, eq(generalCommunications.createdBy, users.id))
          .orderBy(desc(generalCommunications.createdAt));
      } else {
        // Get user's accessible organizations
        const userOrgs = await db
          .select({ organizationId: userOrganizations.organizationId })
          .from(userOrganizations)
          .where(
            and(
              eq(userOrganizations.userId, currentUser.id),
              eq(userOrganizations.isActive, true)
            )
          );

        if (userOrgs.length === 0) {
          // console.log('📭 User has no accessible organizations');
          return res.json([]);
        }

        const orgIds = userOrgs.map(org => org.organizationId);
        communications = await db
          .select({
            id: generalCommunications.id,
            organizationId: generalCommunications.organizationId,
            createdBy: generalCommunications.createdBy,
            title: generalCommunications.title,
            content: generalCommunications.content,
            isUrgent: generalCommunications.isUrgent,
            scheduledFor: generalCommunications.scheduledFor,
            sentAt: generalCommunications.sentAt,
            recipientRoles: generalCommunications.recipientRoles,
            createdAt: generalCommunications.createdAt,
            organization: {
              id: organizations.id,
              name: organizations.name,
            },
            creator: {
              id: users.id,
              firstName: users.firstName,
              lastName: users.lastName,
              email: users.email,
            },
          })
          .from(generalCommunications)
          .innerJoin(organizations, eq(generalCommunications.organizationId, organizations.id))
          .innerJoin(users, eq(generalCommunications.createdBy, users.id))
          .where(
            and(
              inArray(generalCommunications.organizationId, orgIds),
              // A communication is visible to the caller when:
              //   - recipientRoles IS NULL (broadcast to everyone), OR
              //   - recipientRoles is an empty array (also broadcast), OR
              //   - the caller's organization-scoped role for THIS comm's
              //     organization is contained in recipientRoles.
              // We derive the per-organization role from user_organizations
              // (organization_role) so that a user who is, e.g., a manager in
              // org A and a tenant in org B is filtered correctly per row.
              sql`(
                ${generalCommunications.recipientRoles} IS NULL
                OR cardinality(${generalCommunications.recipientRoles}) = 0
                OR EXISTS (
                  SELECT 1 FROM user_organizations uo
                  WHERE uo.user_id = ${currentUser.id}
                    AND uo.organization_id = ${generalCommunications.organizationId}
                    AND uo.is_active = true
                    AND uo.organization_role = ANY(${generalCommunications.recipientRoles})
                )
              )`
            )
          )
          .orderBy(desc(generalCommunications.createdAt));

        // console.log(`🔒 Filtering communications for organizations: [${orgIds.join(', ')}]`);
      }

      // console.log(`✅ Found ${communications.length} general communications`);
      res.json(communications);
    }, { errorMessage: 'Failed to fetch general communications', errorLogPrefix: '❌ Error fetch general communications', extraErrorFields: { '_error': 'Internal server error' } }));

  /**
   * POST /api/communication/general - Send general communication (managers/admins only)
   * Creates a new general communication for an organization.
   */
  app.post('/api/communication/general', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Check if user has permission to send communications
      if (!['admin', 'manager', 'demo_manager'].includes(currentUser.role)) {
        return res.status(403).json({
          message: 'Insufficient permissions to send communications',
          code: 'PERMISSION_DENIED',
        });
      }

      // Extract isTestMode before validation (not part of shared schema)
      const isTestMode = req.body.isTestMode === true;
      
      // Set createdBy from authenticated user before validation
      // Remove isTestMode from request body as it's not part of the schema
      const { isTestMode: _, ...requestBodyWithoutTestMode } = req.body;
      const requestData = {
        ...requestBodyWithoutTestMode,
        createdBy: currentUser.id,
      };

      // Validate request body
      const validatedData = insertGeneralCommunicationSchema.parse(requestData);

      // Additional authorization check for urgent communications
      if (validatedData.isUrgent && !['admin', 'manager'].includes(currentUser.role)) {
        // console.error(`❌ User ${currentUser.email} with role ${currentUser.role} attempted to send urgent communication`);
        return res.status(403).json({
          message: 'Only administrators and managers can send urgent communications',
          code: 'URGENT_PERMISSION_DENIED',
        });
      }

      // Rate limiting for urgent communications
      if (validatedData.isUrgent) {
        const rateLimitCheck = checkUrgentRateLimit(currentUser.id, validatedData.organizationId);
        if (!rateLimitCheck.allowed) {
          logWarn('Rate limit exceeded for urgent communication', { userId: currentUser.id, metadata: { organizationId: validatedData.organizationId } });
          return res.status(429).json({
            message: 'Rate limit exceeded for urgent communications. Maximum 3 urgent messages per hour per organization.',
            code: 'URGENT_RATE_LIMIT_EXCEEDED',
            retryAfter: rateLimitCheck.retryAfter,
          });
        }
      }

      // console.log(`📧 Creating ${validatedData.isUrgent ? 'URGENT' : 'regular'} general communication for organization ${validatedData.organizationId} by user ${currentUser.id}`);

      // If not admin, verify user has access to the organization
      if (currentUser.role !== 'admin') {
        const userOrg = await db
          .select()
          .from(userOrganizations)
          .where(
            and(
              eq(userOrganizations.userId, currentUser.id),
              eq(userOrganizations.organizationId, validatedData.organizationId),
              eq(userOrganizations.isActive, true)
            )
          )
          .limit(1);

        if (userOrg.length === 0) {
          return res.status(403).json({
            message: 'Access denied to this organization',
            code: 'ORGANIZATION_ACCESS_DENIED',
          });
        }
      }

      // Add timestamp (createdBy already set and validated)
      const communicationData = {
        ...validatedData,
        sentAt: new Date(), // Mark as sent immediately
      } as typeof generalCommunications.$inferInsert;

      // Create the communication
      const [newCommunication] = await db
        .insert(generalCommunications)
        .values([communicationData])
        .returning();

      // Fetch the complete communication with related data
      const [completeComm] = await db
        .select({
          id: generalCommunications.id,
          organizationId: generalCommunications.organizationId,
          createdBy: generalCommunications.createdBy,
          title: generalCommunications.title,
          content: generalCommunications.content,
          isUrgent: generalCommunications.isUrgent,
          scheduledFor: generalCommunications.scheduledFor,
          sentAt: generalCommunications.sentAt,
          recipientRoles: generalCommunications.recipientRoles,
          createdAt: generalCommunications.createdAt,
          organization: {
            id: organizations.id,
            name: organizations.name,
          },
          creator: {
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
          },
        })
        .from(generalCommunications)
        .innerJoin(organizations, eq(generalCommunications.organizationId, organizations.id))
        .innerJoin(users, eq(generalCommunications.createdBy, users.id))
        .where(eq(generalCommunications.id, newCommunication.id));

      // Send email notification to organization members
      try {
        // console.log(`📧 Sending general communication emails for: ${completeComm.title}`);
        
        // Get recipients based on organization and recipient roles
        const recipientsQuery = await db
          .select({
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            language: users.language,
            userId: users.id,
          })
          .from(users)
          .innerJoin(userOrganizations, eq(users.id, userOrganizations.userId))
          .where(
            and(
              eq(userOrganizations.organizationId, completeComm.organizationId),
              eq(userOrganizations.isActive, true),
              eq(users.isActive, true),
              // Filter by recipient roles if specified
              communicationData.recipientRoles?.length > 0 
                ? inArray(userOrganizations.organizationRole, communicationData.recipientRoles as any)
                : sql`1=1` // No role filter if no specific roles specified
            )
          );

        // Remove duplicates by email address to prevent sending multiple emails to the same person
        const recipients = recipientsQuery.filter((recipient, index, arr) => 
          arr.findIndex(r => r.email === recipient.email) === index
        );

        // console.log(`📧 Found ${recipientsQuery.length} recipient records, deduplicated to ${recipients.length} unique recipients`);

        // Handle test mode - send only to current user
        if (isTestMode) {
          // Test mode: only send to the current user
          logDebug('Test mode enabled - sending only to current user', { userId: currentUser.id });
          const finalRecipients = [{
            email: currentUser.email,
            firstName: currentUser.firstName,
            lastName: currentUser.lastName,
            language: (currentUser.language as 'fr' | 'en') || 'fr',
            userId: currentUser.id,
          }];
          
          // Send test email
          const fullName = `${currentUser.firstName} ${currentUser.lastName}`;
          await communicationService.sendCombinedTestEmail(
            [{
              type: 'announcement',
              title: `[TEST] ${completeComm.title}`,
              message: completeComm.content
            }],
            completeComm.organization.name,
            [{
              email: currentUser.email,
              name: fullName,
              language: finalRecipients[0].language
            }]
          );
          
          logInfo('Test email sent', { userId: currentUser.id });
        } else if (recipients.length > 0) {
          // For urgent communications, send to all recipients immediately
          // For non-urgent communications, check user notification preferences
          let finalRecipients = recipients;
          
          if (!completeComm.isUrgent) {
            // Get user notification preferences for non-urgent communications
            const preferences = await db
              .select({
                userId: userNotificationPreferences.userId,
                isEnabled: userNotificationPreferences.isEnabled,
              })
              .from(userNotificationPreferences)
              .where(
                and(
                  inArray(userNotificationPreferences.userId, recipients.map(r => r.userId)),
                  eq(userNotificationPreferences.notificationType, 'announcement')
                )
              );

            const preferencesMap = new Map(preferences.map(p => [p.userId, p.isEnabled]));
            
            // Filter recipients based on their notification preferences
            finalRecipients = recipients.filter(recipient => {
              const hasPreference = preferencesMap.has(recipient.userId);
              const isEnabled = preferencesMap.get(recipient.userId);
              // If no preference exists, default to enabled; otherwise use the preference
              return !hasPreference || isEnabled;
            });
            
            // console.log(`📧 Filtered ${recipients.length} recipients to ${finalRecipients.length} based on notification preferences`);
          } else {
            // console.log(`🚨 Urgent communication - bypassing notification preferences for all ${recipients.length} recipients`);
          }

          if (finalRecipients.length > 0) {
            // Send emails to each recipient individually with announcement notification type
            for (const recipient of finalRecipients) {
              const fullName = `${recipient.firstName} ${recipient.lastName}`;
              const language = (recipient.language as 'fr' | 'en') || 'fr';
              
              await communicationService.sendCombinedTestEmail(
                [{
                  type: 'announcement',
                  title: completeComm.title,
                  message: completeComm.content
                }],
                completeComm.organization.name,
                [{
                  email: recipient.email,
                  name: fullName,
                  language: language
                }]
              );
            }

            // console.log(`✅ Sent general communication emails to ${finalRecipients.length} recipients`);
            
            // Enhanced audit logging for urgent communications
            if (completeComm.isUrgent) {
              const auditEntry = {
                userId: completeComm.creator.id,
                userEmail: completeComm.creator.email,
                userRole: currentUser.role,
                organizationId: completeComm.organizationId,
                organizationName: completeComm.organization.name,
                communicationId: completeComm.id,
                messageTitle: completeComm.title,
                recipientsCount: finalRecipients.length,
                isUrgent: true,
                timestamp: new Date().toISOString(),
                reason: 'Bypassing user notification preferences for urgent communication',
                recipientRoles: completeComm.recipientRoles,
              };
              
              // Persistent audit log (console until database audit table is available)
              // console.log(`🚨 URGENT COMMUNICATION AUDIT:`, JSON.stringify(auditEntry, null, 2));
              
              // Traditional log
              // console.log(`🔍 AUDIT: Urgent communication "${completeComm.title}" sent to ${finalRecipients.length} recipients by ${completeComm.creator.email}, bypassing user preferences`);
            }
          } else {
            // console.log(`📭 No eligible recipients found for general communication after filtering`);
          }
        } else {
          // console.log(`📭 No recipients found for general communication`);
        }
      } catch (emailError: any) {
        // Log email error but don't fail the API call
        // console.error('❌ Error sending general communication emails:', emailError);
      }

      // console.log(`✅ Created general communication ${newCommunication.id}`);
      res.status(201).json(completeComm);
    } catch (error: any) {
      // console.error('❌ Error creating general communication:', error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({
          _error: 'Validation error',
          message: 'Invalid communication data provided',
          details: error.errors,
        });
      }

      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to create general communication',
      });
    }
  });

  /**
   * GET /api/communication/general/:id - Get specific communication details
   * Returns detailed information about a specific communication with organization access check.
   */
  app.get('/api/communication/general/:id', requireAuth, asyncHandler(async (req: any, res) => {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      const communicationId = req.params.id;

      // console.log(`📧 Fetching communication ${communicationId} for user ${currentUser.id}`);

      // Fetch the communication with related data
      const [communication] = await db
        .select({
          id: generalCommunications.id,
          organizationId: generalCommunications.organizationId,
          createdBy: generalCommunications.createdBy,
          title: generalCommunications.title,
          content: generalCommunications.content,
          isUrgent: generalCommunications.isUrgent,
          scheduledFor: generalCommunications.scheduledFor,
          sentAt: generalCommunications.sentAt,
          recipientRoles: generalCommunications.recipientRoles,
          createdAt: generalCommunications.createdAt,
          organization: {
            id: organizations.id,
            name: organizations.name,
          },
          creator: {
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
          },
        })
        .from(generalCommunications)
        .innerJoin(organizations, eq(generalCommunications.organizationId, organizations.id))
        .innerJoin(users, eq(generalCommunications.createdBy, users.id))
        .where(eq(generalCommunications.id, communicationId))
        .limit(1);

      if (!communication) {
        return res.status(404).json({
          message: 'Communication not found',
          code: 'COMMUNICATION_NOT_FOUND',
        });
      }

      // Check organization access (unless admin)
      if (currentUser.role !== 'admin') {
        const userOrg = await db
          .select()
          .from(userOrganizations)
          .where(
            and(
              eq(userOrganizations.userId, currentUser.id),
              eq(userOrganizations.organizationId, communication.organizationId),
              eq(userOrganizations.isActive, true)
            )
          )
          .limit(1);

        if (userOrg.length === 0) {
          return res.status(403).json({
            message: 'Access denied to this organization',
            code: 'ORGANIZATION_ACCESS_DENIED',
          });
        }
      }

      // console.log(`✅ Returning communication ${communicationId}`);
      res.json(communication);
    }, { errorMessage: 'Failed to fetch communication', errorLogPrefix: '❌ Error fetch communication', extraErrorFields: { '_error': 'Internal server error' } }));

  // ==========================================
  // MEETINGS ROUTES
  // ==========================================

  /**
   * GET /api/communication/meetings - Get meetings for user's organization(s)
   * Returns meetings based on user's role and organization access.
   */
  app.get('/api/communication/meetings', requireAuth, asyncHandler(async (req: any, res) => {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // console.log(`🗓️ Fetching meetings for user ${currentUser.id} with role ${currentUser.role}`);

      // Apply role-based filtering and build complete query
      let meetingList;
      if (currentUser.role === 'admin') {
        // Admin can see all meetings - no additional filtering
        // console.log('🔓 [ADMIN] No filtering applied - admin can see all meetings');
        meetingList = await db
          .select({
            id: meetings.id,
            organizationId: meetings.organizationId,
            createdBy: meetings.createdBy,
            title: meetings.title,
            description: meetings.description,
            location: meetings.location,
            scheduledDate: meetings.scheduledDate,
            duration: meetings.duration,
            invitedRoles: meetings.invitedRoles,
            sentAt: meetings.sentAt,
            createdAt: meetings.createdAt,
            organization: {
              id: organizations.id,
              name: organizations.name,
            },
            creator: {
              id: users.id,
              firstName: users.firstName,
              lastName: users.lastName,
              email: users.email,
            },
          })
          .from(meetings)
          .innerJoin(organizations, eq(meetings.organizationId, organizations.id))
          .innerJoin(users, eq(meetings.createdBy, users.id))
          .orderBy(meetings.scheduledDate);
      } else {
        // Get user's accessible organizations
        const userOrgs = await db
          .select({ organizationId: userOrganizations.organizationId })
          .from(userOrganizations)
          .where(
            and(
              eq(userOrganizations.userId, currentUser.id),
              eq(userOrganizations.isActive, true)
            )
          );

        if (userOrgs.length === 0) {
          // console.log('📭 User has no accessible organizations');
          return res.json([]);
        }

        const orgIds = userOrgs.map(org => org.organizationId);
        meetingList = await db
          .select({
            id: meetings.id,
            organizationId: meetings.organizationId,
            createdBy: meetings.createdBy,
            title: meetings.title,
            description: meetings.description,
            location: meetings.location,
            scheduledDate: meetings.scheduledDate,
            duration: meetings.duration,
            invitedRoles: meetings.invitedRoles,
            sentAt: meetings.sentAt,
            createdAt: meetings.createdAt,
            organization: {
              id: organizations.id,
              name: organizations.name,
            },
            creator: {
              id: users.id,
              firstName: users.firstName,
              lastName: users.lastName,
              email: users.email,
            },
          })
          .from(meetings)
          .innerJoin(organizations, eq(meetings.organizationId, organizations.id))
          .innerJoin(users, eq(meetings.createdBy, users.id))
          .where(inArray(meetings.organizationId, orgIds))
          .orderBy(meetings.scheduledDate);

        // console.log(`🔒 Filtering meetings for organizations: [${orgIds.join(', ')}]`);
      }

      // console.log(`✅ Found ${meetingList.length} meetings`);
      res.json(meetingList);
    }, { errorMessage: 'Failed to fetch meetings', errorLogPrefix: '❌ Error fetch meetings', extraErrorFields: { '_error': 'Internal server error' } }));

  /**
   * POST /api/communication/meetings - Create meeting and send invites (managers/admins only)
   * Creates a new meeting for an organization.
   */
  app.post('/api/communication/meetings', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Check if user has permission to create meetings
      if (!['admin', 'manager', 'demo_manager'].includes(currentUser.role)) {
        return res.status(403).json({
          message: 'Insufficient permissions to create meetings',
          code: 'PERMISSION_DENIED',
        });
      }

      // Validate request body
      const validatedData = insertMeetingSchema.parse(req.body);

      // console.log(`🗓️ Creating meeting for organization ${validatedData.organizationId} by user ${currentUser.id}`);

      // If not admin, verify user has access to the organization
      if (currentUser.role !== 'admin') {
        const userOrg = await db
          .select()
          .from(userOrganizations)
          .where(
            and(
              eq(userOrganizations.userId, currentUser.id),
              eq(userOrganizations.organizationId, validatedData.organizationId),
              eq(userOrganizations.isActive, true)
            )
          )
          .limit(1);

        if (userOrg.length === 0) {
          return res.status(403).json({
            message: 'Access denied to this organization',
            code: 'ORGANIZATION_ACCESS_DENIED',
          });
        }
      }

      // Set the creator
      const meetingData = {
        ...validatedData,
        createdBy: currentUser.id,
        sentAt: new Date(), // Mark invites as sent immediately
      } as typeof meetings.$inferInsert;

      // Create the meeting
      const [newMeeting] = await db
        .insert(meetings)
        .values([meetingData])
        .returning();

      // Fetch the complete meeting with related data
      const [completeMeeting] = await db
        .select({
          id: meetings.id,
          organizationId: meetings.organizationId,
          createdBy: meetings.createdBy,
          title: meetings.title,
          description: meetings.description,
          location: meetings.location,
          scheduledDate: meetings.scheduledDate,
          duration: meetings.duration,
          invitedRoles: meetings.invitedRoles,
          sentAt: meetings.sentAt,
          createdAt: meetings.createdAt,
          organization: {
            id: organizations.id,
            name: organizations.name,
          },
          creator: {
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
          },
        })
        .from(meetings)
        .innerJoin(organizations, eq(meetings.organizationId, organizations.id))
        .innerJoin(users, eq(meetings.createdBy, users.id))
        .where(eq(meetings.id, newMeeting.id));

      // Send meeting invitation emails to invited roles
      try {
        // console.log(`📧 Sending meeting invitations for: ${completeMeeting.title}`);
        
        // Get recipients based on organization and invited roles
        const recipients = await db
          .select({
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            language: users.language,
          })
          .from(users)
          .innerJoin(userOrganizations, eq(users.id, userOrganizations.userId))
          .where(
            and(
              eq(userOrganizations.organizationId, completeMeeting.organizationId),
              eq(userOrganizations.isActive, true),
              // Filter by invited roles if specified
              meetingData.invitedRoles?.length > 0 
                ? inArray(userOrganizations.organizationRole, meetingData.invitedRoles as any)
                : sql`1=1` // No role filter if no specific roles specified
            )
          );

        if (recipients.length > 0) {
          // Group recipients by language for efficient sending
          const recipientsByLanguage = recipients.reduce((acc, recipient) => {
            const lang = recipient.language || 'fr';
            if (!acc[lang]) acc[lang] = [];
            acc[lang].push(recipient.email);
            return acc;
          }, {} as Record<string, string[]>);

          // Send meeting invitations for each language group
          for (const [language, emailAddresses] of Object.entries(recipientsByLanguage)) {
            await communicationService.sendMeetingInvitation(
              emailAddresses,
              {
                title: completeMeeting.title,
                description: completeMeeting.description || undefined,
                location: completeMeeting.location,
                scheduledDate: completeMeeting.scheduledDate,
                duration: completeMeeting.duration,
                organizerName: `${completeMeeting.creator.firstName} ${completeMeeting.creator.lastName}`,
                organizerEmail: completeMeeting.creator.email,
                organizationName: completeMeeting.organization.name,
              },
              language as 'fr' | 'en'
            );
          }

          // console.log(`✅ Sent meeting invitations to ${recipients.length} recipients`);
        } else {
          // console.log(`📭 No recipients found for meeting invitation`);
        }
      } catch (emailError: any) {
        // Log email error but don't fail the API call
        // console.error('❌ Error sending meeting invitation emails:', emailError);
      }

      // console.log(`✅ Created meeting ${newMeeting.id}`);
      res.status(201).json(completeMeeting);
    } catch (error: any) {
      // console.error('❌ Error creating meeting:', error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({
          _error: 'Validation error',
          message: 'Invalid meeting data provided',
          details: error.errors,
        });
      }

      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to create meeting',
      });
    }
  });

  /**
   * PUT /api/communication/meetings/:id - Update meeting (creators/admins only)
   * Updates an existing meeting with new information.
   */
  app.put('/api/communication/meetings/:id', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      const meetingId = req.params.id;

      // Fetch the existing meeting
      const [existingMeeting] = await db
        .select()
        .from(meetings)
        .where(eq(meetings.id, meetingId))
        .limit(1);

      if (!existingMeeting) {
        return res.status(404).json({
          message: 'Meeting not found',
          code: 'MEETING_NOT_FOUND',
        });
      }

      // Check permissions: only creator or admin can update
      if (currentUser.role !== 'admin' && existingMeeting.createdBy !== currentUser.id) {
        return res.status(403).json({
          message: 'Only the meeting creator or admin can update this meeting',
          code: 'UPDATE_PERMISSION_DENIED',
        });
      }

      // Validate request body (partial update)
      const updateSchema = insertMeetingSchema.omit({ organizationId: true, createdBy: true }).partial();
      const validatedUpdates = updateSchema.parse(req.body);

      // console.log(`🗓️ Updating meeting ${meetingId} by user ${currentUser.id}`);

      // Update the meeting
      const [updatedMeeting] = await db
        .update(meetings)
        .set(validatedUpdates)
        .where(eq(meetings.id, meetingId))
        .returning();

      // Fetch the complete updated meeting with related data
      const [completeMeeting] = await db
        .select({
          id: meetings.id,
          organizationId: meetings.organizationId,
          createdBy: meetings.createdBy,
          title: meetings.title,
          description: meetings.description,
          location: meetings.location,
          scheduledDate: meetings.scheduledDate,
          duration: meetings.duration,
          invitedRoles: meetings.invitedRoles,
          sentAt: meetings.sentAt,
          createdAt: meetings.createdAt,
          organization: {
            id: organizations.id,
            name: organizations.name,
          },
          creator: {
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
          },
        })
        .from(meetings)
        .innerJoin(organizations, eq(meetings.organizationId, organizations.id))
        .innerJoin(users, eq(meetings.createdBy, users.id))
        .where(eq(meetings.id, meetingId));

      // console.log(`✅ Updated meeting ${meetingId}`);
      res.json(completeMeeting);
    } catch (error: any) {
      // console.error('❌ Error updating meeting:', error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({
          _error: 'Validation error',
          message: 'Invalid meeting update data provided',
          details: error.errors,
        });
      }

      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to update meeting',
      });
    }
  });

  /**
   * DELETE /api/communication/meetings/:id - Cancel meeting (creators/admins only)
   * Cancels an existing meeting by deleting it.
   */
  app.delete('/api/communication/meetings/:id', requireAuth, asyncHandler(async (req: any, res) => {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      const meetingId = req.params.id;

      // Fetch the existing meeting
      const [existingMeeting] = await db
        .select()
        .from(meetings)
        .where(eq(meetings.id, meetingId))
        .limit(1);

      if (!existingMeeting) {
        return res.status(404).json({
          message: 'Meeting not found',
          code: 'MEETING_NOT_FOUND',
        });
      }

      // Check permissions: only creator or admin can delete
      if (currentUser.role !== 'admin' && existingMeeting.createdBy !== currentUser.id) {
        return res.status(403).json({
          message: 'Only the meeting creator or admin can cancel this meeting',
          code: 'DELETE_PERMISSION_DENIED',
        });
      }

      // console.log(`🗓️ Cancelling meeting ${meetingId} by user ${currentUser.id}`);

      // Delete the meeting
      await db
        .delete(meetings)
        .where(eq(meetings.id, meetingId));

      // console.log(`✅ Cancelled meeting ${meetingId}`);
      res.status(204).send();
    }, { errorMessage: 'Failed to cancel meeting', errorLogPrefix: '❌ Error cancel meeting', extraErrorFields: { '_error': 'Internal server error' } }));

  // ==========================================
  // NOTIFICATION CONFIGURATIONS ROUTES
  // ==========================================

  /**
   * GET /api/communication/notification-configs - List notification configurations
   * Returns all notification configs for the specified building with proper filtering.
   */
  app.get('/api/communication/notification-configs', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Check if user can manage notifications (managers and admins only)
      if (!['admin', 'manager', 'demo_manager'].includes(currentUser.role)) {
        return res.status(403).json({
          message: 'Only managers and administrators can view notification configurations',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      // Parse and validate query parameters
      const querySchema = z.object({
        organizationId: z.string().uuid('Invalid organization ID'),
        buildingId: z.string().uuid('Invalid building ID'),
      });

      let organizationId: string;
      let buildingId: string;
      
      try {
        const parsed = querySchema.parse(req.query);
        organizationId = parsed.organizationId;
        buildingId = parsed.buildingId;
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return res.status(400).json({
            message: 'Invalid query parameters',
            code: 'VALIDATION_ERROR',
            details: error.errors,
          });
        }
        throw error;
      }

      // SECURITY FIX: Verify user has access to this specific building
      const hasAccess = await authorizeBuildingAccess(
        currentUser.id,
        organizationId,
        buildingId,
        currentUser.role
      );

      if (!hasAccess) {
        return res.status(403).json({
          message: 'Access denied to this building',
          code: 'BUILDING_ACCESS_DENIED',
        });
      }

      // Fetch notification configurations for the building
      const configurations = await db
        .select({
          id: notificationConfigurations.id,
          organizationId: notificationConfigurations.organizationId,
          buildingId: notificationConfigurations.buildingId,
          createdBy: notificationConfigurations.createdBy,
          type: notificationConfigurations.type,
          title: notificationConfigurations.title,
          message: notificationConfigurations.message,
          frequency: notificationConfigurations.frequency,
          startDate: notificationConfigurations.startDate,
          isActive: notificationConfigurations.isActive,
          endsAt: notificationConfigurations.endsAt,
          timezone: notificationConfigurations.timezone,
          createdAt: notificationConfigurations.createdAt,
          updatedAt: notificationConfigurations.updatedAt,
          createdByName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`.as('createdByName'),
        })
        .from(notificationConfigurations)
        .leftJoin(users, eq(notificationConfigurations.createdBy, users.id))
        .where(and(
          eq(notificationConfigurations.organizationId, organizationId),
          eq(notificationConfigurations.buildingId, buildingId),
          eq(notificationConfigurations.isActive, true)
        ))
        .orderBy(desc(notificationConfigurations.createdAt));

      res.json({
        configurations,
        total: configurations.length,
      });
    } catch (error: any) {
      // console.error('❌ Error fetching notification configurations:', error);
      if (error.issues) {
        return res.status(400).json({
          message: 'Invalid query parameters',
          code: 'VALIDATION_ERROR',
          details: error.issues,
        });
      }
      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to fetch notification configurations',
      });
    }
  });

  /**
   * POST /api/communication/notification-configs - Create new notification configuration
   * Creates a new notification configuration with validation.
   */
  app.post('/api/communication/notification-configs', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Check if user can manage notifications (managers and admins only)
      if (!['admin', 'manager', 'demo_manager'].includes(currentUser.role)) {
        return res.status(403).json({
          message: 'Only managers and administrators can create notification configurations',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      // Parse and validate request body using the schema
      const validatedData = insertNotificationConfigurationSchema.parse({
        ...req.body,
        createdBy: currentUser.id,
      }) as typeof notificationConfigurations.$inferInsert;

      // SECURITY FIX: Verify user has access to this specific building
      const hasAccess = await authorizeBuildingAccess(
        currentUser.id,
        validatedData.organizationId,
        validatedData.buildingId,
        currentUser.role
      );

      if (!hasAccess) {
        return res.status(403).json({
          message: 'Access denied to this building',
          code: 'BUILDING_ACCESS_DENIED',
        });
      }

      // Create the notification configuration
      const [newConfig] = await db
        .insert(notificationConfigurations)
        .values([validatedData])
        .returning();

      // console.log(`✅ Created notification configuration ${newConfig.id} by user ${currentUser.id}`);

      res.status(201).json({
        configuration: newConfig,
        message: 'Notification configuration created successfully',
      });
    } catch (error: any) {
      // console.error('❌ Error creating notification configuration:', error);
      if (error.issues) {
        return res.status(400).json({
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.issues,
        });
      }
      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to create notification configuration',
      });
    }
  });

  /**
   * PATCH /api/communication/notification-configs/:id - Update notification configuration
   * Updates a notification configuration with partial data and proper authorization.
   */
  app.patch('/api/communication/notification-configs/:id', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Check if user can manage notifications (managers and admins only)
      if (!['admin', 'manager', 'demo_manager'].includes(currentUser.role)) {
        return res.status(403).json({
          message: 'Only managers and administrators can update notification configurations',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      const { id } = req.params;

      // Validate ID
      if (!id) {
        return res.status(400).json({
          message: 'Configuration ID is required',
          code: 'MISSING_ID',
        });
      }

      // Find the existing configuration
      const [existingConfig] = await db
        .select()
        .from(notificationConfigurations)
        .where(eq(notificationConfigurations.id, id))
        .limit(1);

      if (!existingConfig) {
        return res.status(404).json({
          message: 'Notification configuration not found',
          code: 'CONFIG_NOT_FOUND',
        });
      }

      // SECURITY FIX: Verify user has access to this specific building
      const hasAccess = await authorizeBuildingAccess(
        currentUser.id,
        existingConfig.organizationId,
        existingConfig.buildingId,
        currentUser.role
      );

      if (!hasAccess) {
        return res.status(403).json({
          message: 'Access denied to this building',
          code: 'BUILDING_ACCESS_DENIED',
        });
      }

      // Create partial update schema by making most fields optional
      // Note: Cannot use .partial() on refined schema, so we manually define optional fields
      const partialUpdateSchema = z.object({
        type: z.enum(['seasonal_reminder', 'announcement']).optional(),
        title: z.string().min(1, 'Title is required').optional(),
        message: z.string().min(1, 'Message is required').optional(),
        frequency: z.enum(['unique', 'weekly', 'bi_weekly', 'monthly', 'quarterly', 'bi-annually', 'annually']).optional(),
        startDate: z.coerce.date().optional(),
        isActive: z.boolean().optional(),
        endsAt: z.coerce.date().optional(),
        timezone: z.string().optional(),
      }).refine((data) => {
        if (data.endsAt && data.startDate) {
          return data.endsAt >= data.startDate;
        }
        return true;
      }, {
        message: 'End date must be on or after the start date',
        path: ['endsAt'],
      });

      // Validate the partial update data
      const updateData = partialUpdateSchema.parse(req.body);

      // Update the configuration
      const [updatedConfig] = await db
        .update(notificationConfigurations)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(notificationConfigurations.id, id))
        .returning();

      // console.log(`✅ Updated notification configuration ${id} by user ${currentUser.id}`);

      res.json({
        configuration: updatedConfig,
        message: 'Notification configuration updated successfully',
      });
    } catch (error: any) {
      // console.error('❌ Error updating notification configuration:', error);
      if (error.issues) {
        return res.status(400).json({
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.issues,
        });
      }
      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to update notification configuration',
      });
    }
  });

  /**
   * DELETE /api/communication/notification-configs/:id - Delete notification configuration
   * Soft deletes a notification configuration by setting isActive to false.
   */
  app.delete('/api/communication/notification-configs/:id', requireAuth, asyncHandler(async (req: any, res) => {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Check if user can manage notifications (managers and admins only)
      if (!['admin', 'manager', 'demo_manager'].includes(currentUser.role)) {
        return res.status(403).json({
          message: 'Only managers and administrators can delete notification configurations',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      const { id } = req.params;

      // Validate ID
      if (!id) {
        return res.status(400).json({
          message: 'Configuration ID is required',
          code: 'MISSING_ID',
        });
      }

      // Find the existing configuration
      const [existingConfig] = await db
        .select()
        .from(notificationConfigurations)
        .where(eq(notificationConfigurations.id, id))
        .limit(1);

      if (!existingConfig) {
        return res.status(404).json({
          message: 'Notification configuration not found',
          code: 'CONFIG_NOT_FOUND',
        });
      }

      // SECURITY FIX: Verify user has access to this specific building
      const hasAccess = await authorizeBuildingAccess(
        currentUser.id,
        existingConfig.organizationId,
        existingConfig.buildingId,
        currentUser.role
      );

      if (!hasAccess) {
        return res.status(403).json({
          message: 'Access denied to this building',
          code: 'BUILDING_ACCESS_DENIED',
        });
      }

      // Soft delete by setting isActive to false
      await db
        .update(notificationConfigurations)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(notificationConfigurations.id, id));

      // console.log(`✅ Soft deleted notification configuration ${id} by user ${currentUser.id}`);

      res.status(204).send();
    }, { errorMessage: 'Failed to delete notification configuration', errorLogPrefix: '❌ Error delete notification configuration', extraErrorFields: { '_error': 'Internal server error' } }));

  /**
   * POST /api/communication/notification-configs/:id/preview - Send notification preview
   * Sends a test notification to the current user for preview purposes.
   */
  app.post('/api/communication/notification-configs/:id/preview', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Check if user can manage notifications (managers and admins only)
      if (!['admin', 'manager', 'demo_manager'].includes(currentUser.role)) {
        return res.status(403).json({
          message: 'Only managers and administrators can preview notification configurations',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      const { id } = req.params;

      // Validate ID
      if (!id) {
        return res.status(400).json({
          message: 'Configuration ID is required',
          code: 'MISSING_ID',
        });
      }

      // Find the existing configuration
      const [config] = await db
        .select()
        .from(notificationConfigurations)
        .where(eq(notificationConfigurations.id, id))
        .limit(1);

      if (!config) {
        return res.status(404).json({
          message: 'Notification configuration not found',
          code: 'CONFIG_NOT_FOUND',
        });
      }

      // SECURITY FIX: Verify user has access to this specific building
      const hasAccess = await authorizeBuildingAccess(
        currentUser.id,
        config.organizationId,
        config.buildingId,
        currentUser.role
      );

      if (!hasAccess) {
        return res.status(403).json({
          message: 'Access denied to this building',
          code: 'BUILDING_ACCESS_DENIED',
        });
      }

      // Get organization details for context
      const [organization] = await db
        .select({
          id: organizations.id,
          name: organizations.name,
        })
        .from(organizations)
        .where(eq(organizations.id, config.organizationId))
        .limit(1);

      if (!organization) {
        return res.status(404).json({
          message: 'Organization not found',
          code: 'ORG_NOT_FOUND',
        });
      }

      // Parse language from request body (default to French)
      const previewSchema = z.object({
        language: z.enum(['fr', 'en']).default('fr'),
      });

      const { language } = previewSchema.parse(req.body);

      // console.log(`📧 Sending preview notification for config ${id} to user ${currentUser.email}`);

      // Create recipient object
      const recipients = [{
        email: currentUser.email,
        name: `${currentUser.firstName} ${currentUser.lastName}`,
        language: language as 'fr' | 'en',
      }];

      // Send preview email using the notification configuration data
      const recipient = recipients[0];
      const success = await communicationService.sendPasswordResetEmail(
        recipient.email,
        recipient.name,
        config.title,
        recipient.language
      );

      if (!success) {
        // console.error(`❌ Failed to send preview notification for config ${id}`);
        return res.status(500).json({
          message: 'Failed to send preview email',
          code: 'EMAIL_SEND_FAILED',
        });
      }

      // console.log(`✅ Preview notification sent successfully for config ${id}`);

      res.json({
        message: 'Preview notification sent successfully',
        recipient: currentUser.email,
        configuration: {
          id: config.id,
          title: config.title,
          type: config.type,
          frequency: config.frequency,
        },
      });
    } catch (error: any) {
      // console.error('❌ Error sending preview notification:', error);
      if (error.issues) {
        return res.status(400).json({
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.issues,
        });
      }
      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to send preview notification',
      });
    }
  });

  /**
   * POST /api/communication/preferences/test-combined-email - Send combined test notification email
   * Sends all enabled notification types in a single combined email for preview.
   */
  app.post('/api/communication/preferences/test-combined-email', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      const testEmailSchema = z.object({
        language: z.enum(['fr', 'en']).default('fr'),
      });

      const { language } = testEmailSchema.parse(req.body);

      logInfo('Sending combined test email to user', { userId: currentUser.id, metadata: { language } });

      // Get user's organization for context
      const [userOrganization] = await db
        .select({
          id: organizations.id,
          name: organizations.name,
        })
        .from(userOrganizations)
        .innerJoin(organizations, eq(userOrganizations.organizationId, organizations.id))
        .where(eq(userOrganizations.userId, currentUser.id))
        .limit(1);

      if (!userOrganization) {
        return res.status(404).json({
          message: 'No organization found for user',
          code: 'ORG_NOT_FOUND',
        });
      }

      // Get user's notification preferences to see which ones are enabled
      const preferences = await db
        .select()
        .from(userNotificationPreferences)
        .where(eq(userNotificationPreferences.userId, currentUser.id));

      // Get all notification types that are enabled
      const enabledNotificationTypes = preferences
        .filter(pref => pref.isEnabled)
        .map(pref => pref.notificationType);

      if (enabledNotificationTypes.length === 0) {
        return res.status(400).json({
          message: 'No notification types are enabled',
          code: 'NO_ENABLED_NOTIFICATIONS',
        });
      }

      // Generate test content for all enabled notification types
      const notificationsData = enabledNotificationTypes.map(notificationType => {
        const template = generateTestNotificationContent(notificationType, currentUser, userOrganization, language);
        return {
          type: notificationType,
          title: template.subject.replace(` - ${userOrganization.name}`, ''), // Remove org name from title since it's added later
          message: template.message,
        };
      });

      // Create recipient object
      const recipients = [{
        email: currentUser.email,
        name: `${currentUser.firstName} ${currentUser.lastName}`,
        language: language as 'fr' | 'en',
      }];

      // Send combined test email
      const success = await communicationService.sendCombinedTestEmail(
        notificationsData,
        userOrganization.name,
        recipients
      );

      if (success) {
        logInfo('Combined test email sent successfully', { userId: currentUser.id });
        res.json({
          success: true,
          message: `Combined test email sent to ${currentUser.email}`,
        });
      } else {
        logError('Failed to send combined test email');
        res.status(500).json({
          success: false,
          message: 'Failed to send combined test email',
        });
      }
    } catch (error: any) {
      logError('Error sending combined test email', error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({
          _error: 'Validation error',
          message: 'Invalid test email parameters provided',
          details: error.errors,
        });
      }

      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to send combined test email',
      });
    }
  });

  /**
   * POST /api/communication/preferences/test-email - Send test notification email
   * Sends a sample notification email to the user with their real data for preview.
   */
  app.post('/api/communication/preferences/test-email', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Validate request body
      const testEmailSchema = z.object({
        notificationType: z.enum([
          'bill_reminder',
          'maintenance_update',
          'announcement',
          'system',
          'upcoming_payment',
          'upcoming_bills',
          'bill_paid_last_month',
          'bills_overdue',
          'payment_overdue',
          'new_building_document',
          'meeting_invite',
          'maintenance_completed',
          'budget_update',
          'policy_change',
          'seasonal_reminder',
        ]),
        language: z.enum(['fr', 'en']).default('fr'),
      });

      const { notificationType, language } = testEmailSchema.parse(req.body);

      // console.log(`📧 Sending test email for ${notificationType} to user ${currentUser.email} in ${language}`);

      // Get user's organization for context
      const [userOrganization] = await db
        .select({
          id: organizations.id,
          name: organizations.name,
        })
        .from(userOrganizations)
        .innerJoin(organizations, eq(userOrganizations.organizationId, organizations.id))
        .where(eq(userOrganizations.userId, currentUser.id))
        .limit(1);

      // Generate sample notification content based on type
      const notificationContent = generateTestNotificationContent(notificationType, currentUser, userOrganization, language);

      // Send the test email using the combined test email service (with single notification)
      const success = await communicationService.sendCombinedTestEmail(
        [{
          type: notificationType,
          title: notificationContent.subject.replace(` - ${userOrganization.name}`, ''),
          message: notificationContent.message,
        }],
        userOrganization.name,
        [{
          email: currentUser.email,
          name: `${currentUser.firstName} ${currentUser.lastName}`,
          language: language as 'fr' | 'en',
        }]
      );

      if (success) {
        // console.log(`✅ Test email sent successfully to ${currentUser.email}`);
        res.json({
          success: true,
          message: `Test email sent to ${currentUser.email}`,
          notificationType,
          language,
        });
      } else {
        // console.error(`❌ Failed to send test email to ${currentUser.email}`);
        res.status(500).json({
          success: false,
          message: 'Failed to send test email',
        });
      }
    } catch (error: any) {
      // console.error('❌ Error sending test email:', error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({
          _error: 'Validation error',
          message: 'Invalid test email parameters provided',
          details: error.errors,
        });
      }

      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to send test email',
      });
    }
  });
}

/**
 * Generates test notification content based on notification type and user data.
 */
function generateTestNotificationContent(
  notificationType: string,
  user: any,
  organization: any,
  language: 'fr' | 'en'
) {
  const userName = `${user.firstName} ${user.lastName}`;
  const orgName = organization?.name || 'Votre immeuble';

  const templates = {
    fr: {
      bill_reminder: {
        subject: `Rappel de facture - ${orgName}`,
        message: `Bonjour ${userName}, voici le détail de votre facture de ${orgName}:\n\nDate d'échéance: 25 janvier 2025\nMontant: 850,00 $\nFournisseur: Gestion ABC Inc.\nNote: Frais de copropriété mensuels incluant chauffage et entretien commun`,
      },
      maintenance_update: {
        subject: `Mise à jour maintenance - ${orgName}`,
        message: `Bonjour ${userName}, les travaux de réparation de l'ascenseur dans ${orgName} sont maintenant terminés. Merci pour votre patience.`,
      },
      announcement: {
        subject: `Annonce importante - ${orgName}`,
        message: `Bonjour ${userName}, une assemblée générale aura lieu le 15 février 2025 à 19h00 dans la salle communautaire de ${orgName}.`,
      },
      upcoming_payment: {
        subject: `Paiement à venir - ${orgName}`,
        message: `Bonjour ${userName}, voici le détail de votre paiement à venir pour ${orgName}:\n\nDate d'échéance: 22 janvier 2025\nMontant: 850,00 $\nFournisseur: Gestion ABC Inc.\nNote: Frais de copropriété mensuels - paiement dû dans 2 jours`,
      },
      budget_update: {
        subject: `Mise à jour budgétaire - ${orgName}`,
        message: `Bonjour ${userName}, le rapport budgétaire trimestriel de ${orgName} est maintenant disponible. Consultez-le dans votre espace personnel.`,
      },
      upcoming_bills: {
        subject: `Nouvelles factures disponibles - ${orgName}`,
        message: `Bonjour ${userName}, de nouvelles factures sont disponibles pour ${orgName}:\n\nDate d'échéance: 30 janvier 2025\nMontant: 850,00 $\nFournisseur: Gestion ABC Inc.\nNote: Factures mensuelles émises - consultez les détails complets`,
      },
      bills_overdue: {
        subject: `Factures en retard - ${orgName}`,
        message: `Bonjour ${userName}, attention aux factures en retard pour ${orgName}:\n\nDate d'échéance dépassée: 15 janvier 2025\nMontant: 850,00 $\nFournisseur: Gestion ABC Inc.\nNote: Paiement en retard de 5 jours - veuillez régler rapidement`,
      },
      payment_overdue: {
        subject: `Paiement en retard urgent - ${orgName}`,
        message: `Bonjour ${userName}, paiement urgent en retard pour ${orgName}:\n\nDate d'échéance dépassée: 10 janvier 2025\nMontant: 850,00 $\nFournisseur: Gestion ABC Inc.\nNote: Paiement en retard de 10 jours - situation urgente nécessitant attention immédiate`,
      },
      bill_paid_last_month: {
        subject: `Confirmation de paiement - ${orgName}`,
        message: `Bonjour ${userName}, confirmation de votre paiement pour ${orgName}:\n\nDate de paiement: 20 décembre 2024\nMontant: 850,00 $\nFournisseur: Gestion ABC Inc.\nNote: Paiement reçu et traité - merci`,
      },
      system: {
        subject: `Notification système - ${orgName}`,
        message: `Bonjour ${userName}, notification système importante pour ${orgName}: Les paramètres de sécurité ont été mis à jour. Veuillez vérifier vos informations.`,
      },
      new_building_document: {
        subject: `Nouveau document disponible - ${orgName}`,
        message: `Bonjour ${userName}, un nouveau document important a été ajouté pour ${orgName}: "Règlements de copropriété mis à jour". Consultez-le dans votre espace documents.`,
      },
      meeting_invite: {
        subject: `Invitation à une réunion - ${orgName}`,
        message: `Bonjour ${userName}, vous êtes invité à l'assemblée générale annuelle de ${orgName} le 15 février 2025 à 19h00 dans la salle communautaire.`,
      },
      maintenance_completed: {
        subject: `Travaux complétés - ${orgName}`,
        message: `Bonjour ${userName}, les travaux de rénovation du hall d'entrée de ${orgName} sont maintenant complétés. Merci pour votre patience durant les travaux.`,
      },
      policy_change: {
        subject: `Changement de politique - ${orgName}`,
        message: `Bonjour ${userName}, une mise à jour importante des politiques de ${orgName}: Les heures d'utilisation de la salle commune sont maintenant de 8h à 22h. Consultez le règlement complet.`,
      },
      seasonal_reminder: {
        subject: `Rappel saisonnier - ${orgName}`,
        message: `Bonjour ${userName}, rappel saisonnier pour ${orgName}: N'oubliez pas de fermer les fenêtres avant votre départ en vacances et de vérifier les thermostats.`,
      },
    },
    en: {
      bill_reminder: {
        subject: `Bill Reminder - ${orgName}`,
        message: `Hello ${userName}, here are the details of your bill for ${orgName}:\n\nDue Date: January 25, 2025\nPayment: $850.00\nVendor: ABC Management Inc.\nNote: Monthly condo fees including heating and common area maintenance`,
      },
      maintenance_update: {
        subject: `Maintenance Update - ${orgName}`,
        message: `Hello ${userName}, the elevator repair work at ${orgName} is now complete. Thank you for your patience.`,
      },
      announcement: {
        subject: `Important Announcement - ${orgName}`,
        message: `Hello ${userName}, a general assembly will be held on February 15, 2025 at 7:00 PM in the community room at ${orgName}.`,
      },
      upcoming_payment: {
        subject: `Upcoming Payment - ${orgName}`,
        message: `Hello ${userName}, here are the details of your upcoming payment for ${orgName}:\n\nDue Date: January 22, 2025\nPayment: $850.00\nVendor: ABC Management Inc.\nNote: Monthly condo fees - payment due in 2 days`,
      },
      budget_update: {
        subject: `Budget Update - ${orgName}`,
        message: `Hello ${userName}, the quarterly budget report for ${orgName} is now available. View it in your personal dashboard.`,
      },
      upcoming_bills: {
        subject: `New Bills Available - ${orgName}`,
        message: `Hello ${userName}, new bills are available for ${orgName}:\n\nDue Date: January 30, 2025\nPayment: $850.00\nVendor: ABC Management Inc.\nNote: Monthly bills issued - view complete details`,
      },
      bills_overdue: {
        subject: `Bills Overdue - ${orgName}`,
        message: `Hello ${userName}, attention to overdue bills for ${orgName}:\n\nDue Date Passed: January 15, 2025\nPayment: $850.00\nVendor: ABC Management Inc.\nNote: Payment overdue by 5 days - please settle promptly`,
      },
      payment_overdue: {
        subject: `Urgent Payment Overdue - ${orgName}`,
        message: `Hello ${userName}, urgent overdue payment for ${orgName}:\n\nDue Date Passed: January 10, 2025\nPayment: $850.00\nVendor: ABC Management Inc.\nNote: Payment overdue by 10 days - urgent situation requiring immediate attention`,
      },
      bill_paid_last_month: {
        subject: `Payment Confirmation - ${orgName}`,
        message: `Hello ${userName}, confirmation of your payment for ${orgName}:\n\nPayment Date: December 20, 2024\nPayment: $850.00\nVendor: ABC Management Inc.\nNote: Payment received and processed - thank you`,
      },
      system: {
        subject: `System Notification - ${orgName}`,
        message: `Hello ${userName}, important system notification for ${orgName}: Security settings have been updated. Please verify your information.`,
      },
      new_building_document: {
        subject: `New Document Available - ${orgName}`,
        message: `Hello ${userName}, a new important document has been added for ${orgName}: "Updated Condo Regulations". View it in your documents section.`,
      },
      meeting_invite: {
        subject: `Meeting Invitation - ${orgName}`,
        message: `Hello ${userName}, you are invited to the annual general assembly of ${orgName} on February 15, 2025 at 7:00 PM in the community room.`,
      },
      maintenance_completed: {
        subject: `Work Completed - ${orgName}`,
        message: `Hello ${userName}, the entrance hall renovation work at ${orgName} is now complete. Thank you for your patience during the work.`,
      },
      policy_change: {
        subject: `Policy Change - ${orgName}`,
        message: `Hello ${userName}, an important policy update for ${orgName}: Common room usage hours are now 8am to 10pm. View the complete regulations.`,
      },
      seasonal_reminder: {
        subject: `Seasonal Reminder - ${orgName}`,
        message: `Hello ${userName}, seasonal reminder for ${orgName}: Don't forget to close windows before leaving for vacation and check your thermostats.`,
      },
    },
  };

  const langTemplates = templates[language];
  const template = langTemplates[notificationType as keyof typeof langTemplates] || langTemplates.announcement;

  return template;
}