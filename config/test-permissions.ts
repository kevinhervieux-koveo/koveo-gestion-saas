import { validatePermissions, checkPermission, getRolePermissions } from './permissions-schema';
import permissionsData from './permissions.json';

/**
 * Simple test script to verify permissions system is working correctly.
 */
async function testPermissions() {
  console.warn('🔐 Testing Koveo Gestion Permissions System\n');

  // Test 1: Validate the permissions.json structure
  console.warn('1. Validating permissions.json structure...');
  const validation = validatePermissions(permissionsData);
  
  if (validation.success) {
    console.warn('   ✅ Permissions structure is valid');
  } else {
    console.error('   ❌ Validation failed:');
    validation.error.issues.forEach(issue => {
      console.error(`     - ${issue.path.join('.')}: ${issue.message}`);
    });
    return false;
  }

  // Test 2: Check that all roles exist
  console.warn('\n2. Checking role completeness...');
  const requiredRoles = ['admin', 'manager', 'tenant'];
  const availableRoles = Object.keys(permissionsData);
  const missingRoles = requiredRoles.filter(role => !availableRoles.includes(role));
  
  if (missingRoles.length === 0) {
    console.warn('   ✅ All required roles are present');
  } else {
    console.error(`   ❌ Missing roles: ${missingRoles.join(', ')}`);
    return false;
  }

  // Test 3: Check permission hierarchy (admin should have most permissions)
  console.warn('\n3. Checking permission hierarchy...');
  const adminPerms = new Set(permissionsData.admin);
  const managerPerms = new Set(permissionsData.manager);
  const adminPerms2 = new Set(permissionsData.admin);
  const tenantPerms = new Set(permissionsData.tenant);

  console.warn(`   Admin permissions: ${adminPerms.size}`);
  console.warn(`   Manager permissions: ${managerPerms.size}`);
  console.warn(`   Tenant permissions: ${tenantPerms.size}`);

  if (adminPerms.size >= managerPerms.size && managerPerms.size >= tenantPerms.size) {
    console.warn('   ✅ Permission hierarchy looks correct');
  } else {
    console.warn('   ⚠️  Permission hierarchy might need review');
  }

  // Test 4: Test specific permission checks
  console.warn('\n4. Testing specific permission checks...');
  
  const testCases = [
    { role: 'admin', permission: 'delete:user', expected: true },
    { role: 'manager', permission: 'read:bill', expected: true },
    { role: 'admin', permission: 'create:budget', expected: true },
    { role: 'tenant', permission: 'read:profile', expected: true },
    { role: 'tenant', permission: 'delete:user', expected: false }
  ];

  let allTestsPassed = true;
  for (const test of testCases) {
    const hasPermission = checkPermission(
      validation.data!,
      test.role as any,
      test.permission as any
    );
    
    if (hasPermission === test.expected) {
      console.warn(`   ✅ ${test.role} ${test.expected ? 'has' : 'does not have'} ${test.permission}`);
    } else {
      console.error(`   ❌ ${test.role} permission check failed for ${test.permission}`);
      allTestsPassed = false;
    }
  }

  // Test 5: Check for critical permissions
  console.warn('\n5. Checking critical permissions...');
  const criticalPermissions = [
    { role: 'admin', permissions: ['read:user', 'create:user', 'update:user', 'delete:user'] },
    { role: 'manager', permissions: ['read:building', 'create:maintenance_request', 'read:bill'] },
    { role: 'admin', permissions: ['read:budget', 'create:budget', 'read:maintenance_request'] },
    { role: 'tenant', permissions: ['read:profile', 'update:profile', 'create:maintenance_request'] }
  ];

  for (const { role, permissions } of criticalPermissions) {
    const rolePermissions = getRolePermissions(validation.data!, role as any);
    const missingCritical = permissions.filter(p => !rolePermissions.includes(p as any));
    
    if (missingCritical.length === 0) {
      console.warn(`   ✅ ${role} has all critical permissions`);
    } else {
      console.warn(`   ⚠️  ${role} missing critical permissions: ${missingCritical.join(', ')}`);
    }
  }

  console.warn('\n📋 Test Summary:');
  if (allTestsPassed) {
    console.warn('   ✅ All tests passed! Permissions system is working correctly.');
    return true;
  } else {
    console.warn('   ⚠️  Some tests failed. Please review the permissions configuration.');
    return false;
  }
}

// Run tests
testPermissions().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});