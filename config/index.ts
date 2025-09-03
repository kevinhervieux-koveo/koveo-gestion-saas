/**
 * Koveo Gestion Utility Configuration.
 *
 * This module provides utility functions and constants for the Quebec property
 * management SaaS platform. All permissions are now managed via database.
 */

/**
 * Quick access to role hierarchies for common permission checks.
 * Hierarchy: admin > manager > resident > tenant.
 */
export const ROLE_HIERARCHY = {
  admin: 4,
  manager: 3,
  resident: 2,
  tenant: 1,
} as const;

/**
 * Helper function to check if one role has higher or equal privileges than another.
 *
 * @param userRole - The role to check.
 * @param requiredRole - The minimum required role.
 * @returns Boolean indicating if the user role meets the requirement.
 *
 * @example
 * ```typescript
 * const hasAccess = hasRoleOrHigher('admin', 'manager'); // true
 * const hasAccess2 = hasRoleOrHigher('tenant', 'admin'); // false
 * ```
 */
export function hasRoleOrHigher(
  userRole: keyof typeof ROLE_HIERARCHY,
  requiredRole: keyof typeof ROLE_HIERARCHY
): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

// Note: All permissions are now managed via database tables:
// - permissions: stores all available permissions
// - role_permissions: maps roles to permissions
// - user_permissions: stores user-specific permission overrides

// Types for backwards compatibility with tests
export type Role = 'admin' | 'manager' | 'tenant' | 'resident';
export type Permission = string;
export interface PermissionsConfig {
  [role: string]: Permission[];
}

// Mock permissions for testing - in production, these come from database
export const permissions: PermissionsConfig = {
  admin: [
    'create:user',
    'read:user',
    'update:user',
    'delete:user',
    'create:organization',
    'read:organization',
    'update:organization',
    'delete:organization',
    'create:building',
    'read:building',
    'update:building',
    'delete:building',
    'create:residence',
    'read:residence',
    'update:residence',
    'delete:residence',
    'create:document',
    'read:document',
    'update:document',
    'delete:document',
    'create:invitation',
    'read:invitation',
    'update:invitation',
    'delete:invitation',
    'create:bill',
    'read:bill',
    'update:bill',
    'delete:bill',
    'create:maintenance',
    'read:maintenance',
    'update:maintenance',
    'delete:maintenance',
    'create:audit_log',
    'read:audit_log',
    'manage:system',
    'manage:settings',
    'assign:roles',
    'update:framework_config',
    'read:maintenance_request',
    'delete:maintenance_request',
    'create:financial_report',
    'read:financial_report',
    'update:financial_report',
    'delete:financial_report',
    'approve:bill',
    'read:budget',
    'create:budget',
    'update:budget',
    'delete:budget',
    'create:maintenance_request',
    'update:maintenance_request',
    'export:financial_report',
    'delete:improvement_suggestion',
    'delete:feature',
    'delete:actionable_item',
    'cancel:invitation',
    'resend:invitation',
    'audit:invitation',
    'read:notification',
    'create:notification',
    'read:ai_analysis',
    'create:ai_analysis',
    'backup:system',
    'read:profile',
    'update:profile',
  ],
  manager: [
    'read:user',
    'update:user',
    'read:organization',
    'update:organization',
    'create:building',
    'read:building',
    'update:building',
    'create:residence',
    'read:residence',
    'update:residence',
    'create:document',
    'read:document',
    'update:document',
    'create:invitation',
    'read:invitation',
    'update:invitation',
    'cancel:invitation',
    'resend:invitation',
    'create:bill',
    'read:bill',
    'update:bill',
    'create:maintenance',
    'read:maintenance',
    'update:maintenance',
    'approve:bill',
    'read:budget',
    'create:budget',
    'update:budget',
    'read:maintenance_request',
    'create:maintenance_request',
    'assign:maintenance_request',
    'read:profile',
    'update:profile',
  ],
  tenant: [
    'read:building',
    'read:residence',
    'read:document',
    'read:bill',
    'create:maintenance',
    'read:maintenance',
    'read:maintenance_request',
    'create:maintenance_request',
    'update:own_maintenance_request',
    'read:profile',
    'update:profile',
  ],
  resident: [
    'read:building',
    'read:residence',
    'read:document',
    'create:document',
    'read:bill',
    'create:maintenance',
    'read:maintenance',
    'read:maintenance_request',
    'create:maintenance_request',
    'update:own_maintenance_request',
    'read:profile',
    'update:profile',
  ],
};

// Helper functions for tests
export function getRolePermissions(config: PermissionsConfig, role: Role): Permission[] {
  return config[role] || [];
}

export function checkPermission(
  config: PermissionsConfig,
  role: Role,
  permission: Permission
): boolean {
  // Throw error for invalid roles
  if (!(role in config)) {
    throw new Error(`Invalid role: ${role}`);
  }
  
  const rolePermissions = getRolePermissions(config, role);
  return rolePermissions.includes(permission);
}

export function validatePermissions(config: PermissionsConfig): boolean {
  // Basic validation - ensure all roles exist
  const requiredRoles: Role[] = ['admin', 'manager', 'tenant', 'resident'];
  return requiredRoles.every((role) => role in config);
}
