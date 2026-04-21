import { db } from '../db';
import { bills, payments } from '@shared/schema';
import { eq, and, not, sql, lt } from 'drizzle-orm';
import type { Bill, InsertPayment } from '@shared/schema';
import type { DrizzleTransaction, DatabaseContext } from '../types/transaction';

/**
 * Payment Generation Service
 * Automatically generates payment records for bills based on their payment type and schedule
 */
export class PaymentGenerationService {
  
  /**
   * Helper method to determine effective bill type (supports both new billType and legacy paymentType)
   * Backward compatibility: billType (new) takes precedence, fallback to paymentType (legacy)
   */
  private getEffectiveBillType(billData: Bill): 'unique' | 'recurrent' | 'auto-generated' {
    return (billData.billType || billData.paymentType) as 'unique' | 'recurrent' | 'auto-generated';
  }

  /**
   * Check if a unique bill has custom installment payments
   * Returns true if the bill has paymentStructure='installment' with costs/scheduleCustom arrays
   */
  private hasCustomInstallments(billData: Bill): boolean {
    console.log(`🔍 [hasCustomInstallments] Checking bill:`, {
      paymentStructure: billData.paymentStructure,
      schedulePayment: billData.schedulePayment,
      costs: billData.costs,
      costsType: typeof billData.costs,
      costsIsArray: Array.isArray(billData.costs),
      scheduleCustom: billData.scheduleCustom,
      scheduleCustomType: typeof billData.scheduleCustom,
      scheduleCustomIsArray: Array.isArray(billData.scheduleCustom),
    });
    
    // Check for custom schedule based on schedulePayment field
    if (billData.schedulePayment === 'custom') {
      console.log(`✅ [hasCustomInstallments] Bill has schedulePayment='custom'`);
      return true;
    }
    
    if (billData.paymentStructure !== 'installment') {
      console.log(`❌ [hasCustomInstallments] Not installment, returning false`);
      return false;
    }
    
    // Handle costs - can be string[], number[], or undefined
    const costs = billData.costs as unknown[];
    const scheduleCustom = billData.scheduleCustom as unknown[];
    
    const hasMultipleCosts = costs && Array.isArray(costs) && costs.length > 1;
    const hasScheduleCustom = scheduleCustom && Array.isArray(scheduleCustom) && scheduleCustom.length > 0;
    
    const result = hasMultipleCosts || hasScheduleCustom;
    console.log(`🔍 [hasCustomInstallments] Result:`, { hasMultipleCosts, hasScheduleCustom, result });
    
    return result;
  }

  /**
   * Generate payments for unique bills with custom installment schedules
   * Creates one payment per entry in costs/scheduleCustom arrays
   */
  private generateCustomInstallmentPayments(billId: string, billData: Bill): InsertPayment[] {
    const paymentsToInsert: InsertPayment[] = [];
    const costs = (billData.costs as string[] | null) || [];
    const scheduleCustom = (billData.scheduleCustom as string[] | null) || [];
    
    console.log(`📋 Generating custom installment payments: ${costs.length} costs, ${scheduleCustom.length} dates`);
    
    // Generate one payment for each entry in the costs array
    for (let i = 0; i < costs.length; i++) {
      const amount = costs[i];
      // Use custom date if available, otherwise use start date
      const scheduledDate = scheduleCustom[i] && scheduleCustom[i].trim() !== '' 
        ? scheduleCustom[i] 
        : billData.startDate;
      
      paymentsToInsert.push({
        billId,
        paymentNumber: i + 1,
        scheduledDate,
        amount: amount || '0',
        status: 'pending',
      });
      
      console.log(`  Payment ${i + 1}: $${amount} on ${scheduledDate}`);
    }
    
    return paymentsToInsert;
  }
  
  /**
   * Generate payments for a newly created bill
   */
  async generatePaymentsForBill(billId: string, tx?: DrizzleTransaction): Promise<void> {
    try {
      // Use transaction if provided, otherwise use global db
      const dbContext: DatabaseContext = tx || db;
      
      // Get the bill details
      const bill = await dbContext.select().from(bills).where(eq(bills.id, billId)).limit(1);
      
      if (!bill || bill.length === 0) {
        throw new Error(`Bill with ID ${billId} not found`);
      }

      const billData = bill[0];
      const paymentsToInsert: InsertPayment[] = [];
      
      // Use helper to get effective bill type (supports both new and legacy fields)
      const effectiveBillType = this.getEffectiveBillType(billData);

      switch (effectiveBillType) {
        case 'unique':
          // Check if this is a unique bill with custom installment payments
          if (this.hasCustomInstallments(billData)) {
            const customPayments = this.generateCustomInstallmentPayments(billId, billData);
            paymentsToInsert.push(...customPayments);
          } else {
            // Single payment for simple unique bills
            paymentsToInsert.push({
              billId,
              paymentNumber: 1,
              scheduledDate: billData.startDate, // This is already a string in YYYY-MM-DD format from Drizzle
              amount: billData.totalAmount.toString(),
              status: 'pending',
            });
          }
          break;

        case 'recurrent':
        case 'auto-generated':
          // Generate multiple payments based on schedule
          const generatedPayments = this.generateRecurrentPayments(billData);
          paymentsToInsert.push(...generatedPayments);
          break;

        default:
          throw new Error(`Unsupported payment type: ${effectiveBillType}`);
      }

      // Insert all generated payments
      if (paymentsToInsert.length > 0) {
        await dbContext.insert(payments).values(paymentsToInsert);
        console.log(`✅ Generated ${paymentsToInsert.length} payments for bill ${billId}`);
      }
    } catch (error) {
      console.error(`❌ Error generating payments for bill ${billId}:`, error);
      throw error;
    }
  }

  /**
   * Update payments when a bill is edited
   */
  async updatePaymentsForBill(billId: string, tx?: DrizzleTransaction): Promise<void> {
    try {
      // Use transaction if provided, otherwise use global db
      const dbContext: DatabaseContext = tx || db;
      
      // Get the updated bill details
      const bill = await dbContext.select().from(bills).where(eq(bills.id, billId)).limit(1);
      
      if (!bill || bill.length === 0) {
        throw new Error(`Bill with ID ${billId} not found`);
      }

      const billData = bill[0];

      // Get all existing payments for this bill
      const existingPayments = await dbContext.select().from(payments)
        .where(eq(payments.billId, billId))
        .orderBy(payments.paymentNumber);

      // Find the last paid payment to determine where to continue the sequence
      const paidPayments = existingPayments.filter(p => p.status === 'paid');
      const lastPaidPayment = paidPayments.length > 0 
        ? paidPayments[paidPayments.length - 1] 
        : null;

      // Delete all unpaid payments (pending + overdue) to regenerate with updated amounts
      // Only preserve payments that have already been paid
      await dbContext.delete(payments).where(
        and(
          eq(payments.billId, billId),
          not(eq(payments.status, 'paid'))
        )
      );

      // Regenerate payments starting from where paid payments left off
      const effectiveBillType = this.getEffectiveBillType(billData);
      
      if (effectiveBillType === 'unique') {
        // For unique payments, check if it has custom installments
        if (this.hasCustomInstallments(billData)) {
          // For custom installments, regenerate unpaid payments based on the payment number
          const paidPaymentNumbers = new Set(paidPayments.map(p => p.paymentNumber));
          const allCustomPayments = this.generateCustomInstallmentPayments(billId, billData);
          // Only insert payments that haven't been paid yet
          const unpaidCustomPayments = allCustomPayments.filter(p => !paidPaymentNumbers.has(p.paymentNumber));
          if (unpaidCustomPayments.length > 0) {
            await dbContext.insert(payments).values(unpaidCustomPayments);
          }
        } else if (!lastPaidPayment) {
          // Simple unique bill - only regenerate if no payments have been made
          const paymentsToInsert: InsertPayment[] = [{
            billId,
            paymentNumber: 1,
            scheduledDate: billData.startDate,
            amount: billData.totalAmount.toString(),
            status: 'pending',
          }];
          await dbContext.insert(payments).values(paymentsToInsert);
        }
      } else {
        // For recurrent payments, continue from where paid payments left off
        const startingPaymentNumber = lastPaidPayment ? lastPaidPayment.paymentNumber + 1 : 1;
        const startingDate = lastPaidPayment ? this.calculateNextPaymentDate(lastPaidPayment.scheduledDate, billData.schedulePayment) : billData.startDate;
        
        const generatedPayments = this.generateRecurrentPayments(
          billData, 
          startingPaymentNumber, 
          startingDate
        );
        
        if (generatedPayments.length > 0) {
          await dbContext.insert(payments).values(generatedPayments);
        }
      }
      
      console.log(`✅ Updated payments for bill ${billId}`);
    } catch (error) {
      console.error(`❌ Error updating payments for bill ${billId}:`, error);
      throw error;
    }
  }

  /**
   * Delete all payments when a bill is deleted
   */
  async deletePaymentsForBill(billId: string, tx?: DrizzleTransaction): Promise<void> {
    try {
      // Use transaction if provided, otherwise use global db
      const dbContext: DatabaseContext = tx || db;
      
      await dbContext.delete(payments).where(eq(payments.billId, billId));
      console.log(`✅ Deleted all payments for bill ${billId}`);
    } catch (error) {
      console.error(`❌ Error deleting payments for bill ${billId}:`, error);
      throw error;
    }
  }

  /**
   * Completely regenerate payment schedule for recurrent bills
   * Deletes ALL existing payments (including paid ones) and creates new schedule from scratch
   * This is used when payment structure or pricing changes significantly
   */
  async regenerateCompletePaymentSchedule(billId: string, tx?: DrizzleTransaction): Promise<{ deletedCount: number; createdCount: number }> {
    try {
      // Use transaction if provided, otherwise use global db
      const dbContext: DatabaseContext = tx || db;
      
      // Get the bill details
      const bill = await dbContext.select().from(bills).where(eq(bills.id, billId)).limit(1);
      
      if (!bill || bill.length === 0) {
        throw new Error(`Bill with ID ${billId} not found`);
      }

      const billData = bill[0];

      // Get count of existing payments for logging
      const existingPayments = await dbContext.select().from(payments).where(eq(payments.billId, billId));
      const deletedCount = existingPayments.length;

      // Delete ALL existing payments (including paid ones)
      await dbContext.delete(payments).where(eq(payments.billId, billId));
      console.log(`🗑️ Deleted ${deletedCount} existing payments for bill ${billId} (including paid payments)`);

      // Regenerate the complete payment schedule from scratch
      const paymentsToInsert: InsertPayment[] = [];
      const effectiveBillType = this.getEffectiveBillType(billData);

      switch (effectiveBillType) {
        case 'unique':
          // Check if this is a unique bill with custom installment payments
          if (this.hasCustomInstallments(billData)) {
            const customPayments = this.generateCustomInstallmentPayments(billId, billData);
            paymentsToInsert.push(...customPayments);
          } else {
            // Single payment for simple unique bills
            paymentsToInsert.push({
              billId,
              paymentNumber: 1,
              scheduledDate: billData.startDate,
              amount: billData.totalAmount.toString(),
              status: 'pending',
            });
          }
          break;

        case 'recurrent':
        case 'auto-generated':
          // Generate complete payment schedule from the beginning
          const generatedPayments = this.generateRecurrentPayments(billData);
          paymentsToInsert.push(...generatedPayments);
          break;

        default:
          throw new Error(`Unsupported payment type: ${effectiveBillType}`);
      }

      // Insert all new payments
      if (paymentsToInsert.length > 0) {
        await dbContext.insert(payments).values(paymentsToInsert);
        console.log(`✅ Generated ${paymentsToInsert.length} new payments for bill ${billId} (complete regeneration)`);
      }

      return {
        deletedCount,
        createdCount: paymentsToInsert.length
      };
    } catch (error) {
      console.error(`❌ Error regenerating complete payment schedule for bill ${billId}:`, error);
      throw error;
    }
  }

  /**
   * Update payment status and cascade to bill status if needed
   */
  async updatePaymentStatus(paymentId: string, status: 'pending' | 'overdue' | 'paid' | 'cancelled', paidDate?: string): Promise<void> {
    try {
      const updateData: any = { status };
      if (status === 'paid' && paidDate) {
        updateData.paidDate = paidDate;
      }

      await db.update(payments)
        .set(updateData)
        .where(eq(payments.id, paymentId));

      // Check if we need to update the bill status
      const payment = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
      if (payment.length > 0) {
        await this.updateBillStatusBasedOnPayments(payment[0].billId);
      }

      console.log(`✅ Updated payment ${paymentId} status to ${status}`);
    } catch (error) {
      console.error(`❌ Error updating payment status:`, error);
      throw error;
    }
  }

  /**
   * Update associated payments when bill status changes
   * Implements the status management flow:
   * - draft → all payments pending
   * - sent → payments become active (remain pending but ready for processing)
   * - paid → mark all payments as paid
   * - cancelled → cancel all pending payments
   */
  async updatePaymentStatusFromBillStatus(billId: string, billStatus: 'draft' | 'sent' | 'overdue' | 'paid' | 'cancelled', tx?: DrizzleTransaction): Promise<void> {
    try {
      // Use transaction if provided, otherwise use global db
      const dbContext: DatabaseContext = tx || db;
      
      const billPayments = await dbContext.select().from(payments).where(eq(payments.billId, billId));
      
      if (billPayments.length === 0) {
        console.log(`⚠️ No payments found for bill ${billId}`);
        return;
      }

      switch (billStatus) {
        case 'draft':
          // Set all payments to pending
          await dbContext.update(payments)
            .set({ status: 'pending', paidDate: null })
            .where(eq(payments.billId, billId));
          console.log(`✅ Set all payments for bill ${billId} to pending (draft status)`);
          break;

        case 'sent':
          // Payments become active - keep as pending but ready for processing
          // Only update payments that are not already paid or cancelled
          await dbContext.update(payments)
            .set({ status: 'pending' })
            .where(
              and(
                eq(payments.billId, billId),
                not(eq(payments.status, 'paid')),
                not(eq(payments.status, 'cancelled'))
              )
            );
          console.log(`✅ Activated payments for bill ${billId} (sent status)`);
          break;

        case 'paid':
          // Mark all payments as paid with current date
          const currentDate = new Date().toISOString();
          await dbContext.update(payments)
            .set({ status: 'paid', paidDate: currentDate })
            .where(eq(payments.billId, billId));
          console.log(`✅ Marked all payments for bill ${billId} as paid`);
          break;

        case 'cancelled':
          // Cancel all pending payments (keep already paid ones as paid)
          await dbContext.update(payments)
            .set({ status: 'cancelled' })
            .where(
              and(
                eq(payments.billId, billId),
                sql`${payments.status} IN ('pending', 'overdue')`
              )
            );
          console.log(`✅ Cancelled pending payments for bill ${billId}`);
          break;

        case 'overdue':
          // Update overdue payments based on their due dates
          const today = new Date().toISOString().split('T')[0];
          await dbContext.update(payments)
            .set({ status: 'overdue' })
            .where(
              and(
                eq(payments.billId, billId),
                eq(payments.status, 'pending'),
                lt(payments.scheduledDate, today)
              )
            );
          console.log(`✅ Updated overdue payments for bill ${billId}`);
          break;

        default:
          console.log(`⚠️ Unknown bill status: ${billStatus}`);
      }
    } catch (error) {
      console.error(`❌ Error updating payments for bill status change:`, error);
      throw error;
    }
  }

  /**
   * Update bill status based on payment statuses
   * 
   * Status rules:
   * - Cancelled bills: never auto-change (manual only)
   * - Draft bills with no paid/overdue payments: keep draft
   * - Any late payment (scheduled date passed, not paid): overdue
   * - 100% paid: paid
   * - Between 0% and 100% paid: sent (frontend shows "Sent (partially paid)")
   * - No payments made and none overdue: sent (or draft if was draft)
   */
  async updateBillStatusBasedOnPayments(billId: string): Promise<void> {
    try {
      // Get current bill status first
      const currentBill = await db.select({ status: bills.status }).from(bills).where(eq(bills.id, billId)).limit(1);
      
      if (currentBill.length === 0) {
        console.log(`⚠️ Bill ${billId} not found`);
        return;
      }
      
      const currentStatus = currentBill[0].status;
      
      // Never auto-change cancelled bills
      if (currentStatus === 'cancelled') {
        console.log(`ℹ️ Bill ${billId} is cancelled - skipping automatic status update`);
        return;
      }
      
      const billPayments = await db.select().from(payments).where(eq(payments.billId, billId));
      
      if (billPayments.length === 0) return;

      const today = new Date().toISOString().split('T')[0];
      
      // First, update any pending payments that are past their scheduled date to overdue
      await db.update(payments)
        .set({ status: 'overdue' })
        .where(
          and(
            eq(payments.billId, billId),
            eq(payments.status, 'pending'),
            lt(payments.scheduledDate, today)
          )
        );
      
      // Re-fetch payments after updating overdue status
      const updatedPayments = await db.select().from(payments).where(eq(payments.billId, billId));
      
      // Filter out cancelled payments - all calculations should be based on active payments only
      const activePayments = updatedPayments.filter(p => p.status !== 'cancelled');
      const effectiveTotal = activePayments.length;
      
      // Count payment statuses from the active payments set
      const paidCount = activePayments.filter(p => p.status === 'paid').length;
      const overdueCount = activePayments.filter(p => p.status === 'overdue').length;
      const pendingCount = activePayments.filter(p => p.status === 'pending').length;
      
      let newBillStatus: 'draft' | 'sent' | 'overdue' | 'paid' | 'cancelled' = currentStatus;

      if (effectiveTotal === 0) {
        // All payments cancelled - keep current status
        return;
      } else if (paidCount === effectiveTotal) {
        // 100% paid (all active payments are paid)
        newBillStatus = 'paid';
      } else if (overdueCount > 0) {
        // Any late payment = overdue
        newBillStatus = 'overdue';
      } else if (paidCount > 0 && paidCount < effectiveTotal) {
        // Between 0% and 100% paid = sent (partially paid - display handled in frontend)
        newBillStatus = 'sent';
      } else if (paidCount === 0 && pendingCount > 0) {
        // No payments made yet, none overdue
        // Keep draft if it was draft, otherwise set to sent
        if (currentStatus === 'draft') {
          newBillStatus = 'draft';
        } else {
          newBillStatus = 'sent';
        }
      }

      // Only update if status actually changed
      if (newBillStatus !== currentStatus) {
        await db.update(bills)
          .set({ status: newBillStatus })
          .where(eq(bills.id, billId));
        console.log(`✅ Updated bill ${billId} status from ${currentStatus} to ${newBillStatus}`);
      }
    } catch (error) {
      console.error(`❌ Error updating bill status:`, error);
      throw error;
    }
  }

  /**
   * Generate payment schedule for recurrent bills
   * @param bill The bill data
   * @param startingPaymentNumber The payment number to start from (default: 1)
   * @param startingDate The date to start from (default: bill.startDate)
   */
  private generateRecurrentPayments(
    bill: Bill, 
    startingPaymentNumber: number = 1, 
    startingDate: string = bill.startDate
  ): InsertPayment[] {
    const payments: InsertPayment[] = [];
    const startDate = new Date(startingDate);
    const endDate = bill.endDate ? new Date(bill.endDate) : null;
    
    // Normalize costs array - PostgreSQL returns numeric[] as string representation
    const costsArray = Array.isArray(bill.costs) ? bill.costs : [];
    const costsCount = costsArray.length;
    
    // Calculate maxPayments and paymentAmount based on schedule type
    let maxPayments: number;
    let paymentAmount: string;
    
    if (bill.schedulePayment === 'yearly') {
      // For yearly bills: one full payment per yearInterval (default 1 year)
      const yearInterval = bill.yearInterval || 1; // Default to 1 year if not specified
      
      if (endDate) {
        // Calculate total years between start and end date
        const totalYears = (endDate.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        // Calculate number of payments needed based on year interval
        maxPayments = Math.max(1, Math.ceil(totalYears / yearInterval));
      } else {
        // For recurring yearly bills with single payment structure:
        // Each bill instance represents ONE year and should have exactly ONE payment
        // The bill auto-generation system creates a new bill instance for each year
        if (bill.billType === 'recurrent' && bill.paymentStructure === 'single' && bill.schedulePayment === 'yearly' && costsCount <= 1) {
          maxPayments = 1; // ONE payment per bill instance
        } else {
          // For legacy bills or installment plans without end date:
          // Default to 10 occurrences for yearly bills without end date
          maxPayments = 10;
        }
      }
      // Each payment is the full totalAmount (not divided)
      paymentAmount = bill.totalAmount.toString();
    } else {
      // For monthly, quarterly, weekly: calculate appropriate number of payments
      // Default to 1 year of payments if no end date specified
      if (endDate) {
        // Calculate based on actual time period
        const timeDiff = endDate.getTime() - startDate.getTime();
        const daysDiff = Math.ceil(timeDiff / (24 * 60 * 60 * 1000));
        
        switch (bill.schedulePayment) {
          case 'weekly':
            maxPayments = Math.max(1, Math.ceil(daysDiff / 7));
            break;
          case 'monthly':
            const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                             (endDate.getMonth() - startDate.getMonth());
            maxPayments = Math.max(1, monthsDiff + 1);
            break;
          case 'quarterly':
            const quartersDiff = Math.ceil(daysDiff / 90);
            maxPayments = Math.max(1, quartersDiff);
            break;
          default:
            maxPayments = 12; // Default to 12 monthly payments
        }
      } else {
        // No end date: default to 1 year of payments
        switch (bill.schedulePayment) {
          case 'weekly':
            maxPayments = 52; // 52 weeks in a year
            break;
          case 'monthly':
            maxPayments = 12; // 12 months in a year
            break;
          case 'quarterly':
            maxPayments = 4; // 4 quarters in a year
            break;
          default:
            maxPayments = 12; // Default to 12 monthly payments
        }
      }
      
      // If costs array exists and has items (installment plan), use it to determine payment count
      // The costs array contains [initial, recurring, recurring, ...] for installment plans
      if (costsCount > 0) {
        // For installment plans (especially fiscal year split bills), the costs array is the source of truth
        // Use the EXACT costs count as maxPayments, don't inflate it
        maxPayments = costsCount;
      }
      
      // Divide total amount by number of payments (fallback if no costs array)
      paymentAmount = (parseFloat(bill.totalAmount.toString()) / maxPayments).toString();
    }
    
    let paymentNumber = startingPaymentNumber;

    if (bill.schedulePayment === 'custom') {
      // Custom schedule - use costs array as the source of truth for payment count
      // scheduleCustom provides dates, costs provides amounts
      const startIndex = startingPaymentNumber - 1;
      const scheduleCustomArray = (bill.scheduleCustom as string[] | null) || [];
      
      // Use costs array length as the authoritative payment count for custom schedules
      // This handles cases where scheduleCustom might be empty but costs has entries
      const paymentCount = Math.max(costsCount, scheduleCustomArray.length);
      
      console.log(`📋 [CUSTOM SCHEDULE] Generating ${paymentCount} payments: ${costsCount} costs, ${scheduleCustomArray.length} dates`);
      
      if (paymentCount > 0) {
        for (let i = startIndex; i < paymentCount; i++) {
          // Use custom date if available, otherwise fall back to start date
          const customDate = scheduleCustomArray[i];
          const scheduledDate = customDate && customDate.toString().trim() !== '' 
            ? customDate.toString() 
            : bill.startDate;
          
          // Use cost from costs array, or calculate from total
          const amount = costsArray[i] 
            ? costsArray[i].toString() 
            : (parseFloat(bill.totalAmount.toString()) / paymentCount).toString();
          
          payments.push({
            billId: bill.id,
            paymentNumber: i + 1,
            scheduledDate,
            amount,
            status: 'pending',
          });
          
          console.log(`  Payment ${i + 1}: $${amount} on ${scheduledDate}`);
        }
        return payments;
      }
    }
    
    // Standard schedule (weekly, monthly, quarterly, yearly) or empty custom schedule fallback
    {
      // Standard schedule (weekly, monthly, quarterly, yearly)
      let currentDate = new Date(startDate);
      const billStartDate = new Date(bill.startDate);
      
      while (paymentNumber <= maxPayments && (!endDate || currentDate <= endDate)) {
        // If costs array exists and we've generated all its payments, stop
        if (costsCount > 0 && paymentNumber > costsCount) {
          break;
        }
        
        // Only generate payments that fall within the bill's date range
        // This is critical for fiscal year split bills where payments must respect FY boundaries
        if (currentDate >= billStartDate && (!endDate || currentDate <= endDate)) {
          // Determine payment amount:
          // 1. If costs array has this index, use it
          // 2. If costs array exists but index is out of range, use the last value (for installment plans)
          // 3. Otherwise use the calculated paymentAmount
          let currentPaymentAmount: string;
          if (costsCount > 0) {
            if (paymentNumber - 1 < costsCount) {
              // Use the cost at this index
              currentPaymentAmount = costsArray[paymentNumber - 1].toString();
            } else {
              // Use the last recurring amount from costs array
              currentPaymentAmount = costsArray[costsCount - 1].toString();
            }
          } else {
            // No costs array, use calculated amount
            currentPaymentAmount = paymentAmount;
          }
          
          payments.push({
            billId: bill.id,
            paymentNumber,
            scheduledDate: currentDate.toISOString().split('T')[0],
            amount: currentPaymentAmount,
            status: 'pending',
          });
          
          paymentNumber++;
        }

        // Calculate next payment date (always advance the date, even if we skipped this payment)
        switch (bill.schedulePayment) {
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
            // Use yearInterval if specified, otherwise default to 1 year
            const yearInterval = bill.yearInterval || 1;
            currentDate.setFullYear(currentDate.getFullYear() + yearInterval);
            break;
          default:
            // Default to monthly if schedule not specified
            currentDate.setMonth(currentDate.getMonth() + 1);
        }
      }
    }

    return payments;
  }

  /**
   * Calculate the next payment date based on the schedule
   */
  private calculateNextPaymentDate(lastDate: string, schedule: string): string {
    const date = new Date(lastDate);
    
    switch (schedule) {
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'quarterly':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
      default:
        // Default to monthly
        date.setMonth(date.getMonth() + 1);
    }
    
    return date.toISOString().split('T')[0];
  }

  /**
   * Get payments for a specific bill
   */
  async getPaymentsForBill(billId: string) {
    try {
      return await db.select().from(payments)
        .where(eq(payments.billId, billId))
        .orderBy(payments.paymentNumber);
    } catch (error) {
      console.error(`❌ Error fetching payments for bill ${billId}:`, error);
      throw error;
    }
  }

  /**
   * Check for overdue payments and update their status
   */
  async updateOverduePayments(): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Find payments that are past due and still pending
      const overduePayments = await db.select()
        .from(payments)
        .where(
          and(
            eq(payments.status, 'pending'),
            // Payment is overdue if scheduled date is before today
            sql`${payments.scheduledDate} < ${today}`
          )
        );

      if (overduePayments.length > 0) {
        // Update to overdue status
        for (const payment of overduePayments) {
          await this.updatePaymentStatus(payment.id, 'overdue');
        }
        console.log(`✅ Updated ${overduePayments.length} payments to overdue status`);
      }
    } catch (error) {
      console.error(`❌ Error updating overdue payments:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const paymentGenerationService = new PaymentGenerationService();