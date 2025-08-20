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
    .references(() => users.id),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
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
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  residenceId: uuid('residence_id'), // Will reference residences.id when available
  email: text('email').notNull(),
  role: userRoleEnum('role').notNull(),
  token: text('token').notNull().unique(),
  status: invitationStatusEnum('status').notNull().default('pending'),
  invitedBy: uuid('invited_by')
    .notNull()
    .references(() => users.id),
  expiresAt: timestamp('expires_at').notNull(),
  acceptedAt: timestamp('accepted_at'),
  acceptedBy: uuid('accepted_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
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
  'improvement_suggestion'
]);

export const permissionActionEnum = pgEnum('permission_action', [
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
  'restore'
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
  action: permissionActionEnum('permission_action').notNull(),
  conditions: text('conditions', { mode: 'json' }),
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

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
  firstName: true,
  lastName: true,
  phone: true,
  profileImage: true,
  language: true,
  role: true,
});

export const insertOrganizationSchema = createInsertSchema(organizations).pick({
  name: true,
  type: true,
  address: true,
  city: true,
  province: true,
  postalCode: true,
  phone: true,
  email: true,
  website: true,
  registrationNumber: true,
});

export const insertUserOrganizationSchema = createInsertSchema(userOrganizations).pick({
  userId: true,
  organizationId: true,
  organizationRole: true,
  canAccessAllOrganizations: true,
});

export const insertInvitationSchema = createInsertSchema(invitations).pick({
  organizationId: true,
  residenceId: true,
  email: true,
  role: true,
  token: true,
  invitedBy: true,
  expiresAt: true,
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).pick({
  userId: true,
  token: true,
  tokenHash: true,
  expiresAt: true,
  ipAddress: true,
  userAgent: true,
});

export const insertPermissionSchema = createInsertSchema(permissions).pick({
  name: true,
  displayName: true,
  description: true,
  resourceType: true,
  action: true,
  conditions: true,
  isActive: true,
});

export const insertRolePermissionSchema = createInsertSchema(rolePermissions).pick({
  role: true,
  permissionId: true,
});

export const insertUserPermissionSchema = createInsertSchema(userPermissions).pick({
  userId: true,
  permissionId: true,
  granted: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;

export type InsertUserOrganization = z.infer<typeof insertUserOrganizationSchema>;
export type UserOrganization = typeof userOrganizations.$inferSelect;

export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type Invitation = typeof invitations.$inferSelect;

export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

export type InsertPermission = z.infer<typeof insertPermissionSchema>;
export type Permission = typeof permissions.$inferSelect;

export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type RolePermission = typeof rolePermissions.$inferSelect;

export type InsertUserPermission = z.infer<typeof insertUserPermissionSchema>;
export type UserPermission = typeof userPermissions.$inferSelect;

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  userOrganizations: many(userOrganizations),
  sentInvitations: many(invitations, { relationName: 'invitedBy' }),
  acceptedInvitations: many(invitations, { relationName: 'acceptedBy' }),
  passwordResetTokens: many(passwordResetTokens),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  userOrganizations: many(userOrganizations),
  invitations: many(invitations),
}));

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

export const invitationsRelations = relations(invitations, ({ one }) => ({
  organization: one(organizations, {
    fields: [invitations.organizationId],
    references: [organizations.id],
  }),
  invitedBy: one(users, {
    fields: [invitations.invitedBy],
    references: [users.id],
    relationName: 'invitedBy',
  }),
  acceptedBy: one(users, {
    fields: [invitations.acceptedBy],
    references: [users.id],
    relationName: 'acceptedBy',
  }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
}));