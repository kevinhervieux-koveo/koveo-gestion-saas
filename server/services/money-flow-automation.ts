import { db } from '../db';
import { eq, and, gte, lte, or, sql } from 'drizzle-orm';
import * as schema from '@shared/schema';
import type { 
  InsertMoneyFlow, 
  Bill, 
  Residence,
  Building 
} from '@shared/schema';

const { 
  moneyFlow, 
  bills, 
  residences, 
  buildings,
  users 
} = schema;

/**
 * Service for automating money_flow entries based on bills and residence fees.
 * Generates entries up to 25 years in the future and maintains them daily.
 */
export class MoneyFlowAutomationService {
  private readonly YEARS_TO_PROJECT = 25;
  private readonly DAYS_TO_PROJECT = this.YEARS_TO_PROJECT * 365;

  /**
   * Generate money flow entries for all active bills and residences
   * up to 25 years in the future.
   */
  async generateFutureMoneyFlowEntries(): Promise<{
    billEntriesCreated: number;
    residenceEntriesCreated: number;
    totalEntriesCreated: number;
  }> {
    console.log('🔄 Starting money flow entries generation...');
    
    let billEntriesCreated = 0;
    let residenceEntriesCreated = 0;

    try {
      // Get current date and future date limit
      const now = new Date();
      const futureLimit = new Date();
      futureLimit.setDate(now.getDate() + this.DAYS_TO_PROJECT);

      // 1. Generate entries for all active bills
      billEntriesCreated = await this.generateBillMoneyFlowEntries(now, futureLimit);

      // 2. Generate entries for all residence monthly fees
      residenceEntriesCreated = await this.generateResidenceMoneyFlowEntries(now, futureLimit);

      const totalEntriesCreated = billEntriesCreated + residenceEntriesCreated;

      console.log(`✅ Money flow generation completed:
        - Bill entries: ${billEntriesCreated}
        - Residence entries: ${residenceEntriesCreated}
        - Total: ${totalEntriesCreated}`);

      return {
        billEntriesCreated,
        residenceEntriesCreated,
        totalEntriesCreated
      };

    } catch (error) {
      console.error('❌ Error generating money flow entries:', error);
      throw error;
    }
  }

  /**
   * Generate money flow entries for bills based on their recurrence patterns.
   */
  private async generateBillMoneyFlowEntries(
    startDate: Date, 
    endDate: Date
  ): Promise<number> {
    // Get all active recurrent bills
    const activeBills = await db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.paymentType, 'recurrent'),
          or(
            eq(bills.endDate, null),
            gte(bills.endDate, startDate.toISOString().split('T')[0])
          )
        )
      );

    console.log(`📋 Found ${activeBills.length} active recurrent bills`);

    let entriesCreated = 0;

    for (const bill of activeBills) {
      try {
        // Remove existing future entries for this bill to avoid duplicates
        await this.cleanupExistingBillEntries(bill.id, startDate);

        // Generate new entries based on bill schedule
        const billEntries = await this.generateEntriesForBill(bill, startDate, endDate);
        entriesCreated += billEntries;

      } catch (error) {
        console.error(`❌ Error processing bill ${bill.billNumber}:`, error);
        // Continue with other bills
      }
    }

    return entriesCreated;
  }

  /**
   * Generate money flow entries for residence monthly fees.
   */
  private async generateResidenceMoneyFlowEntries(
    startDate: Date, 
    endDate: Date
  ): Promise<number> {
    // Get all active residences with monthly fees
    const activeResidences = await db
      .select({
        residence: residences,
        building: buildings
      })
      .from(residences)
      .innerJoin(buildings, eq(residences.buildingId, buildings.id))
      .where(
        and(
          eq(residences.isActive, true),
          eq(buildings.isActive, true),
          sql`${residences.monthlyFees} > 0`
        )
      );

    console.log(`🏠 Found ${activeResidences.length} active residences with monthly fees`);

    let entriesCreated = 0;

    for (const { residence, building } of activeResidences) {
      try {
        // Remove existing future entries for this residence to avoid duplicates
        await this.cleanupExistingResidenceEntries(residence.id, startDate);

        // Generate monthly income entries
        const residenceEntries = await this.generateEntriesForResidence(
          residence, 
          building,
          startDate, 
          endDate
        );
        entriesCreated += residenceEntries;

      } catch (error) {
        console.error(`❌ Error processing residence ${residence.unitNumber}:`, error);
        // Continue with other residences
      }
    }

    return entriesCreated;
  }

  /**
   * Generate money flow entries for a specific bill based on its schedule.
   */
  private async generateEntriesForBill(
    bill: Bill, 
    startDate: Date, 
    endDate: Date
  ): Promise<number> {
    const entries: InsertMoneyFlow[] = [];
    const billStartDate = new Date(bill.startDate);
    const billEndDate = bill.endDate ? new Date(bill.endDate) : endDate;

    // Use the bill start date or current date, whichever is later
    const effectiveStartDate = billStartDate > startDate ? billStartDate : startDate;
    
    if (!bill.schedulePayment) {
      console.warn(`⚠️ Bill ${bill.billNumber} has no schedule, skipping`);
      return 0;
    }

    // Get a system user for created_by field
    const systemUser = await this.getSystemUser();

    let currentDate = new Date(effectiveStartDate);
    let costIndex = 0;

    while (currentDate <= billEndDate && currentDate <= endDate) {
      // For bills with multiple costs, cycle through them
      const cost = bill.costs[costIndex % bill.costs.length];
      
      entries.push({
        buildingId: bill.buildingId,
        residenceId: undefined, // Bills are building-level
        billId: bill.id,
        type: 'expense',
        category: this.mapBillCategoryToMoneyFlowCategory(bill.category) as any,
        description: `${bill.title} - ${this.formatScheduleDescription(bill.schedulePayment)}`,
        amount: cost,
        transactionDate: currentDate.toISOString().split('T')[0],
        referenceNumber: `${bill.billNumber}-${currentDate.toISOString().split('T')[0]}`,
        notes: `Auto-generated from bill recurrence: ${bill.schedulePayment}`,
        createdBy: systemUser.id
      });

      // Move to next date based on schedule
      currentDate = this.calculateNextDate(currentDate, bill.schedulePayment, bill.scheduleCustom);
      costIndex++;

      // Safety check to avoid infinite loops
      if (entries.length > 10000) {
        console.warn(`⚠️ Too many entries for bill ${bill.billNumber}, limiting to 10000`);
        break;
      }
    }

    // Insert entries in batches
    if (entries.length > 0) {
      await this.insertEntriesInBatches(entries);
      console.log(`💰 Created ${entries.length} money flow entries for bill ${bill.billNumber}`);
    }

    return entries.length;
  }

  /**
   * Generate money flow entries for residence monthly fees.
   */
  private async generateEntriesForResidence(
    residence: Residence,
    building: Building,
    startDate: Date, 
    endDate: Date
  ): Promise<number> {
    if (!residence.monthlyFees || parseFloat(residence.monthlyFees) <= 0) {
      return 0;
    }

    const entries: InsertMoneyFlow[] = [];
    const systemUser = await this.getSystemUser();

    // Generate monthly entries starting from the 1st of next month
    let currentDate = new Date(startDate);
    currentDate.setDate(1); // Set to first day of month
    if (currentDate <= startDate) {
      // If we're already past the 1st, move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    while (currentDate <= endDate) {
      entries.push({
        buildingId: residence.buildingId,
        residenceId: residence.id,
        billId: undefined, // This is residence income, not bill-related
        type: 'income',
        category: 'monthly_fees',
        description: `Monthly fees - Unit ${residence.unitNumber}`,
        amount: residence.monthlyFees,
        transactionDate: currentDate.toISOString().split('T')[0],
        referenceNumber: `MONTHLY-${residence.unitNumber}-${currentDate.toISOString().slice(0, 7)}`,
        notes: `Auto-generated monthly fee for unit ${residence.unitNumber}`,
        createdBy: systemUser.id
      });

      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);

      // Safety check
      if (entries.length > 1000) {
        console.warn(`⚠️ Too many entries for residence ${residence.unitNumber}, limiting to 1000`);
        break;
      }
    }

    // Insert entries in batches
    if (entries.length > 0) {
      await this.insertEntriesInBatches(entries);
      console.log(`🏠 Created ${entries.length} monthly fee entries for residence ${residence.unitNumber}`);
    }

    return entries.length;
  }

  /**
   * Calculate the next occurrence date based on schedule type.
   */
  private calculateNextDate(
    currentDate: Date, 
    schedule: string, 
    customDates?: string[]
  ): Date {
    const nextDate = new Date(currentDate);

    switch (schedule) {
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'quarterly':
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
      case 'custom':
        // For custom schedules, find the next date in the array
        if (customDates && customDates.length > 0) {
          const currentDateStr = currentDate.toISOString().split('T')[0];
          const sortedDates = [...customDates].sort();
          
          // Find next date after current
          const nextCustomDate = sortedDates.find(date => date > currentDateStr);
          
          if (nextCustomDate) {
            return new Date(nextCustomDate);
          } else {
            // If no more dates this year, move to next year and start over
            const nextYear = nextDate.getFullYear() + 1;
            const firstDateNextYear = `${nextYear}${sortedDates[0].slice(4)}`;
            return new Date(firstDateNextYear);
          }
        }
        // Fallback to monthly if no custom dates
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      default:
        // Default to monthly
        nextDate.setMonth(nextDate.getMonth() + 1);
    }

    return nextDate;
  }

  /**
   * Map bill category to money flow category.
   */
  private mapBillCategoryToMoneyFlowCategory(billCategory: string): 'monthly_fees' | 'special_assessment' | 'late_fees' | 'parking_fees' | 'utility_reimbursement' | 'insurance_claim' | 'bill_payment' | 'maintenance_expense' | 'administrative_expense' | 'professional_services' | 'other_income' | 'other_expense' {
    const mapping: Record<string, 'monthly_fees' | 'special_assessment' | 'late_fees' | 'parking_fees' | 'utility_reimbursement' | 'insurance_claim' | 'bill_payment' | 'maintenance_expense' | 'administrative_expense' | 'professional_services' | 'other_income' | 'other_expense'> = {
      'insurance': 'other_expense',
      'maintenance': 'maintenance_expense', 
      'salary': 'administrative_expense',
      'utilities': 'other_expense',
      'cleaning': 'maintenance_expense',
      'security': 'other_expense',
      'landscaping': 'maintenance_expense',
      'professional_services': 'professional_services',
      'administration': 'administrative_expense',
      'repairs': 'maintenance_expense',
      'supplies': 'maintenance_expense',
      'taxes': 'other_expense',
      'other': 'other_expense'
    };

    return mapping[billCategory] || 'other_expense';
  }

  /**
   * Format schedule description for money flow entry.
   */
  private formatScheduleDescription(schedule: string): string {
    const descriptions: Record<string, string> = {
      'weekly': 'Weekly payment',
      'monthly': 'Monthly payment',
      'quarterly': 'Quarterly payment', 
      'yearly': 'Annual payment',
      'custom': 'Scheduled payment'
    };

    return descriptions[schedule] || 'Recurring payment';
  }

  /**
   * Clean up existing bill entries to avoid duplicates.
   */
  private async cleanupExistingBillEntries(billId: string, fromDate: Date): Promise<void> {
    await db
      .delete(moneyFlow)
      .where(
        and(
          eq(moneyFlow.billId, billId),
          gte(moneyFlow.transactionDate, fromDate.toISOString().split('T')[0])
        )
      );
  }

  /**
   * Clean up existing residence entries to avoid duplicates.
   */
  private async cleanupExistingResidenceEntries(residenceId: string, fromDate: Date): Promise<void> {
    await db
      .delete(moneyFlow)
      .where(
        and(
          eq(moneyFlow.residenceId, residenceId),
          eq(moneyFlow.category, 'monthly_fees'),
          gte(moneyFlow.transactionDate, fromDate.toISOString().split('T')[0])
        )
      );
  }

  /**
   * Insert entries in batches to avoid database constraints.
   */
  private async insertEntriesInBatches(entries: InsertMoneyFlow[], batchSize = 100): Promise<void> {
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      try {
        await db.insert(moneyFlow).values(batch);
      } catch (error) {
        console.error(`❌ Error inserting batch ${i / batchSize + 1}:`, error);
        // Try individual inserts for the failed batch
        for (const entry of batch) {
          try {
            await db.insert(moneyFlow).values(entry);
          } catch (individualError) {
            console.error(`❌ Error inserting individual entry:`, individualError);
            // Skip this entry and continue
          }
        }
      }
    }
  }

  /**
   * Get or create a system user for automated entries.
   */
  private async getSystemUser(): Promise<{ id: string }> {
    // Try to find an existing system user
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, 'system@koveo-gestion.com'))
      .limit(1);

    if (existingUser.length > 0) {
      return existingUser[0];
    }

    // If no system user exists, use the first admin user
    const adminUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'admin'))
      .limit(1);

    if (adminUser.length > 0) {
      return adminUser[0];
    }

    // Fallback: use any active user
    const anyUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.isActive, true))
      .limit(1);

    if (anyUser.length > 0) {
      return anyUser[0];
    }

    throw new Error('No active users found for system operations');
  }

  /**
   * Trigger money flow generation for a specific bill.
   * Called when bills are created or updated.
   */
  async generateForBill(billId: string): Promise<number> {
    console.log(`🔄 Generating money flow entries for bill ${billId}`);

    const bill = await db
      .select()
      .from(bills)
      .where(eq(bills.id, billId))
      .limit(1);

    if (bill.length === 0) {
      throw new Error(`Bill ${billId} not found`);
    }

    const billData = bill[0];

    if (billData.paymentType !== 'recurrent') {
      console.log(`💰 Bill ${billData.billNumber} is not recurrent, no future entries needed`);
      return 0;
    }

    const now = new Date();
    const futureLimit = new Date();
    futureLimit.setDate(now.getDate() + this.DAYS_TO_PROJECT);

    // Clean up existing entries for this bill
    await this.cleanupExistingBillEntries(billId, now);

    // Generate new entries
    const entriesCreated = await this.generateEntriesForBill(billData, now, futureLimit);

    console.log(`✅ Generated ${entriesCreated} money flow entries for bill ${billData.billNumber}`);
    return entriesCreated;
  }

  /**
   * Trigger money flow generation for a specific residence.
   * Called when residence monthly fees are updated.
   */
  async generateForResidence(residenceId: string): Promise<number> {
    console.log(`🔄 Generating money flow entries for residence ${residenceId}`);

    const residenceData = await db
      .select({
        residence: residences,
        building: buildings
      })
      .from(residences)
      .innerJoin(buildings, eq(residences.buildingId, buildings.id))
      .where(eq(residences.id, residenceId))
      .limit(1);

    if (residenceData.length === 0) {
      throw new Error(`Residence ${residenceId} not found`);
    }

    const { residence, building } = residenceData[0];

    const now = new Date();
    const futureLimit = new Date();
    futureLimit.setDate(now.getDate() + this.DAYS_TO_PROJECT);

    // Clean up existing entries for this residence
    await this.cleanupExistingResidenceEntries(residenceId, now);

    // Generate new entries
    const entriesCreated = await this.generateEntriesForResidence(residence, building, now, futureLimit);

    console.log(`✅ Generated ${entriesCreated} money flow entries for residence ${residence.unitNumber}`);
    return entriesCreated;
  }

  /**
   * Get statistics about generated money flow entries.
   */
  async getMoneyFlowStatistics(): Promise<{
    totalEntries: number;
    billEntries: number;
    residenceEntries: number;
    futureEntries: number;
    oldestEntry: string | null;
    newestEntry: string | null;
  }> {
    const now = new Date().toISOString().split('T')[0];

    const [totalResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(moneyFlow);

    const [billResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(moneyFlow)
      .where(sql`${moneyFlow.billId} IS NOT NULL`);

    const [residenceResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(moneyFlow)
      .where(and(
        sql`${moneyFlow.residenceId} IS NOT NULL`,
        eq(moneyFlow.category, 'monthly_fees')
      ));

    const [futureResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(moneyFlow)
      .where(sql`${moneyFlow.transactionDate} > ${now}`);

    const [oldestResult] = await db
      .select({ date: moneyFlow.transactionDate })
      .from(moneyFlow)
      .orderBy(moneyFlow.transactionDate)
      .limit(1);

    const [newestResult] = await db
      .select({ date: moneyFlow.transactionDate })
      .from(moneyFlow)
      .orderBy(sql`${moneyFlow.transactionDate} DESC`)
      .limit(1);

    return {
      totalEntries: totalResult.count,
      billEntries: billResult.count,
      residenceEntries: residenceResult.count,
      futureEntries: futureResult.count,
      oldestEntry: oldestResult?.date || null,
      newestEntry: newestResult?.date || null
    };
  }
}

// Export singleton instance
export const moneyFlowAutomationService = new MoneyFlowAutomationService();