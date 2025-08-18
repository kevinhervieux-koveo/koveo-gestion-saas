#!/usr/bin/env node
/**
 * Enhanced validation script that includes documentation validation
 * Integrates with existing npm validation workflow.
 */

import { execSync } from 'child_process';
import { validateDocs } from './docs-validation.js';

/**
 * Enhanced validation runner that includes documentation checks.
 * @returns Process exit code.
 */
async function runEnhancedValidation(): Promise<number> {
  console.log('🔍 Running enhanced validation with documentation checks...\n');
  
  let hasErrors = false;
  
  // Run standard validation checks
  const validationSteps = [
    { name: 'Lint Check', command: 'npm run lint:check' },
    { name: 'Format Check', command: 'npm run format:check' },
    { name: 'Type Check', command: 'npm run typecheck' },
    { name: 'Tests', command: 'npm run test' },
    { name: 'Quality Check', command: 'npm run quality:check' }
  ];
  
  for (const step of validationSteps) {
    try {
      console.log(`📋 Running ${step.name}...`);
      execSync(step.command, { stdio: 'pipe' });
      console.log(`✅ ${step.name} passed\n`);
    } catch (error) {
      console.log(`❌ ${step.name} failed\n`);
      hasErrors = true;
    }
  }
  
  // Run documentation validation
  try {
    console.log('📚 Running documentation validation...');
    const docsResult = validateDocs();
    if (docsResult !== 0) {
      hasErrors = true;
    }
  } catch (error) {
    console.error('❌ Documentation validation failed:', error);
    hasErrors = true;
  }
  
  // Final result
  if (hasErrors) {
    console.log('\n❌ Enhanced validation failed. Please fix the issues above.');
    return 1;
  } else {
    console.log('\n✅ All enhanced validation checks passed!');
    return 0;
  }
}

// Run validation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runEnhancedValidation().then(exitCode => {
    process.exit(exitCode);
  }).catch(error => {
    console.error('Validation runner failed:', error);
    process.exit(1);
  });
}

export { runEnhancedValidation };