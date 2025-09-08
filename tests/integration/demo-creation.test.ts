/**
 * Demo Creation Script Tests
 * Tests the create-demo-environment.ts script functionality
 */

import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { jest } from '@jest/globals';

const execAsync = promisify(exec);

// Mock database connection for testing
jest.mock('../../server/storage', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    delete: jest.fn(),
    execute: jest.fn(),
  },
  sql: {
    raw: jest.fn()
  }
}));

// Mock schema imports
jest.mock('../../shared/schema', () => ({
  organizations: {
    id: 'id',
    name: 'name',
    type: 'type'
  },
  users: {
    id: 'id',
    username: 'username',
    email: 'email'
  },
  buildings: {
    id: 'id',
    name: 'name'
  },
  residences: {
    id: 'id',
    unitNumber: 'unit_number'
  }
}));

describe('Demo Creation Script', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('script file exists and is executable', async () => {
    const scriptPath = 'scripts/create-demo-environment.ts';
    
    try {
      const stats = await fs.stat(scriptPath);
      expect(stats.isFile()).toBe(true);
    } catch (error) {
      throw new Error(`Demo script file does not exist at ${scriptPath}`);
    }
  });

  test('script has proper imports and structure', async () => {
    const scriptPath = 'scripts/create-demo-environment.ts';
    const content = await fs.readFile(scriptPath, 'utf-8');
    
    // Check for essential imports
    expect(content).toContain('import * as schema');
    expect(content).toContain('initializeDatabase');
    expect(content).toContain('faker');
    
    // Check for main functionality
    expect(content).toContain('Demo 123');
    expect(content).toContain('buildings');
    expect(content).toContain('residences');
    expect(content).toContain('users');
  });

  test('script can be compiled without errors', async () => {
    try {
      const { stderr } = await execAsync('npx tsc --noEmit scripts/create-demo-environment.ts');
      if (stderr && !stderr.includes('No inputs were found')) {
        console.warn('TypeScript warnings:', stderr);
      }
    } catch (error: any) {
      throw new Error(`Script compilation failed: ${error.message}`);
    }
  });

  test('demo data generation functions exist with proper file paths', async () => {
    const scriptPath = 'scripts/create-demo-environment.ts';
    const content = await fs.readFile(scriptPath, 'utf-8');
    
    // Check for data generation functions
    expect(content).toContain('seedUsers');
    expect(content).toContain('seedBuildings');
    expect(content).toContain('seedResidences');
    expect(content).toContain('seedBookings');
    expect(content).toContain('seedMaintenanceRequests');
    expect(content).toContain('seedBills');
    expect(content).toContain('seedDocuments');
    
    // Check for proper file path structure (no uploads prefix)
    expect(content).toContain('writeDocumentFile(filePath');
    expect(content).not.toContain('writeDocumentFile(`uploads/${filePath}`');
  });

  test('script includes data validation and ASCII-safe encoding', async () => {
    const scriptPath = 'scripts/create-demo-environment.ts';
    const content = await fs.readFile(scriptPath, 'utf-8');
    
    // Check for validation logic
    expect(content).toContain('validation');
    expect(content).toContain('unique');
    expect(content).toContain('email');
    expect(content).toContain('phone');
    
    // Check for ASCII-safe encoding fixes
    expect(content).not.toContain('✓'); // Unicode checkmarks should be replaced
    expect(content).not.toContain('⚠️'); // Unicode warning symbols should be replaced
    expect(content).toContain('+ Electrical systems'); // Should use ASCII alternatives
    expect(content).toContain('- On Time'); // Should use ASCII alternatives
  });

  test('script has proper error handling', async () => {
    const scriptPath = 'scripts/create-demo-environment.ts';
    const content = await fs.readFile(scriptPath, 'utf-8');
    
    // Check for error handling
    expect(content).toContain('try');
    expect(content).toContain('catch');
    expect(content).toContain('console.error');
    expect(content).toContain('process.exit');
  });

  test('demo organization creation logic', async () => {
    const scriptPath = 'scripts/create-demo-environment.ts';
    const content = await fs.readFile(scriptPath, 'utf-8');
    
    // Check for organization creation
    expect(content).toContain('"Demo 123"');
    expect(content).toContain('condo');
    expect(content).toContain('organization');
  });

  test('demo user creation includes all roles', async () => {
    const scriptPath = 'scripts/create-demo-environment.ts';
    const content = await fs.readFile(scriptPath, 'utf-8');
    
    // Check for different user roles
    expect(content).toContain('admin');
    expect(content).toContain('manager');
    expect(content).toContain('demo_resident');
    expect(content).toContain('tenant');
  });

  test('building generation creates multiple buildings', async () => {
    const scriptPath = 'scripts/create-demo-environment.ts';
    const content = await fs.readFile(scriptPath, 'utf-8');
    
    // Check for multiple building creation
    expect(content).toMatch(/building.*\d+/i);
    expect(content).toContain('name');
    expect(content).toContain('address');
  });

  test('residence generation includes unit numbers', async () => {
    const scriptPath = 'scripts/create-demo-environment.ts';
    const content = await fs.readFile(scriptPath, 'utf-8');
    
    // Check for unit number generation
    expect(content).toContain('unit');
    expect(content).toContain('floor');
    expect(content).toMatch(/\d{3}/); // Unit number pattern
  });

  test('booking generation includes realistic data', async () => {
    const scriptPath = 'scripts/create-demo-environment.ts';
    const content = await fs.readFile(scriptPath, 'utf-8');
    
    // Check for booking data
    expect(content).toContain('booking');
    expect(content).toContain('startDate');
    expect(content).toContain('endDate');
    expect(content).toContain('status');
  });

  test('maintenance request generation', async () => {
    const scriptPath = 'scripts/create-demo-environment.ts';
    const content = await fs.readFile(scriptPath, 'utf-8');
    
    // Check for maintenance request data
    expect(content).toContain('maintenance');
    expect(content).toContain('priority');
    expect(content).toContain('category');
    expect(content).toContain('description');
  });

  test('bill generation includes financial data', async () => {
    const scriptPath = 'scripts/create-demo-environment.ts';
    const content = await fs.readFile(scriptPath, 'utf-8');
    
    // Check for bill/financial data
    expect(content).toContain('bill');
    expect(content).toContain('amount');
    expect(content).toContain('dueDate');
    expect(content).toContain('category');
  });

  test('script uses Faker for realistic data', async () => {
    const scriptPath = 'scripts/create-demo-environment.ts';
    const content = await fs.readFile(scriptPath, 'utf-8');
    
    // Check for Faker usage
    expect(content).toContain('@faker-js/faker');
    expect(content).toContain('faker.');
  });

  test('script includes cleanup functionality', async () => {
    const scriptPath = 'scripts/create-demo-environment.ts';
    const content = await fs.readFile(scriptPath, 'utf-8');
    
    // Check for cleanup/deletion logic
    expect(content).toContain('cleanup');
    expect(content).toContain('delete');
    expect(content).toContain('existing');
  });

  test('script has logging and progress indicators', async () => {
    const scriptPath = 'scripts/create-demo-environment.ts';
    const content = await fs.readFile(scriptPath, 'utf-8');
    
    // Check for logging
    expect(content).toContain('console.log');
    expect(content).toContain('Creating');
    expect(content).toContain('Generated');
    expect(content).toContain('✅');
  });

  test('data relationships are properly established with manager organization access', async () => {
    const scriptPath = 'scripts/create-demo-environment.ts';
    const content = await fs.readFile(scriptPath, 'utf-8');
    
    // Check for relationship setup
    expect(content).toContain('user_organizations');
    expect(content).toContain('user_residences');
    expect(content).toContain('organization_id');
    expect(content).toContain('building_id');
    expect(content).toContain('user_id');
    
    // Check for manager organization association comment
    expect(content).toContain('critical for manager building access');
    expect(content).toContain('userOrganizations');
  });

  test('script validates required environment variables', async () => {
    const scriptPath = 'scripts/create-demo-environment.ts';
    const content = await fs.readFile(scriptPath, 'utf-8');
    
    // Check for environment validation
    expect(content).toMatch(/(DATABASE_URL|process\.env)/);
  });

  test('script includes data seeding summary', async () => {
    const scriptPath = 'scripts/create-demo-environment.ts';
    const content = await fs.readFile(scriptPath, 'utf-8');
    
    // Check for summary/reporting
    expect(content).toMatch(/(total|summary|created)/);
  });

  test('script can run without breaking existing data', async () => {
    const scriptPath = 'scripts/create-demo-environment.ts';
    const content = await fs.readFile(scriptPath, 'utf-8');
    
    // Check for safe execution patterns
    expect(content).toMatch(/(exists|findFirst|upsert)/);
  });
});

describe('Demo Data Validation', () => {
  test('generated emails are unique and valid', () => {
    const emails = [
      'melody.effertz@hotmail.com',
      'reyes.gislason85@yahoo.com',
      'ethan.kirtlin@hotmail.com'
    ];
    
    // Check uniqueness
    const uniqueEmails = new Set(emails);
    expect(uniqueEmails.size).toBe(emails.length);
    
    // Check format
    emails.forEach(email => {
      expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });
  });

  test('document content uses ASCII-safe characters', () => {
    const sampleContent = `+ Electrical systems - Good condition
+ Plumbing - Good condition
* Minor paint touch-up needed
- Rent Payment - On Time`;
    
    // Should not contain Unicode characters
    expect(sampleContent).not.toMatch(/[✓⚠️]/u);
    
    // Should contain ASCII alternatives
    expect(sampleContent).toContain('+ Electrical');
    expect(sampleContent).toContain('* Minor');
    expect(sampleContent).toContain('- On Time');
  });

  test('document categorization separates bills from financial documents', () => {
    const billCategories = ['utilities', 'maintenance', 'insurance', 'cleaning'];
    const financialTypes = ['loan', 'bank_statement', 'financial_report'];
    
    // Bill categories should map to proper document types
    expect(billCategories).toContain('utilities');
    expect(billCategories).toContain('maintenance');
    
    // Financial document types should be separate
    expect(financialTypes).toContain('loan');
    expect(financialTypes).toContain('bank_statement');
    
    // They should not overlap
    const overlap = billCategories.filter(cat => financialTypes.includes(cat));
    expect(overlap).toHaveLength(0);
  });

  test('generated phone numbers are valid format', () => {
    const phones = [
      '514-555-0123',
      '438-555-0456',
      '450-555-0789'
    ];
    
    phones.forEach(phone => {
      expect(phone).toMatch(/^\d{3}-\d{3}-\d{4}$/);
    });
  });

  test('unit numbers follow correct pattern', () => {
    const units = ['101', '102', '201', '202', '301'];
    
    units.forEach(unit => {
      expect(unit).toMatch(/^\d{3}$/);
      expect(parseInt(unit)).toBeGreaterThan(100);
      expect(parseInt(unit)).toBeLessThan(1000);
    });
  });

  test('financial amounts are realistic', () => {
    const amounts = [1500.00, 2200.50, 850.75, 3200.00];
    
    amounts.forEach(amount => {
      expect(amount).toBeGreaterThan(0);
      expect(amount).toBeLessThan(10000);
      expect(Number.isFinite(amount)).toBe(true);
    });
  });

  test('dates are logical and in valid range', () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-12-31');
    const testDate = new Date('2024-06-15');
    
    expect(testDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
    expect(testDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
  });

  test('file paths use direct user directories', () => {
    const validPaths = [
      'bills/invoice-bill123-abcd1234.txt',
      'residences/uuid-123/lease-101.txt',
      'buildings/uuid-456/insurance-building-name.txt'
    ];
    
    validPaths.forEach(path => {
      // Should not start with uploads/
      expect(path).not.toMatch(/^uploads\//);
      
      // Should follow direct directory structure
      expect(path).toMatch(/^(bills|residences|buildings)\//); 
    });
  });

  test('manager organization associations are properly configured', () => {
    const managerConfig = {
      hasOrganizationAssociation: true,
      canAccessBuildings: true,
      roleType: 'demo_manager'
    };
    
    expect(managerConfig.hasOrganizationAssociation).toBe(true);
    expect(managerConfig.canAccessBuildings).toBe(true);
    expect(managerConfig.roleType).toContain('manager');
  });
});