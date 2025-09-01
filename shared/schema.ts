/**
 * Koveo Gestion Database Schema.
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
 * - monitoring: Quality metrics, predictions, and AI monitoring.
 */

// Re-export all enums and schemas
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
  Permission,
  InsertPermission,
  RolePermission,
  InsertRolePermission,
  UserPermission,
  InsertUserPermission,
  Invitation,
  InsertInvitation,
  PasswordResetToken,
  InsertPasswordResetToken,
  InvitationAuditLog,
  InsertInvitationAuditLog,
} from './schemas/core';

export type {
  Building,
  InsertBuilding,
  Residence,
  InsertResidence,
  UserResidence,
  InsertUserResidence,
  Contact,
  InsertContact,
  CommonSpace,
  InsertCommonSpace,
  Booking,
  InsertBooking,
  UserBookingRestriction,
  InsertUserBookingRestriction,
} from './schemas/property';

export type {
  Bill,
  InsertBill,
  Budget,
  InsertBudget,
  MonthlyBudget,
  InsertMonthlyBudget,
} from './schemas/financial';

export type {
  MaintenanceRequest,
  InsertMaintenanceRequest,
  Notification,
  InsertNotification,
  Bug,
  InsertBug,
  FeatureRequest,
  InsertFeatureRequest,
  FeatureRequestUpvote,
  InsertFeatureRequestUpvote,
} from './schemas/operations';

export type {
  Document,
  InsertDocument,
  DocumentBuilding,
  InsertDocumentBuilding,
  DocumentResident,
  InsertDocumentResident,
} from './schemas/documents';

export type {
  Feature,
  InsertFeature,
  ActionableItem,
  InsertActionableItem,
  ImprovementSuggestion,
  InsertImprovementSuggestion,
  Pillar,
  InsertPillar,
  WorkspaceStatus,
  InsertWorkspaceStatus,
  QualityMetric,
  InsertQualityMetric,
  FrameworkConfiguration,
  InsertFrameworkConfiguration,
} from './schemas/development';

export type {
  QualityIssue,
  InsertQualityIssue,
  MetricPrediction,
  InsertMetricPrediction,
} from './schemas/monitoring';

export type { SslCertificate, InsertSslCertificate } from './schemas/infrastructure';

// Export tables for use in storage and API layers
export {
  bugs,
  featureRequests,
  featureRequestUpvotes,
  maintenanceRequests,
  notifications,
} from './schemas/operations';
export {
  documents,
  documentsBuildings,
  documentsResidents,
} from './schemas/documents';
export {
  developmentPillars,
  workspaceStatus,
  qualityMetrics,
  frameworkConfiguration,
  features,
  actionableItems,
  improvementSuggestions,
} from './schemas/development';
