/**
 * Test to verify database mock functionality with working configuration
 */
import { describe, it, expect, beforeEach } from '@jest/globals';

describe('Database Mock Functionality Test', () => {
  let mockModule: any;

  beforeEach(async () => {
    // Direct import of the enhanced database mock
    mockModule = require('../../__mocks__/enhanced-database-mock.js');
    
    // Clear any existing data
    if (mockModule.testUtils && mockModule.testUtils.clearData) {
      mockModule.testUtils.clearData();
    }
  });

  it('should load database mock exports correctly', () => {
    expect(mockModule).toBeDefined();
    expect(mockModule.mockDb).toBeDefined();
    expect(mockModule.testUtils).toBeDefined();
    expect(mockModule.mockSchema).toBeDefined();
    expect(mockModule.eq).toBeDefined();
    expect(mockModule.and).toBeDefined();
    expect(mockModule.or).toBeDefined();
    
    console.log('✅ All database mock exports available');
  });

  it('should support basic insert operations', async () => {
    const { mockDb, mockSchema } = mockModule;
    
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
    expect(result.length).toBe(1);
    expect(result[0]).toMatchObject({
      name: 'Test Organization',
      type: 'management_company'
    });
    
    console.log('✅ Database mock insert functionality working');
  });

  it('should support query operations with conditions', async () => {
    const { mockDb, mockSchema, eq, testUtils } = mockModule;
    
    // Clear and seed data
    testUtils.clearData();
    testUtils.seedData('organizations', {
      id: 'test-org-1',
      name: 'Test Organization',
      type: 'management_company'
    });
    
    const result = await mockDb.query.organizations.findFirst({
      where: eq(mockSchema.organizations.name, 'Test Organization')
    });

    expect(result).toBeDefined();
    expect(result.name).toBe('Test Organization');
    expect(result.type).toBe('management_company');
    
    console.log('✅ Database mock query with conditions working');
  });

  it('should handle invitation-specific operations', async () => {
    const { mockDb, mockSchema, eq, testUtils } = mockModule;
    
    // Clear data first
    testUtils.clearData();
    
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 7);

    const result = await mockDb.insert(mockSchema.invitations).values({
      email: 'test@example.com',
      token: 'test-token',
      tokenHash: 'test-hash',
      role: 'tenant',
      status: 'pending',
      organizationId: 'org-1',
      invitedByUserId: 'user-1',
      expiresAt: expirationDate,
    }).returning();

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].email).toBe('test@example.com');
    expect(result[0].role).toBe('tenant');
    expect(result[0].status).toBe('pending');
    
    console.log('✅ Database mock invitation operations working');
  });
});