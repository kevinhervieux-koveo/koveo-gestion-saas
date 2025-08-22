import { db } from '../db';
import { bills } from '../../shared/schemas/financial';
import { users } from '../../shared/schema';
import { eq, and, gte, isNull, or } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { Bill } from '../../shared/schema';

/**
 * Advanced Bill Generation Service.
 * 
 * Handles the sophisticated bill management system including:
 * - Creating future bill instances (not just money flow entries)
 * - Multiple payment plans (60% now, 40% later, etc.)
 * - Recurrence patterns with auto-generated bill chains
 * - 3-year projection of future bills
 * - Parent-child bill relationships.
 */
export class BillGenerationService {
  
  /**
   * Get bills by reference (auto-generated bills linked to a parent).
   * @param parentBillId
   */
  private async getBillsByReference(parentBillId: string): Promise<Bill[]> {
    try {
      const existingBills = await db
        .select()
        .from(bills)
        .where(eq(bills.reference, parentBillId));
      
      return existingBills;
    } catch (_error) {
      console.error(`❌ Error fetching bills by reference:`, _error);
      return [];
    }
  }

  /**
   * Set end date for a recurrent bill (stops future auto-generation).
   * @param billId
   * @param endDate
   */
  async setRecurrenceEndDate(billId: string, endDate: Date): Promise<void> {
    try {
      await db
        .update(bills)
        .set({ 
          endDate: endDate.toISOString().split('T')[0],
          updatedAt: new Date()
        })
        .where(eq(bills.id, billId));
      
      console.warn(`📅 Set recurrence end date for bill ${billId}: ${endDate.toISOString()}`);
    } catch (_error) {
      console.error(`❌ Error setting recurrence end date:`, _error);
      throw error;
    }
  }
  
  /**
   * Generate future bill instances for a recurrent bill up to 3 years.
   * Creates actual bill records that users can interact with individually.
   * @param parentBill
   */
  async generateFutureBillInstances(parentBill: Bill): Promise<{
    billsCreated: number;
    generatedUntil: string;
  }> {
    if (parentBill.paymentType !== 'recurrent') {
      throw new Error('Only recurrent bills can generate future instances');
    }

    console.warn(`🔄 Generating future bills for ${parentBill.title} (${parentBill.id})`);

    // Calculate projection period - respect endDate if set
    const startDate = new Date(parentBill.startDate);
    startDate.setFullYear(startDate.getFullYear() + 1); // Start from next year
    
    let endDate: Date;
    if (parentBill.endDate) {
      endDate = new Date(parentBill.endDate);
      console.warn(`📅 Using bill endDate: ${endDate.toISOString()}`);
    } else {
      endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 3); // 3 years from now
      console.warn(`📅 Using default 3-year projection: ${endDate.toISOString()}`);
    }

    // Check if there are already auto-generated bills to avoid duplicates
    const existingBills = await this.getBillsByReference(parentBill.id);
    if (existingBills.length > 0) {
      console.warn(`⚠️ Found ${existingBills.length} existing auto-generated bills, skipping generation`);
      return {
        billsCreated: 0,
        generatedUntil: endDate.toISOString().split('T')[0]
      };
    }

    const generatedBills: unknown[] = [];
    const currentDate = new Date(startDate);
    let billsCreated = 0;

    // Calculate occurrences based on schedule (auto-detect from parent bill)
    const scheduleType = this.detectScheduleType(parentBill);
    const occurrences = this.calculateOccurrences(currentDate, endDate, scheduleType);

    for (const occurrenceDate of occurrences) {
      // Handle multiple payment plans
      const paymentParts = this.calculatePaymentParts(parentBill, occurrenceDate);
      
      for (let partIndex = 0; partIndex < paymentParts.length; partIndex++) {
        const paymentPart = paymentParts[partIndex];
        
        const generatedBill = {
          id: uuidv4(),
          buildingId: parentBill.buildingId,
          billNumber: this.generateBillNumber(parentBill, occurrenceDate, partIndex),
          title: this.generateBillTitle(parentBill, occurrenceDate, partIndex, paymentParts.length),
          description: `Auto-generated from: ${parentBill.title}`,
          category: parentBill.category,
          vendor: parentBill.vendor,
          paymentType: 'unique' as const, // Generated bills are unique payments
          costs: [paymentPart.amount],
          totalAmount: paymentPart.amount,
          startDate: paymentPart.dueDate.toISOString().split('T')[0],
          status: 'draft' as const,
          notes: `Auto-generated from: ${parentBill.title} (Bill #${parentBill.billNumber}). Generated as part ${partIndex + 1}/${paymentParts.length} for ${occurrenceDate.toLocaleDateString()}.`,
          createdBy: parentBill.createdBy
        };

        generatedBills.push(generatedBill);
        billsCreated++;

        // Batch insert every 100 bills for performance
        if (generatedBills.length >= 100) {
          await this.insertBillsBatch(generatedBills);
          generatedBills.length = 0;
        }
      }
    }

    // Insert remaining bills
    if (generatedBills.length > 0) {
      await this.insertBillsBatch(generatedBills);
    }

    console.warn(`✅ Generated ${billsCreated} future bills for ${parentBill.title}`);

    return {
      billsCreated,
      generatedUntil: endDate.toISOString().split('T')[0]
    };
  }

  /**
   * Handle multiple payment logic for bills.
   * Examples:
   * - 60% now, 40% in 2 months
   * - 12 monthly payments of equal amounts
   * - Quarterly payments with varying amounts.
   * @param parentBill
   * @param occurrenceDate
   */
  private calculatePaymentParts(parentBill: Bill, occurrenceDate: Date): Array<{
    amount: number;
    dueDate: Date;
    partNumber: number;
  }> {
    const costs = parentBill.costs.map(cost => parseFloat(cost));
    const paymentParts: Array<{ amount: number; dueDate: Date; partNumber: number }> = [];

    if (costs.length === 1) {
      // Single payment
      paymentParts.push({
        amount: costs[0],
        dueDate: new Date(occurrenceDate),
        partNumber: 1
      });
    } else {
      // Multiple payments - create payment schedule
      costs.forEach((amount, _index) => {
        const dueDate = new Date(occurrenceDate);
        
        // For multiple costs, spread payments over time
        // First payment on occurrence date, subsequent payments monthly
        dueDate.setMonth(dueDate.getMonth() + _index);

        paymentParts.push({
          amount,
          dueDate,
          partNumber: index + 1
        });
      });
    }

    return paymentParts;
  }

  /**
   * Detect schedule type from parent bill characteristics.
   * @param parentBill
   */
  private detectScheduleType(parentBill: Bill): string {
    const costs = parentBill.costs || [];
    
    // Auto-detect based on cost array length and bill patterns
    if (costs.length === 12) {
      return 'monthly'; // 12 payments = monthly
    } else if (costs.length === 4) {
      return 'quarterly'; // 4 payments = quarterly  
    } else if (costs.length === 2) {
      return 'yearly'; // 2 payments = bi-annual, treat as yearly with split
    } else if (costs.length === 1) {
      // Single payment - determine frequency from title/description
      const title = parentBill.title.toLowerCase();
      if (title.includes('annual') || title.includes('yearly')) {
        return 'yearly';
      } else if (title.includes('quarterly')) {
        return 'quarterly';
      } else if (title.includes('monthly')) {
        return 'monthly';
      } else {
        return 'yearly'; // Default to yearly
      }
    }
    
    return 'yearly'; // Default fallback
  }

  /**
   * Calculate all occurrence dates based on schedule type.
   * @param startDate
   * @param endDate
   * @param scheduleType
   */
  private calculateOccurrences(startDate: Date, endDate: Date, scheduleType: string): Date[] {
    const occurrences: Date[] = [];
    const currentDate = new Date(startDate);

    // Standard schedule types
    while (currentDate <= endDate) {
      occurrences.push(new Date(currentDate));

      switch (scheduleType) {
        case 'weekly':
          currentDate.setDate(currentDate.getDate() + 7);
          break;
        case 'monthly':
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
        case 'quarterly':
          currentDate.setMonth(currentDate.getMonth() + 3);
          break;
        case 'yearly':
          currentDate.setFullYear(currentDate.getFullYear() + 1);
          break;
        default:
          throw new Error(`Unknown schedule type: ${scheduleType}`);
      }

      // Safety check to prevent infinite loops
      if (occurrences.length > 10000) {
        console.warn(`⚠️ Bill generation stopped at 10,000 occurrences for safety`);
        break;
      }
    }

    return occurrences;
  }

  /**
   * Handle custom recurring dates (yearly repetition).
   * @param startDate
   * @param endDate
   * @param customDates
   */
  private calculateCustomOccurrences(startDate: Date, endDate: Date, customDates: string[]): Date[] {
    const occurrences: Date[] = [];
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();

    for (let year = startYear; year <= endYear; year++) {
      for (const dateStr of customDates) {
        const customDate = new Date(dateStr);
        customDate.setFullYear(year);

        if (customDate >= startDate && customDate <= endDate) {
          occurrences.push(new Date(customDate));
        }
      }
    }

    return occurrences.sort((a, b) => a.getTime() - b.getTime());
  }

  /**
   * Generate unique bill number for auto-generated bills.
   * @param parentBill
   * @param occurrenceDate
   * @param partIndex
   */
  private generateBillNumber(parentBill: Bill, occurrenceDate: Date, partIndex: number): string {
    const dateStr = occurrenceDate.toISOString().slice(0, 7); // YYYY-MM
    const partSuffix = partIndex > 0 ? `-P${partIndex + 1}` : '';
    return `${parentBill.billNumber}-${dateStr}${partSuffix}`;
  }

  /**
   * Generate descriptive title for auto-generated bills.
   * @param parentBill
   * @param occurrenceDate
   * @param partIndex
   * @param totalParts
   */
  private generateBillTitle(parentBill: Bill, occurrenceDate: Date, partIndex: number, totalParts: number): string {
    const monthYear = occurrenceDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    if (totalParts > 1) {
      return `${parentBill.title} ${monthYear} (Auto-Generated)`;
    } else {
      return `${parentBill.title} ${monthYear} (Auto-Generated)`;
    }
  }

  /**
   * Clean up existing auto-generated bills for a parent bill.
   * @param parentBillId
   */
  private async cleanupExistingGeneratedBills(parentBillId: string): Promise<void> {
    try {
      const result = await db
        .delete(bills)
        .where(and(
          eq(bills.reference, parentBillId),
          eq(bills.autoGenerated, true),
          or(
            eq(bills.status, 'draft'),
            eq(bills.status, 'sent')
          )
        ));

      console.warn(`🧹 Cleaned up existing auto-generated bills for parent ${parentBillId}`);
    } catch (_error) {
      console.error('Error cleaning up existing generated bills:', _error);
    }
  }

  /**
   * Batch insert bills for performance.
   * @param billBatch
   */
  private async insertBillsBatch(billBatch: unknown[]): Promise<void> {
    try {
      await db.insert(bills).values(billBatch);
    } catch (_error) {
      console.error('Error inserting bill batch:', _error);
      throw error;
    }
  }

  /**
   * Update all future auto-generated bills when the parent bill is modified.
   * @param parentBillId
   * @param updates
   */
  async updateGeneratedBillsFromParent(parentBillId: string, updates: Partial<Bill>): Promise<{
    billsUpdated: number;
  }> {
    console.warn(`🔄 Updating generated bills for parent ${parentBillId}`);

    // Find all auto-generated bills for this parent
    const generatedBills = await db
      .select()
      .from(bills)
      .where(and(
        eq(bills.reference, parentBillId),
        eq(bills.autoGenerated, true)
      ));

    let billsUpdated = 0;

    for (const generatedBill of generatedBills) {
      const updatedFields: unknown = {};

      // Update fields that should propagate to generated bills
      if (updates.title) {
        // Preserve the date and part information in the title
        const titleParts = generatedBill.title.split(' - ');
        if (titleParts.length >= 2) {
          updatedFields.title = `${updates.title} - ${titleParts.slice(1).join(' - ')}`;
        }
      }

      if (updates.category) {updatedFields.category = updates.category;}
      if (updates.vendor) {updatedFields.vendor = updates.vendor;}
      if (updates.notes) {
        updatedFields.notes = `Auto-generated bill - ${updates.notes}`;
      }

      if (Object.keys(updatedFields).length > 0) {
        updatedFields.updatedAt = new Date();

        await db
          .update(bills)
          .set(updatedFields)
          .where(eq(bills.id, generatedBill.id));

        billsUpdated++;
      }
    }

    console.warn(`✅ Updated ${billsUpdated} generated bills`);

    return { billsUpdated };
  }

  /**
   * Delete future auto-generated bills with cascade options.
   * @param parentBillId
   * @param deleteAllFuture
   */
  async deleteGeneratedBills(parentBillId: string, deleteAllFuture: boolean = false): Promise<{
    billsDeleted: number;
  }> {
    console.warn(`🗑️ Deleting generated bills for parent ${parentBillId}, deleteAllFuture: ${deleteAllFuture}`);

    let whereCondition;

    if (deleteAllFuture) {
      // Delete all future auto-generated bills
      whereCondition = and(
        eq(bills.reference, parentBillId),
        eq(bills.autoGenerated, true),
        gte(bills.startDate, new Date().toISOString().split('T')[0])
      );
    } else {
      // Delete only unpaid bills (draft/sent status)
      whereCondition = and(
        eq(bills.reference, parentBillId),
        eq(bills.autoGenerated, true),
        or(
          eq(bills.status, 'draft'),
          eq(bills.status, 'sent')
        )
      );
    }

    const result = await db
      .delete(bills)
      .where(whereCondition);

    const billsDeleted = result.rowCount || 0;
    console.warn(`✅ Deleted ${billsDeleted} generated bills`);

    return { billsDeleted };
  }

  /**
   * Get statistics about generated bills for a parent bill.
   * @param parentBillId
   */
  async getGeneratedBillsStats(parentBillId: string): Promise<{
    totalGenerated: number;
    paidBills: number;
    pendingBills: number;
    futureBills: number;
    totalAmount: number;
    paidAmount: number;
  }> {
    const generatedBills = await db
      .select()
      .from(bills)
      .where(and(
        eq(bills.reference, parentBillId),
        eq(bills.autoGenerated, true)
      ));

    const today = new Date().toISOString().split('T')[0];
    
    const stats = {
      totalGenerated: generatedBills.length,
      paidBills: 0,
      pendingBills: 0,
      futureBills: 0,
      totalAmount: 0,
      paidAmount: 0
    };

    for (const bill of generatedBills) {
      const billAmount = parseFloat(bill.totalAmount);
      stats.totalAmount += billAmount;

      if (bill.status === 'paid') {
        stats.paidBills++;
        stats.paidAmount += billAmount;
      } else if (bill.startDate > today) {
        stats.futureBills++;
      } else {
        stats.pendingBills++;
      }
    }

    return stats;
  }

  /**
   * Mark a bill as paid and update related tracking.
   * @param billId
   * @param paymentDate
   */
  async markBillAsPaid(billId: string, paymentDate?: Date): Promise<void> {
    const paymentReceivedDate = paymentDate || new Date();

    await db
      .update(bills)
      .set({
        status: 'paid',
        notes: `Payment confirmed on ${paymentReceivedDate.toLocaleDateString()}`,
        updatedAt: new Date()
      })
      .where(eq(bills.id, billId));

    console.warn(`✅ Bill ${billId} marked as paid`);
  }

  /**
   * Get a system user for automated operations.
   */
  private async getSystemUser(): Promise<{ id: string }> {
    const systemUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'admin'))
      .limit(1);

    if (systemUsers.length === 0) {
      throw new Error('No active users found for system operations');
    }

    return systemUsers[0];
  }
}

// Export singleton instance
export const billGenerationService = new BillGenerationService();