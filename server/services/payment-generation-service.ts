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

      switch (billData.paymentType) {
        case 'unique':
          // Single payment for unique bills
          paymentsToInsert.push({
            billId,
            paymentNumber: 1,
            scheduledDate: billData.startDate, // This is already a string in YYYY-MM-DD format from Drizzle
            amount: billData.totalAmount.toString(),
            status: 'pending',
          });
          break;

        case 'recurrent':
        case 'auto-generated':
          // Generate multiple payments based on schedule
          const generatedPayments = this.generateRecurrentPayments(billData);
          paymentsToInsert.push(...generatedPayments);
          break;

        default:
          throw new Error(`Unsupported payment type: ${billData.paymentType}`);
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
      if (billData.paymentType === 'unique') {
        // For unique payments, only regenerate if no payments have been made
        if (!lastPaidPayment) {
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

      switch (billData.paymentType) {
        case 'unique':
          // Single payment for unique bills
          paymentsToInsert.push({
            billId,
            paymentNumber: 1,
            scheduledDate: billData.startDate,
            amount: billData.totalAmount.toString(),
            status: 'pending',
          });
          break;

        case 'recurrent':
        case 'auto-generated':
          // Generate complete payment schedule from the beginning
          const generatedPayments = this.generateRecurrentPayments(billData);
          paymentsToInsert.push(...generatedPayments);
          break;

        default:
          throw new Error(`Unsupported payment type: ${billData.paymentType}`);
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
   */
  private async updateBillStatusBasedOnPayments(billId: string): Promise<void> {
    try {
      const billPayments = await db.select().from(payments).where(eq(payments.billId, billId));
      
      if (billPayments.length === 0) return;

      const paidCount = billPayments.filter(p => p.status === 'paid').length;
      const overdueCount = billPayments.filter(p => p.status === 'overdue').length;
      const totalCount = billPayments.length;

      let newBillStatus: 'draft' | 'sent' | 'overdue' | 'paid' | 'cancelled' = 'sent';

      if (paidCount === totalCount) {
        newBillStatus = 'paid';
      } else if (overdueCount > 0) {
        newBillStatus = 'overdue';
      }

      await db.update(bills)
        .set({ status: newBillStatus })
        .where(eq(bills.id, billId));

      console.log(`✅ Updated bill ${billId} status to ${newBillStatus}`);
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
    
    // Default to 12 months if no end date specified
    const maxPayments = 12;
    let paymentNumber = startingPaymentNumber;

    if (bill.schedulePayment === 'custom' && bill.scheduleCustom && bill.scheduleCustom.length > 0) {
      // Custom schedule - start from the appropriate index
      const startIndex = startingPaymentNumber - 1;
      
      for (let i = startIndex; i < bill.scheduleCustom.length; i++) {
        const dateStr = bill.scheduleCustom[i];
        payments.push({
          billId: bill.id,
          paymentNumber: i + 1,
          scheduledDate: dateStr,
          amount: bill.costs[i] ? bill.costs[i].toString() : (parseFloat(bill.totalAmount.toString()) / bill.scheduleCustom.length).toString(),
          status: 'pending',
        });
      }
    } else {
      // Standard schedule (weekly, monthly, quarterly, yearly)
      let currentDate = new Date(startDate);
      
      while (paymentNumber <= maxPayments && (!endDate || currentDate <= endDate)) {
        payments.push({
          billId: bill.id,
          paymentNumber,
          scheduledDate: currentDate.toISOString().split('T')[0],
          amount: bill.costs[paymentNumber - 1] ? bill.costs[paymentNumber - 1].toString() : (parseFloat(bill.totalAmount.toString()) / maxPayments).toString(),
          status: 'pending',
        });

        // Calculate next payment date
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
            currentDate.setFullYear(currentDate.getFullYear() + 1);
            break;
          default:
            // Default to monthly if schedule not specified
            currentDate.setMonth(currentDate.getMonth() + 1);
        }

        paymentNumber++;
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