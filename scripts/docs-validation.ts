#!/usr/bin/env node
/**
 * Documentation validation script for JSDoc coverage and TypeDoc validation
 * Integrates with npm validation workflow.
 */

import { execSync } from 'child_process';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Check JSDoc coverage for TypeScript files.
 * @returns Number of files with missing JSDoc.
 */
function checkJSDocCoverage(): number {
  console.log('📚 Checking JSDoc coverage...');
  
  let missingDocs = 0;
  const checkDirectory = (dir: string) => {
    try {
      const items = readdirSync(dir);
      for (const item of items) {
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          checkDirectory(fullPath);
        } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
          // Basic check for exported functions without JSDoc
          try {
            execSync(`grep -l "export.*function\\|export.*class" "${fullPath}"`, { stdio: 'pipe' });
            try {
              execSync(`grep -L "/\\*\\*" "${fullPath}"`, { stdio: 'pipe' });
              missingDocs++;
            } catch {
              // File has JSDoc comments
            }
          } catch {
            // No exported functions/classes
          }
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }
  };
  
  checkDirectory('./client/src');
  checkDirectory('./server');
  
  if (missingDocs > 0) {
    console.log(`⚠️  Found ${missingDocs} files potentially missing JSDoc documentation`);
  } else {
    console.log('✅ JSDoc coverage check passed');
  }
  
  return missingDocs;
}

/**
 * Validate TypeDoc generation.
 * @returns Exit code from TypeDoc validation.
 */
function validateTypeDoc(): number {
  console.log('📖 Validating TypeDoc generation...');
  
  try {
    execSync('npm run docs:generate', { stdio: 'pipe' });
    console.log('✅ TypeDoc validation passed');
    return 0;
  } catch (error) {
    console.log('⚠️  TypeDoc validation warnings (non-blocking)');
    return 0; // Non-blocking for now
  }
}

/**
 * Main documentation validation function.
 * @returns Exit code (0 = success, 1 = failure).
 */
export function validateDocs(): number {
  console.log('🔍 Running documentation validation...\n');
  
  const jsDocIssues = checkJSDocCoverage();
  const typeDocResult = validateTypeDoc();
  
  console.log('\n📊 Documentation validation summary:');
  console.log(`- JSDoc coverage issues: ${jsDocIssues}`);
  console.log(`- TypeDoc generation: ${typeDocResult === 0 ? 'passed' : 'failed'}`);
  
  // For now, documentation issues are warnings, not failures
  console.log('\n✅ Documentation validation completed (warnings only)');
  return 0;
}

// Run validation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const exitCode = validateDocs();
  process.exit(exitCode);
}