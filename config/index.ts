/**
 * Koveo Gestion Utility Configuration.
 * 
 * This module provides utility functions and constants for the Quebec property 
 * management SaaS platform. All permissions are now managed via database.
 */

/**
 * Quick access to role hierarchies for common permission checks.
 */
export const ROLE_HIERARCHY = {
  admin: 4,
  manager: 3,
  resident: 2,
  tenant: 1
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