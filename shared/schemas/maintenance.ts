import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  boolean,
  integer,
  decimal,
  date,
  jsonb,
  varchar,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { relations } from 'drizzle-orm';
import { users, organizations } from './core';
import { buildings } from './property';

// Maintenance enums
/**
 * Enum for building element condition assessment
 */
export const elementConditionEnum = pgEnum('element_condition', [
  'excellent',
  'good', 
  'fair',
  'poor',
  'critical'
]);

/**
 * Enum for element history event types
 */
export const eventTypeEnum = pgEnum('event_type', [
  'construction',
  'repair',
  'minor_rehab',
  'major_rehab', 
  'replacement'
]);

/**
 * Enum for evaluation suggestion types
 */
export const suggestionTypeEnum = pgEnum('suggestion_type', [
  'inspection',
  'minor_rehab',
  'major_rehab',
  'replacement'
]);

/**
 * Enum for suggestion priority levels
 */
export const priorityEnum = pgEnum('priority', [
  'low',
  'medium',
  'high',
  'critical'
]);

/**
 * Enum for suggestion status
 */
export const evaluationStatusEnum = pgEnum('evaluation_status', [
  'pending',
  'scheduled',
  'postponed',
  'completed',
  'dismissed'
]);

/**
 * Enum for maintenance project types
 */
export const projectTypeEnum = pgEnum('project_type', [
  'evaluation',
  'repair',
  'minor_rehab',
  'major_rehab',
  'replacement'
]);

/**
 * Enum for maintenance project status
 */
export const projectStatusEnum = pgEnum('project_status', [
  'planned',
  'evaluation',
  'submission',
  'pre_work',
  'work',
  'post_work',
  'completed'
]);

/**
 * Enum for project step types
 */
export const stepTypeEnum = pgEnum('step_type', [
  'evaluation',
  'submission',
  'pre_work',
  'work',
  'post_work',
  'completion'
]);

/**
 * Enum for step status
 */
export const stepStatusEnum = pgEnum('step_status', [
  'pending',
  'in_progress',
  'completed',
  'skipped'
]);

/**
 * Enum for document types
 */
export const documentTypeEnum = pgEnum('document_type', [
  'image',
  'pdf',
  'specification',
  'warranty',
  'report'
]);

// Maintenance tables

/**
 * UNIFORMAT codes reference table for building element classification.
 * Implements the UNIFORMAT II standard for construction cost estimation and facility management.
 */
export const uniformatCodes = pgTable('uniformat_codes', {
  code: varchar('code', { length: 10 }).primaryKey(), // e.g., "A1010"
  level: integer('level').notNull(), // 1-4 indicating hierarchy depth
  parentCode: varchar('parent_code', { length: 10 }).references((): any => uniformatCodes.code),
  nameFr: varchar('name_fr', { length: 255 }).notNull(),
  nameEn: varchar('name_en', { length: 255 }).notNull(),
  descriptionFr: text('description_fr'),
  descriptionEn: text('description_en'),
  typicalLifespan: integer('typical_lifespan'), // baseline years
  category: varchar('category', { length: 100 }), // major system group
});

/**
 * Vendors table for managing contractors and service providers.
 * Stores vendor information with ratings and contact details.
 */
export const vendors = pgTable('vendors', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  category: varchar('category', { length: 100 }), // e.g., 'plumbing', 'electrical', 'general'
  contactPerson: varchar('contact_person', { length: 100 }),
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 255 }),
  address: text('address'),
  rating: decimal('rating', { precision: 3, scale: 2 }), // 0.00 to 5.00
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * Building elements inventory table for tracking physical components.
 * Links to UNIFORMAT codes for standardized classification.
 */
export const buildingElements = pgTable('building_elements', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  buildingId: varchar('building_id')
    .notNull()
    .references(() => buildings.id, { onDelete: 'cascade' }),
  uniformatCode: varchar('uniformat_code', { length: 10 })
    .notNull()
    .references(() => uniformatCodes.code),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  originalConstructionDate: date('original_construction_date'),
  originalLifespan: integer('original_lifespan'), // years
  currentLifespan: integer('current_lifespan'), // adjusted based on work done
  currentCondition: elementConditionEnum('current_condition').notNull().default('good'),
  lastInspectionDate: date('last_inspection_date'),
  nextEvaluationDate: date('next_evaluation_date'),
  unit: varchar('unit', { length: 20 }), // e.g., "m2", "m", "unit"
  unitValue: decimal('unit_value', { precision: 10, scale: 2 }), // quantity in specified unit
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * Element history table for tracking all work performed on building elements.
 * Maintains a complete audit trail of maintenance activities.
 */
export const elementHistory = pgTable('element_history', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  elementId: uuid('element_id')
    .notNull()
    .references(() => buildingElements.id, { onDelete: 'cascade' }),
  eventType: eventTypeEnum('event_type').notNull(),
  eventDate: date('event_date').notNull(),
  vendorId: uuid('vendor_id').references(() => vendors.id, { onDelete: 'set null' }),
  vendorName: varchar('vendor_name', { length: 200 }), // stored for historical record
  cost: decimal('cost', { precision: 10, scale: 2 }),
  warranty: jsonb('warranty'), // warranty details like duration, terms
  lifespanImpact: integer('lifespan_impact'), // years added to element's life
  workDescription: text('work_description').notNull(),
  createdBy: varchar('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

/**
 * Evaluation suggestions table for smart maintenance recommendations.
 * AI-driven and rule-based suggestions for proactive maintenance.
 */
export const evaluationSuggestions = pgTable('evaluation_suggestions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  elementId: uuid('element_id')
    .notNull()
    .references(() => buildingElements.id, { onDelete: 'cascade' }),
  suggestedDate: date('suggested_date').notNull(),
  suggestedType: suggestionTypeEnum('suggested_type').notNull(),
  reason: text('reason').notNull(), // explanation for the suggestion
  priority: priorityEnum('priority').notNull().default('medium'),
  status: evaluationStatusEnum('status').notNull().default('pending'),
  postponedTo: date('postponed_to'), // if postponed, new suggested date
  projectId: uuid('project_id').references((): any => maintenanceProjects.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * Maintenance projects table for managing maintenance work initiatives.
 * Supports project planning, tracking, and budget management.
 */
export const maintenanceProjects = pgTable('maintenance_projects', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  buildingId: varchar('building_id')
    .notNull()
    .references(() => buildings.id, { onDelete: 'cascade' }),
  suggestionId: uuid('suggestion_id').references(() => evaluationSuggestions.id, { onDelete: 'set null' }),
  projectNumber: varchar('project_number', { length: 50 }).notNull().unique(),
  title: varchar('title', { length: 200 }).notNull(),
  type: projectTypeEnum('type').notNull(),
  status: projectStatusEnum('status').notNull().default('planned'),
  plannedStartDate: date('planned_start_date'),
  plannedEndDate: date('planned_end_date'),
  actualStartDate: date('actual_start_date'),
  actualEndDate: date('actual_end_date'),
  totalBudget: decimal('total_budget', { precision: 12, scale: 2 }),
  actualCost: decimal('actual_cost', { precision: 12, scale: 2 }).default('0'),
  priority: priorityEnum('priority').notNull().default('medium'),
  createdBy: varchar('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * Project steps table for tracking workflow stages of maintenance projects.
 * Enables project management with required and optional steps.
 */
export const projectSteps = pgTable('project_steps', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  projectId: uuid('project_id')
    .notNull()
    .references(() => maintenanceProjects.id, { onDelete: 'cascade' }),
  stepType: stepTypeEnum('step_type').notNull(),
  isRequired: boolean('is_required').notNull().default(true),
  status: stepStatusEnum('status').notNull().default('pending'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  notes: text('notes'),
  documents: jsonb('documents'), // array of document IDs
});

/**
 * Project elements junction table linking projects to affected building elements.
 * Tracks which elements are worked on in each project with cost allocation.
 */
export const projectElements = pgTable('project_elements', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  projectId: uuid('project_id')
    .notNull()
    .references(() => maintenanceProjects.id, { onDelete: 'cascade' }),
  elementId: uuid('element_id')
    .notNull()
    .references(() => buildingElements.id, { onDelete: 'cascade' }),
  workDescription: text('work_description'),
  lifespanImpact: integer('lifespan_impact'), // years added to element's life
  costAllocation: decimal('cost_allocation', { precision: 10, scale: 2 }), // cost assigned to this element
});

/**
 * Element documents table for managing files associated with building elements.
 * Supports various document types with proper file metadata tracking.
 */
export const elementDocuments = pgTable('element_documents', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  elementId: uuid('element_id')
    .notNull()
    .references(() => buildingElements.id, { onDelete: 'cascade' }),
  historyId: uuid('history_id').references(() => elementHistory.id, { onDelete: 'set null' }),
  documentType: documentTypeEnum('document_type').notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size'), // in bytes
  mimeType: varchar('mime_type', { length: 100 }),
  uploadedBy: varchar('uploaded_by')
    .notNull()
    .references(() => users.id),
  uploadedAt: timestamp('uploaded_at').defaultNow(),
});

// Insert schemas
export const insertUniformatCodeSchema = createInsertSchema(uniformatCodes, {
  code: z.string().min(1).max(10),
  level: z.number().int().min(1).max(4),
  nameFr: z.string().min(1).max(255),
  nameEn: z.string().min(1).max(255),
  typicalLifespan: z.number().int().positive().optional(),
  category: z.string().max(100).optional(),
});

export const insertVendorSchema = createInsertSchema(vendors, {
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(200),
  category: z.string().max(100).optional(),
  contactPerson: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  rating: z.number().min(0).max(5).optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertBuildingElementSchema = createInsertSchema(buildingElements, {
  buildingId: z.string().uuid(),
  uniformatCode: z.string().min(1).max(10),
  name: z.string().min(1).max(200),
  originalLifespan: z.number().int().positive().optional(),
  currentLifespan: z.number().int().positive().optional(),
  unit: z.string().max(20).optional(),
  unitValue: z.number().positive().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertElementHistorySchema = createInsertSchema(elementHistory, {
  elementId: z.string().uuid(),
  eventDate: z.date(),
  vendorId: z.string().uuid().optional(),
  vendorName: z.string().max(200).optional(),
  cost: z.number().positive().optional(),
  lifespanImpact: z.number().int().optional(),
  workDescription: z.string().min(1),
  createdBy: z.string().uuid(),
}).omit({ id: true, createdAt: true });

export const insertEvaluationSuggestionSchema = createInsertSchema(evaluationSuggestions, {
  elementId: z.string().uuid(),
  suggestedDate: z.date(),
  reason: z.string().min(1),
  postponedTo: z.date().optional(),
  projectId: z.string().uuid().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertMaintenanceProjectSchema = createInsertSchema(maintenanceProjects, {
  buildingId: z.string().uuid(),
  suggestionId: z.string().uuid().optional(),
  projectNumber: z.string().min(1).max(50),
  title: z.string().min(1).max(200),
  plannedStartDate: z.date().optional(),
  plannedEndDate: z.date().optional(),
  actualStartDate: z.date().optional(),
  actualEndDate: z.date().optional(),
  totalBudget: z.number().positive().optional(),
  actualCost: z.number().min(0).optional(),
  createdBy: z.string().uuid(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertProjectStepSchema = createInsertSchema(projectSteps, {
  projectId: z.string().uuid(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
}).omit({ id: true });

export const insertProjectElementSchema = createInsertSchema(projectElements, {
  projectId: z.string().uuid(),
  elementId: z.string().uuid(),
  lifespanImpact: z.number().int().optional(),
  costAllocation: z.number().positive().optional(),
}).omit({ id: true });

export const insertElementDocumentSchema = createInsertSchema(elementDocuments, {
  elementId: z.string().uuid(),
  historyId: z.string().uuid().optional(),
  fileName: z.string().min(1).max(255),
  filePath: z.string().min(1),
  fileSize: z.number().int().positive().optional(),
  mimeType: z.string().max(100).optional(),
  uploadedBy: z.string().uuid(),
}).omit({ id: true, uploadedAt: true });

// TypeScript types
export type UniformatCode = typeof uniformatCodes.$inferSelect;
export type InsertUniformatCode = z.infer<typeof insertUniformatCodeSchema>;

export type Vendor = typeof vendors.$inferSelect;
export type InsertVendor = z.infer<typeof insertVendorSchema>;

export type BuildingElement = typeof buildingElements.$inferSelect;
export type InsertBuildingElement = z.infer<typeof insertBuildingElementSchema>;

export type ElementHistory = typeof elementHistory.$inferSelect;
export type InsertElementHistory = z.infer<typeof insertElementHistorySchema>;

export type EvaluationSuggestion = typeof evaluationSuggestions.$inferSelect;
export type InsertEvaluationSuggestion = z.infer<typeof insertEvaluationSuggestionSchema>;

export type MaintenanceProject = typeof maintenanceProjects.$inferSelect;
export type InsertMaintenanceProject = z.infer<typeof insertMaintenanceProjectSchema>;

export type ProjectStep = typeof projectSteps.$inferSelect;
export type InsertProjectStep = z.infer<typeof insertProjectStepSchema>;

export type ProjectElement = typeof projectElements.$inferSelect;
export type InsertProjectElement = z.infer<typeof insertProjectElementSchema>;

export type ElementDocument = typeof elementDocuments.$inferSelect;
export type InsertElementDocument = z.infer<typeof insertElementDocumentSchema>;

// Relations
export const uniformatCodesRelations = relations(uniformatCodes, ({ one, many }) => ({
  parent: one(uniformatCodes, {
    fields: [uniformatCodes.parentCode],
    references: [uniformatCodes.code],
  }),
  children: many(uniformatCodes),
  buildingElements: many(buildingElements),
}));

export const vendorsRelations = relations(vendors, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [vendors.organizationId],
    references: [organizations.id],
  }),
  elementHistory: many(elementHistory),
}));

export const buildingElementsRelations = relations(buildingElements, ({ one, many }) => ({
  building: one(buildings, {
    fields: [buildingElements.buildingId],
    references: [buildings.id],
  }),
  uniformatCode: one(uniformatCodes, {
    fields: [buildingElements.uniformatCode],
    references: [uniformatCodes.code],
  }),
  history: many(elementHistory),
  suggestions: many(evaluationSuggestions),
  projectElements: many(projectElements),
  documents: many(elementDocuments),
}));

export const elementHistoryRelations = relations(elementHistory, ({ one, many }) => ({
  element: one(buildingElements, {
    fields: [elementHistory.elementId],
    references: [buildingElements.id],
  }),
  vendor: one(vendors, {
    fields: [elementHistory.vendorId],
    references: [vendors.id],
  }),
  createdBy: one(users, {
    fields: [elementHistory.createdBy],
    references: [users.id],
  }),
  documents: many(elementDocuments),
}));

export const evaluationSuggestionsRelations = relations(evaluationSuggestions, ({ one }) => ({
  element: one(buildingElements, {
    fields: [evaluationSuggestions.elementId],
    references: [buildingElements.id],
  }),
  project: one(maintenanceProjects, {
    fields: [evaluationSuggestions.projectId],
    references: [maintenanceProjects.id],
  }),
}));

export const maintenanceProjectsRelations = relations(maintenanceProjects, ({ one, many }) => ({
  building: one(buildings, {
    fields: [maintenanceProjects.buildingId],
    references: [buildings.id],
  }),
  suggestion: one(evaluationSuggestions, {
    fields: [maintenanceProjects.suggestionId],
    references: [evaluationSuggestions.id],
  }),
  createdBy: one(users, {
    fields: [maintenanceProjects.createdBy],
    references: [users.id],
  }),
  steps: many(projectSteps),
  projectElements: many(projectElements),
  suggestions: many(evaluationSuggestions),
}));

export const projectStepsRelations = relations(projectSteps, ({ one }) => ({
  project: one(maintenanceProjects, {
    fields: [projectSteps.projectId],
    references: [maintenanceProjects.id],
  }),
}));

export const projectElementsRelations = relations(projectElements, ({ one }) => ({
  project: one(maintenanceProjects, {
    fields: [projectElements.projectId],
    references: [maintenanceProjects.id],
  }),
  element: one(buildingElements, {
    fields: [projectElements.elementId],
    references: [buildingElements.id],
  }),
}));

export const elementDocumentsRelations = relations(elementDocuments, ({ one }) => ({
  element: one(buildingElements, {
    fields: [elementDocuments.elementId],
    references: [buildingElements.id],
  }),
  history: one(elementHistory, {
    fields: [elementDocuments.historyId],
    references: [elementHistory.id],
  }),
  uploadedBy: one(users, {
    fields: [elementDocuments.uploadedBy],
    references: [users.id],
  }),
}));