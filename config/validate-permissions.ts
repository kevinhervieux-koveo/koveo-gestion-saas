import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { validatePermissions, validatePermissionNaming } from './permissions-schema';

/**
 * Validates the permissions.json file against the Zod schema.
 * This script can be run to ensure the permissions configuration is valid.
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
      const ownerPermissions = new Set(validation.data.owner);
      const tenantPermissions = new Set(validation.data.tenant);

      // Manager should not have more permissions than admin
      const managerExtraPerms = Array.from(managerPermissions).filter(p => !adminPermissions.has(p));
      if (managerExtraPerms.length > 0) {
        warnings.push(`Manager has permissions that admin doesn't have: ${managerExtraPerms.join(', ')}`);
      }

      // Owner should not have more permissions than manager
      const ownerExtraPerms = Array.from(ownerPermissions).filter(p => !managerPermissions.has(p));
      if (ownerExtraPerms.length > 0) {
        warnings.push(`Owner has permissions that manager doesn't have: ${ownerExtraPerms.join(', ')}`);
      }

      // Tenant should have the most restrictive permissions
      const tenantExtraPerms = Array.from(tenantPermissions).filter(p => !ownerPermissions.has(p));
      if (tenantExtraPerms.length > 0) {
        warnings.push(`Tenant has permissions that owner doesn't have: ${tenantExtraPerms.join(', ')}`);
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
    console.log('\n🔐 Koveo Gestion Permissions Validation\n');
    
    if (result.valid) {
      console.log('✅ Permissions configuration is valid!');
    } else {
      console.log('❌ Permissions configuration has errors:');
      result.errors.forEach(error => console.log(`   ${error}`));
    }

    if (result.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      result.warnings.forEach(warning => console.log(`   ${warning}`));
    }

    console.log('');
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