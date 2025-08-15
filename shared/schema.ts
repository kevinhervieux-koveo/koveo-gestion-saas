import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  uuid,
  pgEnum,
  boolean,
  integer,
  decimal,
  date,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { relations } from 'drizzle-orm';

// Enums for improvement suggestions
/**
 * Enum defining categories for improvement suggestions in the development framework.
 * Used to classify suggestions by their focus area.
 */
export const suggestionCategoryEnum = pgEnum('suggestion_category', [
  'Code Quality',
  'Security',
  'Testing',
  'Documentation',
  'Performance',
]);
/**
 * Enum defining priority levels for improvement suggestions.
 * Used to rank suggestions by importance and urgency.
 */
export const suggestionPriorityEnum = pgEnum('suggestion_priority', [
  'Low',
  'Medium',
  'High',
  'Critical',
]);
/**
 * Enum defining status values for improvement suggestions lifecycle.
 * Tracks the progress of suggestions from creation to completion.
 */
export const suggestionStatusEnum = pgEnum('suggestion_status', ['New', 'Acknowledged', 'Done']);

// Enums for features
/**
 * Enum defining status values for feature development lifecycle.
 * Tracks features from request through completion or cancellation.
 */
export const featureStatusEnum = pgEnum('feature_status', [
  'completed',
  'in-progress',
  'planned',
  'cancelled',
  'requested',
]);
/**
 * Enum defining priority levels for feature development.
 * Used to prioritize feature development by importance and business impact.
 */
export const featurePriorityEnum = pgEnum('feature_priority', [
  'low',
  'medium',
  'high',
  'critical',
]);
/**
 * Enum defining functional categories for features in the property management system.
 * Used to organize features by their business domain and functionality.
 */
export const featureCategoryEnum = pgEnum('feature_category', [
  'Dashboard & Home',
  'Property Management',
  'Resident Management',
  'Financial Management',
  'Maintenance & Requests',
  'Document Management',
  'Communication',
  'AI & Automation',
  'Compliance & Security',
  'Analytics & Reporting',
  'Integration & API',
  'Infrastructure & Performance',
]);

// Enums for core application
/**
 * Enum defining user roles in the Quebec property management system.
 * Determines user permissions and access levels across the application.
 */
export const userRoleEnum = pgEnum('user_role', [
  'admin',
  'manager',
  'owner',
  'tenant',
  'board_member',
]);
export const billStatusEnum = pgEnum('bill_status', [
  'draft',
  'sent',
  'overdue',
  'paid',
  'cancelled',
]);
export const billTypeEnum = pgEnum('bill_type', [
  'condo_fees',
  'special_assessment',
  'utility',
  'maintenance',
  'other',
]);
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
  'bill',
  'maintenance',
  'meeting',
  'announcement',
  'document',
]);
/**
 * Enum defining building types common in Quebec residential properties.
 * Used to classify properties according to Quebec real estate law.
 */
export const buildingTypeEnum = pgEnum('building_type', [
  'condo',
  'cooperative',
  'syndicate',
  'rental',
]);

// Core Application Tables
/**
 * Users table for the Koveo Gestion property management system.
 * Stores user authentication and profile information for all system users.
 * Supports Quebec-specific language preferences and role-based access.
 */
export const users = pgTable('users', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  phone: text('phone'),
  language: text('language').notNull().default('fr'), // Default to French for Quebec
  role: userRoleEnum('role').notNull().default('tenant'),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * Organizations table storing management companies, syndicates, and co-ownership entities.
 * Represents the legal entities responsible for property management in Quebec.
 */
export const organizations = pgTable('organizations', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'management_company', 'syndicate', 'cooperative'
  address: text('address').notNull(),
  city: text('city').notNull(),
  province: text('province').notNull().default('QC'),
  postalCode: text('postal_code').notNull(),
  phone: text('phone'),
  email: text('email'),
  website: text('website'),
  registrationNumber: text('registration_number'), // Quebec business registration
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * Buildings table storing individual property information.
 * Each building represents a distinct property managed by an organization.
 */
export const buildings = pgTable('buildings', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  name: text('name').notNull(),
  address: text('address').notNull(),
  city: text('city').notNull(),
  province: text('province').notNull().default('QC'),
  postalCode: text('postal_code').notNull(),
  buildingType: buildingTypeEnum('building_type').notNull(),
  yearBuilt: integer('year_built'),
  totalUnits: integer('total_units').notNull(),
  totalFloors: integer('total_floors'),
  parkingSpaces: integer('parking_spaces'),
  storageSpaces: integer('storage_spaces'),
  amenities: jsonb('amenities'), // Array of amenities
  managementCompany: text('management_company'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * Residences table storing individual housing units within buildings.
 * Represents apartments, condos, or units that can be occupied by tenants.
 */
export const residences = pgTable('residences', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  buildingId: uuid('building_id')
    .notNull()
    .references(() => buildings.id),
  unitNumber: text('unit_number').notNull(),
  floor: integer('floor'),
  squareFootage: decimal('square_footage', { precision: 8, scale: 2 }),
  bedrooms: integer('bedrooms'),
  bathrooms: decimal('bathrooms', { precision: 3, scale: 1 }),
  balcony: boolean('balcony').default(false),
  parkingSpaceNumber: text('parking_space_number'),
  storageSpaceNumber: text('storage_space_number'),
  ownershipPercentage: decimal('ownership_percentage', { precision: 5, scale: 4 }), // For condos
  monthlyFees: decimal('monthly_fees', { precision: 10, scale: 2 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const userResidences = pgTable('user_residences', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  residenceId: uuid('residence_id')
    .notNull()
    .references(() => residences.id),
  relationshipType: text('relationship_type').notNull(), // 'owner', 'tenant', 'occupant'
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const bills = pgTable('bills', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  residenceId: uuid('residence_id')
    .notNull()
    .references(() => residences.id),
  billNumber: text('bill_number').notNull().unique(),
  type: billTypeEnum('type').notNull(),
  description: text('description').notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  dueDate: date('due_date').notNull(),
  issueDate: date('issue_date').notNull(),
  status: billStatusEnum('status').notNull().default('draft'),
  notes: text('notes'),
  lateFeeAmount: decimal('late_fee_amount', { precision: 10, scale: 2 }),
  discountAmount: decimal('discount_amount', { precision: 10, scale: 2 }),
  finalAmount: decimal('final_amount', { precision: 12, scale: 2 }).notNull(),
  paymentReceivedDate: date('payment_received_date'),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

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

export const budgets = pgTable('budgets', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  buildingId: uuid('building_id')
    .notNull()
    .references(() => buildings.id),
  year: integer('year').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category').notNull(), // 'operational', 'reserve', 'special_project'
  budgetedAmount: decimal('budgeted_amount', { precision: 12, scale: 2 }).notNull(),
  actualAmount: decimal('actual_amount', { precision: 12, scale: 2 }).default('0'),
  variance: decimal('variance', { precision: 12, scale: 2 }).default('0'),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedDate: date('approved_date'),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const documents = pgTable('documents', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id').references(() => organizations.id),
  buildingId: uuid('building_id').references(() => buildings.id),
  residenceId: uuid('residence_id').references(() => residences.id),
  title: text('title').notNull(),
  description: text('description'),
  category: text('category').notNull(), // 'bylaw', 'financial', 'maintenance', 'legal', 'meeting_minutes'
  fileUrl: text('file_url').notNull(),
  fileName: text('file_name').notNull(),
  fileSize: integer('file_size'),
  mimeType: text('mime_type'),
  isPublic: boolean('is_public').notNull().default(false),
  uploadedBy: uuid('uploaded_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

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
 * Development pillars table for the Pillar Methodology framework.
 * Stores the five core development pillars and their completion status.
 */
export const developmentPillars = pgTable('development_pillars', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull().default('pending'), // 'pending', 'in-progress', 'complete'
  order: text('order').notNull(),
  configuration: jsonb('configuration'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const workspaceStatus = pgTable('workspace_status', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  component: text('component').notNull(),
  status: text('status').notNull().default('pending'), // 'pending', 'in-progress', 'complete'
  lastUpdated: timestamp('last_updated').defaultNow(),
});

export const qualityMetrics = pgTable('quality_metrics', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  metricType: text('metric_type').notNull(),
  value: text('value').notNull(),
  timestamp: timestamp('timestamp').defaultNow(),
});

export const frameworkConfiguration = pgTable('framework_configuration', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  key: text('key').notNull().unique(),
  value: jsonb('value').notNull(),
  description: text('description'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Insert schemas for core application
export const insertUserSchema = createInsertSchema(users)
  .pick({
    email: true,
    password: true,
    firstName: true,
    lastName: true,
    phone: true,
    language: true,
    role: true,
  })
  .extend({
    firstName: z.string().min(1).max(100, 'First name must be 100 characters or less'),
    lastName: z.string().min(1).max(100, 'Last name must be 100 characters or less'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  });

export const insertOrganizationSchema = createInsertSchema(organizations).pick({
  name: true,
  type: true,
  address: true,
  city: true,
  province: true,
  postalCode: true,
  phone: true,
  email: true,
  website: true,
  registrationNumber: true,
});

export const insertBuildingSchema = createInsertSchema(buildings).pick({
  organizationId: true,
  name: true,
  address: true,
  city: true,
  province: true,
  postalCode: true,
  buildingType: true,
  yearBuilt: true,
  totalUnits: true,
  totalFloors: true,
  parkingSpaces: true,
  storageSpaces: true,
  amenities: true,
  managementCompany: true,
});

export const insertResidenceSchema = createInsertSchema(residences).pick({
  buildingId: true,
  unitNumber: true,
  floor: true,
  squareFootage: true,
  bedrooms: true,
  bathrooms: true,
  balcony: true,
  parkingSpaceNumber: true,
  storageSpaceNumber: true,
  ownershipPercentage: true,
  monthlyFees: true,
});

export const insertUserResidenceSchema = createInsertSchema(userResidences).pick({
  userId: true,
  residenceId: true,
  relationshipType: true,
  startDate: true,
  endDate: true,
});

export const insertBillSchema = createInsertSchema(bills).pick({
  residenceId: true,
  billNumber: true,
  type: true,
  description: true,
  amount: true,
  dueDate: true,
  issueDate: true,
  status: true,
  notes: true,
  lateFeeAmount: true,
  discountAmount: true,
  finalAmount: true,
  createdBy: true,
});

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

export const insertBudgetSchema = createInsertSchema(budgets).pick({
  buildingId: true,
  year: true,
  name: true,
  description: true,
  category: true,
  budgetedAmount: true,
  actualAmount: true,
  createdBy: true,
});

export const insertDocumentSchema = createInsertSchema(documents).pick({
  organizationId: true,
  buildingId: true,
  residenceId: true,
  title: true,
  description: true,
  category: true,
  fileUrl: true,
  fileName: true,
  fileSize: true,
  mimeType: true,
  isPublic: true,
  uploadedBy: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).pick({
  userId: true,
  type: true,
  title: true,
  message: true,
  relatedEntityId: true,
  relatedEntityType: true,
});

export const insertPillarSchema = createInsertSchema(developmentPillars).pick({
  name: true,
  description: true,
  status: true,
  order: true,
  configuration: true,
});

export const insertWorkspaceStatusSchema = createInsertSchema(workspaceStatus).pick({
  component: true,
  status: true,
});

export const insertQualityMetricSchema = createInsertSchema(qualityMetrics).pick({
  metricType: true,
  value: true,
});

export const insertFrameworkConfigSchema = createInsertSchema(frameworkConfiguration).pick({
  key: true,
  value: true,
  description: true,
});

// Types for core application
/**
 *
 */
/**
 * Type for creating new user records with validation.
 * Derived from the insertUserSchema for type-safe user creation.
 */
export type InsertUser = z.infer<typeof insertUserSchema>;
/**
 *
 */
/**
 * Type representing a complete user record from the database.
 * Inferred from the users table schema for type safety.
 */
export type User = typeof users.$inferSelect;

/**
 *
 */
/**
 * Type for creating new organization records with validation.
 * Derived from the insertOrganizationSchema for type-safe organization creation.
 */
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
/**
 *
 */
/**
 * Type representing a complete organization record from the database.
 * Inferred from the organizations table schema for type safety.
 */
export type Organization = typeof organizations.$inferSelect;

/**
 *
 */
export type InsertBuilding = z.infer<typeof insertBuildingSchema>;
/**
 *
 */
export type Building = typeof buildings.$inferSelect;

/**
 *
 */
export type InsertResidence = z.infer<typeof insertResidenceSchema>;
/**
 *
 */
export type Residence = typeof residences.$inferSelect;

/**
 *
 */
export type InsertUserResidence = z.infer<typeof insertUserResidenceSchema>;
/**
 *
 */
export type UserResidence = typeof userResidences.$inferSelect;

/**
 *
 */
export type InsertBill = z.infer<typeof insertBillSchema>;
/**
 *
 */
export type Bill = typeof bills.$inferSelect;

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
export type InsertBudget = z.infer<typeof insertBudgetSchema>;
/**
 *
 */
export type Budget = typeof budgets.$inferSelect;

/**
 *
 */
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
/**
 *
 */
export type Document = typeof documents.$inferSelect;

/**
 *
 */
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
/**
 *
 */
export type Notification = typeof notifications.$inferSelect;

// Framework types
/**
 *
 */
export type InsertPillar = z.infer<typeof insertPillarSchema>;
/**
 *
 */
export type DevelopmentPillar = typeof developmentPillars.$inferSelect;

/**
 *
 */
export type InsertWorkspaceStatus = z.infer<typeof insertWorkspaceStatusSchema>;
/**
 *
 */
export type WorkspaceStatus = typeof workspaceStatus.$inferSelect;

/**
 *
 */
export type InsertQualityMetric = z.infer<typeof insertQualityMetricSchema>;
/**
 *
 */
export type QualityMetric = typeof qualityMetrics.$inferSelect;

/**
 *
 */
export type InsertFrameworkConfig = z.infer<typeof insertFrameworkConfigSchema>;
/**
 *
 */
export type FrameworkConfiguration = typeof frameworkConfiguration.$inferSelect;

// Improvement Suggestions table
export const improvementSuggestions = pgTable('improvement_suggestions', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text('title').notNull(),
  description: text('description').notNull(),
  category: suggestionCategoryEnum('category').notNull(),
  priority: suggestionPriorityEnum('priority').notNull(),
  status: suggestionStatusEnum('status').notNull().default('New'),
  filePath: text('file_path'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Insert schema for improvement suggestions
export const insertImprovementSuggestionSchema = createInsertSchema(improvementSuggestions).pick({
  title: true,
  description: true,
  category: true,
  priority: true,
  status: true,
  filePath: true,
});

// Types for improvement suggestions
/**
 *
 */
export type InsertImprovementSuggestion = z.infer<typeof insertImprovementSuggestionSchema>;
/**
 *
 */
export type ImprovementSuggestion = typeof improvementSuggestions.$inferSelect;

// Features table
/**
 * Features table for tracking development roadmap items and functionality.
 * Used by the Pillar Methodology framework for feature planning and tracking.
 */
export const features = pgTable('features', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  description: text('description').notNull(),
  category: featureCategoryEnum('category').notNull(),
  status: featureStatusEnum('status').notNull().default('planned'),
  priority: featurePriorityEnum('priority').notNull().default('medium'),
  requestedBy: uuid('requested_by').references(() => users.id),
  assignedTo: uuid('assigned_to').references(() => users.id),
  estimatedHours: integer('estimated_hours'),
  actualHours: integer('actual_hours'),
  startDate: date('start_date'),
  completedDate: date('completed_date'),
  isPublicRoadmap: boolean('is_public_roadmap').notNull().default(true),
  tags: jsonb('tags'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Insert schema for features
export const insertFeatureSchema = createInsertSchema(features).pick({
  name: true,
  description: true,
  category: true,
  status: true,
  priority: true,
  requestedBy: true,
  assignedTo: true,
  estimatedHours: true,
  startDate: true,
  completedDate: true,
  isPublicRoadmap: true,
  tags: true,
  metadata: true,
});

// Types for features
/**
 *
 */
export type InsertFeature = z.infer<typeof insertFeatureSchema>;
/**
 *
 */
export type Feature = typeof features.$inferSelect;

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  buildings: many(buildings),
  documents: many(documents),
}));

export const buildingsRelations = relations(buildings, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [buildings.organizationId],
    references: [organizations.id],
  }),
  residences: many(residences),
  budgets: many(budgets),
  documents: many(documents),
}));

export const residencesRelations = relations(residences, ({ one, many }) => ({
  building: one(buildings, {
    fields: [residences.buildingId],
    references: [buildings.id],
  }),
  userResidences: many(userResidences),
  bills: many(bills),
  maintenanceRequests: many(maintenanceRequests),
  documents: many(documents),
}));

export const usersRelations = relations(users, ({ many }) => ({
  userResidences: many(userResidences),
  createdBills: many(bills),
  submittedMaintenanceRequests: many(maintenanceRequests),
  assignedMaintenanceRequests: many(maintenanceRequests),
  createdBudgets: many(budgets),
  uploadedDocuments: many(documents),
  notifications: many(notifications),
}));

export const userResidencesRelations = relations(userResidences, ({ one }) => ({
  user: one(users, {
    fields: [userResidences.userId],
    references: [users.id],
  }),
  residence: one(residences, {
    fields: [userResidences.residenceId],
    references: [residences.id],
  }),
}));

export const billsRelations = relations(bills, ({ one }) => ({
  residence: one(residences, {
    fields: [bills.residenceId],
    references: [residences.id],
  }),
  createdBy: one(users, {
    fields: [bills.createdBy],
    references: [users.id],
  }),
}));

export const maintenanceRequestsRelations = relations(maintenanceRequests, ({ one }) => ({
  residence: one(residences, {
    fields: [maintenanceRequests.residenceId],
    references: [residences.id],
  }),
  submittedBy: one(users, {
    fields: [maintenanceRequests.submittedBy],
    references: [users.id],
  }),
  assignedTo: one(users, {
    fields: [maintenanceRequests.assignedTo],
    references: [users.id],
  }),
}));

export const budgetsRelations = relations(budgets, ({ one }) => ({
  building: one(buildings, {
    fields: [budgets.buildingId],
    references: [buildings.id],
  }),
  createdBy: one(users, {
    fields: [budgets.createdBy],
    references: [users.id],
  }),
  approvedBy: one(users, {
    fields: [budgets.approvedBy],
    references: [users.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  organization: one(organizations, {
    fields: [documents.organizationId],
    references: [organizations.id],
  }),
  building: one(buildings, {
    fields: [documents.buildingId],
    references: [buildings.id],
  }),
  residence: one(residences, {
    fields: [documents.residenceId],
    references: [residences.id],
  }),
  uploadedBy: one(users, {
    fields: [documents.uploadedBy],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));
