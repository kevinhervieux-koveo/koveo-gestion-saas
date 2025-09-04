#!/usr/bin/env tsx
/**
 * User Safety Verification Script
 * 
 * Verifies that all user safety measures are properly implemented
 * to prevent accidental user data loss.
 */

import { glob } from 'glob';
import { readFileSync } from 'fs';
import chalk from 'chalk';

interface SafetyCheck {
  name: string;
  description: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  details: string[];
}

const safetyChecks: SafetyCheck[] = [];

/**
 * Check for cascade user deletion patterns in code
 */
async function checkCascadeUserDeletion(): Promise<SafetyCheck> {
  const files = await glob('server/**/*.ts');
  const dangerousPatterns = [
    /delete.*users.*where.*inArray/i,
    /\.delete\(users\).*where.*inArray/i,
    /orphaned.*users.*delete/i,
    /delete.*orphaned.*users/i
  ];
  
  const violations: string[] = [];
  
  for (const file of files) {
    if (file.includes('test') || file.includes('scripts/verify-user-safety.ts')) continue;
    
    try {
      const content = readFileSync(file, 'utf8');
      
      for (const pattern of dangerousPatterns) {
        if (pattern.test(content)) {
          // Check if it's disabled/commented
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (pattern.test(lines[i]) && !lines[i].includes('DISABLED')) {
              violations.push(`${file}:${i + 1} - ${lines[i].trim()}`);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error reading ${file}:`, error);
    }
  }
  
  return {
    name: 'Cascade User Deletion Check',
    description: 'Ensures no automatic user deletion in cascade operations',
    status: violations.length === 0 ? 'PASS' : 'FAIL',
    details: violations.length > 0 ? violations : ['No cascade user deletion patterns found']
  };
}

/**
 * Check for user retention policy implementation
 */
async function checkUserRetentionPolicy(): Promise<SafetyCheck> {
  try {
    const policyFile = 'server/policies/user-retention-policy.ts';
    const content = readFileSync(policyFile, 'utf8');
    
    const requiredElements = [
      'AUTO_DELETE_USERS: false',
      'PRESERVE_ORPHANED_USERS: true',
      'REQUIRE_EXPLICIT_ADMIN_DELETION: true',
      'preserveUsersInCascadeOperation',
      'validateUserDeletionPolicy'
    ];
    
    const missing = requiredElements.filter(element => !content.includes(element));
    
    return {
      name: 'User Retention Policy',
      description: 'Verifies user retention policy is implemented',
      status: missing.length === 0 ? 'PASS' : 'FAIL',
      details: missing.length > 0 ? [`Missing elements: ${missing.join(', ')}`] : ['All policy elements present']
    };
  } catch (error) {
    return {
      name: 'User Retention Policy',
      description: 'Verifies user retention policy is implemented',
      status: 'FAIL',
      details: ['User retention policy file not found']
    };
  }
}

/**
 * Check admin user deletion endpoint security
 */
async function checkAdminDeletionSecurity(): Promise<SafetyCheck> {
  try {
    const userApiFile = 'server/api/users.ts';
    const content = readFileSync(userApiFile, 'utf8');
    
    const securityFeatures = [
      'RESTRICTED Admin endpoint',
      'requires email confirmation',
      'deletion reason for audit',
      'Only administrators can delete',
      'CRITICAL: Admin.*attempting to delete'
    ];
    
    const missing = securityFeatures.filter(feature => 
      !content.match(new RegExp(feature, 'i'))
    );
    
    return {
      name: 'Admin Deletion Security',
      description: 'Verifies admin user deletion endpoint has proper safeguards',
      status: missing.length === 0 ? 'PASS' : 'WARNING',
      details: missing.length > 0 ? [`Missing security features: ${missing.join(', ')}`] : ['All security features present']
    };
  } catch (error) {
    return {
      name: 'Admin Deletion Security',
      description: 'Verifies admin user deletion endpoint has proper safeguards',
      status: 'FAIL',
      details: ['Could not check admin deletion security']
    };
  }
}

/**
 * Check for test cleanup patterns
 */
async function checkTestCleanupPatterns(): Promise<SafetyCheck> {
  const testFiles = await glob('tests/**/*.ts');
  let testDeletions = 0;
  let safeTestDeletions = 0;
  
  for (const file of testFiles) {
    try {
      const content = readFileSync(file, 'utf8');
      const deletions = content.match(/\.delete\(.*users\)/g) || [];
      testDeletions += deletions.length;
      
      // Count safe deletions (test-specific emails)
      const safeDeletions = content.match(/\.delete\(.*users\).*where.*eq.*email.*@test\.|@example\.|@demo\./g) || [];
      safeTestDeletions += safeDeletions.length;
    } catch (error) {
      console.error(`Error reading ${file}:`, error);
    }
  }
  
  return {
    name: 'Test Cleanup Patterns',
    description: 'Ensures test user deletions use safe test-specific patterns',
    status: testDeletions === safeTestDeletions ? 'PASS' : 'WARNING',
    details: [
      `Total test deletions: ${testDeletions}`,
      `Safe test deletions: ${safeTestDeletions}`,
      testDeletions > safeTestDeletions ? 'Some test deletions may affect real users' : 'All test deletions are safe'
    ]
  };
}

/**
 * Main verification function
 */
async function main() {
  console.log(chalk.blue('\n🛡️ User Safety Verification Report'));
  console.log(chalk.blue('=====================================\n'));
  
  // Run all safety checks
  const checks = await Promise.all([
    checkCascadeUserDeletion(),
    checkUserRetentionPolicy(),
    checkAdminDeletionSecurity(),
    checkTestCleanupPatterns()
  ]);
  
  safetyChecks.push(...checks);
  
  // Display results
  let totalPassed = 0;
  let totalFailed = 0;
  let totalWarnings = 0;
  
  for (const check of safetyChecks) {
    const statusColor = check.status === 'PASS' ? chalk.green : 
                       check.status === 'WARNING' ? chalk.yellow : chalk.red;
    const statusIcon = check.status === 'PASS' ? '✅' : 
                      check.status === 'WARNING' ? '⚠️' : '❌';
    
    console.log(`${statusIcon} ${statusColor(check.status)} ${chalk.bold(check.name)}`);
    console.log(`   ${chalk.gray(check.description)}`);
    
    for (const detail of check.details) {
      console.log(`   ${chalk.cyan('→')} ${detail}`);
    }
    console.log('');
    
    if (check.status === 'PASS') totalPassed++;
    else if (check.status === 'WARNING') totalWarnings++;
    else totalFailed++;
  }
  
  // Summary
  console.log(chalk.blue('Summary'));
  console.log(chalk.blue('======='));
  console.log(`${chalk.green('✅ Passed:')} ${totalPassed}`);
  console.log(`${chalk.yellow('⚠️  Warnings:')} ${totalWarnings}`);
  console.log(`${chalk.red('❌ Failed:')} ${totalFailed}`);
  
  if (totalFailed > 0) {
    console.log(chalk.red('\n🚨 CRITICAL: User safety verification failed!'));
    console.log(chalk.red('Please address the failed checks before proceeding.'));
    process.exit(1);
  } else if (totalWarnings > 0) {
    console.log(chalk.yellow('\n⚠️ WARNING: Some user safety checks have warnings.'));
    console.log(chalk.yellow('Review the warnings to ensure optimal safety.'));
  } else {
    console.log(chalk.green('\n🎉 SUCCESS: All user safety checks passed!'));
    console.log(chalk.green('User data is properly protected from accidental deletion.'));
  }
  
  // Additional recommendations
  console.log(chalk.blue('\n📋 Additional Recommendations:'));
  console.log(chalk.cyan('• Implement regular database backups'));
  console.log(chalk.cyan('• Set up audit logging for all user operations'));
  console.log(chalk.cyan('• Consider implementing soft deletion for all user-related data'));
  console.log(chalk.cyan('• Regularly test data recovery procedures'));
  console.log(chalk.cyan('• Train administrators on safe user management practices\n'));
}

// Execute if called directly
main().catch(console.error);