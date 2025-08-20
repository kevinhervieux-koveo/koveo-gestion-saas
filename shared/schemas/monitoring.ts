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
});

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
});

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
  validatorId: uuid('validator_id').references(() => users.id),
  timeTaken: integer('time_taken'), // Hours to validate
  impactLevel: issueSeverityEnum('impact_level'),
  resolutionActions: text('resolution_actions'),
  quebecComplianceNotes: text('quebec_compliance_notes'),
  costImpact: decimal('cost_impact', { precision: 10, scale: 2 }),
  validatedAt: timestamp('validated_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

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
});

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
  detectedBy: uuid('detected_by').references(() => users.id),
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
});

// Insert schemas
export const insertMetricEffectivenessTrackingSchema = createInsertSchema(metricEffectivenessTracking).pick({
  metricType: true,
  calculatedValue: true,
  actualOutcome: true,
  accuracy: true,
  precision: true,
  recall: true,
  f1Score: true,
  calibrationScore: true,
  predictionConfidence: true,
  validationDate: true,
  quebecComplianceImpact: true,
  propertyManagementContext: true,
});

export const insertMetricPredictionSchema = createInsertSchema(metricPredictions).pick({
  metricType: true,
  predictedValue: true,
  confidenceLevel: true,
  thresholdUsed: true,
  contextData: true,
  predictionReason: true,
  expectedSeverity: true,
  quebecComplianceRelevant: true,
  propertyManagementCategory: true,
  filePath: true,
  lineNumber: true,
});

export const insertPredictionValidationSchema = createInsertSchema(predictionValidations).pick({
  predictionId: true,
  validationStatus: true,
  actualOutcome: true,
  validationMethod: true,
  validatorId: true,
  timeTaken: true,
  impactLevel: true,
  resolutionActions: true,
  quebecComplianceNotes: true,
  costImpact: true,
  validatedAt: true,
});

export const insertMetricCalibrationDataSchema = createInsertSchema(metricCalibrationData).pick({
  metricType: true,
  calibrationModel: true,
  trainingDataSize: true,
  accuracy: true,
  precision: true,
  recall: true,
  f1Score: true,
  crossValidationScore: true,
  featureImportance: true,
  hyperparameters: true,
  quebecSpecificFactors: true,
  lastTrainingDate: true,
  modelVersion: true,
  isActive: true,
  performanceMetrics: true,
});

export const insertQualityIssueSchema = createInsertSchema(qualityIssues).pick({
  title: true,
  description: true,
  category: true,
  severity: true,
  filePath: true,
  lineNumber: true,
  detectionMethod: true,
  detectedBy: true,
  relatedMetricType: true,
  wasPredicted: true,
  predictionId: true,
  resolutionStatus: true,
  resolutionTime: true,
  resolutionActions: true,
  quebecComplianceRelated: true,
  propertyManagementImpact: true,
  costToFix: true,
  actualCost: true,
  discoveredAt: true,
  resolvedAt: true,
});

// Types
export type InsertMetricEffectivenessTracking = z.infer<typeof insertMetricEffectivenessTrackingSchema>;
export type MetricEffectivenessTracking = typeof metricEffectivenessTracking.$inferSelect;

export type InsertMetricPrediction = z.infer<typeof insertMetricPredictionSchema>;
export type MetricPrediction = typeof metricPredictions.$inferSelect;

export type InsertPredictionValidation = z.infer<typeof insertPredictionValidationSchema>;
export type PredictionValidation = typeof predictionValidations.$inferSelect;

export type InsertMetricCalibrationData = z.infer<typeof insertMetricCalibrationDataSchema>;
export type MetricCalibrationData = typeof metricCalibrationData.$inferSelect;

export type InsertQualityIssue = z.infer<typeof insertQualityIssueSchema>;
export type QualityIssue = typeof qualityIssues.$inferSelect;

// Relations
export const metricPredictionsRelations = relations(metricPredictions, ({ many }) => ({
  validations: many(predictionValidations),
  qualityIssues: many(qualityIssues),
}));

export const predictionValidationsRelations = relations(predictionValidations, ({ one }) => ({
  prediction: one(metricPredictions, {
    fields: [predictionValidations.predictionId],
    references: [metricPredictions.id],
  }),
  validator: one(users, {
    fields: [predictionValidations.validatorId],
    references: [users.id],
  }),
}));

export const qualityIssuesRelations = relations(qualityIssues, ({ one }) => ({
  detectedBy: one(users, {
    fields: [qualityIssues.detectedBy],
    references: [users.id],
  }),
  prediction: one(metricPredictions, {
    fields: [qualityIssues.predictionId],
    references: [metricPredictions.id],
  }),
}));