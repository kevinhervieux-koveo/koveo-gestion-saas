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
  users,
  organizations,
  userOrganizations,
  insertUserNotificationPreferenceSchema,
  insertGeneralCommunicationSchema,
  insertMeetingSchema,
  insertNotificationSchema,
  notificationTypeEnum,
  frequencyEnum,
} from '@shared/schema';
import { and, eq, or, inArray, desc, sql } from 'drizzle-orm';
import { requireAuth } from '../auth';
import { z } from 'zod';
import { emailService } from '../services/email-service';
import { populateDefaultPreferences } from '../scripts/populate-default-notification-preferences';

/**
 * Registers all communication-related API endpoints.
 *
 * @param app - Express application instance.
 */
export function registerCommunicationRoutes(app: Express): void {
  // ==========================================
  // ORGANIZATION CONTEXT ROUTES
  // ==========================================

  /**
   * GET /api/communication/organization-context - Get organization context for communication
   * Returns user's organization information for sending general communications.
   */
  app.get('/api/communication/organization-context', requireAuth, async (req: any, res) => {
    try {
      console.log('🔍 [DEBUG] GET /api/communication/organization-context endpoint called');
      
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        console.log('❌ [DEBUG] No valid session found for organization-context');
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      console.log(`🔍 [DEBUG] User ${currentUser.id} (${currentUser.role}) requesting organization context`);

      // Check if user can send communications (managers and admins only)
      if (!['admin', 'manager', 'demo_manager'].includes(currentUser.role)) {
        console.log(`❌ [DEBUG] User ${currentUser.id} with role '${currentUser.role}' not authorized for organization context`);
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
        console.log(`❌ [DEBUG] No active organization found for user ${currentUser.id}`);
        return res.status(404).json({
          message: 'No organization found for user',
          code: 'NO_ORGANIZATION',
        });
      }

      console.log(`🔍 [DEBUG] Found organization ${userOrgResult.organizationId} for user ${currentUser.id}`);

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
        console.log(`❌ [DEBUG] Organization ${userOrgResult.organizationId} not found in database`);
        return res.status(404).json({
          message: 'Organization not found',
          code: 'ORGANIZATION_NOT_FOUND',
        });
      }

      console.log(`✅ [DEBUG] Returning organization context for ${organization.name} (${organization.id})`);

      res.json({
        id: organization.id,
        name: organization.name,
        canAccessAll: userOrgResult.canAccessAll,
        userRole: currentUser.role,
      });
    } catch (error: any) {
      console.error('❌ [DEBUG] Error in organization-context endpoint:', error);
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
      console.log('🔍 [DEBUG] GET /api/communication/settings endpoint called');
      
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        console.log('❌ [DEBUG] No valid session found for settings');
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      console.log(`🔍 [DEBUG] User ${currentUser.id} requesting notification settings`);

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
        console.log(`❌ [DEBUG] User ${currentUser.id} not found`);
        return res.status(404).json({
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      const startingDate = user.notificationsStartingDate || new Date().toISOString().split('T')[0];
      
      console.log(`✅ [DEBUG] Returning notification settings for user ${currentUser.id}, starting date: ${startingDate}`);

      res.json({
        startingDate,
      });
    } catch (error: any) {
      console.error('❌ [DEBUG] Error in settings endpoint:', error);
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
      console.log('🔍 [DEBUG] PUT /api/communication/settings endpoint called');
      
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        console.log('❌ [DEBUG] No valid session found for settings update');
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      // Validate request body
      const settingsSchema = z.object({
        startingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Starting date must be in YYYY-MM-DD format'),
      });

      const { startingDate } = settingsSchema.parse(req.body);

      console.log(`🔍 [DEBUG] User ${currentUser.id} updating notification settings, starting date: ${startingDate}`);

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
        console.log(`❌ [DEBUG] Failed to update settings for user ${currentUser.id}`);
        return res.status(404).json({
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      console.log(`✅ [DEBUG] Updated notification settings for user ${currentUser.id}`);

      res.json({
        startingDate: updatedUser.notificationsStartingDate,
      });
    } catch (error: any) {
      console.error('❌ [DEBUG] Error updating settings:', error);
      
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
  app.get('/api/communication/preferences', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      console.log(`📋 Fetching notification preferences for user ${currentUser.id}`);

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
        'emergency',
        'upcoming_payment',
        'upcoming_bills',
        'bill_paid_last_month',
        'bills_overdue',
        'payment_overdue',
        'new_building_document',
        'general_communication',
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
          isEnabled: true,
          createdAt: null,
          updatedAt: null,
        };
      });

      // If some preferences don't exist, create them with defaults
      const missingTypes = allNotificationTypes.filter(type => !existingMap.has(type as any));
      if (missingTypes.length > 0) {
        console.log(`📝 Creating default preferences for ${missingTypes.length} notification types`);
        
        const defaultPreferences = missingTypes.map(type => ({
          userId: currentUser.id,
          notificationType: type as any,
          frequency: 'monthly' as any,
          isEnabled: true,
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
        
        console.log(`✅ Returning ${finalPreferences.length} notification preferences`);
        return res.json(finalPreferences);
      }

      console.log(`✅ Returning ${preferences.length} notification preferences`);
      res.json(preferences);
    } catch (error: any) {
      console.error('❌ Error fetching notification preferences:', error);
      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to fetch notification preferences',
      });
    }
  });

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
          'emergency',
          'upcoming_payment',
          'upcoming_bills',
          'bill_paid_last_month',
          'bills_overdue',
          'payment_overdue',
          'new_building_document',
          'general_communication',
          'meeting_invite',
          'maintenance_completed',
          'budget_update',
          'policy_change',
          'seasonal_reminder',
        ]),
        frequency: z.enum(['immediate', 'weekly', '2weeks', 'monthly', 'quarterly', 'bi-annually', 'annually']),
        isEnabled: z.boolean(),
        startingDate: z.date().optional(),
      }));

      const validatedUpdates = updateSchema.parse(req.body);

      console.log(`📝 Updating ${validatedUpdates.length} notification preferences for user ${currentUser.id}`);

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
              startingDate: update.startingDate || sql`starting_date`,
              updatedAt: sql`now()`,
            },
          });
      }

      // Fetch updated preferences
      const updatedPreferences = await db
        .select()
        .from(userNotificationPreferences)
        .where(eq(userNotificationPreferences.userId, currentUser.id));

      console.log(`✅ Updated notification preferences successfully`);
      res.json(updatedPreferences);
    } catch (error: any) {
      console.error('❌ Error updating notification preferences:', error);
      
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

      console.log(`🔧 Admin ${currentUser.email} requesting default preferences population`);

      const result = await populateDefaultPreferences();

      if (result.success) {
        console.log(`✅ Default preferences populated: ${result.statistics.preferencesCreated} preferences created`);
        res.json(result);
      } else {
        console.error(`❌ Failed to populate default preferences: ${result.message}`);
        res.status(500).json(result);
      }
    } catch (error: any) {
      console.error('❌ Error in populate defaults endpoint:', error);
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
  app.post('/api/communication/preferences/reset', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      console.log(`🔄 Resetting notification preferences to defaults for user ${currentUser.id}`);

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
        'emergency',
        'upcoming_payment',
        'upcoming_bills',
        'bill_paid_last_month',
        'bills_overdue',
        'payment_overdue',
        'new_building_document',
        'general_communication',
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
        isEnabled: true,
      }));

      await db.insert(userNotificationPreferences).values(defaultPreferences);

      // Fetch the newly created preferences
      const newPreferences = await db
        .select()
        .from(userNotificationPreferences)
        .where(eq(userNotificationPreferences.userId, currentUser.id));

      console.log(`✅ Reset notification preferences to defaults`);
      res.json(newPreferences);
    } catch (error: any) {
      console.error('❌ Error resetting notification preferences:', error);
      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to reset notification preferences',
      });
    }
  });

  // ==========================================
  // GENERAL COMMUNICATIONS ROUTES
  // ==========================================

  /**
   * GET /api/communication/general - Get communications history for user's organization(s)
   * Returns communications based on user's role and organization access.
   */
  app.get('/api/communication/general', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      console.log(`📧 Fetching general communications for user ${currentUser.id} with role ${currentUser.role}`);

      // Apply role-based filtering and build complete query
      let communications;
      if (currentUser.role === 'admin') {
        // Admin can see all communications - no additional filtering
        console.log('🔓 [ADMIN] No filtering applied - admin can see all communications');
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
          console.log('📭 User has no accessible organizations');
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
          .where(inArray(generalCommunications.organizationId, orgIds))
          .orderBy(desc(generalCommunications.createdAt));

        console.log(`🔒 Filtering communications for organizations: [${orgIds.join(', ')}]`);
      }

      console.log(`✅ Found ${communications.length} general communications`);
      res.json(communications);
    } catch (error: any) {
      console.error('❌ Error fetching general communications:', error);
      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to fetch general communications',
      });
    }
  });

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

      // Validate request body
      const validatedData = insertGeneralCommunicationSchema.parse(req.body);

      console.log(`📧 Creating general communication for organization ${validatedData.organizationId} by user ${currentUser.id}`);

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
      const communicationData = {
        ...validatedData,
        createdBy: currentUser.id,
        sentAt: new Date(), // Mark as sent immediately
      };

      // Create the communication
      const [newCommunication] = await db
        .insert(generalCommunications)
        .values(communicationData)
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
        console.log(`📧 Sending general communication emails for: ${completeComm.title}`);
        
        // Get recipients based on organization and recipient roles
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
              eq(userOrganizations.organizationId, completeComm.organizationId),
              eq(userOrganizations.isActive, true),
              // Filter by recipient roles if specified
              communicationData.recipientRoles?.length > 0 
                ? inArray(userOrganizations.organizationRole, communicationData.recipientRoles as any)
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

          // Send emails for each language group
          for (const [language, emailAddresses] of Object.entries(recipientsByLanguage)) {
            await emailService.sendGeneralCommunication(
              {
                title: completeComm.title,
                content: completeComm.content,
                isUrgent: completeComm.isUrgent,
                organizationName: completeComm.organization.name,
                senderName: `${completeComm.creator.firstName} ${completeComm.creator.lastName}`,
                senderEmail: completeComm.creator.email,
              },
              emailAddresses,
              language as 'fr' | 'en'
            );
          }

          console.log(`✅ Sent general communication emails to ${recipients.length} recipients`);
        } else {
          console.log(`📭 No recipients found for general communication`);
        }
      } catch (emailError: any) {
        // Log email error but don't fail the API call
        console.error('❌ Error sending general communication emails:', emailError);
      }

      console.log(`✅ Created general communication ${newCommunication.id}`);
      res.status(201).json(completeComm);
    } catch (error: any) {
      console.error('❌ Error creating general communication:', error);
      
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
  app.get('/api/communication/general/:id', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      const communicationId = req.params.id;

      console.log(`📧 Fetching communication ${communicationId} for user ${currentUser.id}`);

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

      console.log(`✅ Returning communication ${communicationId}`);
      res.json(communication);
    } catch (error: any) {
      console.error('❌ Error fetching communication:', error);
      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to fetch communication',
      });
    }
  });

  // ==========================================
  // MEETINGS ROUTES
  // ==========================================

  /**
   * GET /api/communication/meetings - Get meetings for user's organization(s)
   * Returns meetings based on user's role and organization access.
   */
  app.get('/api/communication/meetings', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      console.log(`🗓️ Fetching meetings for user ${currentUser.id} with role ${currentUser.role}`);

      // Apply role-based filtering and build complete query
      let meetingList;
      if (currentUser.role === 'admin') {
        // Admin can see all meetings - no additional filtering
        console.log('🔓 [ADMIN] No filtering applied - admin can see all meetings');
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
          console.log('📭 User has no accessible organizations');
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

        console.log(`🔒 Filtering meetings for organizations: [${orgIds.join(', ')}]`);
      }

      console.log(`✅ Found ${meetingList.length} meetings`);
      res.json(meetingList);
    } catch (error: any) {
      console.error('❌ Error fetching meetings:', error);
      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to fetch meetings',
      });
    }
  });

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

      console.log(`🗓️ Creating meeting for organization ${validatedData.organizationId} by user ${currentUser.id}`);

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
      };

      // Create the meeting
      const [newMeeting] = await db
        .insert(meetings)
        .values(meetingData)
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
        console.log(`📧 Sending meeting invitations for: ${completeMeeting.title}`);
        
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
            await emailService.sendMeetingInvite(
              {
                title: completeMeeting.title,
                description: completeMeeting.description || undefined,
                location: completeMeeting.location,
                scheduledDate: completeMeeting.scheduledDate,
                duration: completeMeeting.duration,
                organizationName: completeMeeting.organization.name,
                organizerName: `${completeMeeting.creator.firstName} ${completeMeeting.creator.lastName}`,
                organizerEmail: completeMeeting.creator.email,
              },
              emailAddresses,
              language as 'fr' | 'en'
            );
          }

          console.log(`✅ Sent meeting invitations to ${recipients.length} recipients`);
        } else {
          console.log(`📭 No recipients found for meeting invitation`);
        }
      } catch (emailError: any) {
        // Log email error but don't fail the API call
        console.error('❌ Error sending meeting invitation emails:', emailError);
      }

      console.log(`✅ Created meeting ${newMeeting.id}`);
      res.status(201).json(completeMeeting);
    } catch (error: any) {
      console.error('❌ Error creating meeting:', error);
      
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

      console.log(`🗓️ Updating meeting ${meetingId} by user ${currentUser.id}`);

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

      console.log(`✅ Updated meeting ${meetingId}`);
      res.json(completeMeeting);
    } catch (error: any) {
      console.error('❌ Error updating meeting:', error);
      
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
  app.delete('/api/communication/meetings/:id', requireAuth, async (req: any, res) => {
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

      // Check permissions: only creator or admin can delete
      if (currentUser.role !== 'admin' && existingMeeting.createdBy !== currentUser.id) {
        return res.status(403).json({
          message: 'Only the meeting creator or admin can cancel this meeting',
          code: 'DELETE_PERMISSION_DENIED',
        });
      }

      console.log(`🗓️ Cancelling meeting ${meetingId} by user ${currentUser.id}`);

      // Delete the meeting
      await db
        .delete(meetings)
        .where(eq(meetings.id, meetingId));

      console.log(`✅ Cancelled meeting ${meetingId}`);
      res.status(204).send();
    } catch (error: any) {
      console.error('❌ Error cancelling meeting:', error);
      res.status(500).json({
        _error: 'Internal server error',
        message: 'Failed to cancel meeting',
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

      console.log(`📧 Sending combined test email to user ${currentUser.email} in ${language}`);

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
      const success = await emailService.sendCombinedNotifications(
        notificationsData,
        userOrganization.name,
        recipients,
        true // isTestEmail
      );

      if (success) {
        console.log(`✅ Combined test email sent successfully to ${currentUser.email}`);
        res.json({
          success: true,
          message: `Combined test email sent to ${currentUser.email}`,
        });
      } else {
        console.error(`❌ Failed to send combined test email to ${currentUser.email}`);
        res.status(500).json({
          success: false,
          message: 'Failed to send combined test email',
        });
      }
    } catch (error: any) {
      console.error('❌ Error sending combined test email:', error);
      
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
          'emergency',
          'upcoming_payment',
          'upcoming_bills',
          'bill_paid_last_month',
          'bills_overdue',
          'payment_overdue',
          'new_building_document',
          'general_communication',
          'meeting_invite',
          'maintenance_completed',
          'budget_update',
          'policy_change',
          'seasonal_reminder',
        ]),
        language: z.enum(['fr', 'en']).default('fr'),
      });

      const { notificationType, language } = testEmailSchema.parse(req.body);

      console.log(`📧 Sending test email for ${notificationType} to user ${currentUser.email} in ${language}`);

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

      // Send the test email using the email service
      const success = await emailService.sendTestNotificationEmail(
        currentUser.email,
        `${currentUser.firstName} ${currentUser.lastName}`,
        notificationContent.subject,
        notificationContent.message,
        notificationType,
        language
      );

      if (success) {
        console.log(`✅ Test email sent successfully to ${currentUser.email}`);
        res.json({
          success: true,
          message: `Test email sent to ${currentUser.email}`,
          notificationType,
          language,
        });
      } else {
        console.error(`❌ Failed to send test email to ${currentUser.email}`);
        res.status(500).json({
          success: false,
          message: 'Failed to send test email',
        });
      }
    } catch (error: any) {
      console.error('❌ Error sending test email:', error);
      
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
    },
  };

  const langTemplates = templates[language];
  const template = langTemplates[notificationType as keyof typeof langTemplates] || langTemplates.announcement;

  return template;
}