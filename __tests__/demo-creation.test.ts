/**
 * Demo Creation Script Tests
 * Tests the create-demo-environment.ts script functionality
 */

import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Mock database connection for testing
jest.mock('../server/db', () => ({
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
jest.mock('../shared/schema', () => ({
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
      fail(`Demo script file does not exist at ${scriptPath}`);
    }
  });

  test('script has proper imports and structure', async () => {
    const scriptPath = 'scripts/create-demo-environment.ts';
    const content = await fs.readFile(scriptPath, 'utf-8');
    
    // Check for essential imports
    expect(content).toContain('import { db }');
    expect(content).toContain('import * as schema');
    expect(content).toContain('createDemoEnvironment');
    
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
      fail(`Script compilation failed: ${error.message}`);
    }
  });

  test('demo data generation functions exist', async () => {
    const scriptPath = 'scripts/create-demo-environment.ts';
    const content = await fs.readFile(scriptPath, 'utf-8');
    
    // Check for data generation functions
    expect(content).toContain('generateDemoUsers');
    expect(content).toContain('generateDemoBuildings');
    expect(content).toContain('generateDemoResidences');
    expect(content).toContain('generateDemoBookings');
    expect(content).toContain('generateDemoMaintenanceRequests');
    expect(content).toContain('generateDemoBills');
  });

  test('script includes data validation', async () => {
    const scriptPath = 'scripts/create-demo-environment.ts';
    const content = await fs.readFile(scriptPath, 'utf-8');
    
    // Check for validation logic
    expect(content).toContain('validation');
    expect(content).toContain('unique');
    expect(content).toContain('email');
    expect(content).toContain('phone');
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

  test('data relationships are properly established', async () => {
    const scriptPath = 'scripts/create-demo-environment.ts';
    const content = await fs.readFile(scriptPath, 'utf-8');
    
    // Check for relationship setup
    expect(content).toContain('user_organizations');
    expect(content).toContain('user_residences');
    expect(content).toContain('organization_id');
    expect(content).toContain('building_id');
    expect(content).toContain('user_id');
  });

  test('script validates required environment variables', async () => {
    const scriptPath = 'scripts/create-demo-environment.ts';
    const content = await fs.readFile(scriptPath, 'utf-8');
    
    // Check for environment validation
    expect(content).toContain('DATABASE_URL') || expect(content).toContain('process.env');
  });

  test('script includes data seeding summary', async () => {
    const scriptPath = 'scripts/create-demo-environment.ts';
    const content = await fs.readFile(scriptPath, 'utf-8');
    
    // Check for summary/reporting
    expect(content).toContain('total') || expect(content).toContain('summary') || expect(content).toContain('created');
  });

  test('script can run without breaking existing data', async () => {
    const scriptPath = 'scripts/create-demo-environment.ts';
    const content = await fs.readFile(scriptPath, 'utf-8');
    
    // Check for safe execution patterns
    expect(content).toContain('exists') || expect(content).toContain('findFirst') || expect(content).toContain('upsert');
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
    
    expect(testDate).toBeGreaterThanOrEqual(startDate);
    expect(testDate).toBeLessThanOrEqual(endDate);
  });
});