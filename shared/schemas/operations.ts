import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  uuid,
  pgEnum,
  boolean,
  decimal,
  integer,
  varchar,
  unique,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { relations } from 'drizzle-orm';
import { users, organizations } from './core';
import { residences, buildings } from './property';

// Operations enums
export const maintenanceStatusEnum = pgEnum('maintenance_status', [
  'submitted',
  'acknowledged',
  'in_progress',
  'completed',
  'cancelled',
]);

export const maintenancePriorityEnum = pgEnum('maintenance_priority', [
  'low',
  'medium',
  'high',
  'urgent',
  'emergency',
]);

export const frequencyEnum = pgEnum('frequency', [
  'unique',
  'immediate',
  'weekly',
  'bi_weekly',
  'monthly',
  'quarterly',
  'bi-annually',
  'annually',
]);

export const notificationTypeEnum = pgEnum('notification_type', [
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
]);

export const demandTypeEnum = pgEnum('demand_type', [
  'complaint',
  'information',
  'maintenance',
  'other',
]);

export const demandStatusEnum = pgEnum('demand_status', [
  'draft',
  'submitted',
  'under_review',
  'approved',
  'in_progress',
  'completed',
  'rejected',
  'cancelled',
]);

// Operations tables
/**
 * Maintenance requests table for tracking property maintenance and repairs.
 * Supports prioritization, assignment, and cost tracking.
 */
export const maintenanceRequests = pgTable('maintenance_requests', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  residenceId: varchar('residence_id')
    .notNull()
    .references(() => residences.id),
  submittedBy: varchar('submitted_by')
    .references(() => users.id),
  assignedTo: varchar('assigned_to').references(() => users.id),
  title: text('title').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(), // 'plumbing', 'electrical', 'hvac', 'general', etc.
  priority: maintenancePriorityEnum('priority').notNull().default('medium'),
  status: maintenanceStatusEnum('status').notNull().default('submitted'),
  estimatedCost: decimal('estimated_cost', { precision: 10, scale: 2 }),
  actualCost: decimal('actual_cost', { precision: 10, scale: 2 }),
  scheduledDate: timestamp('scheduled_date'),
  completedDate: timestamp('completed_date'),
  notes: text('notes'),
  images: jsonb('images'), // Array of image URLs
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  residenceIdIdx: index('maintenance_requests_residence_id_idx').on(table.residenceId),
  submittedByIdx: index('maintenance_requests_submitted_by_idx').on(table.submittedBy),
  assignedToIdx: index('maintenance_requests_assigned_to_idx').on(table.assignedTo),
  statusIdx: index('maintenance_requests_status_idx').on(table.status),
  priorityIdx: index('maintenance_requests_priority_idx').on(table.priority),
  // Date indexes for range queries
  scheduledDateIdx: index('maintenance_requests_scheduled_date_idx').on(table.scheduledDate),
  completedDateIdx: index('maintenance_requests_completed_date_idx').on(table.completedDate),
  createdAtIdx: index('maintenance_requests_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('maintenance_requests_updated_at_idx').on(table.updatedAt),
}));

/**
 * Notifications table for system-wide user communication.
 * Supports various notification types with read tracking.
 */
export const notifications = pgTable('notifications', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .notNull()
    .references(() => users.id),
  type: notificationTypeEnum('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  relatedEntityId: varchar('related_entity_id'), // ID of related bill, maintenance request, etc.
  relatedEntityType: text('related_entity_type'), // 'bill', 'maintenance_request', etc.
  isRead: boolean('is_read').notNull().default(false),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('notifications_user_id_idx').on(table.userId),
  typeIdx: index('notifications_type_idx').on(table.type),
  // Date indexes for range queries
  readAtIdx: index('notifications_read_at_idx').on(table.readAt),
  createdAtIdx: index('notifications_created_at_idx').on(table.createdAt),
}));

/**
 * Demands table for tracking resident requests and complaints.
 * Supports various demand types with approval workflow.
 */
export const demands = pgTable('demands', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  submitterId: varchar('submitter_id')
    .references(() => users.id),
  type: demandTypeEnum('type').notNull(),
  assignationResidenceId: varchar('assignation_residence_id').references(() => residences.id),
  assignationBuildingId: varchar('assignation_building_id').references(() => buildings.id),
  description: text('description').notNull(),
  filePath: text('file_path'), // Path to uploaded file
  fileName: text('file_name'), // Original filename
  fileSize: integer('file_size'), // File size in bytes
  residenceId: varchar('residence_id')
    .references(() => residences.id),
  buildingId: varchar('building_id')
    .notNull()
    .references(() => buildings.id),
  status: demandStatusEnum('status').notNull().default('draft'),
  reviewedBy: varchar('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  reviewNotes: text('review_notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  submitterIdIdx: index('demands_submitter_id_idx').on(table.submitterId),
  assignationResidenceIdIdx: index('demands_assignation_residence_id_idx').on(table.assignationResidenceId),
  assignationBuildingIdIdx: index('demands_assignation_building_id_idx').on(table.assignationBuildingId),
  residenceIdIdx: index('demands_residence_id_idx').on(table.residenceId),
  buildingIdIdx: index('demands_building_id_idx').on(table.buildingId),
  reviewedByIdx: index('demands_reviewed_by_idx').on(table.reviewedBy),
  typeIdx: index('demands_type_idx').on(table.type),
  statusIdx: index('demands_status_idx').on(table.status),
  // Date indexes for range queries
  reviewedAtIdx: index('demands_reviewed_at_idx').on(table.reviewedAt),
  createdAtIdx: index('demands_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('demands_updated_at_idx').on(table.updatedAt),
}));

/**
 * Demand comments table for tracking communication on demands.
 * Supports threaded conversations on demand requests.
 */
export const demandComments = pgTable('demands_comments', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  demandId: uuid('demand_id')
    .notNull()
    .references(() => demands.id),
  commenterId: text('commenter_id')
    .notNull()
    .references(() => users.id),
  commentText: text('comment_text').notNull(),
  commentType: text('comment_type'),
  isInternal: boolean('is_internal').default(false),
  // Optional single-file attachment (mirrors the demands table fields).
  // Populated by the MCP `create_demand_comment` tool when an AI assistant
  // supplies an object-storage URL alongside the comment text.
  filePath: text('file_path'),
  fileName: text('file_name'),
  fileSize: integer('file_size'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  demandIdIdx: index('demand_comments_demand_id_idx').on(table.demandId),
  commenterIdIdx: index('demand_comments_commenter_id_idx').on(table.commenterId),
  commentTypeIdx: index('demand_comments_comment_type_idx').on(table.commentType),
  // Date indexes for range queries
  createdAtIdx: index('demand_comments_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('demand_comments_updated_at_idx').on(table.updatedAt),
}));

/**
 * User notification preferences table for storing user's notification frequency preferences.
 * Allows users to configure how often they receive different types of notifications.
 */
export const userNotificationPreferences = pgTable('user_notification_preferences', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .notNull()
    .references(() => users.id),
  notificationType: notificationTypeEnum('notification_type').notNull(),
  frequency: frequencyEnum('frequency').notNull().default('monthly'),
  isEnabled: boolean('is_enabled').notNull().default(false),
  startingDate: timestamp('starting_date').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('user_notification_preferences_user_id_idx').on(table.userId),
  // Unique constraint for upsert operations (onConflictDoUpdate)
  userNotificationTypeUnique: unique('user_notification_type_unique').on(table.userId, table.notificationType),
  // Date indexes for range queries
  startingDateIdx: index('user_notification_preferences_starting_date_idx').on(table.startingDate),
  createdAtIdx: index('user_notification_preferences_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('user_notification_preferences_updated_at_idx').on(table.updatedAt),
}));

/**
 * General communications table for storing manager communications to organization.
 * Supports scheduled and urgent communications with role-based targeting.
 */
export const generalCommunications = pgTable('general_communications', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: varchar('organization_id')
    .notNull()
    .references(() => organizations.id),
  createdBy: varchar('created_by')
    .notNull()
    .references(() => users.id),
  title: varchar('title', { length: 200 }).notNull(),
  content: varchar('content', { length: 5000 }).notNull(),
  isUrgent: boolean('is_urgent').notNull().default(false),
  scheduledFor: timestamp('scheduled_for'),
  sentAt: timestamp('sent_at'),
  recipientRoles: text('recipient_roles').array(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  organizationIdIdx: index('general_communications_organization_id_idx').on(table.organizationId),
  createdByIdx: index('general_communications_created_by_idx').on(table.createdBy),
  // Date indexes for range queries
  scheduledForIdx: index('general_communications_scheduled_for_idx').on(table.scheduledFor),
  sentAtIdx: index('general_communications_sent_at_idx').on(table.sentAt),
  createdAtIdx: index('general_communications_created_at_idx').on(table.createdAt),
}));

/**
 * Meetings table for storing meeting invitations.
 * Supports scheduling meetings with role-based invitations.
 */
export const meetings = pgTable('meetings', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: varchar('organization_id')
    .notNull()
    .references(() => organizations.id),
  createdBy: varchar('created_by')
    .notNull()
    .references(() => users.id),
  title: text('title').notNull(),
  description: text('description'),
  location: text('location').notNull(),
  scheduledDate: timestamp('scheduled_date').notNull(),
  duration: integer('duration').notNull(),
  invitedRoles: text('invited_roles').array(),
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  organizationIdIdx: index('meetings_organization_id_idx').on(table.organizationId),
  createdByIdx: index('meetings_created_by_idx').on(table.createdBy),
  // Date indexes for range queries
  scheduledDateIdx: index('meetings_scheduled_date_idx').on(table.scheduledDate),
  sentAtIdx: index('meetings_sent_at_idx').on(table.sentAt),
  createdAtIdx: index('meetings_created_at_idx').on(table.createdAt),
  // Task #633: meetings must have a strictly positive duration. The MCP
  // tool `create_meeting` previously skipped the `.positive()` guard
  // present in `insertMeetingSchema`, so this is the DB-level safety net
  // for any caller (raw SQL, future tool, etc.) that bypasses the API.
  durationPositive: check('meetings_duration_positive_check', sql`duration > 0`),
}));

/**
 * Notification configurations table for storing building-specific automated notifications.
 * Supports scheduled notifications with frequency settings and timezone support.
 */
export const notificationConfigurations = pgTable('notification_configurations', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: varchar('organization_id')
    .notNull()
    .references(() => organizations.id),
  buildingId: varchar('building_id')
    .notNull()
    .references(() => buildings.id),
  createdBy: varchar('created_by')
    .notNull()
    .references(() => users.id),
  type: notificationTypeEnum('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  frequency: frequencyEnum('frequency').notNull(),
  startDate: timestamp('start_date').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  endsAt: timestamp('ends_at'),
  timezone: text('timezone'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  organizationIdIdx: index('notification_configurations_organization_id_idx').on(table.organizationId),
  buildingIdIdx: index('notification_configurations_building_id_idx').on(table.buildingId),
  createdByIdx: index('notification_configurations_created_by_idx').on(table.createdBy),
  // Date indexes for range queries
  startDateIdx: index('notification_configurations_start_date_idx').on(table.startDate),
  endsAtIdx: index('notification_configurations_ends_at_idx').on(table.endsAt),
  createdAtIdx: index('notification_configurations_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('notification_configurations_updated_at_idx').on(table.updatedAt),
}));

/**
 * Notification dispatch log table for tracking sent notifications.
 * Records when notifications are sent and to which users.
 */
export const notificationDispatchLog = pgTable('notification_dispatch_log', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  configurationId: uuid('configuration_id')
    .notNull()
    .references(() => notificationConfigurations.id),
  userId: varchar('user_id')
    .notNull()
    .references(() => users.id),
  periodKey: text('period_key').notNull(),
  sentAt: timestamp('sent_at').notNull().defaultNow(),
}, (table) => ({
  configurationIdIdx: index('notification_dispatch_log_configuration_id_idx').on(table.configurationId),
  userIdIdx: index('notification_dispatch_log_user_id_idx').on(table.userId),
  // Date indexes for range queries
  sentAtIdx: index('notification_dispatch_log_sent_at_idx').on(table.sentAt),
  // Unique constraint to prevent duplicate dispatch records
  uniqueDispatchRecord: unique().on(table.configurationId, table.userId, table.periodKey),
}));

// Insert schemas
/**
 * Canonical list of maintenance request categories — Task #619.
 *
 * This tuple is the single source of truth shared by:
 *   - the Drizzle insert schema below (`insertMaintenanceRequestSchema.category`)
 *   - the MCP `create_maintenance_request` tool's Zod parameter schema
 *   - the database CHECK constraint (`maintenance_requests_category_check`)
 *     applied via migration `0009_maintenance_category_check.sql`
 *
 * If you add a value here, you MUST also widen the DB CHECK constraint via a
 * new migration. Removing a value requires a backfill migration first.
 */
export const MAINTENANCE_CATEGORY_VALUES = [
  'plumbing',
  'electrical',
  'hvac',
  'general',
  'elevator',
  'landscaping',
  'cleaning',
  'security',
  'other',
] as const;

export const maintenanceCategorySchema = z.enum(MAINTENANCE_CATEGORY_VALUES);
export type MaintenanceCategory = z.infer<typeof maintenanceCategorySchema>;

export const insertMaintenanceRequestSchema = z.object({
  residenceId: z.string().uuid(),
  submittedBy: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),
  title: z.string(),
  description: z.string(),
  category: maintenanceCategorySchema,
  priority: z.string().default('medium'),
  estimatedCost: z.number().optional(),
  scheduledDate: z.date().optional(),
  notes: z.string().optional(),
  images: z.array(z.string()).optional(),
});

export const insertNotificationSchema = z.object({
  userId: z.string().uuid(),
  type: z.enum([
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
  title: z.string(),
  message: z.string(),
  relatedEntityId: z.string().uuid().optional(),
  relatedEntityType: z.string().optional(),
});

export const DEMAND_DESCRIPTION_MAX = 2000;

export const insertDemandSchema = z.object({
  submitterId: z.string().uuid().optional(),
  type: z.enum(['complaint', 'information', 'maintenance', 'other']),
  assignationResidenceId: z.preprocess((val) => val === '' ? undefined : val, z.string().uuid().optional()),
  assignationBuildingId: z.preprocess((val) => val === '' ? undefined : val, z.string().uuid().optional()),
  description: z
    .string()
    .trim()
    .min(10, 'Description must be at least 10 characters')
    .max(DEMAND_DESCRIPTION_MAX, 'Description must not exceed 2000 characters'),
  filePath: z.string().optional(), // Path to uploaded file
  fileName: z.string().optional(), // Original filename  
  fileSize: z.number().int().optional(), // File size in bytes
  residenceId: z.preprocess((val) => val === '' ? undefined : val, z.string().uuid().optional()),
  buildingId: z.preprocess((val) => val === '' ? undefined : val, z.string().uuid().optional()),
  status: z.string().default('submitted'),
  reviewNotes: z.string().optional(),
});

export const insertDemandCommentSchema = z.object({
  demandId: z.string().uuid(),
  commenterId: z.string().uuid(),
  commentText: z
    .string()
    .min(1, 'Comment content is required')
    .max(1000, 'Comment must not exceed 1000 characters'),
  commentType: z.string().optional(),
  isInternal: z.boolean().default(false),
  // Optional single-file attachment (mirrors insertDemandSchema).
  filePath: z.string().optional(),
  fileName: z.string().optional(),
  fileSize: z.number().int().optional(),
});

export const insertUserNotificationPreferenceSchema = z.object({
  userId: z.string().uuid(),
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
  frequency: z.enum(['immediate', 'weekly', 'bi_weekly', 'monthly', 'quarterly', 'bi-annually', 'annually']).default('monthly'),
  isEnabled: z.boolean().default(false),
  startingDate: z.date().optional(),
});

export const COMMUNICATION_TITLE_MAX = 200;
export const COMMUNICATION_CONTENT_MAX = 5000;

export const insertGeneralCommunicationSchema = z.object({
  organizationId: z.string().uuid(),
  createdBy: z.string().uuid(),
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(COMMUNICATION_TITLE_MAX, 'Title must be 200 characters or fewer'),
  content: z
    .string()
    .trim()
    .min(1, 'Content is required')
    .max(COMMUNICATION_CONTENT_MAX, 'Content must be 5000 characters or fewer'),
  isUrgent: z.boolean().default(false),
  scheduledFor: z.date().optional(),
  recipientRoles: z.array(z.string()).optional(),
});

export const MEETING_TITLE_MAX = 200;
export const MEETING_DESCRIPTION_MAX = 5000;

export const insertMeetingSchema = z.object({
  organizationId: z.string().uuid(),
  createdBy: z.string().uuid(),
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().optional(),
  location: z.string().trim().min(1, 'Location is required'),
  scheduledDate: z.date(),
  duration: z.number().int().positive('Duration must be a positive number'),
  invitedRoles: z.array(z.string()).optional(),
});

export const insertNotificationConfigurationSchema = z.object({
  organizationId: z.string().uuid(),
  buildingId: z.string().uuid(),
  createdBy: z.string().uuid(),
  type: z.enum(['seasonal_reminder', 'announcement']),
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  frequency: z.enum(['unique', 'weekly', 'bi_weekly', 'monthly', 'quarterly', 'bi-annually', 'annually']),
  startDate: z.coerce.date(),
  isActive: z.boolean().default(true),
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

export const insertNotificationDispatchLogSchema = z.object({
  configurationId: z.string().uuid(),
  userId: z.string().uuid(),
  periodKey: z.string().min(1, 'Period key is required'),
});

// Types
/**
 *
 */
export type InsertMaintenanceRequest = z.infer<typeof insertMaintenanceRequestSchema>;
/**
 *
 */
export type MaintenanceRequest = typeof maintenanceRequests.$inferSelect;

/**
 *
 */
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
/**
 *
 */
export type Notification = typeof notifications.$inferSelect;

/**
 *
 */
export type InsertDemand = z.infer<typeof insertDemandSchema>;
/**
 *
 */
export type Demand = typeof demands.$inferSelect;

/**
 *
 */
export type InsertDemandComment = z.infer<typeof insertDemandCommentSchema>;
/**
 *
 */
export type DemandComment = typeof demandComments.$inferSelect;

/**
 *
 */
export type InsertUserNotificationPreference = z.infer<typeof insertUserNotificationPreferenceSchema>;
/**
 *
 */
export type UserNotificationPreference = typeof userNotificationPreferences.$inferSelect;

/**
 *
 */
export type InsertGeneralCommunication = z.infer<typeof insertGeneralCommunicationSchema>;
/**
 *
 */
export type GeneralCommunication = typeof generalCommunications.$inferSelect;

/**
 *
 */
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;
/**
 *
 */
export type Meeting = typeof meetings.$inferSelect;

/**
 *
 */
export type InsertNotificationConfiguration = z.infer<typeof insertNotificationConfigurationSchema>;
/**
 *
 */
export type NotificationConfiguration = typeof notificationConfigurations.$inferSelect;

/**
 *
 */
export type InsertNotificationDispatchLog = z.infer<typeof insertNotificationDispatchLogSchema>;
/**
 *
 */
export type NotificationDispatchLog = typeof notificationDispatchLog.$inferSelect;

// Relations
// Relations - temporarily commented out due to drizzle-orm version compatibility
// export const maintenanceRequestsRelations = relations(maintenanceRequests, ({ one }) => ({
//   residence: one(residences, {
//     fields: [maintenanceRequests.residenceId],
//     references: [residences.id],
//   }),
//   submittedBy: one(users, {
//     fields: [maintenanceRequests.submittedBy],
//     references: [users.id],
//     relationName: 'submittedBy',
//   }),
//   assignedTo: one(users, {
//     fields: [maintenanceRequests.assignedTo],
//     references: [users.id],
//     relationName: 'assignedTo',
//   }),
// }));

// export const notificationsRelations = relations(notifications, ({ one }) => ({
//   user: one(users, {
//     fields: [notifications.userId],
//     references: [users.id],
//   }),
// }));

// export const demandsRelations = relations(demands, ({ one, many }) => ({
//   submitter: one(users, {
//     fields: [demands.submitterId],
//     references: [users.id],
//     relationName: 'submitter',
//   }),
//   assignationResidence: one(residences, {
//     fields: [demands.assignationResidenceId],
//     references: [residences.id],
//     relationName: 'assignationResidence',
//   }),
//   assignationBuilding: one(buildings, {
//     fields: [demands.assignationBuildingId],
//     references: [buildings.id],
//     relationName: 'assignationBuilding',
//   }),
//   residence: one(residences, {
//     fields: [demands.residenceId],
//     references: [residences.id],
//     relationName: 'residence',
//   }),
//   building: one(buildings, {
//     fields: [demands.buildingId],
//     references: [buildings.id],
//     relationName: 'building',
//   }),
//   reviewedBy: one(users, {
//     fields: [demands.reviewedBy],
//     references: [users.id],
//     relationName: 'reviewedBy',
//   }),
//   comments: many(demandComments),
// }));

// export const demandCommentsRelations = relations(demandComments, ({ one }) => ({
//   demand: one(demands, {
//     fields: [demandComments.demandId],
//     references: [demands.id],
//   }),
//   createdBy: one(users, {
//     fields: [demandComments.createdBy],
//     references: [users.id],
//   }),
// }));
