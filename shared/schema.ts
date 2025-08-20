/**
 * Koveo Gestion Database Schema
 * 
 * This is the main schema file that re-exports all domain-specific schemas.
 * The schemas are organized by domain for better maintainability:
 * 
 * - core: Users, organizations, invitations, and authentication
 * - property: Buildings, residences, and user-residence relationships
 * - financial: Bills, budgets, and financial management
 * - operations: Maintenance requests and notifications
 * - documents: Document management and file storage
 * - development: Features, improvement suggestions, and development tracking
 * - monitoring: Quality metrics, predictions, and AI monitoring
 */

// Re-export all enums
export * from './schemas/core';
export * from './schemas/property';
export * from './schemas/financial';
export * from './schemas/operations';
export * from './schemas/documents';
export * from './schemas/development';
export * from './schemas/monitoring';
export * from './schemas/infrastructure';

// For backward compatibility, we also export commonly used tables and types
// These are the most frequently imported items across the codebase
export type {
  User,
  InsertUser,
  Organization,
  InsertOrganization,
  Building,
  InsertBuilding,
  Residence,
  InsertResidence,
  Bill,
  InsertBill,
  MaintenanceRequest,
  InsertMaintenanceRequest,
  Feature,
  InsertFeature,
  ImprovementSuggestion,
  InsertImprovementSuggestion,
  Notification,
  InsertNotification,
  Document,
  InsertDocument,
} from './schemas/core';

export type {
  Building,
  InsertBuilding,
  Residence,
  InsertResidence,
  UserResidence,
  InsertUserResidence,
} from './schemas/property';

export type {
  Bill,
  InsertBill,
  Budget,
  InsertBudget,
} from './schemas/financial';

export type {
  MaintenanceRequest,
  InsertMaintenanceRequest,
  Notification,
  InsertNotification,
} from './schemas/operations';

export type {
  Document,
  InsertDocument,
} from './schemas/documents';

export type {
  Feature,
  InsertFeature,
  ActionableItem,
  InsertActionableItem,
  ImprovementSuggestion,
  InsertImprovementSuggestion,
} from './schemas/development';

export type {
  QualityIssue,
  InsertQualityIssue,
  MetricPrediction,
  InsertMetricPrediction,
} from './schemas/monitoring';

export type {
  SslCertificate,
  InsertSslCertificate,
} from './schemas/infrastructure';