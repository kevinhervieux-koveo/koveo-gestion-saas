import { validatePermissions, checkPermission, getRolePermissions } from './permissions-schema';
import permissionsData from './permissions.json';

/**
 * Simple test script to verify permissions system is working correctly.
 */
async function testPermissions() {
  console.log('🔐 Testing Koveo Gestion Permissions System\n');

  // Test 1: Validate the permissions.json structure
  console.log('1. Validating permissions.json structure...');
  const validation = validatePermissions(permissionsData);
  
  if (validation.success) {
    console.log('   ✅ Permissions structure is valid');
  } else {
    console.log('   ❌ Validation failed:');
    validation.error.issues.forEach(issue => {
      console.log(`     - ${issue.path.join('.')}: ${issue.message}`);
    });
    return false;
  }

  // Test 2: Check that all roles exist
  console.log('\n2. Checking role completeness...');
  const requiredRoles = ['admin', 'manager', 'owner', 'tenant'];
  const availableRoles = Object.keys(permissionsData);
  const missingRoles = requiredRoles.filter(role => !availableRoles.includes(role));
  
  if (missingRoles.length === 0) {
    console.log('   ✅ All required roles are present');
  } else {
    console.log(`   ❌ Missing roles: ${missingRoles.join(', ')}`);
    return false;
  }

  // Test 3: Check permission hierarchy (admin should have most permissions)
  console.log('\n3. Checking permission hierarchy...');
  const adminPerms = new Set(permissionsData.admin);
  const managerPerms = new Set(permissionsData.manager);
  const ownerPerms = new Set(permissionsData.owner);
  const tenantPerms = new Set(permissionsData.tenant);

  console.log(`   Admin permissions: ${adminPerms.size}`);
  console.log(`   Manager permissions: ${managerPerms.size}`);
  console.log(`   Owner permissions: ${ownerPerms.size}`);
  console.log(`   Tenant permissions: ${tenantPerms.size}`);

  if (adminPerms.size >= managerPerms.size && managerPerms.size >= ownerPerms.size && ownerPerms.size >= tenantPerms.size) {
    console.log('   ✅ Permission hierarchy looks correct');
  } else {
    console.log('   ⚠️  Permission hierarchy might need review');
  }

  // Test 4: Test specific permission checks
  console.log('\n4. Testing specific permission checks...');
  
  const testCases = [
    { role: 'admin', permission: 'delete:user', expected: true },
    { role: 'manager', permission: 'read:bill', expected: true },
    { role: 'owner', permission: 'create:budget', expected: true },
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
      console.log(`   ✅ ${test.role} ${test.expected ? 'has' : 'does not have'} ${test.permission}`);
    } else {
      console.log(`   ❌ ${test.role} permission check failed for ${test.permission}`);
      allTestsPassed = false;
    }
  }

  // Test 5: Check for critical permissions
  console.log('\n5. Checking critical permissions...');
  const criticalPermissions = [
    { role: 'admin', permissions: ['read:user', 'create:user', 'update:user', 'delete:user'] },
    { role: 'manager', permissions: ['read:building', 'create:maintenance_request', 'read:bill'] },
    { role: 'owner', permissions: ['read:budget', 'create:budget', 'read:maintenance_request'] },
    { role: 'tenant', permissions: ['read:profile', 'update:profile', 'create:maintenance_request'] }
  ];

  for (const { role, permissions } of criticalPermissions) {
    const rolePermissions = getRolePermissions(validation.data!, role as any);
    const missingCritical = permissions.filter(p => !rolePermissions.includes(p as any));
    
    if (missingCritical.length === 0) {
      console.log(`   ✅ ${role} has all critical permissions`);
    } else {
      console.log(`   ⚠️  ${role} missing critical permissions: ${missingCritical.join(', ')}`);
    }
  }

  console.log('\n📋 Test Summary:');
  if (allTestsPassed) {
    console.log('   ✅ All tests passed! Permissions system is working correctly.');
    return true;
  } else {
    console.log('   ⚠️  Some tests failed. Please review the permissions configuration.');
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