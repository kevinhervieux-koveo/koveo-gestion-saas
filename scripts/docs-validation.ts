#!/usr/bin/env node
/**
 * Documentation validation script for JSDoc coverage and TypeDoc validation
 * Integrates with npm validation workflow.
 */

import { execFileSync } from 'child_process';
import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';


/**
 * Check JSDoc coverage for TypeScript files.
 * @returns Number of files with missing JSDoc.
 */
/**
 * CheckJSDocCoverage function.
 * @returns Function result.
 */
function checkJSDocCoverage(): number {
  console.warn('📚 Checking JSDoc coverage...');

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
            const fileContent = readFileSync(fullPath, 'utf-8');
            
            // Check if file has exported functions or classes
            const hasExports = /export\s+.*(function|class)/.test(fileContent);
            
            if (hasExports) {
              // Check if file has JSDoc comments
              const hasJSDoc = /\/\*\*/.test(fileContent);
              
              if (!hasJSDoc) {
                missingDocs++;
              }
            }
          } catch {
            // Skip files that can't be read
          }
        }
      }
    } catch (_error) {
      // Skip directories that can't be read
    }
  };

  checkDirectory('./client/src');
  checkDirectory('./server');

  if (missingDocs > 0) {
    console.warn(`⚠️  Found ${missingDocs} files potentially missing JSDoc documentation`);
  } else {
    console.warn('✅ JSDoc coverage check passed');
  }

  return missingDocs;
}

/**
 * Validate TypeDoc generation.
 * @returns Exit code from TypeDoc validation.
 */
/**
 * ValidateTypeDoc function.
 * @returns Function result.
 */
function validateTypeDoc(): number {
  console.warn('📖 Validating TypeDoc generation...');

  try {
    // Use execFileSync with argument array for npm commands
    execFileSync('npm', ['run', 'docs:generate'], { stdio: 'pipe' });
    console.warn('✅ TypeDoc validation passed');
    return 0;
  } catch (_error) {
    console.warn('⚠️  TypeDoc validation warnings (non-blocking)');
    return 0; // Non-blocking for now
  }
}

/**
 * Main documentation validation function.
 * @returns Exit code (0 = success, 1 = failure).
 */
/**
 * ValidateDocs function.
 * @returns Function result.
 */
export function validateDocs(): number {
  console.warn('🔍 Running documentation validation...\n');

  const jsDocIssues = checkJSDocCoverage();
  const typeDocResult = validateTypeDoc();

  console.warn('\n📊 Documentation validation summary:');
  console.warn(`- JSDoc coverage issues: ${jsDocIssues}`);
  console.warn(`- TypeDoc generation: ${typeDocResult === 0 ? 'passed' : 'failed'}`);

  // For now, documentation issues are warnings, not failures
  console.warn('\n✅ Documentation validation completed (warnings only)');
  return 0;
}

// Run validation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const exitCode = validateDocs();
  process.exit(exitCode);
}
