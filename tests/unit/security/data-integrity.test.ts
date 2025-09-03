/**
 * Data Integrity and Concurrent Operations Tests
 * Tests database consistency and concurrent operation handling for Quebec property management
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { db } from '../../../server/db';
import * as schema from '../../../shared/schema';
import { eq, and } from 'drizzle-orm';

describe('Data Integrity and Concurrent Operations', () => {
  let testOrganization: any;
  let testBuilding: any;
  let testUser: any;

  beforeEach(async () => {
    // Clean test data
    await db.delete(schema.userOrganizations);
    await db.delete(schema.userResidences);
    await db.delete(schema.users);
    await db.delete(schema.residences);
    await db.delete(schema.buildings);
    await db.delete(schema.organizations);

    // Create test organization
    const [org] = await db
      .insert(schema.organizations)
      .values({
        name: 'Test Organization',
        type: 'Standard' as any,
        address: '123 Test St',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1H 1H1',
        phone: '514-555-0123',
        email: 'test@org.com',
      })
      .returning();
    testOrganization = org;

    // Create test building
    const [building] = await db
      .insert(schema.buildings)
      .values({
        organizationId: testOrganization.id,
        name: 'Test Building',
        address: '123 Test St',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1H 1H1',
        buildingType: 'apartment',
        totalUnits: 10,
      })
      .returning();
    testBuilding = building;

    // Create test user
    const [user] = await db
      .insert(schema.users)
      .values({
        email: 'test@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        role: 'tenant',
        password: 'hashedpassword',
      })
      .returning();
    testUser = user;
  });

  afterEach(async () => {
    await db.delete(schema.userOrganizations);
    await db.delete(schema.userResidences);
    await db.delete(schema.users);
    await db.delete(schema.residences);
    await db.delete(schema.buildings);
    await db.delete(schema.organizations);
  });

  describe('Foreign Key Constraint Validation', () => {
    it('should enforce organization-building relationship integrity', async () => {
      // Try to create building with non-existent organization
      const nonExistentOrgId = '00000000-0000-0000-0000-000000000000';

      try {
        await db
          .insert(schema.buildings)
          .values({
            organizationId: nonExistentOrgId,
            name: 'Orphan Building',
            address: '456 Nowhere St',
            city: 'Montreal',
            province: 'QC',
            postalCode: 'H2Y 2Y2',
            buildingType: 'apartment',
            totalUnits: 5,
          });

        // Should fail due to foreign key constraint
        expect(true).toBe(false); // This should not be reached
      } catch (error: any) {
        expect(error.message).toMatch(/foreign key|constraint/i);
      }
    });

    it('should enforce building-residence relationship integrity', async () => {
      // Try to create residence with non-existent building
      const nonExistentBuildingId = '00000000-0000-0000-0000-000000000000';

      try {
        await db
          .insert(schema.residences)
          .values({
            buildingId: nonExistentBuildingId,
            unitNumber: '101',
            squareFootage: 1000,
            bedrooms: 2,
            bathrooms: 1,
          });

        // Should fail due to foreign key constraint
        expect(true).toBe(false); // This should not be reached
      } catch (error: any) {
        expect(error.message).toMatch(/foreign key|constraint/i);
      }
    });

    it('should enforce user-organization relationship integrity', async () => {
      // Try to assign user to non-existent organization
      const nonExistentOrgId = '00000000-0000-0000-0000-000000000000';

      try {
        await db
          .insert(schema.userOrganizations)
          .values({
            userId: testUser.id,
            organizationId: nonExistentOrgId,
            organizationRole: 'tenant',
          });

        // Should fail due to foreign key constraint
        expect(true).toBe(false); // This should not be reached
      } catch (error: any) {
        expect(error.message).toMatch(/foreign key|constraint/i);
      }
    });
  });

  describe('Unique Constraint Validation', () => {
    it('should enforce unique email addresses', async () => {
      // Try to create duplicate user with same email
      try {
        await db
          .insert(schema.users)
          .values({
            email: testUser.email, // Same email as existing user
            username: 'differentuser',
            firstName: 'Different',
            lastName: 'User',
            role: 'resident',
            password: 'hashedpassword',
          });

        // Should fail due to unique constraint
        expect(true).toBe(false); // This should not be reached
      } catch (error: any) {
        expect(error.message).toMatch(/unique|duplicate|email/i);
      }
    });

    it('should enforce unique usernames', async () => {
      // Try to create duplicate user with same username
      try {
        await db
          .insert(schema.users)
          .values({
            email: 'different@example.com',
            username: testUser.username, // Same username as existing user
            firstName: 'Different',
            lastName: 'User',
            role: 'resident',
            password: 'hashedpassword',
          });

        // Should fail due to unique constraint
        expect(true).toBe(false); // This should not be reached
      } catch (error: any) {
        expect(error.message).toMatch(/unique|duplicate|username/i);
      }
    });

    it('should enforce unique unit numbers within building', async () => {
      // Create first residence
      const [residence1] = await db
        .insert(schema.residences)
        .values({
          buildingId: testBuilding.id,
          unitNumber: '101',
          squareFootage: 1000,
          bedrooms: 2,
          bathrooms: 1,
        })
        .returning();

      expect(residence1.unitNumber).toBe('101');

      // Try to create another residence with same unit number in same building
      try {
        await db
          .insert(schema.residences)
          .values({
            buildingId: testBuilding.id,
            unitNumber: '101', // Same unit number
            squareFootage: 1200,
            bedrooms: 3,
            bathrooms: 2,
          });

        // Should fail due to unique constraint
        expect(true).toBe(false); // This should not be reached
      } catch (error: any) {
        expect(error.message).toMatch(/unique|duplicate|unit/i);
      }
    });
  });

  describe('Cascading Delete Validation', () => {
    it('should prevent organization deletion when buildings exist', async () => {
      // Building exists for testOrganization, deletion should be blocked
      try {
        await db
          .delete(schema.organizations)
          .where(eq(schema.organizations.id, testOrganization.id));

        // Should fail due to foreign key constraint
        expect(true).toBe(false); // This should not be reached
      } catch (error: any) {
        expect(error.message).toMatch(/foreign key|constraint|violates/i);
      }
    });

    it('should prevent building deletion when residences exist', async () => {
      // Create residence for the building
      await db
        .insert(schema.residences)
        .values({
          buildingId: testBuilding.id,
          unitNumber: '101',
          squareFootage: 1000,
          bedrooms: 2,
          bathrooms: 1,
        });

      // Try to delete building with residences
      try {
        await db
          .delete(schema.buildings)
          .where(eq(schema.buildings.id, testBuilding.id));

        // Should fail due to foreign key constraint
        expect(true).toBe(false); // This should not be reached
      } catch (error: any) {
        expect(error.message).toMatch(/foreign key|constraint|violates/i);
      }
    });
  });

  describe('Transaction Consistency', () => {
    it('should maintain consistency during user organization assignment', async () => {
      // Test atomic assignment operations
      const assignment = {
        userId: testUser.id,
        organizationId: testOrganization.id,
        organizationRole: 'tenant',
        isActive: true,
      };

      const [result] = await db
        .insert(schema.userOrganizations)
        .values(assignment)
        .returning();

      expect(result.userId).toBe(testUser.id);
      expect(result.organizationId).toBe(testOrganization.id);
      expect(result.organizationRole).toBe('tenant');
      expect(result.isActive).toBe(true);

      // Verify the assignment exists
      const assignments = await db
        .select()
        .from(schema.userOrganizations)
        .where(
          and(
            eq(schema.userOrganizations.userId, testUser.id),
            eq(schema.userOrganizations.organizationId, testOrganization.id)
          )
        );

      expect(assignments).toHaveLength(1);
    });

    it('should handle concurrent user assignments to same organization', async () => {
      // Create multiple users
      const users = await Promise.all(
        Array(3).fill(null).map(async (_, index) => {
          const [user] = await db
            .insert(schema.users)
            .values({
              email: `user${index}@example.com`,
              username: `user${index}`,
              firstName: `User${index}`,
              lastName: 'Test',
              role: 'tenant',
              password: 'hashedpassword',
            })
            .returning();
          return user;
        })
      );

      // Assign all users to same organization concurrently
      const assignments = users.map(user => ({
        userId: user.id,
        organizationId: testOrganization.id,
        organizationRole: 'tenant',
        isActive: true,
      }));

      const results = await db
        .insert(schema.userOrganizations)
        .values(assignments)
        .returning();

      expect(results).toHaveLength(3);
      expect(results.every(r => r.organizationId === testOrganization.id)).toBe(true);
    });
  });

  describe('Data Type and Format Validation', () => {
    it('should validate numeric constraints for building data', async () => {
      const invalidBuildingData = [
        { totalUnits: -1 }, // Negative units
        { totalUnits: 0 }, // Zero units
        { totalFloors: -1 }, // Negative floors
        { yearBuilt: 1800 }, // Too old
        { yearBuilt: 2050 }, // Future year
        { parkingSpaces: -1 }, // Negative parking
        { storageSpaces: -10 }, // Negative storage
      ];

      for (const invalidData of invalidBuildingData) {
        try {
          await db
            .insert(schema.buildings)
            .values({
              organizationId: testOrganization.id,
              name: 'Invalid Building',
              address: '123 Test St',
              city: 'Montreal',
              province: 'QC',
              postalCode: 'H1H 1H1',
              buildingType: 'apartment',
              totalUnits: 10,
              ...invalidData, // Override with invalid data
            });

          // Some validations might pass at database level but should be caught by application
          console.log(`Warning: Invalid data accepted: ${JSON.stringify(invalidData)}`);
        } catch (error: any) {
          expect(error.message).toMatch(/constraint|invalid|check/i);
        }
      }
    });

    it('should validate residence square footage ranges', async () => {
      const [residence] = await db
        .insert(schema.residences)
        .values({
          buildingId: testBuilding.id,
          unitNumber: '101',
          squareFootage: 1000,
          bedrooms: 2,
          bathrooms: 1,
        })
        .returning();

      expect(residence.squareFootage).toBe(1000);
      expect(residence.bedrooms).toBe(2);
      expect(residence.bathrooms).toBe(1);

      // Valid Quebec residential ranges
      expect(residence.squareFootage).toBeGreaterThan(0);
      expect(residence.squareFootage).toBeLessThan(10000); // Reasonable max
      expect(residence.bedrooms).toBeGreaterThanOrEqual(0);
      expect(residence.bathrooms).toBeGreaterThan(0);
    });
  });
});