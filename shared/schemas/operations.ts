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
import { residences } from './property';

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