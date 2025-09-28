/**
 * Simple test to verify database mock availability and functionality
 * This helps debug the core mocking infrastructure issues
 */
import { describe, it, expect } from '@jest/globals';

// Test direct CommonJS require to see if the mock is accessible
describe('Database Mock Availability Test', () => {
  it('should load enhanced database mock via require', () => {
    try {
      const mock = require('../../__mocks__/enhanced-database-mock.js');
      console.log('Mock exports:', Object.keys(mock));
      expect(mock.mockDb).toBeDefined();
      expect(mock.testUtils).toBeDefined();
      expect(mock.mockSchema).toBeDefined();
      console.log('✅ Direct require test passed');
    } catch (error) {
      console.error('❌ Direct require failed:', error);
      throw error;
    }
  });

  it('should load enhanced database mock via ES module import', async () => {
    try {
      const mock = await import('drizzle-orm');
      console.log('ES import exports:', Object.keys(mock));
      expect((mock as any).mockDb).toBeDefined();
      expect((mock as any).testUtils).toBeDefined();
      expect((mock as any).mockSchema).toBeDefined();
      console.log('✅ ES module import test passed');
    } catch (error) {
      console.error('❌ ES module import failed:', error);
      throw error;
    }
  });

  it('should have working mockDb insert functionality', async () => {
    try {
      const mock = require('../../__mocks__/enhanced-database-mock.js');
      const { mockDb, testUtils, mockSchema } = mock;
      
      // Clear any existing data
      if (testUtils && testUtils.clearData) {
        testUtils.clearData();
      }
      
      // Test basic insert functionality
      const result = await mockDb.insert(mockSchema.organizations).values({
        name: 'Test Organization',
        type: 'management_company',
        address: '123 Test St',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A 1A1',
      }).returning();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      console.log('✅ Mock insert functionality test passed');
    } catch (error) {
      console.error('❌ Mock insert functionality failed:', error);
      throw error;
    }
  });
});