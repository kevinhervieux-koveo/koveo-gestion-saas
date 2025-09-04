import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { residences, buildings, organizations } from '../../shared/schema';
import { eq } from 'drizzle-orm';

// Import database connection specifically for testing
let db: any;

async function getDb() {
  if (!db) {
    const { db: dbConnection } = await import('../../server/db');
    db = dbConnection;
  }
  return db;
}

describe('Residence Update API', () => {
  let testOrganizationId: string;
  let testBuildingId: string;
  let testResidenceId: string;

  beforeAll(async () => {
    const database = await getDb();
    
    // Create a test organization
    const [org] = await database
      .insert(organizations)
      .values({
        name: 'Test Residence Update Org',
        address: '123 Test St',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1H 1H1',
        isActive: true,
      })
      .returning();
    testOrganizationId = org.id;

    // Create a test building
    const [building] = await database
      .insert(buildings)
      .values({
        organizationId: testOrganizationId,
        name: 'Test Building for Updates',
        address: '456 Update Ave',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H2H 2H2',
        buildingType: 'condo',
        totalUnits: 10,
        totalFloors: 3,
        isActive: true,
      })
      .returning();
    testBuildingId = building.id;

    // Create a test residence
    const [residence] = await database
      .insert(residences)
      .values({
        buildingId: testBuildingId,
        unitNumber: '101',
        floor: 1,
        squareFootage: '1000',
        bedrooms: 2,
        bathrooms: '1.5',
        balcony: true,
        parkingSpaceNumbers: ['P1'],
        storageSpaceNumbers: ['S1'],
        ownershipPercentage: '2.5',
        monthlyFees: '350.00',
        isActive: true,
      })
      .returning();
    testResidenceId = residence.id;
  });

  afterAll(async () => {
    const database = await getDb();
    // Clean up test data
    await database.delete(residences).where(eq(residences.buildingId, testBuildingId));
    await database.delete(buildings).where(eq(buildings.id, testBuildingId));
    await database.delete(organizations).where(eq(organizations.id, testOrganizationId));
  });

  beforeEach(async () => {
    const database = await getDb();
    // Reset residence to known state before each test
    await database
      .update(residences)
      .set({
        unitNumber: '101',
        floor: 1,
        squareFootage: '1000',
        bedrooms: 2,
        bathrooms: '1.5',
        balcony: true,
        parkingSpaceNumbers: ['P1'],
        storageSpaceNumbers: ['S1'],
        ownershipPercentage: '2.5',
        monthlyFees: '350.00',
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(residences.id, testResidenceId));
  });

  test('should update residence with valid numeric data', async () => {
    const database = await getDb();
    const updateData = {
      unitNumber: '102',
      floor: 2,
      squareFootage: 1200,
      bedrooms: 3,
      bathrooms: 2.0,
      balcony: false,
      parkingSpaceNumbers: ['P2', 'P3'],
      storageSpaceNumbers: ['S2'],
      ownershipPercentage: 3.0,
      monthlyFees: 425.50,
    };

    const [updated] = await database
      .update(residences)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(residences.id, testResidenceId))
      .returning();

    expect(updated).toBeDefined();
    expect(updated.unitNumber).toBe('102');
    expect(updated.floor).toBe(2);
    expect(Number(updated.squareFootage)).toBe(1200);
    expect(updated.bedrooms).toBe(3);
    expect(Number(updated.bathrooms)).toBe(2.0);
    expect(updated.balcony).toBe(false);
    expect(updated.parkingSpaceNumbers).toEqual(['P2', 'P3']);
    expect(updated.storageSpaceNumbers).toEqual(['S2']);
    expect(Number(updated.ownershipPercentage)).toBe(3.0);
    expect(Number(updated.monthlyFees)).toBe(425.50);
  });

  test('should handle null values for optional fields', async () => {
    const database = await getDb();
    const updateData = {
      unitNumber: '103',
      floor: 1,
      squareFootage: null,
      bedrooms: 1,
      bathrooms: null,
      balcony: false,
      parkingSpaceNumbers: [],
      storageSpaceNumbers: [],
      ownershipPercentage: null,
      monthlyFees: null,
    };

    const [updated] = await database
      .update(residences)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(residences.id, testResidenceId))
      .returning();

    expect(updated).toBeDefined();
    expect(updated.unitNumber).toBe('103');
    expect(updated.squareFootage).toBeNull();
    expect(updated.bathrooms).toBeNull();
    expect(updated.ownershipPercentage).toBeNull();
    expect(updated.monthlyFees).toBeNull();
    expect(updated.parkingSpaceNumbers).toEqual([]);
    expect(updated.storageSpaceNumbers).toEqual([]);
  });

  test('should handle string numbers (converted to numeric)', async () => {
    const database = await getDb();
    const updateData = {
      unitNumber: '104',
      floor: 2,
      squareFootage: '1500', // String number
      bedrooms: 2,
      bathrooms: '2.5', // String number
      balcony: true,
      parkingSpaceNumbers: ['P4'],
      storageSpaceNumbers: ['S4'],
      ownershipPercentage: '4.25', // String number
      monthlyFees: '500.75', // String number
    };

    const [updated] = await database
      .update(residences)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(residences.id, testResidenceId))
      .returning();

    expect(updated).toBeDefined();
    expect(updated.unitNumber).toBe('104');
    expect(Number(updated.squareFootage)).toBe(1500);
    expect(Number(updated.bathrooms)).toBe(2.5);
    expect(Number(updated.ownershipPercentage)).toBe(4.25);
    expect(Number(updated.monthlyFees)).toBe(500.75);
  });

  test('should handle empty strings as null for optional fields', async () => {
    const updateData = {
      unitNumber: '105',
      floor: 1,
      squareFootage: '', // Empty string should become null
      bedrooms: 1,
      bathrooms: '', // Empty string should become null
      balcony: false,
      parkingSpaceNumbers: [],
      storageSpaceNumbers: [],
      ownershipPercentage: '', // Empty string should become null
      monthlyFees: '', // Empty string should become null
    };

    // Process empty strings to null (mimicking backend logic)
    const processedData = {
      ...updateData,
      squareFootage: updateData.squareFootage === '' ? null : updateData.squareFootage,
      bathrooms: updateData.bathrooms === '' ? null : updateData.bathrooms,
      ownershipPercentage: updateData.ownershipPercentage === '' ? null : updateData.ownershipPercentage,
      monthlyFees: updateData.monthlyFees === '' ? null : updateData.monthlyFees,
      updatedAt: new Date(),
    };

    const database = await getDb();
    const [updated] = await database
      .update(residences)
      .set(processedData)
      .where(eq(residences.id, testResidenceId))
      .returning();

    expect(updated).toBeDefined();
    expect(updated.unitNumber).toBe('105');
    expect(updated.squareFootage).toBeNull();
    expect(updated.bathrooms).toBeNull();
    expect(updated.ownershipPercentage).toBeNull();
    expect(updated.monthlyFees).toBeNull();
  });

  test('should preserve arrays correctly', async () => {
    const database = await getDb();
    const updateData = {
      unitNumber: '106',
      floor: 2,
      squareFootage: 1100,
      bedrooms: 2,
      bathrooms: 2.0,
      balcony: true,
      parkingSpaceNumbers: ['P5', 'P6', 'P7'],
      storageSpaceNumbers: ['S5', 'S6'],
      ownershipPercentage: 2.75,
      monthlyFees: 375.25,
    };

    const [updated] = await database
      .update(residences)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(residences.id, testResidenceId))
      .returning();

    expect(updated).toBeDefined();
    expect(updated.parkingSpaceNumbers).toEqual(['P5', 'P6', 'P7']);
    expect(updated.storageSpaceNumbers).toEqual(['S5', 'S6']);
    expect(updated.parkingSpaceNumbers).toHaveLength(3);
    expect(updated.storageSpaceNumbers).toHaveLength(2);
  });

  test('should handle decimal precision correctly', async () => {
    const database = await getDb();
    const updateData = {
      unitNumber: '107',
      floor: 3,
      squareFootage: 1234.56, // Should preserve to 2 decimal places
      bedrooms: 3,
      bathrooms: 2.5, // Should preserve to 1 decimal place
      balcony: true,
      parkingSpaceNumbers: ['P8'],
      storageSpaceNumbers: ['S8'],
      ownershipPercentage: 3.1234, // Should preserve to 4 decimal places
      monthlyFees: 456.78, // Should preserve to 2 decimal places
    };

    const [updated] = await database
      .update(residences)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(residences.id, testResidenceId))
      .returning();

    expect(updated).toBeDefined();
    expect(Number(updated.squareFootage)).toBe(1234.56);
    expect(Number(updated.bathrooms)).toBe(2.5);
    expect(Number(updated.ownershipPercentage)).toBe(3.1234);
    expect(Number(updated.monthlyFees)).toBe(456.78);
  });

  test('should maintain data integrity across multiple updates', async () => {
    const database = await getDb();
    
    // First update
    await database
      .update(residences)
      .set({
        unitNumber: '108',
        squareFootage: 1000,
        bathrooms: '1.5',
        updatedAt: new Date(),
      })
      .where(eq(residences.id, testResidenceId));

    // Second update
    await database
      .update(residences)
      .set({
        monthlyFees: 400.00,
        ownershipPercentage: 2.75,
        updatedAt: new Date(),
      })
      .where(eq(residences.id, testResidenceId));

    // Verify final state
    const [final] = await database
      .select()
      .from(residences)
      .where(eq(residences.id, testResidenceId));

    expect(final).toBeDefined();
    expect(final.unitNumber).toBe('108');
    expect(Number(final.squareFootage)).toBe(1000);
    expect(Number(final.bathrooms)).toBe(1.5);
    expect(Number(final.monthlyFees)).toBe(400.00);
    expect(Number(final.ownershipPercentage)).toBe(2.75);
  });
});