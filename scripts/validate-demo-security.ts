#!/usr/bin/env tsx

/**
 * Demo Security Validation Script
 * 
 * This script validates that demo user restrictions are properly implemented
 * and working across the application. It can be run manually or as part of CI/CD
 * to ensure demo users maintain view-only access.
 */

import { db } from '../server/db';
import * as schema from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import { isOpenDemoUser, canUserPerformWriteOperation } from '../server/rbac';
import chalk from 'chalk';

interface ValidationResult {
  test: string;
  passed: boolean;
  message: string;
}

async function validateDemoUsers(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  
  console.log(chalk.blue('🔍 Validating demo user security restrictions...\n'));
  
  try {
    // Test 1: Find demo organizations
    const demoOrgs = await db.query.organizations.findMany({
      where: eq(schema.organizations.name, 'Open Demo')
    });
    
    results.push({
      test: 'Demo Organization Exists',
      passed: demoOrgs.length > 0,
      message: demoOrgs.length > 0 
        ? `Found ${demoOrgs.length} demo organization(s)`
        : 'No demo organizations found - demo users may not be properly configured'
    });
    
    if (demoOrgs.length === 0) {
      results.push({
        test: 'Demo User Validation',
        passed: false,
        message: 'Cannot test demo users without demo organization'
      });
      return results;
    }
    
    const demoOrg = demoOrgs[0];
    
    // Test 2: Find demo users
    const demoUsers = await db.query.users.findMany({
      where: or(
        eq(schema.users.role, 'demo_manager'),
        eq(schema.users.role, 'demo_tenant'), 
        eq(schema.users.role, 'demo_resident')
      )
    });
    
    results.push({
      test: 'Demo Users Exist',
      passed: demoUsers.length > 0,
      message: demoUsers.length > 0
        ? `Found ${demoUsers.length} demo user(s)`
        : 'No demo users found'
    });
    
    // Test 3: Validate demo users are identified as Open Demo users
    let openDemoUserCount = 0;
    for (const user of demoUsers) {
      const isOpenDemo = await isOpenDemoUser(user.id);
      if (isOpenDemo) openDemoUserCount++;
    }
    
    results.push({
      test: 'Demo User Identification',
      passed: openDemoUserCount === demoUsers.length,
      message: `${openDemoUserCount}/${demoUsers.length} demo users correctly identified as Open Demo users`
    });
    
    // Test 4: Validate write operation restrictions
    let writeRestrictedCount = 0;
    const writeOperations: Array<'create' | 'update' | 'delete' | 'manage'> = ['create', 'update', 'delete', 'manage'];
    
    for (const user of demoUsers) {
      let allRestricted = true;
      for (const operation of writeOperations) {
        const canPerform = await canUserPerformWriteOperation(user.id, operation);
        if (canPerform) {
          allRestricted = false;
          break;
        }
      }
      if (allRestricted) writeRestrictedCount++;
    }
    
    results.push({
      test: 'Write Operation Restrictions',
      passed: writeRestrictedCount === demoUsers.length,
      message: `${writeRestrictedCount}/${demoUsers.length} demo users have proper write restrictions`
    });
    
    // Test 5: Check demo user organization assignments
    const demoUserOrgAssignments = await db.query.userOrganizations.findMany({
      where: and(
        eq(schema.userOrganizations.organizationId, demoOrg.id),
        eq(schema.userOrganizations.isActive, true)
      )
    });
    
    results.push({
      test: 'Demo User Organization Assignment',
      passed: demoUserOrgAssignments.length > 0,
      message: `${demoUserOrgAssignments.length} users assigned to demo organization`
    });
    
    // Test 6: Validate role-based restrictions
    const demoRoles = ['demo_manager', 'demo_tenant', 'demo_resident'];
    const roleCount = await db.select({ count: sql`count(*)` }).from(schema.users)
      .where(inArray(schema.users.role, demoRoles));
    
    results.push({
      test: 'Demo Role Types',
      passed: roleCount[0].count > 0,
      message: `Found users with demo roles: ${roleCount[0].count} total`
    });
    
  } catch (error) {
    results.push({
      test: 'Database Connection',
      passed: false,
      message: `Database error: ${error.message}`
    });
  }
  
  return results;
}

async function generateSecurityReport(): Promise<void> {
  console.log(chalk.cyan('📊 Generating Demo Security Report\n'));
  
  try {
    // Count all endpoints that should have demo restrictions
    const totalUsers = await db.select({ count: sql`count(*)` }).from(schema.users);
    const demoUsers = await db.select({ count: sql`count(*)` }).from(schema.users)
      .where(or(
        eq(schema.users.role, 'demo_manager'),
        eq(schema.users.role, 'demo_tenant'),
        eq(schema.users.role, 'demo_resident')
      ));
    
    const regularUsers = totalUsers[0].count - demoUsers[0].count;
    
    const report = {
      timestamp: new Date().toISOString(),
      totalUsers: totalUsers[0].count,
      demoUsers: demoUsers[0].count,
      regularUsers: regularUsers,
      demoUserPercentage: totalUsers[0].count > 0 
        ? ((demoUsers[0].count / totalUsers[0].count) * 100).toFixed(2)
        : '0.00',
      securityStatus: 'Under Review'
    };
    
    console.log(chalk.white('📈 User Distribution:'));
    console.log(`   Total Users: ${report.totalUsers}`);
    console.log(`   Demo Users: ${report.demoUsers} (${report.demoUserPercentage}%)`);
    console.log(`   Regular Users: ${report.regularUsers}`);
    console.log('');
    
  } catch (error) {
    console.error(chalk.red('❌ Error generating security report:'), error);
  }
}

async function main(): Promise<void> {
  console.log(chalk.bold.blue('🛡️  Demo Security Validation Tool\n'));
  
  const results = await validateDemoUsers();
  await generateSecurityReport();
  
  console.log(chalk.cyan('🔍 Validation Results:\n'));
  
  let passedCount = 0;
  let failedCount = 0;
  
  for (const result of results) {
    const icon = result.passed ? chalk.green('✅') : chalk.red('❌');
    const status = result.passed ? chalk.green('PASS') : chalk.red('FAIL');
    
    console.log(`${icon} ${result.test}: ${status}`);
    console.log(`   ${result.message}\n`);
    
    if (result.passed) {
      passedCount++;
    } else {
      failedCount++;
    }
  }
  
  console.log(chalk.bold('📊 Summary:'));
  console.log(`   ${chalk.green('✅ Passed:')} ${passedCount}`);
  console.log(`   ${chalk.red('❌ Failed:')} ${failedCount}`);
  console.log(`   ${chalk.blue('📈 Success Rate:')} ${((passedCount / results.length) * 100).toFixed(1)}%\n`);
  
  if (failedCount > 0) {
    console.log(chalk.yellow('⚠️  Security Issues Detected:'));
    console.log('   Some demo user restrictions may not be properly configured.');
    console.log('   Review the failed tests above and ensure proper security measures are in place.\n');
    process.exit(1);
  } else {
    console.log(chalk.green('🎉 All demo security validations passed!'));
    console.log('   Demo users are properly restricted to view-only access.\n');
  }
}

// Add missing imports
import { sql, or, inArray } from 'drizzle-orm';

if (import.meta.main) {
  main().catch(error => {
    console.error(chalk.red('❌ Validation failed:'), error);
    process.exit(1);
  });
}

export { validateDemoUsers, generateSecurityReport };