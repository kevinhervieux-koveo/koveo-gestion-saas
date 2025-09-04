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
import { users } from './core';

// Development enums
export const suggestionCategoryEnum = pgEnum('suggestion_category', [
  'Code Quality',
  'Security',
  'Testing',
  'Documentation',
  'Performance',
  'Continuous Improvement',
  'Replit AI Agent Monitoring',
  'Replit App',
]);

export const suggestionPriorityEnum = pgEnum('suggestion_priority', [
  'Low',
  'Medium',
  'High',
  'Critical',
]);

export const suggestionStatusEnum = pgEnum('suggestion_status', ['New', 'Acknowledged', 'Done']);

export const featureStatusEnum = pgEnum('feature_status', [
  'submitted',
  'planned',
  'in-progress',
  'ai-analyzed',
  'completed',
  'cancelled',
]);

export const featurePriorityEnum = pgEnum('feature_priority', [
  'low',
  'medium',
  'high',
  'critical',
]);

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
  'Website',
]);

export const actionableItemStatusEnum = pgEnum('actionable_item_status', [
  'pending',
  'in-progress',
  'completed',
  'blocked',
]);

// Development tables
/**
 * Improvement suggestions table for the Pillar Methodology framework.
 * Stores AI-generated and manual suggestions for code quality, security, and process improvements.
 */
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
  technicalDetails: text('technical_details'),
  businessImpact: text('business_impact'),
  implementationEffort: text('implementation_effort'),
  quebecComplianceRelevance: text('quebec_compliance_relevance'),
  suggestedBy: varchar('suggested_by').references(() => users.id),
  assignedTo: varchar('assigned_to').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  acknowledgedAt: timestamp('acknowledged_at'),
  completedAt: timestamp('completed_at'),
});

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
  status: featureStatusEnum('status').notNull().default('submitted'),
  priority: featurePriorityEnum('priority').notNull().default('medium'),
  requestedBy: text('requested_by'),
  assignedTo: text('assigned_to'),
  estimatedHours: integer('estimated_hours'),
  actualHours: integer('actual_hours'),
  startDate: date('start_date'),
  completedDate: date('completed_date'),
  isPublicRoadmap: boolean('is_public_roadmap').notNull().default(true),
  tags: jsonb('tags'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  businessObjective: text('business_objective'),
  targetUsers: text('target_users'),
  successMetrics: text('success_metrics'),
  technicalComplexity: text('technical_complexity'),
  dependencies: text('dependencies'),
  userFlow: text('user_flow'),
  aiAnalysisResult: jsonb('ai_analysis_result'),
  aiAnalyzedAt: timestamp('ai_analyzed_at'),
  isStrategicPath: boolean('is_strategic_path').notNull().default(false),
  syncedAt: timestamp('synced_at'),
});

/**
 * Actionable items table for tracking specific tasks generated from feature analysis.
 * Links features to concrete development tasks and implementation steps.
 */
export const actionableItems = pgTable('actionable_items', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  featureId: uuid('feature_id')
    .notNull()
    .references(() => features.id),
  title: text('title').notNull(),
  description: text('description').notNull(),
  type: text('type').notNull(), // 'code', 'test', 'documentation', 'design', etc.
  status: actionableItemStatusEnum('status').notNull().default('pending'),
  estimatedHours: integer('estimated_hours'),
  actualHours: integer('actual_hours'),
  assignedTo: varchar('assigned_to').references(() => users.id),
  dependencies: jsonb('dependencies'), // Array of other actionable item IDs
  acceptanceCriteria: text('acceptance_criteria'),
  implementation_notes: text('implementation_notes'),
  // AI-generated analysis fields
  technicalDetails: text('technical_details'),
  implementationPrompt: text('implementation_prompt'),
  testingRequirements: text('testing_requirements'),
  estimatedEffort: text('estimated_effort'),
  orderIndex: integer('order_index').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
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
  _value: text('value').notNull(),
  timestamp: timestamp('timestamp').defaultNow(),
});

export const frameworkConfiguration = pgTable('framework_configuration', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  _key: text('key').notNull().unique(),
  _value: text('value').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Insert schemas
export const insertImprovementSuggestionSchema = z.object({
  title: z.string(),
  description: z.string(),
  category: z.string(),
  priority: z.string().default('medium'),
  status: z.string().default('new'),
  filePath: z.string().optional(),
  technicalDetails: z.string().optional(),
  businessImpact: z.string().optional(),
  implementationEffort: z.string().optional(),
  quebecComplianceRelevance: z.string().optional(),
  suggestedBy: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),
});

export const insertFeatureSchema = z.object({
  name: z.string(),
  description: z.string(),
  category: z.string(),
  status: z.string().default('planned'),
  priority: z.string().default('medium'),
  requestedBy: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),
  estimatedHours: z.number().optional(),
  businessObjective: z.string().optional(),
  targetUsers: z.string().optional(),
  successMetrics: z.string().optional(),
  technicalComplexity: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  userFlow: z.string().optional(),
});

export const insertActionableItemSchema = z.object({
  featureId: z.string().uuid().optional(),
  title: z.string(),
  description: z.string(),
  type: z.string(),
  status: z.string().default('pending'),
  estimatedHours: z.number().optional(),
  assignedTo: z.string().uuid().optional(),
  dependencies: z.array(z.string()).optional(),
  acceptanceCriteria: z.string().optional(),
  implementation_notes: z.string().optional(),
});

export const insertPillarSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  status: z.string().default('pending'),
  order: z.number().int(),
  configuration: z.record(z.string(), z.any()).optional(),
});

export const insertWorkspaceStatusSchema = z.object({
  component: z.string(),
  status: z.string().default('pending'),
});

export const insertQualityMetricSchema = z.object({
  metricType: z.string(),
  _value: z.string(),
});

export const insertFrameworkConfigSchema = z.object({
  _key: z.string(),
  _value: z.string(),
  description: z.string().optional(),
});

// Types
/**
 *
 */
export type InsertImprovementSuggestion = z.infer<typeof insertImprovementSuggestionSchema>;
/**
 *
 */
export type ImprovementSuggestion = typeof improvementSuggestions.$inferSelect;

/**
 *
 */
export type InsertFeature = z.infer<typeof insertFeatureSchema>;
/**
 *
 */
export type Feature = typeof features.$inferSelect;

/**
 *
 */
export type InsertActionableItem = z.infer<typeof insertActionableItemSchema>;
/**
 *
 */
export type ActionableItem = typeof actionableItems.$inferSelect;

/**
 *
 */
export type InsertPillar = z.infer<typeof insertPillarSchema>;
/**
 *
 */
export type Pillar = typeof developmentPillars.$inferSelect;

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
export type InsertFrameworkConfiguration = z.infer<typeof insertFrameworkConfigSchema>;
/**
 *
 */
export type FrameworkConfiguration = typeof frameworkConfiguration.$inferSelect;

// Relations
// Relations - temporarily commented out due to drizzle-orm version compatibility
// export const improvementSuggestionsRelations = relations(improvementSuggestions, ({ one }) => ({
//   suggestedBy: one(users, {
//     fields: [improvementSuggestions.suggestedBy],
//     references: [users.id],
//     relationName: 'suggestedBy',
//   }),
//   assignedTo: one(users, {
//     fields: [improvementSuggestions.assignedTo],
//     references: [users.id],
//     relationName: 'assignedTo',
//   }),
// }));

// export const featuresRelations = relations(features, ({ many }) => ({
//   actionableItems: many(actionableItems),
// }));

// export const actionableItemsRelations = relations(actionableItems, ({ one }) => ({
//   feature: one(features, {
//     fields: [actionableItems.featureId],
//     references: [features.id],
//   }),
// }));
