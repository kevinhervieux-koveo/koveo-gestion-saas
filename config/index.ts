/**
 * Koveo Gestion Permissions Configuration.
 * 
 * This module provides a comprehensive role-based access control (RBAC) system
 * for the Quebec property management SaaS platform.
 * 
 * @example
 * ```typescript
 * import { permissions, checkPermission, validatePermissions } from '@/config';
 * 
 * // Check if a user has a specific permission
 * const canReadBills = checkPermission(permissions, 'admin', 'read:bill');
 * 
 * // Validate permissions configuration
 * const validation = validatePermissions(permissions);
 * ```
 */

// Export all permission-related types and utilities
export {
  PermissionAction,
  UserRole,
  RolePermissionsSchema,
  PermissionsSchema,
  type Permission,
  type Role,
  type RolePermissions,
  type PermissionsConfig,
  validatePermissions,
  checkPermission,
  getRolePermissions,
  validatePermissionNaming
} from './permissions-schema';

// Export validation utilities
export { validatePermissionsFile } from './validate-permissions';

// Export the actual permissions configuration
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load permissions data with fallback for production and development environments.
 */
function loadPermissionsData() {
  // Try multiple possible locations for the permissions.json file
  const possiblePaths = [
    // Development path (relative to config directory)
    join(__dirname, 'permissions.json'),
    // Production path (in dist/config)
    join(__dirname, '../config/permissions.json'),
    // Alternative production path
    join(process.cwd(), 'config/permissions.json'),
    // Dist path
    join(process.cwd(), 'dist/config/permissions.json')
  ];

  for (const path of possiblePaths) {
    try {
      const data = readFileSync(path, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      // Continue to next path
      continue;
    }
  }

  throw new Error(`Could not find permissions.json file. Tried paths: ${possiblePaths.join(', ')}`);
}

const permissionsData = loadPermissionsData();
export { permissionsData as permissions };

/**
 * Quick access to role hierarchies for common permission checks.
 */
export const ROLE_HIERARCHY = {
  admin: 3,
  manager: 2,
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

/**
 * Permission categories for easier permission management.
 */
export const PERMISSION_CATEGORIES = {
  USER_MANAGEMENT: [
    'read:user',
    'create:user',
    'update:user',
    'delete:user',
    'manage:user_roles',
    'read:profile',
    'update:profile'
  ],
  PROPERTY_MANAGEMENT: [
    'read:organization',
    'create:organization',
    'update:organization',
    'delete:organization',
    'read:building',
    'create:building',
    'update:building',
    'delete:building',
    'read:residence',
    'create:residence',
    'update:residence',
    'delete:residence',
    'assign:residence'
  ],
  FINANCIAL_MANAGEMENT: [
    'read:bill',
    'create:bill',
    'update:bill',
    'delete:bill',
    'approve:bill',
    'read:budget',
    'create:budget',
    'update:budget',
    'delete:budget',
    'approve:budget',
    'read:financial_report',
    'create:financial_report',
    'export:financial_report'
  ],
  MAINTENANCE_MANAGEMENT: [
    'read:maintenance_request',
    'create:maintenance_request',
    'update:maintenance_request',
    'update:own_maintenance_request',
    'delete:maintenance_request',
    'assign:maintenance_request',
    'approve:maintenance_request'
  ],
  DOCUMENT_MANAGEMENT: [
    'read:document',
    'create:document',
    'update:document',
    'delete:document',
    'share:document'
  ],
  SYSTEM_ADMINISTRATION: [
    'read:audit_log',
    'create:audit_log',
    'read:system_settings',
    'update:system_settings',
    'read:performance_metrics',
    'update:performance_metrics',
    'manage:integrations',
    'read:security_logs',
    'manage:security_settings',
    'backup:system',
    'restore:system',
    'manage:database'
  ],
  AI_AND_ANALYTICS: [
    'read:ai_analysis',
    'create:ai_analysis',
    'update:ai_analysis',
    'delete:ai_analysis',
    'access:ai_assistant',
    'manage:ai_settings',
    'read:analytics',
    'create:analytics',
    'export:analytics'
  ]
} as const;