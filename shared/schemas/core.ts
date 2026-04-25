import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  varchar,
  timestamp,
  uuid,
  pgEnum,
  boolean,
  date,
  integer,
  json,
  primaryKey,
  index,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { relations } from 'drizzle-orm';

// Core enums
/**
 * Enum defining user roles in the Quebec property management system.
 * Determines user permissions and access levels across the application.
 */
export const userRoleEnum = pgEnum('user_role', [
  'admin',
  'manager',
  'tenant',
  'resident',
  'demo_manager',
  'demo_tenant',
  'demo_resident',
]);

/**
 * Enum defining invitation status values for user invitation system.
 * Tracks the lifecycle of user invitations from creation to completion.
 */
export const invitationStatusEnum = pgEnum('invitation_status', [
  'pending',
  'accepted',
  'expired',
  'cancelled',
]);

// Core tables
/**
 * Users table for the Koveo Gestion property management system.
 * Stores user authentication and profile information for all system users.
 * Supports Quebec-specific language preferences and role-based access.
 */
export const users = pgTable('users', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  username: text('username').notNull().unique(), // Username field required by database
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: text('password').notNull(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  profileImage: text('profile_image'),
  language: varchar('language', { length: 10 }).notNull().default('fr'), // Default to French for Quebec
  role: userRoleEnum('role').notNull().default('tenant'),
  isActive: boolean('is_active').notNull().default(true),
  notificationsStartingDate: date('notifications_starting_date'), // Global starting date for all notifications
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  roleIdx: index('users_role_idx').on(table.role),
}));

/**
 * Organizations table storing management companies, syndicates, and co-ownership entities.
 * Represents the legal entities responsible for property management in Quebec.
 */
export const organizations = pgTable('organizations', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 200 }).notNull(),
  // Short, unique, human-readable code used as the org segment of bill
  // numbers (Task #255). Nullable during the first rollout step; backfilled
  // and tightened to NOT NULL in a follow-up migration.
  code: varchar('code', { length: 8 }).unique(),
  type: text('type').notNull(), // 'management_company', 'syndicate', 'cooperative', 'condo_association', 'demo'
  address: text('address').notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  province: varchar('province', { length: 3 }).notNull().default('QC'),
  postalCode: varchar('postal_code', { length: 10 }).notNull(),
  phone: text('phone'),
  email: varchar('email', { length: 255 }),
  website: text('website'),
  registrationNumber: text('registration_number'), // Quebec business registration
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * User-Organization relationship table to manage users belonging to organizations.
 * Users can belong to multiple organizations with different roles.
 */
export const userOrganizations = pgTable('user_organizations', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  organizationId: varchar('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  organizationRole: userRoleEnum('organization_role').notNull().default('tenant'),
  isActive: boolean('is_active').notNull().default(true),
  canAccessAllOrganizations: boolean('can_access_all_organizations').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('user_organizations_user_id_idx').on(table.userId),
  organizationIdIdx: index('user_organizations_organization_id_idx').on(table.organizationId),
}));

/**
 * Invitations table for managing user invitations to organizations.
 * Supports role-based invitations with expiration and security features.
 */
export const invitations = pgTable('invitations', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: varchar('organization_id'),
  buildingId: varchar('building_id'),
  residenceId: text('residence_id'),
  email: text('email').notNull(),
  token: text('token').notNull().unique(),
  role: userRoleEnum('role').notNull(),
  status: invitationStatusEnum('status').notNull().default('pending'),
  invitedByUserId: varchar('invited_by_user_id').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  tokenHash: text('token_hash').notNull(),
  usageCount: integer('usage_count').notNull().default(0),
  maxUsageCount: integer('max_usage_count').notNull().default(1),
  personalMessage: text('personal_message'),
  invitationContext: json('invitation_context'),
  securityLevel: text('security_level'),
  requires2fa: boolean('requires_2fa').notNull().default(false),
  acceptedAt: timestamp('accepted_at'),
  acceptedBy: varchar('accepted_by_user_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastAccessedAt: timestamp('last_accessed_at'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
}, (table) => ({
  organizationIdIdx: index('invitations_organization_id_idx').on(table.organizationId),
  buildingIdIdx: index('invitations_building_id_idx').on(table.buildingId),
  residenceIdIdx: index('invitations_residence_id_idx').on(table.residenceId),
  invitedByUserIdIdx: index('invitations_invited_by_user_id_idx').on(table.invitedByUserId),
  acceptedByIdx: index('invitations_accepted_by_idx').on(table.acceptedBy),
  roleIdx: index('invitations_role_idx').on(table.role),
  statusIdx: index('invitations_status_idx').on(table.status),
}));

/**
 * Password reset tokens table for secure password reset functionality.
 * Stores temporary tokens that expire after a set time for security.
 */
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  tokenHash: text('token_hash').notNull(), // Hashed version for security
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  isUsed: boolean('is_used').notNull().default(false),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('password_reset_tokens_user_id_idx').on(table.userId),
}));

/**
 * Invitation audit log table for tracking invitation operations and security events.
 * Provides comprehensive logging for invitation lifecycle and security monitoring.
 */
export const invitationAuditLog = pgTable('invitation_audit_log', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  invitationId: varchar('invitation_id').references(() => invitations.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  performedBy: varchar('performed_by').references(() => users.id),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  details: json('details'),
  previousStatus: invitationStatusEnum('previous_status'),
  newStatus: invitationStatusEnum('new_status'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  invitationIdIdx: index('invitation_audit_log_invitation_id_idx').on(table.invitationId),
  performedByIdx: index('invitation_audit_log_performed_by_idx').on(table.performedBy),
}));

/**
 * MCP assume_user / restore_acting_user audit log (Task #642).
 *
 * Tracks every admin-initiated impersonation event performed via the MCP
 * `assume_user` and `restore_acting_user` tools. The row is written by
 * `server/mcp/server.ts`'s `writeAssumeUserAudit` helper. FK references to
 * `users.id` use `ON DELETE SET NULL` so historical audit rows survive user
 * deletion without violating referential integrity.
 */
export const mcpAssumeUserLog = pgTable('mcp_assume_user_log', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  performedBy: varchar('performed_by').references(() => users.id, { onDelete: 'set null' }),
  assumedUserId: varchar('assumed_user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  details: json('details'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  performedByIdx: index('mcp_assume_user_log_performed_by_idx').on(table.performedBy),
  assumedUserIdIdx: index('mcp_assume_user_log_assumed_user_id_idx').on(table.assumedUserId),
}));

// Permissions enums
export const resourceTypeEnum = pgEnum('resource_type', [
  'user',
  'users', // Added to handle existing production data
  'organization',
  'building',
  'residence',
  'bill',
  'budget',
  'maintenance_request',
  'document',
  'audit_log',
  'system_settings',
  'development_pillar',
  'quality_metric',
  'feature',
  'actionable_item',
  'improvement_suggestion',
]);

export const actionEnum = pgEnum('action', [
  'read',
  'create',
  'update',
  'delete',
  'manage',
  'approve',
  'assign',
  'share',
  'export',
  'backup',
  'restore',
]);

// Permissions tables
export const permissions = pgTable('permissions', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull().unique(),
  displayName: text('display_name').notNull(),
  description: text('description'),
  resourceType: resourceTypeEnum('resource_type').notNull(),
  action: actionEnum('action').notNull(),
  conditions: json('conditions'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const rolePermissions = pgTable('role_permissions', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  role: userRoleEnum('role').notNull(),
  permissionId: uuid('permission_id')
    .notNull()
    .references(() => permissions.id),
  grantedBy: varchar('granted_by').references(() => users.id),
  grantedAt: timestamp('granted_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  permissionIdIdx: index('role_permissions_permission_id_idx').on(table.permissionId),
  grantedByIdx: index('role_permissions_granted_by_idx').on(table.grantedBy),
}));

export const userPermissions = pgTable('user_permissions', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .notNull()
    .references(() => users.id),
  permissionId: uuid('permission_id')
    .notNull()
    .references(() => permissions.id),
  granted: boolean('granted').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('user_permissions_user_id_idx').on(table.userId),
  permissionIdIdx: index('user_permissions_permission_id_idx').on(table.permissionId),
}));

// Insert schemas - manual Zod schemas to avoid drizzle-zod compatibility issues
export const insertUserSchema = z.object({
  username: z.string().min(1).max(50, 'Username must be between 1-50 characters'),
  email: z.string().email('Must be a valid email address').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/,
      'Password must contain uppercase, lowercase, number, and special character'
    ),
  firstName: z.string().min(1).max(100, 'First name must be 1-100 characters').trim(),
  lastName: z.string().min(1).max(100, 'Last name must be 1-100 characters').trim(),
  phone: z
    .string()
    .optional()
    .refine(
      (phone) =>
        !phone || /^(\+1\s?)?(\([0-9]{3}\)|[0-9]{3})[\s.-]?[0-9]{3}[\s.-]?[0-9]{4}$/.test(phone),
      'Phone must be a valid North American format (e.g., 514-123-4567 or (514) 123-4567)'
    ),
  profileImage: z.string().optional(),
  language: z.string().default('fr'),
  role: z
    .enum([
      'admin',
      'manager',
      'tenant',
      'resident',
      'demo_manager',
      'demo_tenant',
      'demo_resident',
    ])
    .default('tenant'),
});

export const insertOrganizationSchema = z.object({
  name: z.string().min(1),
  // 2-8 char short code used in bill numbers; uppercase alphanumerics only.
  // Optional on input — backfilled automatically when omitted.
  code: z
    .string()
    .min(2)
    .max(8)
    .regex(/^[A-Z0-9]+$/, 'Code must be uppercase alphanumeric')
    .optional(),
  type: z.string(),
  address: z.string(),
  city: z.string(),
  province: z.string().default('QC'),
  postalCode: z.string(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  registrationNumber: z.string().optional(),
});

export const insertUserOrganizationSchema = z.object({
  userId: z.string().uuid(),
  organizationId: z.string().uuid(),
  organizationRole: z
    .enum([
      'admin',
      'manager',
      'tenant',
      'resident',
      'demo_manager',
      'demo_tenant',
      'demo_resident',
    ])
    .default('tenant'),
  canAccessAllOrganizations: z.boolean().default(false),
});

export const insertInvitationSchema = z.object({
  organizationId: z.string().uuid().optional(),
  residenceId: z.union([z.string().uuid(), z.null()]).optional(),
  email: z.string().email(),
  role: z.enum([
    'admin',
    'manager',
    'tenant',
    'resident',
    'demo_manager',
    'demo_tenant',
    'demo_resident',
  ]),
  invitedByUserId: z.string().uuid(),
  expiresAt: z.union([
    z.date(),
    z
      .string()
      .datetime()
      .transform((str) => new Date(str)),
  ]),
});

export const insertPasswordResetTokenSchema = z.object({
  userId: z.string().uuid(),
  token: z.string(),
  tokenHash: z.string(),
  expiresAt: z.date(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

export const insertInvitationAuditLogSchema = z.object({
  invitationId: z.string().uuid(),
  action: z.string(),
  performedBy: z.string().uuid(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  details: z.record(z.string(), z.any()).optional(),
  previousStatus: z.string().optional(),
  newStatus: z.string().optional(),
});

export const insertPermissionSchema = z.object({
  name: z.string(),
  displayName: z.string(),
  description: z.string().optional(),
  resourceType: z.string(),
  action: z.string(),
  conditions: z.record(z.string(), z.any()).optional(),
  isActive: z.boolean().default(true),
});

export const insertRolePermissionSchema = z.object({
  role: z.enum([
    'admin',
    'manager',
    'tenant',
    'resident',
    'demo_manager',
    'demo_tenant',
    'demo_resident',
  ]),
  permissionId: z.string().uuid(),
});

export const insertUserPermissionSchema = z.object({
  userId: z.string().uuid(),
  permissionId: z.string().uuid(),
  granted: z.boolean().default(true),
});

// Types
/**
 *
 */
export type InsertUser = z.infer<typeof insertUserSchema>;
/**
 *
 */
export type User = typeof users.$inferSelect;

// Extended user type with assignment data for user management
export type UserWithAssignments = User & {
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
};

/**
 *
 */
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
/**
 *
 */
export type Organization = typeof organizations.$inferSelect;

/**
 *
 */
export type InsertUserOrganization = z.infer<typeof insertUserOrganizationSchema>;
/**
 *
 */
export type UserOrganization = typeof userOrganizations.$inferSelect;

/**
 *
 */
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
/**
 *
 */
export type Invitation = typeof invitations.$inferSelect;

/**
 *
 */
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
/**
 *
 */
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

/**
 *
 */
export type InsertPermission = z.infer<typeof insertPermissionSchema>;
/**
 *
 */
export type Permission = typeof permissions.$inferSelect;

/**
 *
 */
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
/**
 *
 */
export type RolePermission = typeof rolePermissions.$inferSelect;

/**
 *
 */
export type InsertUserPermission = z.infer<typeof insertUserPermissionSchema>;
/**
 *
 */
export type UserPermission = typeof userPermissions.$inferSelect;

/**
 *
 */
export type InsertInvitationAuditLog = z.infer<typeof insertInvitationAuditLogSchema>;
/**
 *
 */
export type InvitationAuditLog = typeof invitationAuditLog.$inferSelect;

/**
 * Insert type for the MCP assume_user / restore_acting_user audit log.
 */
export type InsertMcpAssumeUserLog = typeof mcpAssumeUserLog.$inferInsert;
/**
 * Select type for the MCP assume_user / restore_acting_user audit log.
 */
export type McpAssumeUserLog = typeof mcpAssumeUserLog.$inferSelect;

// Relations - Temporarily commented out due to drizzle-orm version compatibility
// TODO: Fix relations import compatibility with current drizzle-orm version
/*
export const usersRelations = relations(users, ({ many }) => ({
  userOrganizations: many(userOrganizations),
  sentInvitations: many(invitations, { relationName: 'invitedByUserId' }),
  acceptedInvitations: many(invitations, { relationName: 'acceptedBy' }),
  passwordResetTokens: many(passwordResetTokens),
}));
*/

/*
export const organizationsRelations = relations(organizations, ({ many }) => ({
  userOrganizations: many(userOrganizations),
  invitations: many(invitations),
}));
*/

/*
export const userOrganizationsRelations = relations(userOrganizations, ({ one }) => ({
  user: one(users, {
    fields: [userOrganizations.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [userOrganizations.organizationId],
    references: [organizations.id],
  }),
}));
*/

/*
export const invitationsRelations = relations(invitations, ({ one }) => ({
  organization: one(organizations, {
    fields: [invitations.organizationId],
    references: [organizations.id],
  }),
  invitedByUserId: one(users, {
    fields: [invitations.invitedByUserId],
    references: [users.id],
    relationName: 'invitedByUserId',
  }),
  acceptedBy: one(users, {
    fields: [invitations.acceptedBy],
    references: [users.id],
    relationName: 'acceptedBy',
  }),
}));
*/

/*
export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
}));
*/
