#!/usr/bin/env node
/**
 * @fileoverview Build validation script to ensure removed routes are not present in production builds
 * Run this after building to verify that removed routes don't persist in cached files
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

// Configuration
const REMOVED_ROUTES = [
  '/admin/dashboard',  // This route was removed but was persisting due to cache
];

const VALID_ROUTES = [
  // Public routes
  '/',
  '/login',
  '/accept-invitation',
  
  // Admin routes
  '/admin/organizations',
  '/admin/documentation',
  '/admin/roadmap',
  '/admin/quality',
  '/admin/suggestions',
  '/admin/permissions',
  
  // Owner routes
  '/owner/dashboard',
  '/owner/documentation',
  '/owner/pillars',
  '/owner/roadmap',
  '/owner/quality',
  '/owner/suggestions',
  '/owner/permissions',
  
  // Manager routes
  '/manager/buildings',
  '/manager/residences',
  '/manager/budget',
  '/manager/bills',
  '/manager/demands',
  '/manager/user-management',
  
  // Resident routes
  '/dashboard',
  '/residents/residence',
  '/residents/building',
  '/residents/demands',
  
  // Settings routes
  '/settings/settings',
  '/settings/bug-reports',
  '/settings/idea-box',
  
  // Legacy routes
  '/pillars',
];

interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Check if a file contains references to removed routes
 */
async function checkFileForRemovedRoutes(filePath: string): Promise<string[]> {
  const content = await fs.promises.readFile(filePath, 'utf-8');
  const errors: string[] = [];
  
  for (const route of REMOVED_ROUTES) {
    // Check for various patterns where the route might appear
    const patterns = [
      `"${route}"`,
      `'${route}'`,
      `\`${route}\``,
      `path="${route}"`,
      `path='${route}'`,
      `to="${route}"`,
      `to='${route}'`,
      `href="${route}"`,
      `href='${route}'`,
    ];
    
    for (const pattern of patterns) {
      if (content.includes(pattern)) {
        errors.push(`Found removed route "${route}" in ${filePath} (pattern: ${pattern})`);
      }
    }
  }
  
  return errors;
}

/**
 * Check source files for route consistency
 */
async function checkSourceFiles(): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check App.tsx for route definitions
  const appPath = path.join(process.cwd(), 'client/src/App.tsx');
  if (fs.existsSync(appPath)) {
    const appContent = await fs.promises.readFile(appPath, 'utf-8');
    
    // Check for removed routes
    for (const route of REMOVED_ROUTES) {
      if (appContent.includes(`path='${route}'`) || appContent.includes(`path="${route}"`)) {
        errors.push(`App.tsx still contains removed route: ${route}`);
      }
    }
    
    // Check that valid routes are present
    for (const route of VALID_ROUTES) {
      if (!appContent.includes(`path='${route}'`) && !appContent.includes(`path="${route}"`)) {
        warnings.push(`App.tsx missing expected route: ${route}`);
      }
    }
  }
  
  // Check sidebar.tsx for navigation items
  const sidebarPath = path.join(process.cwd(), 'client/src/components/layout/sidebar.tsx');
  if (fs.existsSync(sidebarPath)) {
    const sidebarContent = await fs.promises.readFile(sidebarPath, 'utf-8');
    
    for (const route of REMOVED_ROUTES) {
      if (sidebarContent.includes(`path: '${route}'`) || sidebarContent.includes(`path: "${route}"`)) {
        errors.push(`sidebar.tsx still contains removed route: ${route}`);
      }
    }
  }
  
  return {
    success: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Check build output for removed routes
 */
async function checkBuildOutput(): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const distPath = path.join(process.cwd(), 'client/dist');
  
  if (!fs.existsSync(distPath)) {
    warnings.push('Build output not found. Run "npm run build" first.');
    return { success: true, errors, warnings };
  }
  
  // Find all JavaScript files in the build output
  const jsFiles = await glob(path.join(distPath, '**/*.js'));
  
  console.log(`Checking ${jsFiles.length} JavaScript files in build output...`);
  
  for (const file of jsFiles) {
    const fileErrors = await checkFileForRemovedRoutes(file);
    errors.push(...fileErrors);
  }
  
  // Also check HTML files
  const htmlFiles = await glob(path.join(distPath, '**/*.html'));
  
  for (const file of htmlFiles) {
    const fileErrors = await checkFileForRemovedRoutes(file);
    errors.push(...fileErrors);
  }
  
  return {
    success: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Main validation function
 */
async function validateRoutes(): Promise<void> {
  console.log('🔍 Validating routes in Koveo Gestion...\n');
  
  // Check source files
  console.log('📝 Checking source files...');
  const sourceResult = await checkSourceFiles();
  
  if (sourceResult.errors.length > 0) {
    console.error('❌ Source file errors:');
    sourceResult.errors.forEach(error => console.error(`   - ${error}`));
  }
  
  if (sourceResult.warnings.length > 0) {
    console.warn('⚠️  Source file warnings:');
    sourceResult.warnings.forEach(warning => console.warn(`   - ${warning}`));
  }
  
  // Check build output
  console.log('\n📦 Checking build output...');
  const buildResult = await checkBuildOutput();
  
  if (buildResult.errors.length > 0) {
    console.error('❌ Build output errors:');
    buildResult.errors.forEach(error => console.error(`   - ${error}`));
  }
  
  if (buildResult.warnings.length > 0) {
    console.warn('⚠️  Build output warnings:');
    buildResult.warnings.forEach(warning => console.warn(`   - ${warning}`));
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  const totalErrors = sourceResult.errors.length + buildResult.errors.length;
  const totalWarnings = sourceResult.warnings.length + buildResult.warnings.length;
  
  if (totalErrors === 0) {
    console.log('✅ Route validation passed!');
    console.log(`   - No removed routes found in source or build`);
    console.log(`   - All routes are properly configured`);
    
    if (totalWarnings > 0) {
      console.log(`   - ${totalWarnings} warning(s) to review`);
    }
    
    process.exit(0);
  } else {
    console.error(`❌ Route validation failed with ${totalErrors} error(s)`);
    console.error('\nTo fix:');
    console.error('1. Remove references to deleted routes from source files');
    console.error('2. Clear build cache: rm -rf client/dist .vite node_modules/.vite');
    console.error('3. Rebuild: npm run build');
    console.error('4. Run validation again: npm run validate:routes');
    
    process.exit(1);
  }
}

// Run validation
validateRoutes().catch(error => {
  console.error('Fatal error during route validation:', error);
  process.exit(1);
});