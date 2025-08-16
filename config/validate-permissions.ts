import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { validatePermissions, validatePermissionsWithFallback, validatePermissionNaming } from './permissions-schema';

/**
 * Validates the permissions.json file against the Zod schema.
 * This script can be run to ensure the permissions configuration is valid.
 */
export async function validatePermissionsFile(): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
}>

/**
 * Validates permissions with fallback for startup resilience.
 * This function is designed for use during application startup to prevent crashes.
 * @param allowFallback
 */
export async function validatePermissionsForStartup(allowFallback: boolean = true): Promise<{
  valid: boolean;
  data: Record<string, unknown>;
  errors: string[];
  warnings: string[];
  usedFallback: boolean;
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Read and parse the permissions.json file with fallback paths
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    
    const possiblePaths = [
      join(__dirname, 'permissions.json'),
      join(__dirname, '../config/permissions.json'),
      join(process.cwd(), 'config/permissions.json'),
      join(process.cwd(), 'dist/config/permissions.json')
    ];

    let permissionsContent: string;
    let foundPath: string | null = null;

    for (const path of possiblePaths) {
      try {
        permissionsContent = readFileSync(path, 'utf-8');
        foundPath = path;
        break;
      } catch (error) {
        continue;
      }
    }

    if (!foundPath) {
      if (allowFallback) {
        warnings.push('permissions.json file not found, using fallback configuration');
        const fallbackResult = validatePermissionsWithFallback({}, { allowFallback: true });
        return {
          valid: true,
          data: fallbackResult.data,
          errors,
          warnings,
          usedFallback: true
        };
      }
      throw new Error(`Could not find permissions.json file. Tried paths: ${possiblePaths.join(', ')}`);
    }

    const permissionsData = JSON.parse(permissionsContent!);

    // Use fallback validation for startup resilience
    const validation = validatePermissionsWithFallback(permissionsData, { allowFallback });
    
    if (!validation.success) {
      if (allowFallback) {
        // This should not happen with fallback enabled, but just in case
        warnings.push('Validation failed even with fallback, using minimal permissions');
        return {
          valid: true,
          data: {
            admin: ['read:user'],
            manager: ['read:user'],
            tenant: ['read:profile']
          },
          errors,
          warnings,
          usedFallback: true
        };
      }
      errors.push('Schema validation failed:');
      validation.error.issues.forEach(issue => {
        errors.push(`  - ${issue.path.join('.')}: ${issue.message}`);
      });
      return { valid: false, data: null, errors, warnings, usedFallback: false };
    }

    // Additional validation checks (non-blocking)
    const allPermissions = Object.values(validation.data).flat();
    const uniquePermissions = Array.from(new Set(allPermissions));
    
    if (allPermissions.length !== uniquePermissions.length) {
      warnings.push('Duplicate permissions found across roles');
    }

    // Check role hierarchy (warnings only)
    const adminPermissions = new Set(validation.data.admin);
    const managerPermissions = new Set(validation.data.manager);
    const tenantPermissions = new Set(validation.data.tenant);

    const managerExtraPerms = Array.from(managerPermissions).filter(p => !adminPermissions.has(p));
    if (managerExtraPerms.length > 0) {
      warnings.push(`Manager has permissions that admin doesn't have: ${managerExtraPerms.join(', ')}`);
    }

    return {
      valid: true,
      data: validation.data,
      errors,
      warnings,
      usedFallback: validation.usedFallback || false
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (allowFallback) {
      warnings.push(`Failed to read permissions.json (${errorMessage}), using fallback configuration`);
      const fallbackResult = validatePermissionsWithFallback({}, { allowFallback: true });
      return {
        valid: true,
        data: fallbackResult.data,
        errors,
        warnings,
        usedFallback: true
      };
    }
    
    if (errorMessage.includes('ENOENT')) {
      errors.push('permissions.json file not found. Please ensure the file exists in the config directory.');
    } else if (errorMessage.includes('SyntaxError')) {
      errors.push('permissions.json contains invalid JSON syntax.');
    } else {
      errors.push(`Failed to read or parse permissions.json: ${errorMessage}`);
    }
    return { valid: false, data: null, errors, warnings, usedFallback: false };
  }
}

/**
 *
 */
export async function validatePermissionsFile(): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Read and parse the permissions.json file with fallback paths
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    
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

    let permissionsContent: string;
    let foundPath: string | null = null;

    for (const path of possiblePaths) {
      try {
        permissionsContent = readFileSync(path, 'utf-8');
        foundPath = path;
        break;
      } catch (error) {
        // Continue to next path
        continue;
      }
    }

    if (!foundPath) {
      throw new Error(`Could not find permissions.json file. Tried paths: ${possiblePaths.join(', ')}`);
    }

    const permissionsData = JSON.parse(permissionsContent!);

    // Validate against Zod schema
    const validation = validatePermissions(permissionsData);
    
    if (!validation.success) {
      errors.push('Schema validation failed:');
      validation.error.issues.forEach(issue => {
        errors.push(`  - ${issue.path.join('.')}: ${issue.message}`);
      });
    } else {
      // Additional validation checks
      const allPermissions = Object.values(validation.data).flat();
      const uniquePermissions = Array.from(new Set(allPermissions));
      
      if (allPermissions.length !== uniquePermissions.length) {
        warnings.push('Duplicate permissions found across roles');
      }

      // Validate permission naming patterns
      const namingValidation = validatePermissionNaming(uniquePermissions);
      if (!namingValidation.valid) {
        errors.push('Invalid permission naming patterns:');
        namingValidation.invalidPermissions.forEach(permission => {
          errors.push(`  - ${permission} (should follow pattern: action:resource)`);
        });
      }

      // Check role hierarchy makes sense
      const adminPermissions = new Set(validation.data.admin);
      const managerPermissions = new Set(validation.data.manager);
      const tenantPermissions = new Set(validation.data.tenant);

      // Manager should not have more permissions than admin (warning only)
      const managerExtraPerms = Array.from(managerPermissions).filter(p => !adminPermissions.has(p));
      if (managerExtraPerms.length > 0) {
        warnings.push(`Manager has permissions that admin doesn't have: ${managerExtraPerms.join(', ')}`);
      }

      // Tenant should have the most restrictive permissions (warning only)
      const tenantExtraPerms = Array.from(tenantPermissions).filter(p => !managerPermissions.has(p) && !adminPermissions.has(p));
      if (tenantExtraPerms.length > 0) {
        warnings.push(`Tenant has permissions not found in admin or manager roles: ${tenantExtraPerms.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('ENOENT')) {
      errors.push('permissions.json file not found. Please ensure the file exists in the config directory.');
    } else if (errorMessage.includes('SyntaxError')) {
      errors.push('permissions.json contains invalid JSON syntax.');
    } else {
      errors.push(`Failed to read or parse permissions.json: ${errorMessage}`);
    }
    return { valid: false, errors, warnings };
  }
}

/**
 * CLI script to validate permissions if run directly.
 */
async function runCLI() {
  try {
    const result = await validatePermissionsFile();
    console.warn('\n🔐 Koveo Gestion Permissions Validation\n');
    
    if (result.valid) {
      console.warn('✅ Permissions configuration is valid!');
    } else {
      console.warn('❌ Permissions configuration has errors:');
      result.errors.forEach(error => console.warn(`   ${error}`));
    }

    if (result.warnings.length > 0) {
      console.warn('\n⚠️  Warnings:');
      result.warnings.forEach(warning => console.warn(`   ${warning}`));
    }

    console.warn('');
    process.exit(result.valid ? 0 : 1);
  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
}

// Check if this module is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI();
}