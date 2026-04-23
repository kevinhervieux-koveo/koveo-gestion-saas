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
  unique,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { relations } from 'drizzle-orm';
import { users, organizations } from './core';
import { buildings, residences } from './property';
import { schedulePaymentEnum } from './financial';

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
  'repair',
  'minor_rehab',
  'major_rehab',
  'replacement',
  'not_sure'
]);

/**
 * Enum for maintenance project status
 */
export const projectStatusEnum = pgEnum('project_status', [
  'planned',
  'submission',
  'pre_work',
  'in_progress',
  'post_work',
  'completed'
]);

/**
 * Enum for project step types
 */
export const stepTypeEnum = pgEnum('step_type', [
  'submission',
  'pre_work',
  'in_progress',
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

/**
 * Enum for building element access type
 */
export const elementAccessEnum = pgEnum('element_access', [
  'not_restrained',
  'restrained'
]);

/**
 * Enum for building element charge type
 */
export const elementChargeEnum = pgEnum('element_charge', [
  'common',
  'personnal'
]);

/**
 * Enum for auto-generated project status
 */
export const autoProjectStatusEnum = pgEnum('auto_project_status', [
  'pending',
  'accepted',
  'dismissed'
]);

/**
 * Enum for project origin
 */
export const projectOriginEnum = pgEnum('project_origin', [
  'manual',
  'auto'
]);

/**
 * Enum for workflow task phases
 */
export const workflowPhaseEnum = pgEnum('workflow_phase', [
  'pre_work',
  'in_progress',
  'post_work'
]);

/**
 * Enum for notification timing types
 */
export const timingTypeEnum = pgEnum('timing_type', [
  'one_day_before',
  'three_days_before',
  'one_week_before',
  'custom'
]);

/**
 * Enum for element update status in post-work phase
 */
export const elementUpdateStatusEnum = pgEnum('element_update_status', [
  'repair',
  'minor_rehab',
  'major_rehab',
  'replace',
  'nothing'
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
}, (table) => ({
  parentCodeIdx: index('uniformat_codes_parent_code_idx').on(table.parentCode),
}));

/**
 * Vendors table for managing contractors and service providers.
 * Stores vendor information with ratings and contact details.
 */
export const vendors = pgTable('vendors', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text('organization_id')
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
}, (table) => ({
  // Performance index for organization lookups
  organizationIdIdx: index('vendors_organization_id_idx').on(table.organizationId),
  categoryIdx: index('vendors_category_idx').on(table.category),
  // Date indexes for range queries
  createdAtIdx: index('vendors_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('vendors_updated_at_idx').on(table.updatedAt),
  // Validation constraints
  ratingCheck: check('vendors_rating_check', sql`rating >= 0 AND rating <= 5`),
}));

/**
 * Building elements inventory table for tracking physical components.
 * Links to UNIFORMAT codes for standardized classification.
 */
export const buildingElements = pgTable('building_elements', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  buildingId: text('building_id')
    .notNull()
    .references(() => buildings.id, { onDelete: 'cascade' }),
  residenceId: text('residence_id'), // Single residence ID, null for building-wide elements
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
  reconstructionCost: decimal('reconstruction_cost', { precision: 10, scale: 2 }), // estimated reconstruction cost
  costEstimationDate: date('cost_estimation_date'), // date when cost was estimated
  access: elementAccessEnum('access').notNull().default('not_restrained'), // Access type for element
  charge: elementChargeEnum('charge').notNull().default('common'), // Charge type for element
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  // Performance indexes (removed unique constraint to allow duplicates at level 3)
  buildingIdIdx: index('building_elements_building_id_idx').on(table.buildingId),
  residenceIdIdx: index('building_elements_residence_id_idx').on(table.residenceId),
  uniformatCodeIdx: index('building_elements_uniformat_code_idx').on(table.uniformatCode),
  // Date indexes for range queries
  originalConstructionDateIdx: index('building_elements_original_construction_date_idx').on(table.originalConstructionDate),
  lastInspectionDateIdx: index('building_elements_last_inspection_date_idx').on(table.lastInspectionDate),
  nextEvaluationDateIdx: index('building_elements_next_evaluation_date_idx').on(table.nextEvaluationDate),
  costEstimationDateIdx: index('building_elements_cost_estimation_date_idx').on(table.costEstimationDate),
  createdAtIdx: index('building_elements_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('building_elements_updated_at_idx').on(table.updatedAt),
}));

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
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  // Performance indexes for history lookups
  elementIdIdx: index('element_history_element_id_idx').on(table.elementId),
  eventDateIdx: index('element_history_event_date_idx').on(table.eventDate),
  vendorIdIdx: index('element_history_vendor_id_idx').on(table.vendorId),
  eventTypeIdx: index('element_history_event_type_idx').on(table.eventType),
  // Date indexes for range queries
  createdAtIdx: index('element_history_created_at_idx').on(table.createdAt),
  // Validation constraints
  costCheck: check('element_history_cost_check', sql`cost >= 0`),
}));

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
}, (table) => ({
  // Performance indexes for evaluation suggestions
  elementIdIdx: index('evaluation_suggestions_element_id_idx').on(table.elementId),
  statusSuggestedDateIdx: index('evaluation_suggestions_status_suggested_date_idx').on(table.status, table.suggestedDate),
  projectIdIdx: index('evaluation_suggestions_project_id_idx').on(table.projectId),
  suggestedTypeIdx: index('evaluation_suggestions_suggested_type_idx').on(table.suggestedType),
  // Date indexes for range queries
  postponedToIdx: index('evaluation_suggestions_postponed_to_idx').on(table.postponedTo),
  createdAtIdx: index('evaluation_suggestions_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('evaluation_suggestions_updated_at_idx').on(table.updatedAt),
}));

/**
 * Auto-generated projects table for AI-suggested maintenance projects.
 * Stores automatically generated project suggestions based on element analysis.
 */
export const autoGeneratedProjects = pgTable('auto_generated_projects', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  buildingId: text('building_id')
    .notNull()
    .references(() => buildings.id, { onDelete: 'cascade' }),
  elementId: uuid('element_id')
    .notNull()
    .references(() => buildingElements.id, { onDelete: 'cascade' }),
  suggestionId: uuid('suggestion_id').references(() => evaluationSuggestions.id, { onDelete: 'set null' }),
  status: autoProjectStatusEnum('status').notNull().default('pending'),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description').notNull(),
  suggestedType: projectTypeEnum('suggested_type').notNull(),
  suggestedPriority: priorityEnum('suggested_priority').notNull().default('medium'),
  estimatedCost: decimal('estimated_cost', { precision: 12, scale: 2 }),
  confidence: decimal('confidence', { precision: 3, scale: 2 }), // 0.00 to 1.00
  metadata: jsonb('metadata'), // additional AI-generated data
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  // Performance indexes
  buildingIdIdx: index('auto_generated_projects_building_id_idx').on(table.buildingId),
  elementIdIdx: index('auto_generated_projects_element_id_idx').on(table.elementId),
  statusIdx: index('auto_generated_projects_status_idx').on(table.status),
  // Date indexes for range queries
  createdAtIdx: index('auto_generated_projects_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('auto_generated_projects_updated_at_idx').on(table.updatedAt),
  // Unique constraint: one pending auto-project per element
  uniquePendingPerElement: unique('auto_generated_projects_unique_pending_per_element').on(table.elementId, table.status),
  // Validation constraints
  estimatedCostCheck: check('auto_generated_projects_estimated_cost_check', sql`estimated_cost >= 0`),
  confidenceCheck: check('auto_generated_projects_confidence_check', sql`confidence >= 0 AND confidence <= 1`),
}));

/**
 * Maintenance projects table for managing maintenance work initiatives.
 * Supports project planning, tracking, and budget management.
 */
export const maintenanceProjects = pgTable('maintenance_projects', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  buildingId: text('building_id')
    .notNull()
    .references(() => buildings.id, { onDelete: 'cascade' }),
  suggestionId: uuid('suggestion_id').references(() => evaluationSuggestions.id, { onDelete: 'set null' }),
  autoGeneratedId: uuid('auto_generated_id').references(() => autoGeneratedProjects.id, { onDelete: 'set null' }),
  projectNumber: varchar('project_number', { length: 50 }).notNull().unique(),
  title: varchar('title', { length: 200 }).notNull(),
  type: projectTypeEnum('type').notNull().default('not_sure'),
  origin: projectOriginEnum('origin').notNull().default('manual'),
  status: projectStatusEnum('status').notNull().default('planned'),
  plannedStartDate: date('planned_start_date'),
  plannedEndDate: date('planned_end_date'),
  actualStartDate: date('actual_start_date'),
  actualEndDate: date('actual_end_date'),
  totalBudget: decimal('total_budget', { precision: 12, scale: 2 }),
  actualCost: decimal('actual_cost', { precision: 12, scale: 2 }).default('0'),
  priority: priorityEnum('priority').notNull().default('medium'),
  // Planning fields
  planningDescription: text('planning_description'),
  planningStartDate: date('planning_start_date'),
  estimatedCost: decimal('estimated_cost', { precision: 12, scale: 2 }),
  financialYear: integer('financial_year'),
  // Workflow control fields
  skipSubmission: boolean('skip_submission').notNull().default(false),
  skipPreWork: boolean('skip_pre_work').notNull().default(false),
  skipInProgress: boolean('skip_in_progress').notNull().default(false),
  skipPostWork: boolean('skip_post_work').notNull().default(false),
  // Completion fields
  completionSummary: text('completion_summary'),
  workStartDate: date('work_start_date'),
  // Quick Project flag - restricts workflow progression
  isQuickProject: boolean('is_quick_project').notNull().default(false),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  // Performance indexes for maintenance projects
  buildingStatusIdx: index('maintenance_projects_building_status_idx').on(table.buildingId, table.status),
  typeIdx: index('maintenance_projects_type_idx').on(table.type),
  // Date indexes for range queries
  plannedStartDateIdx: index('maintenance_projects_planned_start_date_idx').on(table.plannedStartDate),
  plannedEndDateIdx: index('maintenance_projects_planned_end_date_idx').on(table.plannedEndDate),
  actualStartDateIdx: index('maintenance_projects_actual_start_date_idx').on(table.actualStartDate),
  actualEndDateIdx: index('maintenance_projects_actual_end_date_idx').on(table.actualEndDate),
  planningStartDateIdx: index('maintenance_projects_planning_start_date_idx').on(table.planningStartDate),
  workStartDateIdx: index('maintenance_projects_work_start_date_idx').on(table.workStartDate),
  createdAtIdx: index('maintenance_projects_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('maintenance_projects_updated_at_idx').on(table.updatedAt),
  // Validation constraints
  totalBudgetCheck: check('maintenance_projects_total_budget_check', sql`total_budget >= 0`),
  actualCostCheck: check('maintenance_projects_actual_cost_check', sql`actual_cost >= 0`),
  estimatedCostCheck: check('maintenance_projects_estimated_cost_check', sql`estimated_cost >= 0`),
}));

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
}, (table) => ({
  projectIdIdx: index('project_steps_project_id_idx').on(table.projectId),
  // Date indexes for range queries
  startedAtIdx: index('project_steps_started_at_idx').on(table.startedAt),
  completedAtIdx: index('project_steps_completed_at_idx').on(table.completedAt),
}));

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
  projectType: projectTypeEnum('project_type'), // type of work planned for this element
  workDescription: text('work_description'),
  lifespanImpact: integer('lifespan_impact'), // years added to element's life
  costAllocation: decimal('cost_allocation', { precision: 10, scale: 2 }), // cost assigned to this element
  confirmed: boolean('confirmed').notNull().default(false), // element lifespan effect confirmed by user
}, (table) => ({
  projectIdIdx: index('project_elements_project_id_idx').on(table.projectId),
  elementIdIdx: index('project_elements_element_id_idx').on(table.elementId),
  // Validation constraints
  costAllocationCheck: check('project_elements_cost_allocation_check', sql`cost_allocation >= 0`),
}));

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
  // Original UTF-8 filename supplied by the uploader (Task #420). The
  // `fileName` column above is normalized to ASCII for filesystem safety,
  // while this column preserves the user-facing name for download headers.
  originalFileName: text('original_file_name'),
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size'), // in bytes
  mimeType: varchar('mime_type', { length: 100 }),
  uploadedBy: text('uploaded_by')
    .notNull()
    .references(() => users.id),
  uploadedAt: timestamp('uploaded_at').defaultNow(),
}, (table) => ({
  elementIdIdx: index('element_documents_element_id_idx').on(table.elementId),
  historyIdIdx: index('element_documents_history_id_idx').on(table.historyId),
  uploadedByIdx: index('element_documents_uploaded_by_idx').on(table.uploadedBy),
  documentTypeIdx: index('element_documents_document_type_idx').on(table.documentType),
}));

/**
 * Submission vendors table for managing vendor submissions during project submission phase.
 * Tracks vendor quotes, contact information, and selection status.
 */
export const submissionVendors = pgTable('submission_vendors', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  projectId: uuid('project_id')
    .notNull()
    .references(() => maintenanceProjects.id, { onDelete: 'cascade' }),
  vendorName: varchar('vendor_name', { length: 255 }).notNull(),
  availableDate: date('available_date'),
  contactInfo: text('contact_info'),
  notes: text('notes'),
  price: decimal('price', { precision: 12, scale: 2 }),
  projectType: projectTypeEnum('project_type').notNull(),
  addedLifespan: integer('added_lifespan'), // only for minor/major rehab
  documents: jsonb('documents'), // submission documents
  // Payment plan fields following financial service patterns
  paymentPlanCosts: decimal('payment_plan_costs', { precision: 10, scale: 2 }).array(), // array of payment amounts like bills.costs
  paymentPlanSchedule: schedulePaymentEnum('payment_plan_schedule'), // weekly, monthly, quarterly, yearly, custom
  paymentPlanCustomDates: date('payment_plan_custom_dates').array(), // for custom scheduling
  paymentPlanStartDate: date('payment_plan_start_date'), // when payments begin
  isSelected: boolean('is_selected').notNull().default(false),
  preferred: boolean('preferred').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  // Performance indexes
  projectIdIdx: index('submission_vendors_project_id_idx').on(table.projectId),
  vendorNameIdx: index('submission_vendors_vendor_name_idx').on(table.vendorName),
  // Date indexes for range queries
  availableDateIdx: index('submission_vendors_available_date_idx').on(table.availableDate),
  paymentPlanStartDateIdx: index('submission_vendors_payment_plan_start_date_idx').on(table.paymentPlanStartDate),
  createdAtIdx: index('submission_vendors_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('submission_vendors_updated_at_idx').on(table.updatedAt),
  // Validation constraints
  priceCheck: check('submission_vendors_price_check', sql`price >= 0`),
  addedLifespanCheck: check('submission_vendors_added_lifespan_check', sql`added_lifespan >= 0`),
}));

/**
 * Workflow tasks table for managing specific tasks within project workflow phases.
 * Enables detailed task tracking and cost allocation per phase.
 */
export const workflowTasks = pgTable('workflow_tasks', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  projectId: uuid('project_id')
    .notNull()
    .references(() => maintenanceProjects.id, { onDelete: 'cascade' }),
  phase: workflowPhaseEnum('phase').notNull(),
  taskName: text('task_name').notNull(),
  description: text('description'),
  cost: decimal('cost', { precision: 10, scale: 2 }),
  dueDate: date('due_date'),
  isCompleted: boolean('is_completed').notNull().default(false),
  orderIndex: integer('order_index').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  // Performance indexes
  projectPhaseIdx: index('workflow_tasks_project_phase_idx').on(table.projectId, table.phase),
  orderIdx: index('workflow_tasks_order_idx').on(table.projectId, table.orderIndex),
  // Date indexes for range queries
  dueDateIdx: index('workflow_tasks_due_date_idx').on(table.dueDate),
  createdAtIdx: index('workflow_tasks_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('workflow_tasks_updated_at_idx').on(table.updatedAt),
  // Validation constraints
  costCheck: check('workflow_tasks_cost_check', sql`cost >= 0`),
}));

/**
 * Project notifications table for managing automated reminders and notifications.
 * Supports various timing configurations for project workflow notifications.
 */
export const projectNotifications = pgTable('project_notifications', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  projectId: uuid('project_id')
    .notNull()
    .references(() => maintenanceProjects.id, { onDelete: 'cascade' }),
  messageText: text('message_text').notNull(),
  timingType: timingTypeEnum('timing_type').notNull(),
  customDaysBefore: integer('custom_days_before'), // for custom timing
  isSent: boolean('is_sent').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  // Performance indexes
  projectIdIdx: index('project_notifications_project_id_idx').on(table.projectId),
  isSentIdx: index('project_notifications_is_sent_idx').on(table.isSent),
  // Date indexes for range queries
  createdAtIdx: index('project_notifications_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('project_notifications_updated_at_idx').on(table.updatedAt),
  // Validation constraints
  customDaysBeforeCheck: check('project_notifications_custom_days_before_check', sql`custom_days_before > 0`),
}));

/**
 * Element project updates table for tracking actual work performed on elements in post-work phase.
 * Records what was actually done to each element during the project completion.
 */
export const elementProjectUpdates = pgTable('element_project_updates', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  projectId: uuid('project_id')
    .notNull()
    .references(() => maintenanceProjects.id, { onDelete: 'cascade' }),
  elementId: uuid('element_id')
    .notNull()
    .references(() => buildingElements.id, { onDelete: 'cascade' }),
  updateStatus: elementUpdateStatusEnum('update_status').notNull(),
  actualCost: decimal('actual_cost', { precision: 10, scale: 2 }), // optional cost for this specific element update
  notes: text('notes'), // optional notes about the work performed
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  // Performance indexes
  projectIdIdx: index('element_project_updates_project_id_idx').on(table.projectId),
  elementIdIdx: index('element_project_updates_element_id_idx').on(table.elementId),
  // Date indexes for range queries
  createdAtIdx: index('element_project_updates_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('element_project_updates_updated_at_idx').on(table.updatedAt),
  // Unique constraint: one update record per project-element combination
  uniqueProjectElement: unique('element_project_updates_unique_project_element').on(table.projectId, table.elementId),
  // Validation constraints
  actualCostCheck: check('element_project_updates_actual_cost_check', sql`actual_cost >= 0`),
}));

// Insert schemas
export const insertUniformatCodeSchema = z.object({
  code: z.string().min(1).max(10),
  level: z.number().int().min(1).max(4),
  nameFr: z.string().min(1).max(255),
  nameEn: z.string().min(1).max(255),
  typicalLifespan: z.number().int().positive().optional(),
  category: z.string().max(100).optional(),
});

// Temporary fix: Manual schema definition to avoid createInsertSchema issue
export const insertVendorSchema = z.object({
  organizationId: z.string(),
  name: z.string().min(1).max(200),
  category: z.string().max(100).optional(),
  contactPerson: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
});

// Temporary fix: Manual schema definition to avoid createInsertSchema issue
export const insertBuildingElementSchema = z.object({
  buildingId: z.string(),
  residenceId: z.string().nullable().optional(),
  uniformatCode: z.string().min(1).max(10),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  originalConstructionDate: z.coerce.date().optional(),
  originalLifespan: z.number().int().positive().optional(),
  currentLifespan: z.number().int().positive().optional(),
  lastInspectionDate: z.coerce.date().optional(),
  nextEvaluationDate: z.coerce.date().optional(),
  unit: z.string().max(20).optional(),
  unitValue: z.number().positive().optional(),
  notes: z.string().optional(),
  reconstructionCost: z.number().positive().optional(),
  costEstimationDate: z.coerce.date().optional(),
  currentCondition: z.enum(['excellent', 'good', 'fair', 'poor', 'critical']).optional(),
  access: z.enum(['not_restrained', 'restrained']).optional(),
  charge: z.enum(['common', 'personnal']).optional(),
});

// Temporary fix: Manual schema definition
export const insertElementHistorySchema = z.object({
  elementId: z.string().uuid(),
  eventDate: z.date(),
  vendorId: z.string().uuid().optional(),
  vendorName: z.string().max(200).optional(),
  cost: z.number().positive().optional(),
  lifespanImpact: z.number().int().optional(),
  workDescription: z.string().min(1),
  createdBy: z.string(),
});

// Temporary fix: Manual schema definition
export const insertEvaluationSuggestionSchema = z.object({
  elementId: z.string().uuid(),
  suggestedDate: z.date(),
  reason: z.string().min(1),
  postponedTo: z.date().optional(),
  projectId: z.string().uuid().optional(),
});

// Temporary fix: Manual schema definition
export const insertAutoGeneratedProjectSchema = z.object({
  buildingId: z.string(),
  elementId: z.string().uuid(),
  suggestionId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  estimatedCost: z.number().positive().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const insertMaintenanceProjectSchema = z.object({
  buildingId: z.string(),
  suggestionId: z.string().uuid().optional(),
  autoGeneratedId: z.string().uuid().optional(),
  projectNumber: z.string().min(1).max(50),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.enum(['planning', 'submission', 'pre_work', 'in_progress', 'post_work', 'complete', 'abandoned']).optional(),
  plannedStartDate: z.coerce.date().optional(),
  plannedEndDate: z.coerce.date().optional(),
  actualStartDate: z.coerce.date().optional(),
  actualEndDate: z.coerce.date().optional(),
  totalBudget: z.number().positive().optional(),
  actualCost: z.number().min(0).optional(),
  planningDescription: z.string().optional(),
  planningStartDate: z.coerce.date().optional(),
  estimatedCost: z.number().positive().optional(),
  skipSubmission: z.boolean().optional(),
  skipPreWork: z.boolean().optional(),
  skipInProgress: z.boolean().optional(),
  skipPostWork: z.boolean().optional(),
  completionSummary: z.string().optional(),
  workStartDate: z.coerce.date().optional(),
  createdBy: z.string(),
});

export const insertProjectStepSchema = z.object({
  projectId: z.string().uuid(),
  step: z.enum(['planning', 'submission', 'pre_work', 'in_progress', 'post_work']),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
});

export const insertProjectElementSchema = z.object({
  projectId: z.string().uuid(),
  elementId: z.string().uuid(),
  projectType: z.enum(['repair', 'minor_rehab', 'major_rehab', 'replacement', 'not_sure']).optional(),
  lifespanImpact: z.number().int().optional(),
  costAllocation: z.number().positive().optional(),
});

export const insertElementDocumentSchema = z.object({
  elementId: z.string().uuid(),
  historyId: z.string().uuid().optional(),
  fileName: z.string().min(1).max(255),
  originalFileName: z.string().optional(),
  filePath: z.string().min(1),
  fileSize: z.number().int().positive().optional(),
  mimeType: z.string().max(100).optional(),
  uploadedBy: z.string(),
});

export const insertSubmissionVendorSchema = z.object({
  projectId: z.string().uuid(),
  vendorName: z.string().min(1, 'Vendor name is required').max(255),
  availableDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  contactInfo: z.string().optional(),
  notes: z.string().optional(),
  price: z.number().positive().optional(),
  addedLifespan: z.number().int().positive().optional(),
  paymentPlanCosts: z.array(z.number().positive()).min(1).optional(),
  paymentPlanSchedule: z.enum(['weekly', 'monthly', 'quarterly', 'yearly', 'custom']).optional(),
  paymentPlanCustomDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  paymentPlanStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  preferred: z.boolean().optional(),
});

export const insertWorkflowTaskSchema = z.object({
  projectId: z.string().uuid(),
  step: z.enum(['planning', 'submission', 'pre_work', 'in_progress', 'post_work']),
  taskName: z.string().min(1),
  description: z.string().optional(),
  completed: z.boolean().optional(),
  cost: z.number().positive().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  orderIndex: z.number().int().min(0),
});

export const insertProjectNotificationSchema = z.object({
  projectId: z.string().uuid(),
  type: z.enum(['planning_start', 'submission_due', 'work_start', 'work_end', 'custom']),
  messageText: z.string().min(1),
  customDaysBefore: z.number().int().positive().optional(),
});

export const insertElementProjectUpdateSchema = z.object({
  projectId: z.string().uuid(),
  elementId: z.string().uuid(),
  updateStatus: z.enum(['repair', 'minor_rehab', 'major_rehab', 'replacement']),
  actualCost: z.number().positive().optional(),
  notes: z.string().optional(),
});

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

export type AutoGeneratedProject = typeof autoGeneratedProjects.$inferSelect;
export type InsertAutoGeneratedProject = z.infer<typeof insertAutoGeneratedProjectSchema>;

export type MaintenanceProject = typeof maintenanceProjects.$inferSelect;
export type InsertMaintenanceProject = z.infer<typeof insertMaintenanceProjectSchema>;

export type ProjectStep = typeof projectSteps.$inferSelect;
export type InsertProjectStep = z.infer<typeof insertProjectStepSchema>;

export type ProjectElement = typeof projectElements.$inferSelect;
export type InsertProjectElement = z.infer<typeof insertProjectElementSchema>;

export type ElementDocument = typeof elementDocuments.$inferSelect;
export type InsertElementDocument = z.infer<typeof insertElementDocumentSchema>;

export type SubmissionVendor = typeof submissionVendors.$inferSelect;
export type InsertSubmissionVendor = z.infer<typeof insertSubmissionVendorSchema>;

export type WorkflowTask = typeof workflowTasks.$inferSelect;
export type InsertWorkflowTask = z.infer<typeof insertWorkflowTaskSchema>;

export type ProjectNotification = typeof projectNotifications.$inferSelect;
export type InsertProjectNotification = z.infer<typeof insertProjectNotificationSchema>;

export type ElementProjectUpdate = typeof elementProjectUpdates.$inferSelect;
export type InsertElementProjectUpdate = z.infer<typeof insertElementProjectUpdateSchema>;

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
  submissionVendors: many(submissionVendors),
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
  autoGeneratedProjects: many(autoGeneratedProjects),
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

export const evaluationSuggestionsRelations = relations(evaluationSuggestions, ({ one, many }) => ({
  element: one(buildingElements, {
    fields: [evaluationSuggestions.elementId],
    references: [buildingElements.id],
  }),
  project: one(maintenanceProjects, {
    fields: [evaluationSuggestions.projectId],
    references: [maintenanceProjects.id],
  }),
  autoGeneratedProjects: many(autoGeneratedProjects),
}));

export const autoGeneratedProjectsRelations = relations(autoGeneratedProjects, ({ one }) => ({
  building: one(buildings, {
    fields: [autoGeneratedProjects.buildingId],
    references: [buildings.id],
  }),
  element: one(buildingElements, {
    fields: [autoGeneratedProjects.elementId],
    references: [buildingElements.id],
  }),
  suggestion: one(evaluationSuggestions, {
    fields: [autoGeneratedProjects.suggestionId],
    references: [evaluationSuggestions.id],
  }),
  maintenanceProject: one(maintenanceProjects, {
    fields: [autoGeneratedProjects.id],
    references: [maintenanceProjects.autoGeneratedId],
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
  autoGeneratedProject: one(autoGeneratedProjects, {
    fields: [maintenanceProjects.autoGeneratedId],
    references: [autoGeneratedProjects.id],
  }),
  createdBy: one(users, {
    fields: [maintenanceProjects.createdBy],
    references: [users.id],
  }),
  steps: many(projectSteps),
  projectElements: many(projectElements),
  suggestions: many(evaluationSuggestions),
  submissionVendors: many(submissionVendors),
  workflowTasks: many(workflowTasks),
  projectNotifications: many(projectNotifications),
  elementUpdates: many(elementProjectUpdates),
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

export const submissionVendorsRelations = relations(submissionVendors, ({ one }) => ({
  project: one(maintenanceProjects, {
    fields: [submissionVendors.projectId],
    references: [maintenanceProjects.id],
  }),
}));

export const workflowTasksRelations = relations(workflowTasks, ({ one }) => ({
  project: one(maintenanceProjects, {
    fields: [workflowTasks.projectId],
    references: [maintenanceProjects.id],
  }),
}));

export const projectNotificationsRelations = relations(projectNotifications, ({ one }) => ({
  project: one(maintenanceProjects, {
    fields: [projectNotifications.projectId],
    references: [maintenanceProjects.id],
  }),
}));

export const elementProjectUpdatesRelations = relations(elementProjectUpdates, ({ one }) => ({
  project: one(maintenanceProjects, {
    fields: [elementProjectUpdates.projectId],
    references: [maintenanceProjects.id],
  }),
  element: one(buildingElements, {
    fields: [elementProjectUpdates.elementId],
    references: [buildingElements.id],
  }),
}));