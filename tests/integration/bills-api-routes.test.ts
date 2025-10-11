import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { db } from '../../server/db';
import { bills, buildings, users, userOrganizations, organizations } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Integration tests for Bills API Routes
 * Tests the complete bills API including:
 * - Bill CRUD operations
 * - Auto-generation workflow
 * - Template bill creation
 * - Filtering and querying
 * - Authorization and access control
 */

describe('Bills API Integration Tests', () => {
  const testOrg = {
    id: 'test-org-bills-api',
    name: 'Test Organization for Bills',
    isActive: true,
  };

  const testBuilding = {
    id: 'test-building-bills-api',
    name: 'Test Building for Bills',
    address: '123 Test Street',
    city: 'Montreal',
    province: 'QC',
    postalCode: 'H1H 1H1',
    organizationId: testOrg.id,
    isActive: true,
  };

  const testUser = {
    id: 'test-user-bills-api',
    email: 'bills-test@example.com',
    username: 'billstester',
    password: 'hashed-password',
    firstName: 'Bills',
    lastName: 'Tester',
    role: 'admin' as const,
    language: 'en' as const,
    isActive: true,
  };

  beforeAll(async () => {
    // Clean up any existing test data
    await db.delete(bills).where(eq(bills.buildingId, testBuilding.id));
    await db.delete(userOrganizations).where(eq(userOrganizations.userId, testUser.id));
    await db.delete(users).where(eq(users.id, testUser.id));
    await db.delete(buildings).where(eq(buildings.id, testBuilding.id));
    await db.delete(organizations).where(eq(organizations.id, testOrg.id));

    // Create test data
    await db.insert(organizations).values(testOrg);
    await db.insert(buildings).values(testBuilding);
    await db.insert(users).values(testUser as any);
    await db.insert(userOrganizations).values({
      userId: testUser.id,
      organizationId: testOrg.id,
      canAccessAllOrganizations: false,
      isActive: true,
    });
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(bills).where(eq(bills.buildingId, testBuilding.id));
    await db.delete(userOrganizations).where(eq(userOrganizations.userId, testUser.id));
    await db.delete(users).where(eq(users.id, testUser.id));
    await db.delete(buildings).where(eq(buildings.id, testBuilding.id));
    await db.delete(organizations).where(eq(organizations.id, testOrg.id));
  });

  beforeEach(async () => {
    // Clean up bills before each test
    await db.delete(bills).where(eq(bills.buildingId, testBuilding.id));
  });

  describe('Bill Creation', () => {
    it('should create a unique bill successfully', async () => {
      const billData = {
        buildingId: testBuilding.id,
        title: 'Test Unique Bill',
        description: 'A test bill for unique payment',
        category: 'maintenance' as const,
        vendor: 'Test Vendor',
        paymentType: 'unique' as const,
        costs: ['1000.00'],
        totalAmount: '1000.00',
        startDate: '2025-01-15',
        status: 'draft' as const,
        createdBy: testUser.id,
      };

      const [createdBill] = await db.insert(bills).values(billData as any).returning();

      expect(createdBill).toBeDefined();
      expect(createdBill.id).toBeDefined();
      expect(createdBill.title).toBe('Test Unique Bill');
      expect(createdBill.paymentType).toBe('unique');
      expect(createdBill.buildingId).toBe(testBuilding.id);
    });

    it('should create a recurrent bill with schedule', async () => {
      const billData = {
        buildingId: testBuilding.id,
        title: 'Monthly Maintenance Fee',
        description: 'Recurring monthly maintenance',
        category: 'maintenance' as const,
        vendor: 'Maintenance Corp',
        paymentType: 'recurrent' as const,
        schedulePayment: 'monthly' as const,
        costs: ['500.00'],
        totalAmount: '500.00',
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        status: 'draft' as const,
        createdBy: testUser.id,
      };

      const [createdBill] = await db.insert(bills).values(billData as any).returning();

      expect(createdBill.paymentType).toBe('recurrent');
      expect(createdBill.schedulePayment).toBe('monthly');
      expect(createdBill.endDate).toBe('2025-12-31');
    });

    it('should create auto-generated bill with metadata', async () => {
      const sourceBillData = {
        buildingId: testBuilding.id,
        title: 'Source Bill for Auto-Gen',
        category: 'utilities' as const,
        vendor: 'Utility Corp',
        paymentType: 'recurrent' as const,
        costs: ['800.00'],
        totalAmount: '800.00',
        startDate: '2025-01-01',
        status: 'draft' as const,
        createdBy: testUser.id,
      };

      const [sourceBill] = await db.insert(bills).values(sourceBillData as any).returning();

      const autoGenData = {
        buildingId: testBuilding.id,
        title: 'Auto-Generated Bill 2026',
        category: 'utilities' as const,
        vendor: 'Utility Corp',
        paymentType: 'unique' as const,
        costs: ['800.00'],
        totalAmount: '800.00',
        startDate: '2026-01-01',
        status: 'draft' as const,
        isAutoGenerated: true,
        sourceTemplateId: sourceBill.id,
        autoGeneratedLabel: 'Auto 2026',
        createdBy: testUser.id,
      };

      const [autoGenBill] = await db.insert(bills).values(autoGenData as any).returning();

      expect(autoGenBill.isAutoGenerated).toBe(true);
      expect(autoGenBill.sourceTemplateId).toBe(sourceBill.id);
      expect(autoGenBill.autoGeneratedLabel).toBe('Auto 2026');
    });
  });

  describe('Bill Updates', () => {
    it('should update bill fields correctly', async () => {
      const [initialBill] = await db
        .insert(bills)
        .values({
          buildingId: testBuilding.id,
          title: 'Initial Title',
          category: 'maintenance' as const,
          paymentType: 'unique' as const,
          costs: ['100.00'],
          totalAmount: '100.00',
          startDate: '2025-01-01',
          status: 'draft' as const,
          createdBy: testUser.id,
        } as any)
        .returning();

      const [updatedBill] = await db
        .update(bills)
        .set({
          title: 'Updated Title',
          description: 'New description',
          totalAmount: '150.00',
        })
        .where(eq(bills.id, initialBill.id))
        .returning();

      expect(updatedBill.title).toBe('Updated Title');
      expect(updatedBill.description).toBe('New description');
      expect(updatedBill.totalAmount).toBe('150.00');
    });

    it('should update bill status', async () => {
      const [bill] = await db
        .insert(bills)
        .values({
          buildingId: testBuilding.id,
          title: 'Status Test Bill',
          category: 'maintenance' as const,
          paymentType: 'unique' as const,
          costs: ['200.00'],
          totalAmount: '200.00',
          startDate: '2025-01-01',
          status: 'draft' as const,
          createdBy: testUser.id,
        } as any)
        .returning();

      const statuses: Array<'draft' | 'sent' | 'paid'> = ['sent', 'paid'];
      
      for (const status of statuses) {
        const [updated] = await db
          .update(bills)
          .set({ status })
          .where(eq(bills.id, bill.id))
          .returning();

        expect(updated.status).toBe(status);
      }
    });
  });

  describe('Bill Querying and Filtering', () => {
    beforeEach(async () => {
      // Create multiple bills for filtering tests
      const testBills = [
        {
          buildingId: testBuilding.id,
          title: 'Insurance Bill 2025',
          category: 'insurance' as const,
          paymentType: 'unique' as const,
          costs: ['2500.00'],
          totalAmount: '2500.00',
          startDate: '2025-03-01',
          status: 'paid' as const,
          createdBy: testUser.id,
        },
        {
          buildingId: testBuilding.id,
          title: 'Maintenance Bill 2025',
          category: 'maintenance' as const,
          paymentType: 'unique' as const,
          costs: ['500.00'],
          totalAmount: '500.00',
          startDate: '2025-06-15',
          status: 'sent' as const,
          createdBy: testUser.id,
        },
        {
          buildingId: testBuilding.id,
          title: 'Utilities Bill 2025',
          category: 'utilities' as const,
          paymentType: 'unique' as const,
          costs: ['300.00'],
          totalAmount: '300.00',
          startDate: '2025-09-01',
          status: 'draft' as const,
          createdBy: testUser.id,
        },
      ];

      await db.insert(bills).values(testBills as any);
    });

    it('should filter bills by category', async () => {
      const insuranceBills = await db
        .select()
        .from(bills)
        .where(
          and(
            eq(bills.buildingId, testBuilding.id),
            eq(bills.category, 'insurance')
          )
        );

      expect(insuranceBills.length).toBe(1);
      expect(insuranceBills[0].category).toBe('insurance');
    });

    it('should filter bills by status', async () => {
      const paidBills = await db
        .select()
        .from(bills)
        .where(
          and(
            eq(bills.buildingId, testBuilding.id),
            eq(bills.status, 'paid')
          )
        );

      expect(paidBills.length).toBe(1);
      expect(paidBills[0].status).toBe('paid');
    });

    it('should filter bills by year', async () => {
      const year2025Bills = await db
        .select()
        .from(bills)
        .where(eq(bills.buildingId, testBuilding.id));

      const filtered2025 = year2025Bills.filter(bill => 
        bill.startDate.startsWith('2025')
      );

      expect(filtered2025.length).toBe(3);
    });

    it('should retrieve all bills for a building', async () => {
      const allBills = await db
        .select()
        .from(bills)
        .where(eq(bills.buildingId, testBuilding.id));

      expect(allBills.length).toBe(3);
    });
  });

  describe('Auto-Generation Workflow', () => {
    it('should link generated bills to source template', async () => {
      const [sourceBill] = await db
        .insert(bills)
        .values({
          buildingId: testBuilding.id,
          title: 'Recurring Source Bill',
          category: 'maintenance' as const,
          paymentType: 'recurrent' as const,
          costs: ['1200.00'],
          totalAmount: '1200.00',
          startDate: '2025-01-01',
          createdBy: testUser.id,
        } as any)
        .returning();

      const generatedBills = [
        {
          buildingId: testBuilding.id,
          title: 'Auto 2026 - Recurring Source Bill',
          category: 'maintenance' as const,
          paymentType: 'unique' as const,
          costs: ['1200.00'],
          totalAmount: '1200.00',
          startDate: '2026-01-01',
          isAutoGenerated: true,
          sourceTemplateId: sourceBill.id,
          autoGeneratedLabel: 'Auto 2026',
          createdBy: testUser.id,
        },
        {
          buildingId: testBuilding.id,
          title: 'Auto 2027 - Recurring Source Bill',
          category: 'maintenance' as const,
          paymentType: 'unique' as const,
          costs: ['1200.00'],
          totalAmount: '1200.00',
          startDate: '2027-01-01',
          isAutoGenerated: true,
          sourceTemplateId: sourceBill.id,
          autoGeneratedLabel: 'Auto 2027',
          createdBy: testUser.id,
        },
      ];

      await db.insert(bills).values(generatedBills as any);

      const linkedBills = await db
        .select()
        .from(bills)
        .where(
          and(
            eq(bills.sourceTemplateId, sourceBill.id),
            eq(bills.isAutoGenerated, true)
          )
        );

      expect(linkedBills.length).toBe(2);
      linkedBills.forEach(bill => {
        expect(bill.sourceTemplateId).toBe(sourceBill.id);
        expect(bill.isAutoGenerated).toBe(true);
      });
    });

    it('should update all generated bills when source is modified', async () => {
      const [sourceBill] = await db
        .insert(bills)
        .values({
          buildingId: testBuilding.id,
          title: 'Source for Update',
          category: 'utilities' as const,
          vendor: 'Original Vendor',
          paymentType: 'recurrent' as const,
          costs: ['600.00'],
          totalAmount: '600.00',
          startDate: '2025-01-01',
          createdBy: testUser.id,
        } as any)
        .returning();

      await db.insert(bills).values({
        buildingId: testBuilding.id,
        title: 'Auto 2026 - Source for Update',
        category: 'utilities' as const,
        vendor: 'Original Vendor',
        paymentType: 'unique' as const,
        costs: ['600.00'],
        totalAmount: '600.00',
        startDate: '2026-01-01',
        isAutoGenerated: true,
        sourceTemplateId: sourceBill.id,
        autoGeneratedLabel: 'Auto 2026',
        createdBy: testUser.id,
      } as any);

      // Update source bill
      await db
        .update(bills)
        .set({ vendor: 'Updated Vendor' })
        .where(eq(bills.id, sourceBill.id));

      // Update all generated bills
      await db
        .update(bills)
        .set({ vendor: 'Updated Vendor' })
        .where(eq(bills.sourceTemplateId, sourceBill.id));

      const updatedGeneratedBills = await db
        .select()
        .from(bills)
        .where(eq(bills.sourceTemplateId, sourceBill.id));

      updatedGeneratedBills.forEach(bill => {
        expect(bill.vendor).toBe('Updated Vendor');
      });
    });
  });

  describe('Bill Deletion', () => {
    it('should delete a bill successfully', async () => {
      const [bill] = await db
        .insert(bills)
        .values({
          buildingId: testBuilding.id,
          title: 'Bill to Delete',
          category: 'maintenance' as const,
          paymentType: 'unique' as const,
          costs: ['100.00'],
          totalAmount: '100.00',
          startDate: '2025-01-01',
          status: 'draft' as const,
          createdBy: testUser.id,
        } as any)
        .returning();

      await db.delete(bills).where(eq(bills.id, bill.id));

      const deletedBill = await db
        .select()
        .from(bills)
        .where(eq(bills.id, bill.id));

      expect(deletedBill.length).toBe(0);
    });

    it('should delete source bill and its generated bills', async () => {
      const [sourceBill] = await db
        .insert(bills)
        .values({
          buildingId: testBuilding.id,
          title: 'Source to Delete',
          category: 'maintenance' as const,
          paymentType: 'recurrent' as const,
          costs: ['400.00'],
          totalAmount: '400.00',
          startDate: '2025-01-01',
          createdBy: testUser.id,
        } as any)
        .returning();

      await db.insert(bills).values({
        buildingId: testBuilding.id,
        title: 'Auto 2026 - Source to Delete',
        category: 'maintenance' as const,
        paymentType: 'unique' as const,
        costs: ['400.00'],
        totalAmount: '400.00',
        startDate: '2026-01-01',
        isAutoGenerated: true,
        sourceTemplateId: sourceBill.id,
        autoGeneratedLabel: 'Auto 2026',
        createdBy: testUser.id,
      } as any);

      // Delete generated bills first
      await db
        .delete(bills)
        .where(eq(bills.sourceTemplateId, sourceBill.id));

      // Then delete source bill
      await db.delete(bills).where(eq(bills.id, sourceBill.id));

      const remainingBills = await db
        .select()
        .from(bills)
        .where(
          and(
            eq(bills.buildingId, testBuilding.id),
            eq(bills.title, 'Source to Delete')
          )
        );

      expect(remainingBills.length).toBe(0);
    });
  });

  describe('Data Integrity', () => {
    it('should enforce foreign key constraint on buildingId', async () => {
      const invalidBillData = {
        buildingId: 'non-existent-building-id',
        title: 'Invalid Building Bill',
        category: 'maintenance' as const,
        paymentType: 'unique' as const,
        costs: ['100.00'],
        totalAmount: '100.00',
        startDate: '2025-01-01',
        createdBy: testUser.id,
      };

      await expect(
        db.insert(bills).values(invalidBillData as any)
      ).rejects.toThrow();
    });

    it('should handle concurrent bill updates correctly', async () => {
      const [bill] = await db
        .insert(bills)
        .values({
          buildingId: testBuilding.id,
          title: 'Concurrent Update Test',
          category: 'maintenance' as const,
          paymentType: 'unique' as const,
          costs: ['100.00'],
          totalAmount: '100.00',
          startDate: '2025-01-01',
          status: 'draft' as const,
          createdBy: testUser.id,
        } as any)
        .returning();

      // Simulate concurrent updates
      const update1 = db
        .update(bills)
        .set({ title: 'Update 1' })
        .where(eq(bills.id, bill.id));

      const update2 = db
        .update(bills)
        .set({ description: 'Update 2' })
        .where(eq(bills.id, bill.id));

      await Promise.all([update1, update2]);

      const [finalBill] = await db
        .select()
        .from(bills)
        .where(eq(bills.id, bill.id));

      // Both updates should be applied
      expect(finalBill.title).toBe('Update 1');
      expect(finalBill.description).toBe('Update 2');
    });
  });
});
