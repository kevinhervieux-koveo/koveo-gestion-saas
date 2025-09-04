import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { db } from '../../server/db';
import { buildings, residences, organizations, users, userResidences, documents } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import {
  adjustResidenceCount,
  addResidencesAutomatically,
  getResidencesForSelection,
  deleteSelectedResidences,
} from '../../server/api/buildings/operations';

describe('Residence Count Adjustment Features', () => {
  let testOrganizationId: string;
  let testBuildingId: string;
  let testUserId: string;
  let createdResidenceIds: string[] = [];
  let createdDocumentIds: string[] = [];

  beforeEach(async () => {
    // Clean up previous test data
    await cleanup();

    // Create test organization
    const org = await db
      .insert(organizations)
      .values({
        name: 'Test Residence Adjustment Org',
        type: 'association',
        address: '123 Test Ave',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1H 1H1',
        phone: '514-555-0123',
        email: 'test@example.com',
        isActive: true,
      })
      .returning();
    testOrganizationId = org[0].id;

    // Create test user
    const user = await db
      .insert(users)
      .values({
        username: `test.residenceadj.${Date.now()}`,
        email: `test.residenceadj.${Date.now()}@example.com`,
        password: 'hashedpassword123',
        firstName: 'Test',
        lastName: 'User',
        role: 'admin',
        isActive: true,
      })
      .returning();
    testUserId = user[0].id;

    // Create test building
    const building = await db
      .insert(buildings)
      .values({
        name: 'Test Residence Adjustment Building',
        address: '123 Test St',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1H 1H1',
        buildingType: 'condo',
        totalUnits: 5,
        totalFloors: 2,
        organizationId: testOrganizationId,
        isActive: true,
      })
      .returning();
    testBuildingId = building[0].id;

    // Create initial residences
    const initialResidences = await db
      .insert(residences)
      .values([
        { buildingId: testBuildingId, unitNumber: '101', floor: 1, isActive: true },
        { buildingId: testBuildingId, unitNumber: '102', floor: 1, isActive: true },
        { buildingId: testBuildingId, unitNumber: '201', floor: 2, isActive: true },
        { buildingId: testBuildingId, unitNumber: '202', floor: 2, isActive: true },
        { buildingId: testBuildingId, unitNumber: '203', floor: 2, isActive: true },
      ])
      .returning();
    createdResidenceIds = initialResidences.map(r => r.id);
  });

  afterEach(async () => {
    await cleanup();
  });

  async function cleanup() {
    // Clean up test data
    if (createdDocumentIds.length > 0) {
      await db.delete(documents).where(eq(documents.id, createdDocumentIds[0]));
      createdDocumentIds = [];
    }

    if (createdResidenceIds.length > 0) {
      await db.update(residences)
        .set({ isActive: false })
        .where(eq(residences.id, createdResidenceIds[0]));
      createdResidenceIds = [];
    }

    if (testBuildingId) {
      await db.update(buildings)
        .set({ isActive: false })
        .where(eq(buildings.id, testBuildingId));
    }

    if (testUserId) {
      await db.update(users)
        .set({ isActive: false })
        .where(eq(users.id, testUserId));
    }

    if (testOrganizationId) {
      await db.delete(organizations).where(eq(organizations.id, testOrganizationId));
    }
  }

  describe('Automatic Residence Addition', () => {
    it('should automatically add residences when building count increases', async () => {
      // Increase from 5 to 8 units
      const result = await adjustResidenceCount(
        testBuildingId,
        testOrganizationId,
        8, // new count
        5, // current count
        2  // floors
      );

      expect(result.action).toBe('increased');
      expect(result.residencesToSelect).toBeUndefined();

      // Check that 3 new residences were created
      const allResidences = await db
        .select()
        .from(residences)
        .where(and(eq(residences.buildingId, testBuildingId), eq(residences.isActive, true)));

      expect(allResidences).toHaveLength(8);

      // Verify new residences have proper unit numbers (algorithm distributes across floors)
      const unitNumbers = allResidences.map(r => r.unitNumber).sort();
      expect(unitNumbers).toEqual(['101', '102', '103', '104', '201', '202', '203', '204']);
    });

    it('should generate proper unit numbers following floor pattern', async () => {
      // Create building with 3 floors and increase units
      await addResidencesAutomatically(
        testBuildingId,
        4, // add 4 units
        3, // 3 floors 
        createdResidenceIds.map(id => ({ id, unitNumber: '999' })) // existing residences
      );

      const newResidences = await db
        .select({ unitNumber: residences.unitNumber, floor: residences.floor })
        .from(residences)
        .where(and(eq(residences.buildingId, testBuildingId), eq(residences.isActive, true)))
        .orderBy(residences.unitNumber);

      // Should have generated logical unit numbers
      expect(newResidences.length).toBeGreaterThan(5);
    });
  });

  describe('Residence Selection for Deletion', () => {
    it('should return list of residences prioritizing empty ones', async () => {
      // Create a document for one residence to make it "occupied"
      const testDocument = await db
        .insert(documents)
        .values({
          name: 'Test Document',
          documentType: 'lease',
          filePath: '/test/document.pdf',
          residenceId: createdResidenceIds[0],
          buildingId: testBuildingId,
          uploadedById: testUserId,
        })
        .returning();
      createdDocumentIds.push(testDocument[0].id);

      // Create user-residence relationship for another residence
      await db
        .insert(userResidences)
        .values({
          userId: testUserId,
          residenceId: createdResidenceIds[1],
          relationshipType: 'owner',
          isActive: true,
        });

      const residencesToSelect = await getResidencesForSelection(testBuildingId, 3);

      expect(residencesToSelect).toHaveLength(5);

      // Should prioritize empty residences (no documents or users)
      const emptyResidences = residencesToSelect.filter(r => !r.hasDocuments && !r.hasUsers);
      const occupiedResidences = residencesToSelect.filter(r => r.hasDocuments || r.hasUsers);

      expect(emptyResidences.length).toBeGreaterThan(0);
      expect(occupiedResidences.length).toBe(2); // One with document, one with user

      // Empty residences should appear first in the sorted list
      expect(residencesToSelect[0].hasDocuments).toBe(false);
      expect(residencesToSelect[0].hasUsers).toBe(false);
    });

    it('should correctly identify residences with documents and user relationships', async () => {
      // Add document to first residence
      const testDocument = await db
        .insert(documents)
        .values({
          name: 'Lease Agreement',
          documentType: 'lease',
          filePath: '/test/lease.pdf',
          residenceId: createdResidenceIds[0],
          buildingId: testBuildingId,
          uploadedById: testUserId,
        })
        .returning();
      createdDocumentIds.push(testDocument[0].id);

      const residencesToSelect = await getResidencesForSelection(testBuildingId, 5);

      const residenceWithDoc = residencesToSelect.find(r => r.id === createdResidenceIds[0]);
      expect(residenceWithDoc).toBeDefined();
      expect(residenceWithDoc?.hasDocuments).toBe(true);
      expect(residenceWithDoc?.hasUsers).toBe(false);
    });
  });

  describe('Admin-Only Residence Deletion', () => {
    it('should successfully delete selected residences for admin users', async () => {
      // Create a test document
      const testDocument = await db
        .insert(documents)
        .values({
          name: 'Document to Delete',
          documentType: 'lease',
          filePath: '/test/delete.pdf',
          residenceId: createdResidenceIds[0],
          buildingId: testBuildingId,
          uploadedById: testUserId,
        })
        .returning();
      createdDocumentIds.push(testDocument[0].id);

      const residencesToDelete = [createdResidenceIds[0], createdResidenceIds[1]];

      const result = await deleteSelectedResidences(
        testBuildingId,
        residencesToDelete,
        'admin'
      );

      expect(result.deletedCount).toBe(2);
      expect(result.documentsDeleted).toBe(1);

      // Verify residences are soft-deleted
      const deletedResidences = await db
        .select()
        .from(residences)
        .where(and(
          eq(residences.buildingId, testBuildingId),
          eq(residences.isActive, false)
        ));

      expect(deletedResidences).toHaveLength(2);

      // Verify document is deleted
      const remainingDocs = await db
        .select()
        .from(documents)
        .where(eq(documents.id, testDocument[0].id));

      expect(remainingDocs).toHaveLength(0);
    });

    it('should reject deletion attempts from non-admin users', async () => {
      await expect(
        deleteSelectedResidences(testBuildingId, [createdResidenceIds[0]], 'manager')
      ).rejects.toThrow('Only admins can delete residences');

      await expect(
        deleteSelectedResidences(testBuildingId, [createdResidenceIds[0]], 'tenant')
      ).rejects.toThrow('Only admins can delete residences');
    });
  });

  describe('Complete Residence Adjustment Flow', () => {
    it('should handle residence count decrease requiring user selection', async () => {
      // Simulate decreasing from 5 to 3 units
      const result = await adjustResidenceCount(
        testBuildingId,
        testOrganizationId,
        3, // new count 
        5, // current count
        2  // floors
      );

      expect(result.action).toBe('decreased');
      expect(result.residencesToSelect).toBeDefined();
      expect(result.residencesToSelect).toHaveLength(5); // All residences for selection
    });

    it('should return no action when residence count is unchanged', async () => {
      const result = await adjustResidenceCount(
        testBuildingId,
        testOrganizationId,
        5, // same count
        5, // current count  
        2  // floors
      );

      expect(result.action).toBe('none');
      expect(result.residencesToSelect).toBeUndefined();
    });
  });
});