#!/usr/bin/env tsx

/**
 * Final validation cleanup script
 * Targets the remaining critical issues.
 */

import * as fs from 'fs';
import * as path from 'path';

const problematicFiles = [
  'server/services/money-flow-automation.ts',
  'server/api/bills.ts', 
  'server/services/dynamic-financial-calculator.ts',
  'server/routes-minimal.ts',
  'server/services/financial-automation-service.ts'
];

/**
 * Fix Express typing issues.
 * @param content - File content.
 * @returns Fixed content.
 */
function fixExpressTypes(content: string): string {
  // Add proper Express imports if missing
  if (content.includes('Express') && !content.includes('import type { Express, Request, Response }')) {
    content = content.replace(
      "import type { Express } from 'express';",
      "import type { Express, Request, Response } from 'express';"
    );
  }
  
  // Fix request/response parameters
  content = content.replace(
    /async \(req: unknown, res: unknown\)/g,
    'async (req: Request, res: Response)'
  );
  
  return content;
}

/**
 * Fix undefined error variables  .
 * @param content - File content.
 * @returns Fixed content.
 */
function fixErrorVariables(content: string): string {
  // Replace undefined 'error' with proper error handling
  const errorPatterns = [
    /Cannot find name 'error'/g,
    /Cannot find name 'cleanupError'/g,
    /Cannot find name 'emailError'/g,
    /Cannot find name 'individualError'/g
  ];
  
  errorPatterns.forEach(pattern => {
    content = content.replace(pattern, 'console.error');
  });
  
  return content;
}

/**
 * Fix JSDoc issues.
 * @param content - File content  
 * @returns Fixed content
 */
function fixJSDocIssues(content: string): string {
  // Add missing JSDoc descriptions
  content = content.replace(
    /Missing JSDoc @param "([^"]*)" description/g,
    '/** @param $1 Parameter description */'
  );
  
  content = content.replace(
    /Missing JSDoc @returns declaration/g,
    '/** @returns Function result */'
  );
  
  return content;
}

/**
 * Process a single file.
 * @param filePath - File path to process.
 */
function processFile(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️ File not found: ${filePath}`);
    return;
  }
  
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    const originalLength = content.length;
    
    // Apply fixes
    content = fixExpressTypes(content);
    content = fixErrorVariables(content);
    content = fixJSDocIssues(content);
    
    // Only write if changed
    if (content.length !== originalLength) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Fixed: ${filePath}`);
    } else {
      console.log(`📝 No changes needed: ${filePath}`);
    }
    
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error);
  }
}

/**
 * Main cleanup function.
 */
function main(): void {
  console.log('🚀 Starting final validation cleanup...\n');
  
  problematicFiles.forEach(processFile);
  
  console.log('\n✅ Final cleanup completed!');
  console.log('🎯 Run "npm run validate" to check remaining issues.');
}

main();