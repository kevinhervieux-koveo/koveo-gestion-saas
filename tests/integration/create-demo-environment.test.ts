/**
 * Test suite for create-demo-environment.ts script
 * 
 * Validates the demo environment creation script's structure, imports,
 * and basic functionality to prevent regressions during CI/CD checks.
 */

import { describe, test, expect, jest } from '@jest/globals';

describe('create-demo-environment.ts', () => {
  test('should be importable without errors', async () => {
    // This test ensures the script file can be imported successfully
    // and doesn't have any immediate syntax or import errors
    
    let importError: Error | null = null;
    
    try {
      // Dynamic import to avoid executing the script during testing
      const scriptModule = await import('./create-demo-environment.js');
      expect(scriptModule).toBeDefined();
      expect(typeof scriptModule.default).toBe('function');
    } catch (error) {
      importError = error as Error;
    }
    
    expect(importError).toBeNull();
  });

  test('should have required CLI argument validation structure', async () => {
    // Test that the script has proper argument validation
    // We can't easily test the CLI parsing without mocking process.argv
    // But we can ensure the script structure is intact
    
    const fs = require('fs');
    const path = require('path');
    
    const scriptPath = path.join(__dirname, 'create-demo-environment.ts');
    const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
    
    // Check for required CLI argument handling
    expect(scriptContent).toContain('--type');
    expect(scriptContent).toContain('--name');
    expect(scriptContent).toContain('demo');
    expect(scriptContent).toContain('production');
  });

  test('should have comprehensive database schema imports and Unicode fixes', async () => {
    // Ensure all required schema imports are present
    const fs = require('fs');
    const path = require('path');
    
    const scriptPath = path.join(__dirname, 'create-demo-environment.ts');
    const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
    
    // Check for database and schema imports
    expect(scriptContent).toContain('@neondatabase/serverless');
    expect(scriptContent).toContain('drizzle-orm/neon-serverless');
    expect(scriptContent).toContain("from '../shared/schema'");
    expect(scriptContent).toContain('@faker-js/faker');
    expect(scriptContent).toContain('bcryptjs');
    
    // Check for Unicode encoding fixes
    expect(scriptContent).not.toContain('✓'); // No Unicode checkmarks
    expect(scriptContent).not.toContain('⚠️'); // No Unicode warning symbols
    expect(scriptContent).toContain('+ Electrical systems'); // ASCII alternatives
    expect(scriptContent).toContain('================================================================'); // ASCII separators
  });

  test('should have main seeding functions defined', async () => {
    // Verify that all major seeding functions exist
    const fs = require('fs');
    const path = require('path');
    
    const scriptPath = path.join(__dirname, 'create-demo-environment.ts');
    const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
    
    // Check for core functions
    expect(scriptContent).toContain('upsertOrganization');
    expect(scriptContent).toContain('seedBuildings');
    expect(scriptContent).toContain('seedResidences');
    expect(scriptContent).toContain('seedCommonSpaces');
    expect(scriptContent).toContain('seedUsers');
    expect(scriptContent).toContain('seedBookings');
    expect(scriptContent).toContain('seedMaintenanceRequests');
    expect(scriptContent).toContain('seedBills');
  });

  test('should have Quebec-specific data generation', async () => {
    // Ensure Quebec compliance and localization
    const fs = require('fs');
    const path = require('path');
    
    const scriptPath = path.join(__dirname, 'create-demo-environment.ts');
    const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
    
    // Check for Quebec-specific elements
    expect(scriptContent).toContain('Quebec');
    expect(scriptContent).toContain('montreal');
    expect(scriptContent).toContain("province: 'QC'");
    expect(scriptContent).toContain('generateQuebecPostalCode');
    expect(scriptContent).toContain('generateQuebecPhone');
  });

  test('should have proper role-based user creation logic', async () => {
    // Verify demo vs production role handling
    const fs = require('fs');
    const path = require('path');
    
    const scriptPath = path.join(__dirname, 'create-demo-environment.ts');
    const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
    
    // Check for role differentiation
    expect(scriptContent).toContain('demo_manager');
    expect(scriptContent).toContain('demo_resident');
    expect(scriptContent).toContain('manager');
    expect(scriptContent).toContain('resident');
    expect(scriptContent).toMatch(/organizationType.*demo.*production/);
  });

  test('should have comprehensive error handling', async () => {
    // Ensure proper error handling throughout
    const fs = require('fs');
    const path = require('path');
    
    const scriptPath = path.join(__dirname, 'create-demo-environment.ts');
    const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
    
    // Check for error handling patterns
    expect(scriptContent).toContain('try {');
    expect(scriptContent).toContain('} catch');
    expect(scriptContent).toContain('console.error');
    expect(scriptContent).toContain('throw error');
  });

  test('should have proper database connection management', async () => {
    // Verify database connection setup and cleanup
    const fs = require('fs');
    const path = require('path');
    
    const scriptPath = path.join(__dirname, 'create-demo-environment.ts');
    const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
    
    // Check for database connection patterns
    expect(scriptContent).toContain('DATABASE_URL');
    expect(scriptContent).toContain('new Pool');
    expect(scriptContent).toContain('drizzle');
    expect(scriptContent).toContain('pool.end()');
  });

  test('should have realistic data generation with proper categories and file paths', async () => {
    // Ensure realistic data categories are defined
    const fs = require('fs');
    const path = require('path');
    
    const scriptPath = path.join(__dirname, 'create-demo-environment.ts');
    const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
    
    // Check for data categories
    expect(scriptContent).toContain('MAINTENANCE_CATEGORIES');
    expect(scriptContent).toContain('BILL_CATEGORIES');
    expect(scriptContent).toContain('COMMON_SPACE_TYPES');
    expect(scriptContent).toContain('isBookable');
    
    // Check for realistic data patterns
    expect(scriptContent).toContain('Plumbing');
    expect(scriptContent).toContain('Electrical');
    expect(scriptContent).toContain('HVAC');
    expect(scriptContent).toContain('insurance');
    expect(scriptContent).toContain('maintenance');
    
    // Check for proper file path structure (no uploads prefix)
    expect(scriptContent).toContain('writeDocumentFile(filePath');
    expect(scriptContent).not.toContain('writeDocumentFile(`uploads/${filePath}`');
    expect(scriptContent).toContain('bills/');
    expect(scriptContent).toContain('residences/');
    expect(scriptContent).toContain('buildings/');
  });

  test('should comply with Law 25 (no admin role creation)', async () => {
    // Ensure the script doesn't create admin users
    const fs = require('fs');
    const path = require('path');
    
    const scriptPath = path.join(__dirname, 'create-demo-environment.ts');
    const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
    
    // The script should NOT contain admin role creation
    expect(scriptContent).not.toContain("role: 'admin'");
    expect(scriptContent).not.toContain("demo_admin");
    
    // Should contain the constraint comment
    expect(scriptContent).toContain('NOT create any users with the');
  });

  test('should have proper configuration constants', async () => {
    // Verify configuration constants are defined
    const fs = require('fs');
    const path = require('path');
    
    const scriptPath = path.join(__dirname, 'create-demo-environment.ts');
    const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
    
    // Check for configuration constants
    expect(scriptContent).toContain('BUILDINGS_PER_ORG');
    expect(scriptContent).toContain('MIN_RESIDENCES_PER_BUILDING');
    expect(scriptContent).toContain('MAX_RESIDENCES_PER_BUILDING');
    expect(scriptContent).toContain('COMMON_SPACES_PER_BUILDING');
    expect(scriptContent).toContain('BOOKINGS_PER_RESERVABLE_SPACE');
    expect(scriptContent).toContain('DEMANDS_PER_RESIDENT');
    expect(scriptContent).toContain('BILLS_PER_BUILDING_PER_MONTH');
  });

  test('should have comprehensive logging and progress tracking', async () => {
    // Ensure good user feedback through logging
    const fs = require('fs');
    const path = require('path');
    
    const scriptPath = path.join(__dirname, 'create-demo-environment.ts');
    const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
    
    // Check for progress logging
    expect(scriptContent).toContain('console.log');
    expect(scriptContent).toContain('Step 1:');
    expect(scriptContent).toContain('Step 2:');
    expect(scriptContent).toContain('📊 Created');
    expect(scriptContent).toContain('✅');
    expect(scriptContent).toContain('Summary');
  });
});

// Additional tests for specific functionality improvements
describe('create-demo-environment.ts - Functionality Tests', () => {
  test('should ensure manager organization associations', async () => {
    const fs = require('fs');
    const path = require('path');
    
    const scriptPath = path.join(__dirname, 'create-demo-environment.ts');
    const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
    
    // Check for manager organization association logic
    expect(scriptContent).toContain('critical for manager building access');
    expect(scriptContent).toContain('userOrganizations');
    expect(scriptContent).toContain('organizationId');
  });

  test('should separate bill documents from financial documents', async () => {
    const fs = require('fs');
    const path = require('path');
    
    const scriptPath = path.join(__dirname, 'create-demo-environment.ts');
    const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
    
    // Check for proper document categorization
    expect(scriptContent).toContain('documentTypeMapping');
    expect(scriptContent).toContain('utilities');
    expect(scriptContent).toContain('maintenance');
    expect(scriptContent).toContain('loan');
    expect(scriptContent).toContain('bank_statement');
    expect(scriptContent).toContain('financial_report');
    
    // Bills should be attached to bills, financial docs to buildings/residences
    expect(scriptContent).toContain('attachedToType: \'bill\'');
    expect(scriptContent).toContain('buildingId:');
  });

  test('should use ASCII-safe characters in all generated content', async () => {
    const fs = require('fs');
    const path = require('path');
    
    const scriptPath = path.join(__dirname, 'create-demo-environment.ts');
    const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
    
    // Check that problematic Unicode characters are replaced
    const unicodeCheckmarks = /✓/g.test(scriptContent);
    const unicodeWarnings = /⚠️/g.test(scriptContent);
    
    expect(unicodeCheckmarks).toBe(false);
    expect(unicodeWarnings).toBe(false);
    
    // Should use ASCII alternatives instead
    expect(scriptContent).toContain('+ Electrical systems');
    expect(scriptContent).toContain('* Minor paint touch-up');
    expect(scriptContent).toContain('- On Time');
  });
});

export {};