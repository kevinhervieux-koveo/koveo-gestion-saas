#!/usr/bin/env tsx
/**
 * Authentication Routes Validation Script
 * 
 * This script prevents the recurring 404 authentication errors by:
 * 1. Validating that auth routes use correct /api/auth/ paths
 * 2. Ensuring registerRoutes function is properly exported
 * 3. Checking that authentication routes are loaded during server startup
 */

import fs from 'fs';
import path from 'path';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate authentication route paths in server/auth.ts
 */
function validateAuthRoutePaths(): ValidationResult {
  const result: ValidationResult = { isValid: true, errors: [], warnings: [] };
  
  try {
    const authFile = fs.readFileSync(path.join(process.cwd(), 'server/auth.ts'), 'utf-8');
    
    // Check for incorrect /auth/ paths (should be /api/auth/)
    const incorrectPaths = [
      { pattern: /app\.(get|post|put|delete)\s*\(\s*['"`]\/auth\//, description: "Found /auth/ path instead of /api/auth/" },
    ];
    
    const correctPaths = [
      { pattern: /app\.post\s*\(\s*['"`]\/api\/auth\/login['"`]/, description: "Login route" },
      { pattern: /app\.post\s*\(\s*['"`]\/api\/auth\/logout['"`]/, description: "Logout route" },
      { pattern: /app\.get\s*\(\s*['"`]\/api\/auth\/user['"`]/, description: "User route" },
    ];
    
    // Check for incorrect paths
    for (const check of incorrectPaths) {
      if (check.pattern.test(authFile)) {
        result.isValid = false;
        result.errors.push(`❌ ${check.description} - this causes 404 errors!`);
      }
    }
    
    // Check for correct paths
    let correctPathCount = 0;
    for (const check of correctPaths) {
      if (check.pattern.test(authFile)) {
        correctPathCount++;
        console.log(`✅ ${check.description} path is correct`);
      } else {
        result.warnings.push(`⚠️  ${check.description} path not found`);
      }
    }
    
    if (correctPathCount === 0) {
      result.isValid = false;
      result.errors.push('❌ No correct /api/auth/ paths found in authentication routes');
    }
    
  } catch (error) {
    result.isValid = false;
    result.errors.push(`❌ Failed to read server/auth.ts: ${error}`);
  }
  
  return result;
}

/**
 * Validate that routes.ts properly exports registerRoutes function
 */
function validateRoutesExport(): ValidationResult {
  const result: ValidationResult = { isValid: true, errors: [], warnings: [] };
  
  try {
    const routesFile = fs.readFileSync(path.join(process.cwd(), 'server/routes.ts'), 'utf-8');
    
    // Check for registerRoutes export
    if (!routesFile.includes('export async function registerRoutes')) {
      result.isValid = false;
      result.errors.push('❌ registerRoutes function not properly exported in server/routes.ts');
    } else {
      console.log('✅ registerRoutes function is properly exported');
    }
    
    // Check for setupAuthRoutes import
    if (!routesFile.includes('setupAuthRoutes')) {
      result.isValid = false;
      result.errors.push('❌ setupAuthRoutes not imported in server/routes.ts');
    } else {
      console.log('✅ setupAuthRoutes is imported in routes.ts');
    }
    
  } catch (error) {
    result.isValid = false;
    result.errors.push(`❌ Failed to read server/routes.ts: ${error}`);
  }
  
  return result;
}

/**
 * Validate that server/index.ts properly imports registerRoutes
 */
function validateServerIndex(): ValidationResult {
  const result: ValidationResult = { isValid: true, errors: [], warnings: [] };
  
  try {
    const serverFile = fs.readFileSync(path.join(process.cwd(), 'server/index.ts'), 'utf-8');
    
    // Check for proper import and usage
    if (!serverFile.includes('registerRoutes') && !serverFile.includes('./routes.js')) {
      result.warnings.push('⚠️  registerRoutes not being called in server/index.ts');
    } else {
      console.log('✅ registerRoutes is being called in server/index.ts');
    }
    
  } catch (error) {
    result.isValid = false;
    result.errors.push(`❌ Failed to read server/index.ts: ${error}`);
  }
  
  return result;
}

/**
 * Main validation function
 */
function main() {
  console.log('🔍 Validating authentication routes configuration...\n');
  
  const validations = [
    { name: 'Authentication Route Paths', fn: validateAuthRoutePaths },
    { name: 'Routes Export', fn: validateRoutesExport },
    { name: 'Server Index Configuration', fn: validateServerIndex },
  ];
  
  let overallValid = true;
  const allErrors: string[] = [];
  const allWarnings: string[] = [];
  
  for (const validation of validations) {
    console.log(`📋 Checking ${validation.name}...`);
    const result = validation.fn();
    
    if (!result.isValid) {
      overallValid = false;
      allErrors.push(...result.errors);
    }
    
    allWarnings.push(...result.warnings);
    console.log('');
  }
  
  // Print summary
  console.log('📊 VALIDATION SUMMARY');
  console.log('==================');
  
  if (overallValid) {
    console.log('✅ All authentication route validations passed!');
    console.log('✅ 404 errors should be prevented.');
  } else {
    console.log('❌ Authentication route validation failed!');
    console.log('❌ This configuration will cause 404 errors.');
  }
  
  if (allErrors.length > 0) {
    console.log('\n🚨 ERRORS TO FIX:');
    allErrors.forEach(error => console.log(`  ${error}`));
  }
  
  if (allWarnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    allWarnings.forEach(warning => console.log(`  ${warning}`));
  }
  
  console.log('\n💡 To prevent future 404 errors:');
  console.log('   1. Always use /api/auth/ paths for authentication routes');
  console.log('   2. Ensure registerRoutes is exported and called during server startup');
  console.log('   3. Run this script after auth-related changes: npm run validate:auth');
  
  process.exit(overallValid ? 0 : 1);
}

// Run main function directly in ES modules
main();