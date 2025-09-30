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
  index,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { relations } from 'drizzle-orm';
import { users } from './core';

// Monitoring enums
export const validationStatusEnum = pgEnum('validation_status', [
  'pending',
  'true_positive', // Metric correctly predicted an issue
  'false_positive', // Metric predicted issue but none found
  'true_negative', // Metric correctly predicted no issue
  'false_negative', // Metric missed a real issue
]);

export const issueSeverityEnum = pgEnum('issue_severity', [
  'info', // Minor suggestions
  'low', // Non-critical improvements
  'medium', // Important but not urgent
  'high', // Significant issues affecting operations
  'critical', // Severe issues affecting compliance or safety
  'quebec_compliance', // Issues affecting Quebec Law 25 or provincial regulations
]);

export const metricTypeEnum = pgEnum('metric_type', [
  'code_coverage',
  'code_quality',
  'security_vulnerabilities',
  'build_time',
  'translation_coverage',
  'api_response_time',
  'memory_usage',
  'bundle_size',
  'database_query_time',
  'page_load_time',
  'accessibility_score',
  'seo_score',
  'quebec_compliance_score',
]);

// Monitoring tables
/**
 * Tracks effectiveness of quality metrics in predicting real issues.
 * Used for continuous improvement of the quality assessment system.
 */
export const metricEffectivenessTracking = pgTable('metric_effectiveness_tracking', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  metricType: metricTypeEnum('metric_type').notNull(),
  calculatedValue: decimal('calculated_value', { precision: 10, scale: 4 }).notNull(),
  actualOutcome: text('actual_outcome').notNull(),
  accuracy: decimal('accuracy', { precision: 5, scale: 4 }).notNull(),
  precision: decimal('precision', { precision: 5, scale: 4 }).notNull(),
  recall: decimal('recall', { precision: 5, scale: 4 }).notNull(),
  f1Score: decimal('f1_score', { precision: 5, scale: 4 }).notNull(),
  calibrationScore: decimal('calibration_score', { precision: 5, scale: 4 }),
  predictionConfidence: decimal('prediction_confidence', { precision: 5, scale: 4 }),
  validationDate: date('validation_date').notNull(),
  quebecComplianceImpact: boolean('quebec_compliance_impact').notNull().default(false),
  propertyManagementContext: text('property_management_context'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  metricTypeIdx: index('metric_effectiveness_tracking_metric_type_idx').on(table.metricType),
  // Date indexes for range queries
  validationDateIdx: index('metric_effectiveness_tracking_validation_date_idx').on(table.validationDate),
  createdAtIdx: index('metric_effectiveness_tracking_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('metric_effectiveness_tracking_updated_at_idx').on(table.updatedAt),
}));

/**
 * Stores predictions made by quality metrics before validation.
 * Links predictions to actual outcomes for effectiveness tracking.
 */
export const metricPredictions = pgTable('metric_predictions', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  metricType: metricTypeEnum('metric_type').notNull(),
  predictedValue: decimal('predicted_value', { precision: 10, scale: 4 }).notNull(),
  confidenceLevel: decimal('confidence_level', { precision: 5, scale: 4 }).notNull(),
  thresholdUsed: decimal('threshold_used', { precision: 10, scale: 4 }).notNull(),
  contextData: jsonb('context_data'),
  predictionReason: text('prediction_reason'),
  expectedSeverity: issueSeverityEnum('expected_severity').notNull(),
  quebecComplianceRelevant: boolean('quebec_compliance_relevant').notNull().default(false),
  propertyManagementCategory: text('property_management_category'),
  filePath: text('file_path'),
  lineNumber: integer('line_number'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  metricTypeIdx: index('metric_predictions_metric_type_idx').on(table.metricType),
  expectedSeverityIdx: index('metric_predictions_expected_severity_idx').on(table.expectedSeverity),
  // Date indexes for range queries
  createdAtIdx: index('metric_predictions_created_at_idx').on(table.createdAt),
}));

/**
 * Validates metric predictions against real outcomes.
 * Essential for measuring and improving metric effectiveness.
 */
export const predictionValidations = pgTable('prediction_validations', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  predictionId: uuid('prediction_id')
    .notNull()
    .references(() => metricPredictions.id),
  validationStatus: validationStatusEnum('validation_status').notNull(),
  actualOutcome: text('actual_outcome').notNull(),
  validationMethod: text('validation_method').notNull(),
  validatorId: varchar('validator_id').references(() => users.id),
  timeTaken: integer('time_taken'), // Hours to validate
  impactLevel: issueSeverityEnum('impact_level'),
  resolutionActions: text('resolution_actions'),
  quebecComplianceNotes: text('quebec_compliance_notes'),
  costImpact: decimal('cost_impact', { precision: 10, scale: 2 }),
  validatedAt: timestamp('validated_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  predictionIdIdx: index('prediction_validations_prediction_id_idx').on(table.predictionId),
  validatorIdIdx: index('prediction_validations_validator_id_idx').on(table.validatorId),
  validationStatusIdx: index('prediction_validations_validation_status_idx').on(table.validationStatus),
  impactLevelIdx: index('prediction_validations_impact_level_idx').on(table.impactLevel),
  // Date indexes for range queries
  validatedAtIdx: index('prediction_validations_validated_at_idx').on(table.validatedAt),
  createdAtIdx: index('prediction_validations_created_at_idx').on(table.createdAt),
}));

/**
 * Stores calibration data for improving metric accuracy.
 * Used for machine learning model optimization and threshold tuning.
 */
export const metricCalibrationData = pgTable('metric_calibration_data', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  metricType: metricTypeEnum('metric_type').notNull(),
  calibrationModel: text('calibration_model').notNull(),
  trainingDataSize: integer('training_data_size').notNull(),
  accuracy: decimal('accuracy', { precision: 5, scale: 4 }).notNull(),
  precision: decimal('precision', { precision: 5, scale: 4 }).notNull(),
  recall: decimal('recall', { precision: 5, scale: 4 }).notNull(),
  f1Score: decimal('f1_score', { precision: 5, scale: 4 }).notNull(),
  crossValidationScore: decimal('cross_validation_score', { precision: 5, scale: 4 }),
  featureImportance: jsonb('feature_importance'),
  hyperparameters: jsonb('hyperparameters'),
  quebecSpecificFactors: jsonb('quebec_specific_factors'),
  lastTrainingDate: date('last_training_date').notNull(),
  modelVersion: text('model_version').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  performanceMetrics: jsonb('performance_metrics'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  metricTypeIdx: index('metric_calibration_data_metric_type_idx').on(table.metricType),
  // Date indexes for range queries
  lastTrainingDateIdx: index('metric_calibration_data_last_training_date_idx').on(table.lastTrainingDate),
  createdAtIdx: index('metric_calibration_data_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('metric_calibration_data_updated_at_idx').on(table.updatedAt),
}));

/**
 * Tracks quality issues found in the codebase and their resolution.
 * Links back to metric predictions for effectiveness validation.
 */
export const qualityIssues = pgTable('quality_issues', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text('title').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  severity: issueSeverityEnum('severity').notNull(),
  filePath: text('file_path').notNull(),
  lineNumber: integer('line_number'),
  detectionMethod: text('detection_method').notNull(),
  detectedBy: varchar('detected_by').references(() => users.id),
  relatedMetricType: metricTypeEnum('related_metric_type'),
  wasPredicted: boolean('was_predicted').notNull().default(false),
  predictionId: uuid('prediction_id').references(() => metricPredictions.id),
  resolutionStatus: text('resolution_status').notNull().default('open'),
  resolutionTime: integer('resolution_time'), // Hours to resolve
  resolutionActions: text('resolution_actions'),
  quebecComplianceRelated: boolean('quebec_compliance_related').notNull().default(false),
  propertyManagementImpact: text('property_management_impact'),
  costToFix: decimal('cost_to_fix', { precision: 10, scale: 2 }),
  actualCost: decimal('actual_cost', { precision: 10, scale: 2 }),
  discoveredAt: timestamp('discovered_at').notNull(),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  detectedByIdx: index('quality_issues_detected_by_idx').on(table.detectedBy),
  predictionIdIdx: index('quality_issues_prediction_id_idx').on(table.predictionId),
  categoryIdx: index('quality_issues_category_idx').on(table.category),
  severityIdx: index('quality_issues_severity_idx').on(table.severity),
  relatedMetricTypeIdx: index('quality_issues_related_metric_type_idx').on(table.relatedMetricType),
  resolutionStatusIdx: index('quality_issues_resolution_status_idx').on(table.resolutionStatus),
  // Date indexes for range queries
  discoveredAtIdx: index('quality_issues_discovered_at_idx').on(table.discoveredAt),
  resolvedAtIdx: index('quality_issues_resolved_at_idx').on(table.resolvedAt),
  createdAtIdx: index('quality_issues_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('quality_issues_updated_at_idx').on(table.updatedAt),
}));

// Insert schemas
export const insertMetricEffectivenessTrackingSchema = z.object({
  metricType: z.enum([
    'code_coverage',
    'code_quality',
    'security_vulnerabilities',
    'build_time',
    'translation_coverage',
    'api_response_time',
    'deployment_success_rate',
    'user_satisfaction',
    'performance_score',
    'test_reliability',
    'quebec_compliance_score',
    'maintenance_productivity',
  ]),
  calculatedValue: z.number(),
  actualOutcome: z.number(),
  accuracy: z.number(),
  precision: z.number(),
  recall: z.number(),
  f1Score: z.number(),
  calibrationScore: z.number(),
  predictionConfidence: z.number(),
  validationDate: z.date(),
  quebecComplianceImpact: z.string().optional(),
  propertyManagementContext: z.string().optional(),
});

export const insertMetricPredictionSchema = z.object({
  metricType: z.enum([
    'code_coverage',
    'code_quality',
    'security_vulnerabilities',
    'build_time',
    'translation_coverage',
    'api_response_time',
    'deployment_success_rate',
    'user_satisfaction',
    'performance_score',
    'test_reliability',
    'quebec_compliance_score',
    'maintenance_productivity',
  ]),
  predictedValue: z.number(),
  confidenceLevel: z.number(),
  thresholdUsed: z.number(),
  contextData: z.record(z.string(), z.any()).optional(),
  predictionReason: z.string(),
  expectedSeverity: z.string(),
  quebecComplianceRelevant: z.boolean().default(false),
  propertyManagementCategory: z.string().optional(),
  filePath: z.string(),
  lineNumber: z.number().int().optional(),
});

export const insertPredictionValidationSchema = z.object({
  predictionId: z.string().uuid(),
  validationStatus: z.enum(['validated', 'failed', 'partially_validated', 'needs_review']),
  actualOutcome: z.number(),
  validationMethod: z.string(),
  validatorId: z.string().uuid().optional(),
  timeTaken: z.number().optional(),
  impactLevel: z.string().optional(),
  resolutionActions: z.string().optional(),
  quebecComplianceNotes: z.string().optional(),
  costImpact: z.number().optional(),
  validatedAt: z.date(),
});

export const insertMetricCalibrationDataSchema = z.object({
  metricType: z.string(),
  calibrationModel: z.string(),
  trainingDataSize: z.number().int(),
  accuracy: z.number(),
  precision: z.number(),
  recall: z.number(),
  f1Score: z.number(),
  crossValidationScore: z.number(),
  featureImportance: z.record(z.string(), z.number()).optional(),
  hyperparameters: z.record(z.string(), z.any()).optional(),
  quebecSpecificFactors: z.record(z.string(), z.any()).optional(),
  lastTrainingDate: z.date(),
  modelVersion: z.string(),
  isActive: z.boolean().default(true),
  performanceMetrics: z.record(z.string(), z.number()).optional(),
});

export const insertQualityIssueSchema = z.object({
  title: z.string(),
  description: z.string(),
  category: z.string(),
  severity: z.string(),
  filePath: z.string(),
  lineNumber: z.number().int().optional(),
  detectionMethod: z.string(),
  detectedBy: z.string().uuid().optional(),
  relatedMetricType: z.string().optional(),
  wasPredicted: z.boolean().default(false),
  predictionId: z.string().uuid().optional(),
  resolutionStatus: z.string().default('open'),
  resolutionTime: z.number().int().optional(),
  resolutionActions: z.string().optional(),
  quebecComplianceRelated: z.boolean().default(false),
  propertyManagementImpact: z.string().optional(),
  costToFix: z.number().optional(),
  actualCost: z.number().optional(),
  discoveredAt: z.date(),
  resolvedAt: z.date().optional(),
});

// Types
/**
 *
 */
export type InsertMetricEffectivenessTracking = z.infer<
  typeof insertMetricEffectivenessTrackingSchema
>;
/**
 *
 */
export type MetricEffectivenessTracking = typeof metricEffectivenessTracking.$inferSelect;

/**
 *
 */
export type InsertMetricPrediction = z.infer<typeof insertMetricPredictionSchema>;
/**
 *
 */
export type MetricPrediction = typeof metricPredictions.$inferSelect;

/**
 *
 */
export type InsertPredictionValidation = z.infer<typeof insertPredictionValidationSchema>;
/**
 *
 */
export type PredictionValidation = typeof predictionValidations.$inferSelect;

/**
 *
 */
export type InsertMetricCalibrationData = z.infer<typeof insertMetricCalibrationDataSchema>;
/**
 *
 */
export type MetricCalibrationData = typeof metricCalibrationData.$inferSelect;

/**
 *
 */
export type InsertQualityIssue = z.infer<typeof insertQualityIssueSchema>;
/**
 *
 */
export type QualityIssue = typeof qualityIssues.$inferSelect;

// Relations
// Relations - temporarily commented out due to drizzle-orm version compatibility
// export const metricPredictionsRelations = relations(metricPredictions, ({ many }) => ({
//   validations: many(predictionValidations),
//   qualityIssues: many(qualityIssues),
// }));

// export const predictionValidationsRelations = relations(predictionValidations, ({ one }) => ({
//   prediction: one(metricPredictions, {
//     fields: [predictionValidations.predictionId],
//     references: [metricPredictions.id],
//   }),
//   validator: one(users, {
//     fields: [predictionValidations.validatorId],
//     references: [users.id],
//   }),
// }));

// export const qualityIssuesRelations = relations(qualityIssues, ({ one }) => ({
//   detectedBy: one(users, {
//     fields: [qualityIssues.detectedBy],
//     references: [users.id],
//   }),
//   prediction: one(metricPredictions, {
//     fields: [qualityIssues.predictionId],
//     references: [metricPredictions.id],
//   }),
// }));
