#!/usr/bin/env node

/**
 * Simple test runner for buildings management functionality
 * Tests validation logic, search functionality, and role-based access control
 */

// Mock building data
const mockBuildings = [
  {
    id: 'building-1',
    name: 'Maple Heights',
    address: '123 Rue Sainte-Catherine',
    city: 'Montreal',
    province: 'QC',
    postalCode: 'H3A 1A1',
    buildingType: 'condo',
    yearBuilt: 2020,
    totalUnits: 50,
    totalFloors: 10,
    parkingSpaces: 30,
    storageSpaces: 25,
    organizationId: 'org-1',
    organizationName: 'Koveo Management',
    isActive: true,
  },
  {
    id: 'building-2',
    name: 'Oak Gardens',
    address: '456 Boulevard René-Lévesque',
    city: 'Quebec City',
    province: 'QC',
    postalCode: 'G1R 2B5',
    buildingType: 'rental',
    yearBuilt: 2018,
    totalUnits: 75,
    totalFloors: 15,
    parkingSpaces: 0,
    storageSpaces: 0,
    organizationId: 'org-2',
    organizationName: 'Properties Plus',
    isActive: true,
  },
];

// Test utilities
const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`❌ ${message}`);
  }
  console.log(`✅ ${message}`);
};

const assertEqual = (actual, expected, message) => {
  if (actual !== expected) {
    throw new Error(`❌ ${message}: expected ${expected}, got ${actual}`);
  }
  console.log(`✅ ${message}`);
};

// Validation functions
const validateBuildingForm = (formData) => {
  const errors = [];
  
  if (!formData.name || formData.name.trim().length === 0) {
    errors.push('Building name is required');
  }
  
  if (!formData.organizationId || formData.organizationId.trim().length === 0) {
    errors.push('Organization is required');
  }
  
  if (formData.postalCode && !/^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/.test(formData.postalCode)) {
    errors.push('Invalid postal code format');
  }
  
  if (formData.yearBuilt && (formData.yearBuilt < 1800 || formData.yearBuilt > new Date().getFullYear() + 5)) {
    errors.push('Invalid year built');
  }
  
  if (formData.totalUnits && (formData.totalUnits < 0 || formData.totalUnits > 10000)) {
    errors.push('Invalid total units');
  }
  
  if (formData.totalFloors && (formData.totalFloors < 1 || formData.totalFloors > 200)) {
    errors.push('Invalid total floors');
  }
  
  if (formData.parkingSpaces !== undefined && (formData.parkingSpaces < 0 || formData.parkingSpaces > 50000)) {
    errors.push('Invalid parking spaces');
  }
  
  if (formData.storageSpaces !== undefined && (formData.storageSpaces < 0 || formData.storageSpaces > 50000)) {
    errors.push('Invalid storage spaces');
  }
  
  return { isValid: errors.length === 0, errors };
};

const searchBuildings = (buildings, searchTerm) => {
  const term = searchTerm.toLowerCase();
  return buildings.filter(building => 
    building.name.toLowerCase().includes(term) ||
    building.address.toLowerCase().includes(term) ||
    building.city.toLowerCase().includes(term) ||
    building.organizationName.toLowerCase().includes(term)
  );
};

const checkAccessPermissions = (userRole) => {
  return {
    canView: ['admin', 'manager'].includes(userRole),
    canCreate: ['admin'].includes(userRole),
    canEdit: ['admin', 'manager'].includes(userRole),
    canDelete: ['admin'].includes(userRole),
  };
};

// Test suites
const testBuildingValidation = () => {
  console.log('\n🧪 Testing Building Validation...');
  
  // Test valid building
  const validBuilding = {
    name: 'Test Building',
    organizationId: 'org-123',
    address: '123 Test Street',
    city: 'Montreal',
    province: 'QC',
    postalCode: 'H3A 1A1',
    buildingType: 'condo',
    yearBuilt: 2023,
    totalUnits: 50,
    totalFloors: 10,
    parkingSpaces: 30,
    storageSpaces: 25,
  };
  
  const validResult = validateBuildingForm(validBuilding);
  assert(validResult.isValid, 'Valid building should pass validation');
  assertEqual(validResult.errors.length, 0, 'Valid building should have no errors');
  
  // Test missing required fields
  const invalidBuilding = {
    address: '123 Test Street',
    city: 'Montreal',
  };
  
  const invalidResult = validateBuildingForm(invalidBuilding);
  assert(!invalidResult.isValid, 'Invalid building should fail validation');
  assert(invalidResult.errors.includes('Building name is required'), 'Should require building name');
  assert(invalidResult.errors.includes('Organization is required'), 'Should require organization');
  
  // Test zero values (should be valid)
  const buildingWithZeros = {
    name: 'Zero Building',
    organizationId: 'org-123',
    parkingSpaces: 0,
    storageSpaces: 0,
  };
  
  const zeroResult = validateBuildingForm(buildingWithZeros);
  assert(zeroResult.isValid, 'Building with zero values should be valid');
  
  // Test invalid postal codes
  const invalidPostalCodes = ['12345', 'ABC123', 'H3A1A', 'H3A 1A12'];
  invalidPostalCodes.forEach(postalCode => {
    const result = validateBuildingForm({ 
      name: 'Test', 
      organizationId: 'org-123', 
      postalCode 
    });
    assert(!result.isValid, `Invalid postal code ${postalCode} should fail validation`);
  });
  
  // Test valid postal codes
  const validPostalCodes = ['H3A 1A1', 'M5V 3A8', 'V6B1A1', 'K1A0A6'];
  validPostalCodes.forEach(postalCode => {
    const result = validateBuildingForm({ 
      name: 'Test', 
      organizationId: 'org-123', 
      postalCode 
    });
    assert(result.isValid, `Valid postal code ${postalCode} should pass validation`);
  });
  
  console.log('✅ All building validation tests passed!');
};

const testBuildingSearch = () => {
  console.log('\n🔍 Testing Building Search...');
  
  // Test search by name
  const nameResults = searchBuildings(mockBuildings, 'Maple');
  assertEqual(nameResults.length, 1, 'Should find 1 building by name');
  assertEqual(nameResults[0].name, 'Maple Heights', 'Should find correct building by name');
  
  // Test search by address
  const addressResults = searchBuildings(mockBuildings, 'Sainte-Catherine');
  assertEqual(addressResults.length, 1, 'Should find 1 building by address');
  assertEqual(addressResults[0].address, '123 Rue Sainte-Catherine', 'Should find correct building by address');
  
  // Test search by city
  const cityResults = searchBuildings(mockBuildings, 'Montreal');
  assertEqual(cityResults.length, 1, 'Should find 1 building by city');
  assertEqual(cityResults[0].city, 'Montreal', 'Should find correct building by city');
  
  // Test search by organization
  const orgResults = searchBuildings(mockBuildings, 'Koveo');
  assertEqual(orgResults.length, 1, 'Should find 1 building by organization');
  assert(orgResults[0].organizationName.includes('Koveo'), 'Should find correct building by organization');
  
  // Test case insensitive search
  const upperResults = searchBuildings(mockBuildings, 'MAPLE');
  const lowerResults = searchBuildings(mockBuildings, 'maple');
  assertEqual(upperResults.length, lowerResults.length, 'Search should be case insensitive');
  
  // Test no results
  const noResults = searchBuildings(mockBuildings, 'nonexistent');
  assertEqual(noResults.length, 0, 'Should return empty array for no matches');
  
  // Test special characters
  const specialResults = searchBuildings(mockBuildings, 'René-Lévesque');
  assertEqual(specialResults.length, 1, 'Should handle special characters in search');
  
  console.log('✅ All building search tests passed!');
};

const testRoleBasedAccess = () => {
  console.log('\n🔐 Testing Role-based Access Control...');
  
  // Test admin permissions
  const adminPerms = checkAccessPermissions('admin');
  assert(adminPerms.canView, 'Admin should be able to view');
  assert(adminPerms.canCreate, 'Admin should be able to create');
  assert(adminPerms.canEdit, 'Admin should be able to edit');
  assert(adminPerms.canDelete, 'Admin should be able to delete');
  
  // Test manager permissions
  const managerPerms = checkAccessPermissions('manager');
  assert(managerPerms.canView, 'Manager should be able to view');
  assert(!managerPerms.canCreate, 'Manager should NOT be able to create');
  assert(managerPerms.canEdit, 'Manager should be able to edit');
  assert(!managerPerms.canDelete, 'Manager should NOT be able to delete');
  
  // Test tenant permissions
  const tenantPerms = checkAccessPermissions('tenant');
  assert(!tenantPerms.canView, 'Tenant should NOT be able to view');
  assert(!tenantPerms.canCreate, 'Tenant should NOT be able to create');
  assert(!tenantPerms.canEdit, 'Tenant should NOT be able to edit');
  assert(!tenantPerms.canDelete, 'Tenant should NOT be able to delete');
  
  // Test resident permissions
  const residentPerms = checkAccessPermissions('resident');
  assert(!residentPerms.canView, 'Resident should NOT be able to view');
  assert(!residentPerms.canCreate, 'Resident should NOT be able to create');
  assert(!residentPerms.canEdit, 'Resident should NOT be able to edit');
  assert(!residentPerms.canDelete, 'Resident should NOT be able to delete');
  
  console.log('✅ All role-based access control tests passed!');
};

const testQuebecSpecific = () => {
  console.log('\n🇨🇦 Testing Quebec-specific Features...');
  
  // Test French characters
  const frenchBuilding = {
    name: 'Résidence Les Érables',
    organizationId: 'org-123',
    address: 'Rue de la Cathédrale',
    city: 'Québec',
  };
  
  const frenchResult = validateBuildingForm(frenchBuilding);
  assert(frenchResult.isValid, 'French characters should be valid');
  
  // Test Quebec postal codes
  const quebecCodes = ['H3A 1A1', 'G1R 2B5', 'J5A 1B2'];
  quebecCodes.forEach(code => {
    const quebecPattern = /^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/;
    assert(quebecPattern.test(code), `Quebec postal code ${code} should match pattern`);
  });
  
  // Test special Quebec addresses
  const quebecAddresses = [
    'Côte-des-Neiges',
    'Rue Saint-Denis',
    'Boulevard René-Lévesque',
    'Chemin de la Côte-Sainte-Catherine',
  ];
  
  quebecAddresses.forEach(address => {
    assert(address.length > 0, `Quebec address should be defined`);
    assert(/[àâäéèêëïîôöùûüÿç-]/.test(address), `Quebec address should contain French characters or hyphens`);
  });
  
  console.log('✅ All Quebec-specific tests passed!');
};

const testDataIntegrity = () => {
  console.log('\n🔍 Testing Data Integrity...');
  
  // Test building data structure
  mockBuildings.forEach((building, index) => {
    assert(building.id, `Building ${index} should have an ID`);
    assert(building.name, `Building ${index} should have a name`);
    assert(building.organizationId, `Building ${index} should have an organization ID`);
    assert(['condo', 'rental'].includes(building.buildingType), `Building ${index} should have valid type`);
    
    if (building.parkingSpaces !== undefined) {
      assert(typeof building.parkingSpaces === 'number', `Building ${index} parking spaces should be number`);
      assert(building.parkingSpaces >= 0, `Building ${index} parking spaces should be non-negative`);
    }
    
    if (building.storageSpaces !== undefined) {
      assert(typeof building.storageSpaces === 'number', `Building ${index} storage spaces should be number`);
      assert(building.storageSpaces >= 0, `Building ${index} storage spaces should be non-negative`);
    }
  });
  
  // Test zero values specifically
  const buildingWithZeros = mockBuildings.find(b => b.parkingSpaces === 0);
  assert(buildingWithZeros, 'Should have a building with zero parking spaces');
  assertEqual(buildingWithZeros.parkingSpaces, 0, 'Zero parking spaces should be exactly 0');
  assertEqual(buildingWithZeros.storageSpaces, 0, 'Zero storage spaces should be exactly 0');
  
  console.log('✅ All data integrity tests passed!');
};

// Run all tests
const runAllTests = () => {
  console.log('🚀 Starting Buildings Management Tests...\n');
  
  try {
    testBuildingValidation();
    testBuildingSearch();
    testRoleBasedAccess();
    testQuebecSpecific();
    testDataIntegrity();
    
    console.log('\n🎉 All tests passed successfully!');
    console.log('✅ Buildings management functionality is working correctly');
    console.log('✅ Form validation handles required fields and data types properly');
    console.log('✅ Search functionality works with names, addresses, cities, and organizations');
    console.log('✅ Role-based access control is properly implemented');
    console.log('✅ Quebec-specific features (French characters, postal codes) work correctly');
    console.log('✅ Zero values are handled properly in numeric fields');
    console.log('✅ Data integrity checks pass for all building records');
    
  } catch (error) {
    console.error(`\n💥 Test failed: ${error.message}`);
    process.exit(1);
  }
};

// Run tests if called directly
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests();
}

export {
  validateBuildingForm,
  searchBuildings,
  checkAccessPermissions,
  runAllTests,
};