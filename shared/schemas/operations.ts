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
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { relations } from 'drizzle-orm';
import { users } from './core';
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

export const notificationTypeEnum = pgEnum('notification_type', [
  'bill_reminder',
  'maintenance_update',
  'announcement',
  'system',
  'emergency',
]);

export const demandTypeEnum = pgEnum('demand_type', [
  'maintenance',
  'complaint',
  'information',
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

export const bugStatusEnum = pgEnum('bug_status', [
  'new',
  'acknowledged',
  'in_progress',
  'resolved',
  'closed',
]);

export const bugPriorityEnum = pgEnum('bug_priority', [
  'low',
  'medium',
  'high',
  'critical',
]);

export const bugCategoryEnum = pgEnum('bug_category', [
  'ui_ux',
  'functionality',
  'performance',
  'data',
  'security',
  'integration',
  'other',
]);

export const featureRequestStatusEnum = pgEnum('feature_request_status', [
  'submitted',
  'under_review',
  'planned',
  'in_progress',
  'completed',
  'rejected',
]);

export const featureRequestCategoryEnum = pgEnum('feature_request_category', [
  'dashboard',
  'property_management',
  'resident_management', 
  'financial_management',
  'maintenance',
  'document_management',
  'communication',
  'reports',
  'mobile_app',
  'integrations',
  'security',
  'performance',
  'other',
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
  residenceId: uuid('residence_id')
    .notNull()
    .references(() => residences.id),
  submittedBy: uuid('submitted_by')
    .notNull()
    .references(() => users.id),
  assignedTo: uuid('assigned_to').references(() => users.id),
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
});

/**
 * Notifications table for system-wide user communication.
 * Supports various notification types with read tracking.
 */
export const notifications = pgTable('notifications', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  type: notificationTypeEnum('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  relatedEntityId: uuid('related_entity_id'), // ID of related bill, maintenance request, etc.
  relatedEntityType: text('related_entity_type'), // 'bill', 'maintenance_request', etc.
  isRead: boolean('is_read').notNull().default(false),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

/**
 * Demands table for tracking resident requests and complaints.
 * Supports various demand types with approval workflow.
 */
export const demands = pgTable('demands', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  submitterId: uuid('submitter_id')
    .notNull()
    .references(() => users.id),
  type: demandTypeEnum('type').notNull(),
  assignationResidenceId: uuid('assignation_residence_id')
    .references(() => residences.id),
  assignationBuildingId: uuid('assignation_building_id')
    .references(() => buildings.id),
  description: text('description').notNull(),
  residenceId: uuid('residence_id')
    .notNull()
    .references(() => residences.id),
  buildingId: uuid('building_id')
    .notNull()
    .references(() => buildings.id),
  status: demandStatusEnum('status').notNull().default('draft'),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  reviewNotes: text('review_notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * Demand comments table for tracking communication on demands.
 * Supports threaded conversations on demand requests.
 */
export const demandComments = pgTable('demand_comments', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  demandId: uuid('demand_id')
    .notNull()
    .references(() => demands.id),
  orderIndex: decimal('order_index', { precision: 10, scale: 2 }).notNull(),
  comment: text('comment').notNull(),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

/**
 * Bugs table for tracking application issues and bug reports.
 * All users can create bugs with category and page assignments.
 */
export const bugs = pgTable('bugs', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  title: text('title').notNull(),
  description: text('description').notNull(),
  category: bugCategoryEnum('category').notNull(),
  page: text('page').notNull(), // The page where the bug was found
  priority: bugPriorityEnum('priority').notNull().default('medium'),
  status: bugStatusEnum('status').notNull().default('new'),
  assignedTo: uuid('assigned_to').references(() => users.id),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: uuid('resolved_by').references(() => users.id),
  notes: text('notes'), // Internal notes for resolution
  reproductionSteps: text('reproduction_steps'), // Steps to reproduce the bug
  environment: text('environment'), // Browser, OS, device info
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * Feature requests table for collecting user suggestions and ideas.
 * All users can submit feature requests with category and page assignments.
 * Supports upvoting and merging similar requests.
 */
export const featureRequests = pgTable('feature_requests', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  title: text('title').notNull(),
  description: text('description').notNull(),
  need: text('need').notNull(), // The specific need this feature addresses
  category: featureRequestCategoryEnum('category').notNull(),
  page: text('page').notNull(), // The page/section where this feature should be added
  status: featureRequestStatusEnum('status').notNull().default('submitted'),
  upvoteCount: integer('upvote_count').notNull().default(0),
  assignedTo: uuid('assigned_to').references(() => users.id),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  adminNotes: text('admin_notes'), // Internal notes for admins only
  mergedIntoId: uuid('merged_into_id').references(() => featureRequests.id), // If merged into another request
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * Feature request upvotes table for tracking user votes on feature requests.
 * Each user can only upvote a feature request once.
 */
export const featureRequestUpvotes = pgTable('feature_request_upvotes', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  featureRequestId: uuid('feature_request_id')
    .notNull()
    .references(() => featureRequests.id),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

// Insert schemas
export const insertMaintenanceRequestSchema = z.object({
  residenceId: z.string().uuid(),
  submittedBy: z.string().uuid(),
  assignedTo: z.string().uuid().optional(),
  title: z.string(),
  description: z.string(),
  category: z.string(),
  priority: z.string().default('medium'),
  estimatedCost: z.number().optional(),
  scheduledDate: z.date().optional(),
  notes: z.string().optional(),
  images: z.array(z.string()).optional(),
});

export const insertNotificationSchema = z.object({
  userId: z.string().uuid(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  relatedEntityId: z.string().uuid().optional(),
  relatedEntityType: z.string().optional(),
});

export const insertDemandSchema = z.object({
  submitterId: z.string().uuid(),
  type: z.enum(['maintenance', 'complaint', 'information', 'other']),
  assignationResidenceId: z.string().uuid().optional(),
  assignationBuildingId: z.string().uuid().optional(),
  description: z.string().min(10, "Description must be at least 10 characters").max(2000, "Description must not exceed 2000 characters"),
  residenceId: z.string().uuid().optional(),
  buildingId: z.string().uuid().optional(),
  status: z.string().default('draft'),
  reviewNotes: z.string().optional(),
});

export const insertDemandCommentSchema = z.object({
  demandId: z.string().uuid(),
  orderIndex: z.number().int(),
  comment: z.string().min(1, "Comment content is required").max(1000, "Comment must not exceed 1000 characters"),
  createdBy: z.string().uuid(),
});

export const insertBugSchema = z.object({
  createdBy: z.string().uuid(),
  title: z.string().min(1, "Title is required").max(200, "Title must not exceed 200 characters"),
  description: z.string().min(10, "Description must be at least 10 characters").max(2000, "Description must not exceed 2000 characters"),
  category: z.enum(['ui_ux', 'functionality', 'performance', 'data', 'security', 'integration', 'other']),
  page: z.string().min(1, "Page is required"),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  reproductionSteps: z.string().optional(),
  environment: z.string().optional(),
});

export const insertFeatureRequestSchema = z.object({
  createdBy: z.string().uuid(),
  title: z.string().min(1, "Title is required").max(200, "Title must not exceed 200 characters"),
  description: z.string().min(10, "Description must be at least 10 characters").max(2000, "Description must not exceed 2000 characters"),
  need: z.string().min(5, "Need must be at least 5 characters").max(500, "Need must not exceed 500 characters"),
  category: z.enum(['dashboard', 'property_management', 'resident_management', 'financial_management', 'maintenance', 'document_management', 'communication', 'reports', 'mobile_app', 'integrations', 'security', 'performance', 'other']),
  page: z.string().min(1, "Page is required"),
});

export const insertFeatureRequestUpvoteSchema = z.object({
  featureRequestId: z.string().uuid(),
  userId: z.string().uuid(),
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
export type InsertBug = z.infer<typeof insertBugSchema>;
/**
 *
 */
export type Bug = typeof bugs.$inferSelect;

/**
 *
 */
export type InsertFeatureRequest = z.infer<typeof insertFeatureRequestSchema>;
/**
 *
 */
export type FeatureRequest = typeof featureRequests.$inferSelect;

/**
 *
 */
export type InsertFeatureRequestUpvote = z.infer<typeof insertFeatureRequestUpvoteSchema>;
/**
 *
 */
export type FeatureRequestUpvote = typeof featureRequestUpvotes.$inferSelect;

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