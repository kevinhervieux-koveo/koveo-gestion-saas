import { db } from '../db';
import { bills, payments } from '@shared/schema';
import { eq, and, not, sql, lt } from 'drizzle-orm';
import type { Bill, InsertPayment } from '@shared/schema';

/**
 * Payment Generation Service
 * Automatically generates payment records for bills based on their payment type and schedule
 */
export class PaymentGenerationService {
  
  /**
   * Generate payments for a newly created bill
   */
  async generatePaymentsForBill(billId: string): Promise<void> {
    try {
      // Get the bill details
      const bill = await db.select().from(bills).where(eq(bills.id, billId)).limit(1);
      
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
            amount: billData.totalAmount,
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
        await db.insert(payments).values(paymentsToInsert);
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
  async updatePaymentsForBill(billId: string): Promise<void> {
    try {
      // Get the updated bill details
      const bill = await db.select().from(bills).where(eq(bills.id, billId)).limit(1);
      
      if (!bill || bill.length === 0) {
        throw new Error(`Bill with ID ${billId} not found`);
      }

      const billData = bill[0];

      // Delete existing payments that are still pending (keep paid ones)
      await db.delete(payments).where(
        and(
          eq(payments.billId, billId),
          eq(payments.status, 'pending')
        )
      );

      // Regenerate payments
      await this.generatePaymentsForBill(billId);
      
      console.log(`✅ Updated payments for bill ${billId}`);
    } catch (error) {
      console.error(`❌ Error updating payments for bill ${billId}:`, error);
      throw error;
    }
  }

  /**
   * Delete all payments when a bill is deleted
   */
  async deletePaymentsForBill(billId: string): Promise<void> {
    try {
      await db.delete(payments).where(eq(payments.billId, billId));
      console.log(`✅ Deleted all payments for bill ${billId}`);
    } catch (error) {
      console.error(`❌ Error deleting payments for bill ${billId}:`, error);
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
  async updatePaymentStatusFromBillStatus(billId: string, billStatus: 'draft' | 'sent' | 'overdue' | 'paid' | 'cancelled'): Promise<void> {
    try {
      const billPayments = await db.select().from(payments).where(eq(payments.billId, billId));
      
      if (billPayments.length === 0) {
        console.log(`⚠️ No payments found for bill ${billId}`);
        return;
      }

      switch (billStatus) {
        case 'draft':
          // Set all payments to pending
          await db.update(payments)
            .set({ status: 'pending', paidDate: null })
            .where(eq(payments.billId, billId));
          console.log(`✅ Set all payments for bill ${billId} to pending (draft status)`);
          break;

        case 'sent':
          // Payments become active - keep as pending but ready for processing
          // Only update payments that are not already paid or cancelled
          await db.update(payments)
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
          await db.update(payments)
            .set({ status: 'paid', paidDate: currentDate })
            .where(eq(payments.billId, billId));
          console.log(`✅ Marked all payments for bill ${billId} as paid`);
          break;

        case 'cancelled':
          // Cancel all pending payments (keep already paid ones as paid)
          await db.update(payments)
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
          await db.update(payments)
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
   */
  private generateRecurrentPayments(bill: Bill): InsertPayment[] {
    const payments: InsertPayment[] = [];
    const startDate = new Date(bill.startDate);
    const endDate = bill.endDate ? new Date(bill.endDate) : null;
    
    // Default to 12 months if no end date specified
    const maxPayments = 12;
    let paymentNumber = 1;

    if (bill.schedulePayment === 'custom' && bill.scheduleCustom && bill.scheduleCustom.length > 0) {
      // Custom schedule
      bill.scheduleCustom.forEach((dateStr, index) => {
        payments.push({
          billId: bill.id,
          paymentNumber: index + 1,
          scheduledDate: dateStr,
          amount: (bill.costs[index] ? bill.costs[index] : (parseFloat(bill.totalAmount) / bill.scheduleCustom!.length).toString()),
          status: 'pending',
        });
      });
    } else {
      // Standard schedule (weekly, monthly, quarterly, yearly)
      let currentDate = new Date(startDate);
      
      while (paymentNumber <= maxPayments && (!endDate || currentDate <= endDate)) {
        payments.push({
          billId: bill.id,
          paymentNumber,
          scheduledDate: currentDate.toISOString().split('T')[0],
          amount: (bill.costs[paymentNumber - 1] ? bill.costs[paymentNumber - 1] : (parseFloat(bill.totalAmount) / maxPayments).toString()),
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