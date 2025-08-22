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

// Insert schemas
export const insertMaintenanceRequestSchema = createInsertSchema(maintenanceRequests).pick({
  residenceId: true,
  submittedBy: true,
  assignedTo: true,
  title: true,
  description: true,
  category: true,
  priority: true,
  estimatedCost: true,
  scheduledDate: true,
  notes: true,
  images: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).pick({
  userId: true,
  type: true,
  title: true,
  message: true,
  relatedEntityId: true,
  relatedEntityType: true,
});

export const insertDemandSchema = createInsertSchema(demands).pick({
  submitterId: true,
  type: true,
  assignationResidenceId: true,
  assignationBuildingId: true,
  description: true,
  residenceId: true,
  buildingId: true,
  status: true,
  reviewNotes: true,
}).extend({
  description: z.string().min(10, "Description must be at least 10 characters").max(2000, "Description must not exceed 2000 characters"),
});

export const insertDemandCommentSchema = createInsertSchema(demandComments).pick({
  demandId: true,
  orderIndex: true,
  comment: true,
  createdBy: true,
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

// Relations
export const maintenanceRequestsRelations = relations(maintenanceRequests, ({ one }) => ({
  residence: one(residences, {
    fields: [maintenanceRequests.residenceId],
    references: [residences.id],
  }),
  submittedBy: one(users, {
    fields: [maintenanceRequests.submittedBy],
    references: [users.id],
    relationName: 'submittedBy',
  }),
  assignedTo: one(users, {
    fields: [maintenanceRequests.assignedTo],
    references: [users.id],
    relationName: 'assignedTo',
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const demandsRelations = relations(demands, ({ one, many }) => ({
  submitter: one(users, {
    fields: [demands.submitterId],
    references: [users.id],
    relationName: 'submitter',
  }),
  assignationResidence: one(residences, {
    fields: [demands.assignationResidenceId],
    references: [residences.id],
    relationName: 'assignationResidence',
  }),
  assignationBuilding: one(buildings, {
    fields: [demands.assignationBuildingId],
    references: [buildings.id],
    relationName: 'assignationBuilding',
  }),
  residence: one(residences, {
    fields: [demands.residenceId],
    references: [residences.id],
    relationName: 'residence',
  }),
  building: one(buildings, {
    fields: [demands.buildingId],
    references: [buildings.id],
    relationName: 'building',
  }),
  reviewedBy: one(users, {
    fields: [demands.reviewedBy],
    references: [users.id],
    relationName: 'reviewedBy',
  }),
  comments: many(demandComments),
}));

export const demandCommentsRelations = relations(demandComments, ({ one }) => ({
  demand: one(demands, {
    fields: [demandComments.demandId],
    references: [demands.id],
  }),
  createdBy: one(users, {
    fields: [demandComments.createdBy],
    references: [users.id],
  }),
}));