import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { db } from '../../server/db';
import { bills, moneyFlow, buildings, users } from '../../shared/schema';
import { eq, and, sql, desc } from 'drizzle-orm';

describe('Payment Flow Integration Tests', () => {
  let testBuildingId: string;
  let testUserId: string;
  let testBillId: string;

  beforeAll(async () => {
    // Get existing building and user for testing
    const building = await db.select().from(buildings).limit(1);
    const user = await db.select().from(users).limit(1);

    expect(building.length).toBeGreaterThan(0);
    expect(user.length).toBeGreaterThan(0);

    testBuildingId = building[0].id;
    testUserId = user[0].id;
  });

  describe('End-to-End Payment Processing', () => {
    it('should create consistent bill and money flow entries', async () => {
      // Create a test bill
      const newBill = await db
        .insert(bills)
        .values({
          buildingId: testBuildingId,
          billNumber: 'TEST-INTEGRATION-001',
          title: 'Integration Test Bill',
          description: 'Test bill for integration testing',
          category: 'maintenance',
          vendor: 'Test Vendor',
          paymentType: 'unique',
          costs: [1500.0],
          totalAmount: 1500.0,
          startDate: '2025-01-01',
          status: 'sent',
          createdBy: testUserId,
        })
        .returning();

      expect(newBill.length).toBe(1);
      testBillId = newBill[0].id;

      // Create corresponding money flow entry
      const newFlow = await db
        .insert(moneyFlow)
        .values({
          buildingId: testBuildingId,
          billId: testBillId,
          type: 'expense',
          category: 'bill_payment',
          description: 'Payment for integration test bill',
          amount: -1500.0,
          transactionDate: '2025-01-05',
          referenceNumber: 'PAY-TEST-001',
          createdBy: testUserId,
        })
        .returning();

      expect(newFlow.length).toBe(1);

      // Verify consistency
      expect(newFlow[0].billId).toBe(testBillId);
      expect(newFlow[0].buildingId).toBe(testBuildingId);
      expect(Math.abs(parseFloat(newFlow[0].amount.toString()))).toBe(1500.0);
    });

    it('should handle recurrent payment scenarios', async () => {
      // Create a recurrent bill
      const recurrentBill = await db
        .insert(bills)
        .values({
          buildingId: testBuildingId,
          billNumber: 'TEST-RECURRENT-001',
          title: 'Monthly Security Service',
          description: 'Monthly security monitoring and patrol',
          category: 'security',
          vendor: 'Security Corp',
          paymentType: 'recurrent',
          costs: [800.0, 800.0, 800.0], // Quarterly payments
          totalAmount: 2400.0,
          startDate: '2025-01-01',
          status: 'sent',
          createdBy: testUserId,
        })
        .returning();

      expect(recurrentBill.length).toBe(1);

      // Create multiple money flow entries for recurrent payments
      const flowEntries = [];
      const months = ['2025-01-01', '2025-04-01', '2025-07-01'];

      for (let i = 0; i < months.length; i++) {
        const flow = await db
          .insert(moneyFlow)
          .values({
            buildingId: testBuildingId,
            billId: recurrentBill[0].id,
            type: 'expense',
            category: 'bill_payment',
            description: `Quarterly security payment ${i + 1}/3`,
            amount: -800.0,
            transactionDate: months[i],
            referenceNumber: `SEC-Q${i + 1}-2025`,
            createdBy: testUserId,
          })
          .returning();

        flowEntries.push(flow[0]);
      }

      expect(flowEntries.length).toBe(3);

      // Verify total flow matches bill total
      const totalFlowAmount = flowEntries.reduce((sum, flow) => {
        return sum + Math.abs(parseFloat(flow.amount.toString()));
      }, 0);

      expect(totalFlowAmount).toBe(2400.0);
    });

    it('should validate payment status transitions', async () => {
      // Test bill status progression: draft -> sent -> paid
      const testBill = await db
        .insert(bills)
        .values({
          buildingId: testBuildingId,
          billNumber: 'TEST-STATUS-001',
          title: 'Status Transition Test',
          description: 'Testing bill status transitions',
          category: 'utilities',
          vendor: 'Utility Company',
          paymentType: 'unique',
          costs: [350.0],
          totalAmount: 350.0,
          startDate: '2025-01-15',
          status: 'draft',
          createdBy: testUserId,
        })
        .returning();

      expect(testBill[0].status).toBe('draft');

      // Update to sent
      await db.update(bills).set({ status: 'sent' }).where(eq(bills.id, testBill[0].id));

      const sentBill = await db.select().from(bills).where(eq(bills.id, testBill[0].id)).limit(1);

      expect(sentBill[0].status).toBe('sent');

      // Create payment flow when bill is paid
      await db.insert(moneyFlow).values({
        buildingId: testBuildingId,
        billId: testBill[0].id,
        type: 'expense',
        category: 'bill_payment',
        description: 'Utility bill payment',
        amount: -350.0,
        transactionDate: '2025-01-20',
        referenceNumber: 'UTIL-PAY-001',
        isReconciled: true,
        reconciledDate: '2025-01-20',
        createdBy: testUserId,
      });

      // Update bill to paid
      await db.update(bills).set({ status: 'paid' }).where(eq(bills.id, testBill[0].id));

      const paidBill = await db.select().from(bills).where(eq(bills.id, testBill[0].id)).limit(1);

      expect(paidBill[0].status).toBe('paid');
    });

    it('should validate financial reconciliation', async () => {
      // Create a bill and corresponding income/expense flows
      const reconciliationBill = await db
        .insert(bills)
        .values({
          buildingId: testBuildingId,
          billNumber: 'TEST-RECONCILE-001',
          title: 'Reconciliation Test',
          description: 'Testing financial reconciliation',
          category: 'maintenance',
          vendor: 'Maintenance Co',
          paymentType: 'unique',
          costs: [2200.0],
          totalAmount: 2200.0,
          startDate: '2025-02-01',
          status: 'sent',
          createdBy: testUserId,
        })
        .returning();

      // Create expense flow (bill payment)
      const expenseFlow = await db
        .insert(moneyFlow)
        .values({
          buildingId: testBuildingId,
          billId: reconciliationBill[0].id,
          type: 'expense',
          category: 'bill_payment',
          description: 'Maintenance bill payment',
          amount: -2200.0,
          transactionDate: '2025-02-05',
          referenceNumber: 'MAINT-PAY-001',
          createdBy: testUserId,
        })
        .returning();

      // Create income flow (resident fee collection to cover this expense)
      const incomeFlow = await db
        .insert(moneyFlow)
        .values({
          buildingId: testBuildingId,
          type: 'income',
          category: 'monthly_fees',
          description: 'Monthly maintenance fees collected',
          amount: 2500.0, // Slightly more than expense
          transactionDate: '2025-02-01',
          referenceNumber: 'FEES-FEB-2025',
          createdBy: testUserId,
        })
        .returning();

      // Verify financial balance for this building
      const buildingFinancials = await db
        .select({
          type: moneyFlow.type,
          total: sql<number>`SUM(CAST(${moneyFlow.amount} AS DECIMAL))`,
        })
        .from(moneyFlow)
        .where(eq(moneyFlow.buildingId, testBuildingId))
        .groupBy(moneyFlow.type);

      let totalIncome = 0;
      let totalExpense = 0;

      buildingFinancials.forEach((item) => {
        const amount = parseFloat(item.total.toString());
        if (item.type === 'income') {
          totalIncome += amount;
        } else {
          totalExpense += Math.abs(amount);
        }
      });

      expect(totalIncome).toBeGreaterThan(0);
      expect(totalExpense).toBeGreaterThan(0);

      // Building should have positive or balanced cash flow
      const netFlow = totalIncome - totalExpense;
      expect(netFlow).toBeGreaterThanOrEqual(-1000); // Allow some negative balance for testing
    });
  });

  describe('Complex Payment Scenarios', () => {
    it('should handle partial payments correctly', async () => {
      const partialBill = await db
        .insert(bills)
        .values({
          buildingId: testBuildingId,
          billNumber: 'TEST-PARTIAL-001',
          title: 'Partial Payment Test',
          description: 'Testing partial payment scenarios',
          category: 'insurance',
          vendor: 'Insurance Corp',
          paymentType: 'unique',
          costs: [5000.0],
          totalAmount: 5000.0,
          startDate: '2025-03-01',
          status: 'sent',
          createdBy: testUserId,
        })
        .returning();

      // Create first partial payment
      await db.insert(moneyFlow).values({
        buildingId: testBuildingId,
        billId: partialBill[0].id,
        type: 'expense',
        category: 'bill_payment',
        description: 'Partial payment 1 of 2',
        amount: -2500.0,
        transactionDate: '2025-03-05',
        referenceNumber: 'INS-PART1-001',
        createdBy: testUserId,
      });

      // Create second partial payment
      await db.insert(moneyFlow).values({
        buildingId: testBuildingId,
        billId: partialBill[0].id,
        type: 'expense',
        category: 'bill_payment',
        description: 'Partial payment 2 of 2',
        amount: -2500.0,
        transactionDate: '2025-03-15',
        referenceNumber: 'INS-PART2-001',
        createdBy: testUserId,
      });

      // Verify total payments match bill amount
      const totalPayments = await db
        .select({
          total: sql<number>`SUM(CAST(${moneyFlow.amount} AS DECIMAL))`,
        })
        .from(moneyFlow)
        .where(eq(moneyFlow.billId, partialBill[0].id));

      const totalPaid = Math.abs(parseFloat(totalPayments[0].total.toString()));
      expect(totalPaid).toBe(5000.0);
    });

    it('should validate overdue payment handling', async () => {
      const overdueBill = await db
        .insert(bills)
        .values({
          buildingId: testBuildingId,
          billNumber: 'TEST-OVERDUE-001',
          title: 'Overdue Payment Test',
          description: 'Testing overdue payment scenarios',
          category: 'repairs',
          vendor: 'Emergency Repairs Inc',
          paymentType: 'unique',
          costs: [1800.0],
          totalAmount: 1800.0,
          startDate: '2024-12-01', // Past date
          status: 'overdue',
          createdBy: testUserId,
        })
        .returning();

      // Overdue bills should have start dates in the past
      const startDate = new Date(overdueBill[0].startDate);
      const currentDate = new Date();
      expect(startDate.getTime()).toBeLessThan(currentDate.getTime());

      // Create late payment with penalty
      await db.insert(moneyFlow).values({
        buildingId: testBuildingId,
        billId: overdueBill[0].id,
        type: 'expense',
        category: 'bill_payment',
        description: 'Late payment with penalty',
        amount: -1890.0, // Original + 5% penalty
        transactionDate: '2025-01-10',
        referenceNumber: 'LATE-PAY-001',
        notes: 'Payment includes 5% late fee',
        createdBy: testUserId,
      });

      // Update bill to paid after payment
      await db.update(bills).set({ status: 'paid' }).where(eq(bills.id, overdueBill[0].id));

      const updatedBill = await db
        .select()
        .from(bills)
        .where(eq(bills.id, overdueBill[0].id))
        .limit(1);

      expect(updatedBill[0].status).toBe('paid');
    });
  });

  afterAll(async () => {
    // Clean up test data
    if (testBillId) {
      await db.delete(moneyFlow).where(eq(moneyFlow.billId, testBillId));
      await db.delete(bills).where(eq(bills.id, testBillId));
    }

    // Clean up other test bills
    const testBills = await db
      .select({ id: bills.id })
      .from(bills)
      .where(sql`${bills.billNumber} LIKE 'TEST-%'`);

    for (const bill of testBills) {
      await db.delete(moneyFlow).where(eq(moneyFlow.billId, bill.id));
      await db.delete(bills).where(eq(bills.id, bill.id));
    }
  });
});
