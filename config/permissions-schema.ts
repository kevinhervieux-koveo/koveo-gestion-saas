import { z } from 'zod';

/**
 * Enum of all possible permission actions in the Koveo Gestion system.
 * Each permission follows the pattern: {action}:{resource}.
 */
export const PermissionAction = z.enum([
  // User management permissions
  'read:user',
  'create:user',
  'update:user',
  'delete:user',
  'manage:user_roles',
  'read:profile',
  'update:profile',

  // Organization management permissions
  'read:organization',
  'create:organization',
  'update:organization',
  'delete:organization',
  'manage:organization_settings',

  // Building management permissions
  'read:building',
  'create:building',
  'update:building',
  'delete:building',
  'manage:building_settings',

  // Residence management permissions
  'read:residence',
  'create:residence',
  'update:residence',
  'delete:residence',
  'assign:residence',

  // Financial management permissions
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
  'update:financial_report',
  'delete:financial_report',
  'export:financial_report',

  // Maintenance management permissions
  'read:maintenance_request',
  'create:maintenance_request',
  'update:maintenance_request',
  'update:own_maintenance_request',
  'delete:maintenance_request',
  'assign:maintenance_request',
  'approve:maintenance_request',

  // Document management permissions
  'read:document',
  'create:document',
  'update:document',
  'delete:document',
  'share:document',

  // System administration permissions
  'read:audit_log',
  'create:audit_log',
  'read:system_settings',
  'update:system_settings',
  'read:performance_metrics',
  'update:performance_metrics',

  // Development framework permissions
  'read:development_pillar',
  'create:development_pillar',
  'update:development_pillar',
  'delete:development_pillar',
  'read:workspace_status',
  'update:workspace_status',
  'read:quality_metric',
  'create:quality_metric',
  'update:quality_metric',
  'delete:quality_metric',
  'read:framework_config',
  'update:framework_config',
  'read:improvement_suggestion',
  'create:improvement_suggestion',
  'update:improvement_suggestion',
  'delete:improvement_suggestion',

  // Feature management permissions
  'read:feature',
  'create:feature',
  'update:feature',
  'delete:feature',
  'analyze:feature',
  'sync:feature',
  'read:actionable_item',
  'create:actionable_item',
  'update:actionable_item',
  'delete:actionable_item',
  'assign:actionable_item',

  // Notification permissions
  'read:notification',
  'create:notification',
  'update:notification',
  'delete:notification',
  'send:notification',

  // AI and analytics permissions
  'read:ai_analysis',
  'create:ai_analysis',
  'update:ai_analysis',
  'delete:ai_analysis',
  'access:ai_assistant',
  'manage:ai_settings',
  'read:analytics',
  'create:analytics',
  'export:analytics',

  // Invitation management permissions
  'read:invitation',
  'create:invitation',
  'update:invitation',
  'cancel:invitation',
  'resend:invitation',
  'audit:invitation',

  // Integration and security permissions
  'manage:integrations',
  'read:security_logs',
  'manage:security_settings',
  'backup:system',
  'restore:system',
  'manage:database',
  'read:api_logs',
  'manage:api_settings'
]);

/**
 * Enum of all user roles in the Koveo Gestion system.
 */
export const UserRole = z.enum(['admin', 'manager', 'tenant']);

/**
 * Schema for validating a single role's permissions array.
 */
export const RolePermissionsSchema = z.array(PermissionAction).min(1, {
  message: 'Each role must have at least one permission'
});

/**
 * Complete schema for validating the permissions.json structure.
 * Ensures all roles are present and have valid permissions.
 */
export const PermissionsSchema = z.object({
  admin: RolePermissionsSchema,
  manager: RolePermissionsSchema,
  tenant: RolePermissionsSchema
}).strict({
  message: 'Permissions object must contain exactly the three required roles: admin, manager, tenant'
});

/**
 * Type definitions inferred from the Zod schemas.
 */
export type Permission = z.infer<typeof PermissionAction>;
/**
 *
 */
export type Role = z.infer<typeof UserRole>;
/**
 *
 */
export type RolePermissions = z.infer<typeof RolePermissionsSchema>;
/**
 *
 */
export type PermissionsConfig = z.infer<typeof PermissionsSchema>;

/**
 * Validates a permissions configuration object against the schema.
 * 
 * @param permissions - The permissions object to validate.
 * @returns Validation result with success status and data or error details.
 * 
 * @example
 * ```typescript
 * import permissionsData from './permissions.json';
 * 
 * const result = validatePermissions(permissionsData);
 * if (result.success) {
 *   console.log('Permissions are valid:', result.data);
 * } else {
 *   console.error('Validation errors:', result.error.issues);
 * }
 * ```
 */
export function validatePermissions(permissions: unknown) {
  return PermissionsSchema.safeParse(permissions);
}

/**
 * Validates permissions configuration with fallback handling for startup resilience.
 * This function provides graceful degradation when permissions validation fails.
 * 
 * @param permissions - The permissions object to validate.
 * @param options - Validation options including whether to allow fallback.
 * @param options.allowFallback
 * @returns Validation result with fallback data when needed.
 */
export function validatePermissionsWithFallback(
  permissions: unknown,
  options: { allowFallback?: boolean } = {}
) {
  try {
    const result = PermissionsSchema.safeParse(permissions);
    
    if (result.success) {
      return { success: true, data: result.data, usedFallback: false };
    }
    
    // If validation fails and fallback is allowed, provide minimal permissions
    if (options.allowFallback) {
      console.warn('Permissions validation failed, using fallback configuration:', 
        result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', '));
      
      const fallbackPermissions = {
        admin: ['read:user', 'read:organization', 'read:building', 'read:residence'],
        manager: ['read:user', 'read:organization', 'read:building'],
        tenant: ['read:profile', 'read:residence']
      };
      
      return { success: true, data: fallbackPermissions, usedFallback: true };
    }
    
    return { success: false, error: result.error, usedFallback: false };
  } catch (error) {
    if (options.allowFallback) {
      console.error('Permissions validation error, using minimal fallback:', error);
      const fallbackPermissions = {
        admin: ['read:user'],
        manager: ['read:user'],
        tenant: ['read:profile']
      };
      return { success: true, data: fallbackPermissions, usedFallback: true };
    }
    
    throw error;
  }
}

/**
 * Checks if a specific role has a particular permission.
 * 
 * @param permissions - The complete permissions configuration.
 * @param role - The user role to check.
 * @param permission - The permission to verify.
 * @returns Boolean indicating whether the role has the permission.
 * 
 * @example
 * ```typescript
 * const hasPermission = checkPermission(permissions, 'admin', 'read:bill');
 * console.log('Owner can read bills:', hasPermission);
 * ```
 */
export function checkPermission(
  permissions: PermissionsConfig,
  role: Role,
  permission: Permission
): boolean {
  return permissions[role].includes(permission);
}

/**
 * Gets all permissions for a specific role.
 * 
 * @param permissions - The complete permissions configuration.
 * @param role - The user role to get permissions for.
 * @returns Array of permissions for the specified role.
 * 
 * @example
 * ```typescript
 * const userPermissions = getRolePermissions(permissions, 'manager');
 * console.log('Manager permissions:', userPermissions);
 * ```
 */
export function getRolePermissions(
  permissions: PermissionsConfig,
  role: Role
): Permission[] {
  return permissions[role];
}

/**
 * Validates that all permissions follow the correct naming pattern.
 * Pattern: {action}:{resource}.
 * 
 * @param permissions - Array of permission strings to validate.
 * @returns Validation result with any invalid permissions.
 */
export function validatePermissionNaming(permissions: string[]): {
  valid: boolean;
  invalidPermissions: string[];
} {
  const permissionPattern = /^[a-z_]+:[a-z_]+$/;
  const invalidPermissions = permissions.filter(
    permission => !permissionPattern.test(permission)
  );
  
  return {
    valid: invalidPermissions.length === 0,
    invalidPermissions
  };
}