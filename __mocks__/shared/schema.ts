/**
 * Mock for shared/schema.ts - Provides all schema exports without drizzle-orm dependencies
 * This ensures test isolation and prevents import errors during unit testing
 */

// Mock enum objects that behave like drizzle enums
export const userRoleEnum = {
  enumName: 'user_role',
  enumValues: ['admin', 'manager', 'tenant', 'resident', 'demo_manager', 'demo_tenant', 'demo_resident']
};

export const invitationStatusEnum = {
  enumName: 'invitation_status',
  enumValues: ['pending', 'accepted', 'expired', 'cancelled']
};

export const resourceTypeEnum = {
  enumName: 'resource_type',
  enumValues: ['user', 'users', 'organization', 'building', 'residence', 'bill', 'budget', 'maintenance_request', 'document', 'audit_log', 'system_settings', 'development_pillar', 'quality_metric', 'feature', 'actionable_item', 'improvement_suggestion']
};

export const actionEnum = {
  enumName: 'action',
  enumValues: ['read', 'create', 'update', 'delete', 'manage', 'approve', 'assign', 'share', 'export', 'backup', 'restore']
};

// Mock table objects
const createMockTable = (tableName: string) => ({
  _: {
    name: tableName,
    schema: undefined,
    columns: {},
    baseName: tableName
  },
  // Common columns for type safety
  id: { name: 'id' },
  email: { name: 'email' },
  name: { name: 'name' },
  role: { name: 'role' },
  userId: { name: 'userId' },
  organizationId: { name: 'organizationId' },
  buildingId: { name: 'buildingId' },
  residenceId: { name: 'residenceId' },
  status: { name: 'status' },
  type: { name: 'type' },
  amount: { name: 'amount' },
  description: { name: 'description' },
  createdAt: { name: 'createdAt' },
  updatedAt: { name: 'updatedAt' },
  firstName: { name: 'firstName' },
  lastName: { name: 'lastName' },
  username: { name: 'username' },
  password: { name: 'password' },
  phone: { name: 'phone' },
  language: { name: 'language' },
  isActive: { name: 'isActive' },
  token: { name: 'token' },
  tokenHash: { name: 'tokenHash' },
  expiresAt: { name: 'expiresAt' },
  invitedByUserId: { name: 'invitedByUserId' },
  acceptedAt: { name: 'acceptedAt' },
  acceptedBy: { name: 'acceptedBy' },
  address: { name: 'address' },
  city: { name: 'city' },
  province: { name: 'province' },
  postalCode: { name: 'postalCode' }
});

// Core tables
export const users = createMockTable('users');
export const organizations = createMockTable('organizations');
export const userOrganizations = createMockTable('userOrganizations');
export const invitations = createMockTable('invitations');
export const passwordResetTokens = createMockTable('passwordResetTokens');
export const invitationAuditLog = createMockTable('invitationAuditLog');
export const permissions = createMockTable('permissions');
export const rolePermissions = createMockTable('rolePermissions');
export const userPermissions = createMockTable('userPermissions');

// Property tables
export const buildings = createMockTable('buildings');
export const residences = createMockTable('residences');
export const userResidences = createMockTable('userResidences');
export const contacts = createMockTable('contacts');
export const commonSpaces = createMockTable('commonSpaces');
export const bookings = createMockTable('bookings');
export const userBookingRestrictions = createMockTable('userBookingRestrictions');

// Financial tables
export const bills = createMockTable('bills');
export const budgets = createMockTable('budgets');
export const monthlyBudgets = createMockTable('monthlyBudgets');

// Operations tables
export const maintenanceRequests = createMockTable('maintenanceRequests');
export const notifications = createMockTable('notifications');
export const bugs = createMockTable('bugs');
export const featureRequests = createMockTable('featureRequests');
export const featureRequestUpvotes = createMockTable('featureRequestUpvotes');
export const demands = createMockTable('demands');
export const demandComments = createMockTable('demandComments');

// Document tables
export const documents = createMockTable('documents');

// Invoice tables
export const invoices = createMockTable('invoices');

// Development tables
export const features = createMockTable('features');
export const actionableItems = createMockTable('actionableItems');
export const improvementSuggestions = createMockTable('improvementSuggestions');
export const developmentPillars = createMockTable('developmentPillars');
export const workspaceStatus = createMockTable('workspaceStatus');
export const qualityMetrics = createMockTable('qualityMetrics');
export const frameworkConfiguration = createMockTable('frameworkConfiguration');

// Monitoring tables
export const qualityIssues = createMockTable('qualityIssues');
export const metricPredictions = createMockTable('metricPredictions');

// Infrastructure tables
export const sslCertificates = createMockTable('sslCertificates');
export const sessions = createMockTable('sessions');

// Mock insert schemas
export const insertUserSchema = {
  parse: jest.fn().mockImplementation((data) => data),
  safeParse: jest.fn().mockImplementation((data) => ({ success: true, data })),
};

export const insertOrganizationSchema = {
  parse: jest.fn().mockImplementation((data) => data),
  safeParse: jest.fn().mockImplementation((data) => ({ success: true, data })),
};

export const insertInvitationSchema = {
  parse: jest.fn().mockImplementation((data) => data),
  safeParse: jest.fn().mockImplementation((data) => ({ success: true, data })),
};

export const insertUserOrganizationSchema = {
  parse: jest.fn().mockImplementation((data) => data),
  safeParse: jest.fn().mockImplementation((data) => ({ success: true, data })),
};

export const insertPasswordResetTokenSchema = {
  parse: jest.fn().mockImplementation((data) => data),
  safeParse: jest.fn().mockImplementation((data) => ({ success: true, data })),
};

export const insertInvitationAuditLogSchema = {
  parse: jest.fn().mockImplementation((data) => data),
  safeParse: jest.fn().mockImplementation((data) => ({ success: true, data })),
};

export const insertPermissionSchema = {
  parse: jest.fn().mockImplementation((data) => data),
  safeParse: jest.fn().mockImplementation((data) => ({ success: true, data })),
};

export const insertRolePermissionSchema = {
  parse: jest.fn().mockImplementation((data) => data),
  safeParse: jest.fn().mockImplementation((data) => ({ success: true, data })),
};

export const insertUserPermissionSchema = {
  parse: jest.fn().mockImplementation((data) => data),
  safeParse: jest.fn().mockImplementation((data) => ({ success: true, data })),
};

// Mock types
export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  profileImage?: string;
  language: string;
  role: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserWithAssignments extends User {
  organizations: Array<{
    id: string;
    name: string;
    type: string;
  }>;
  buildings: Array<{
    id: string;
    name: string;
  }>;
  residences: Array<{
    id: string;
    unitNumber: string;
    buildingId: string;
    buildingName: string;
  }>;
}

export interface Organization {
  id: string;
  name: string;
  type: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  phone?: string;
  email?: string;
  website?: string;
  registrationNumber?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Invitation {
  id: string;
  organizationId?: string;
  buildingId?: string;
  residenceId?: string;
  email: string;
  token: string;
  role: string;
  status: string;
  invitedByUserId: string;
  expiresAt: Date;
  tokenHash: string;
  usageCount: number;
  maxUsageCount: number;
  personalMessage?: string;
  invitationContext?: any;
  securityLevel?: string;
  requires2fa: boolean;
  acceptedAt?: Date;
  acceptedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
  lastAccessedAt?: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface UserOrganization {
  id: string;
  userId: string;
  organizationId: string;
  organizationRole: string;
  isActive: boolean;
  canAccessAllOrganizations: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Mock type aliases for compatibility
export type InsertUser = Partial<User>;
export type InsertOrganization = Partial<Organization>;
export type InsertInvitation = Partial<Invitation>;
export type InsertUserOrganization = Partial<UserOrganization>;

// Add more types as needed...
export interface PasswordResetToken {
  id: string;
  userId: string;
  token: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date;
  isUsed: boolean;
  ipAddress?: string;
  userAgent?: string;
  createdAt?: Date;
}

export type InsertPasswordResetToken = Partial<PasswordResetToken>;

export interface Permission {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  resourceType: string;
  action: string;
  conditions?: any;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type InsertPermission = Partial<Permission>;

export interface RolePermission {
  id: string;
  role: string;
  permissionId: string;
  grantedBy?: string;
  grantedAt?: Date;
  createdAt?: Date;
}

export type InsertRolePermission = Partial<RolePermission>;

export interface UserPermission {
  id: string;
  userId: string;
  permissionId: string;
  granted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type InsertUserPermission = Partial<UserPermission>;

export interface InvitationAuditLog {
  id: string;
  invitationId?: string;
  action: string;
  performedBy?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: any;
  previousStatus?: string;
  newStatus?: string;
  createdAt?: Date;
}

export type InsertInvitationAuditLog = Partial<InvitationAuditLog>;

// Add other domain types as needed for comprehensive mocking...
export interface Building {
  id: string;
  name: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
}

export type InsertBuilding = Partial<Building>;

export interface Residence {
  id: string;
  buildingId: string;
  unitNumber: string;
  floor?: number;
  type: string;
}

export type InsertResidence = Partial<Residence>;

export interface Document {
  id: string;
  name: string;
  type: string;
  path: string;
}

export type InsertDocument = Partial<Document>;

export interface Bill {
  id: string;
  amount: number;
  description: string;
  status: string;
}

export type InsertBill = Partial<Bill>;

export interface Budget {
  id: string;
  name: string;
  amount: number;
  year: number;
}

export type InsertBudget = Partial<Budget>;

export interface MaintenanceRequest {
  id: string;
  title: string;
  description: string;
  status: string;
}

export type InsertMaintenanceRequest = Partial<MaintenanceRequest>;

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
}

export type InsertNotification = Partial<Notification>;

export interface Bug {
  id: string;
  title: string;
  description: string;
  severity: string;
}

export type InsertBug = Partial<Bug>;

export interface FeatureRequest {
  id: string;
  title: string;
  description: string;
  priority: string;
}

export type InsertFeatureRequest = Partial<FeatureRequest>;

export interface FeatureRequestUpvote {
  id: string;
  featureRequestId: string;
  userId: string;
}

export type InsertFeatureRequestUpvote = Partial<FeatureRequestUpvote>;

// Mock drizzle-orm operators and functions
export const eq = jest.fn().mockImplementation((column: any, value: any) => {
  return { type: 'eq', column, value };
});

export const and = jest.fn().mockImplementation((...conditions: any[]) => {
  return { type: 'and', conditions };
});

export const or = jest.fn().mockImplementation((...conditions: any[]) => {
  return { type: 'or', conditions };
});

export const sql = jest.fn().mockImplementation((strings: any, ...values: any[]) => {
  if (typeof strings === 'string') {
    return { sql: strings, params: values };
  }
  if (Array.isArray(strings) && 'raw' in strings) {
    const query = strings.join('?');
    return { sql: query, params: values };
  }
  return { sql: '', params: [] };
});

// Export commonly used validation schemas with mock implementations
export const userValidationSchemas = {
  insertUserSchema,
  insertOrganizationSchema,
  insertInvitationSchema,
  insertUserOrganizationSchema,
  insertPasswordResetTokenSchema,
};

// Add other validation schemas as needed
export const validationSchemas = {
  ...userValidationSchemas,
};