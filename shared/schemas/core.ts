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
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { relations } from 'drizzle-orm';

// Core enums
/**
 * Enum defining user roles in the Quebec property management system.
 * Determines user permissions and access levels across the application.
 */
export const userRoleEnum = pgEnum('user_role', ['admin', 'manager', 'tenant', 'resident']);

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
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text('username').notNull().unique(), // Username field required by database
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  phone: text('phone'),
  profileImage: text('profile_image'),
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
 * User-Organization relationship table to manage users belonging to organizations.
 * Users can belong to multiple organizations with different roles.
 */
export const userOrganizations = pgTable('user_organizations', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  organizationRole: userRoleEnum('organization_role').notNull().default('tenant'),
  isActive: boolean('is_active').notNull().default(true),
  canAccessAllOrganizations: boolean('can_access_all_organizations').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * Invitations table for managing user invitations to organizations.
 * Supports role-based invitations with expiration and security features.
 */
export const invitations = pgTable('invitations', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: text('organization_id'),
  buildingId: text('building_id'),
  residenceId: text('residence_id'),
  email: text('email').notNull(),
  token: text('token').notNull().unique(),
  role: userRoleEnum('role').notNull(),
  status: invitationStatusEnum('status').notNull().default('pending'),
  invitedByUserId: text('invited_by_user_id').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  tokenHash: text('token_hash').notNull(),
  usageCount: integer('usage_count').notNull().default(0),
  maxUsageCount: integer('max_usage_count').notNull().default(1),
  personalMessage: text('personal_message'),
  invitationContext: json('invitation_context'),
  securityLevel: text('security_level'),
  requires2fa: boolean('requires_2fa').notNull().default(false),
  acceptedAt: timestamp('accepted_at'),
  acceptedBy: text('accepted_by_user_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastAccessedAt: timestamp('last_accessed_at'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
});

/**
 * Password reset tokens table for secure password reset functionality.
 * Stores temporary tokens that expire after a set time for security.
 */
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid('user_id')
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
});

/**
 * Invitation audit log table for tracking invitation operations and security events.
 * Provides comprehensive logging for invitation lifecycle and security monitoring.
 */
export const invitationAuditLog = pgTable('invitation_audit_log', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  invitationId: text('invitation_id').references(() => invitations.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  performedBy: uuid('performed_by').references(() => users.id),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  details: json('details'),
  previousStatus: invitationStatusEnum('previous_status'),
  newStatus: invitationStatusEnum('new_status'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Permissions enums
export const resourceTypeEnum = pgEnum('resource_type', [
  'user',
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
  createdAt: timestamp('created_at').defaultNow(),
});

export const userPermissions = pgTable('user_permissions', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  permissionId: uuid('permission_id')
    .notNull()
    .references(() => permissions.id),
  granted: boolean('granted').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Insert schemas - manual Zod schemas to avoid drizzle-zod compatibility issues
export const insertUserSchema = z.object({
  username: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1).max(100, 'First name must be at most 100 characters'),
  lastName: z.string().min(1).max(100, 'Last name must be at most 100 characters'),
  phone: z.string().optional(),
  profileImage: z.string().optional(),
  language: z.string().default('fr'),
  role: z.enum(['admin', 'manager', 'tenant', 'resident']).default('tenant'),
});

export const insertOrganizationSchema = z.object({
  name: z.string().min(1),
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
  organizationRole: z.enum(['admin', 'manager', 'tenant', 'resident']).default('tenant'),
  canAccessAllOrganizations: z.boolean().default(false),
});

export const insertInvitationSchema = z.object({
  organizationId: z.string().uuid().optional(),
  residenceId: z.string().uuid().nullable().optional(),
  email: z.string().email(),
  role: z.enum(['admin', 'manager', 'tenant', 'resident']),
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
  role: z.enum(['admin', 'manager', 'tenant', 'resident']),
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
