import { db } from '../db';
import { submissionVendors } from '../../shared/schemas/maintenance';
import { eq, and } from 'drizzle-orm';
import type { SubmissionVendor } from '../../shared/schemas/maintenance';

/**
 * Project Payment Plan Service.
 * 
 * Handles payment plan generation and management for maintenance project vendors.
 * Follows the same patterns as the bill generation service for consistency.
 * Supports various payment schedules: weekly, monthly, quarterly, yearly, and custom.
 */
export class ProjectPaymentService {

  /**
   * Generate payment plan for selected vendor.
   * @param vendorId - ID of the submission vendor
   * @param totalCost - Total cost to be split into payments
   * @param schedule - Payment schedule (weekly, monthly, quarterly, yearly, custom)
   * @param customDates - Array of custom payment dates (required if schedule is 'custom')
   * @param startDate - When payments begin (defaults to current date)
   * @returns Payment plan with costs array and schedule
   */
  async generatePaymentPlan(
    vendorId: string,
    totalCost: number,
    schedule: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom',
    customDates?: Date[],
    startDate?: Date
  ): Promise<{
    costs: number[];
    schedule: typeof schedule;
    customDates?: string[];
    startDate: string;
    totalAmount: number;
  }> {
    // Validate inputs
    this.validatePaymentPlanInputs(totalCost, schedule, customDates);

    const planStartDate = startDate || new Date();
    
    // Calculate payment schedule and amounts
    const paymentSchedule = this.calculatePaymentSchedule(totalCost, schedule, planStartDate, customDates);
    
    // Format the response
    return {
      costs: paymentSchedule.amounts,
      schedule,
      customDates: schedule === 'custom' ? paymentSchedule.dates.map(d => d.toISOString().split('T')[0]) : undefined,
      startDate: planStartDate.toISOString().split('T')[0],
      totalAmount: totalCost
    };
  }

  /**
   * Validate payment plan structure and data integrity.
   * @param costs - Array of payment amounts
   * @param schedule - Payment schedule
   * @param customDates - Custom dates (if applicable)
   * @returns Validation result with errors if any
   */
  validatePaymentPlan(
    costs: number[],
    schedule: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom',
    customDates?: string[]
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate costs array
    if (!costs || costs.length === 0) {
      errors.push('Payment plan must have at least one payment amount');
    } else {
      // Check that all costs are positive
      costs.forEach((cost, index) => {
        if (cost <= 0) {
          errors.push(`Payment amount at index ${index} must be greater than 0`);
        }
      });
    }

    // Validate schedule-specific requirements
    if (schedule === 'custom') {
      if (!customDates || customDates.length === 0) {
        errors.push('Custom schedule requires custom dates');
      } else if (customDates.length !== costs.length) {
        errors.push('Number of custom dates must match number of payment amounts');
      } else {
        // Validate date formats and chronological order
        const dates = customDates.map(d => new Date(d));
        for (let i = 0; i < dates.length; i++) {
          if (isNaN(dates[i].getTime())) {
            errors.push(`Invalid date format at index ${i}: ${customDates[i]}`);
          }
          if (i > 0 && dates[i] <= dates[i - 1]) {
            errors.push(`Custom dates must be in chronological order`);
          }
        }
      }
    } else {
      // For standard schedules, validate that costs array has appropriate length
      if (costs.length > 12 && schedule !== 'monthly') {
        errors.push(`${schedule} schedule should not have more than 12 payments`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculate payment schedule dates and amounts based on schedule type.
   * Follows the same logic as bill generation service for consistency.
   * @param totalCost - Total amount to be paid
   * @param schedule - Payment frequency
   * @param startDate - Start date for payments
   * @param customDates - Custom payment dates (for custom schedule)
   * @returns Payment schedule with dates and amounts
   */
  calculatePaymentSchedule(
    totalCost: number,
    schedule: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom',
    startDate: Date,
    customDates?: Date[]
  ): { dates: Date[]; amounts: number[] } {
    if (schedule === 'custom') {
      if (!customDates || customDates.length === 0) {
        throw new Error('Custom dates are required for custom schedule');
      }
      
      // For custom schedule, split amount equally across dates
      const amountPerPayment = Number((totalCost / customDates.length).toFixed(2));
      const amounts = new Array(customDates.length - 1).fill(amountPerPayment);
      
      // Last payment gets any remaining amount due to rounding
      const remainingAmount = Number((totalCost - (amountPerPayment * (customDates.length - 1))).toFixed(2));
      amounts.push(remainingAmount);
      
      return {
        dates: [...customDates],
        amounts
      };
    }

    // For standard schedules, calculate based on frequency
    const scheduleConfig = this.getScheduleConfiguration(schedule);
    const paymentDates: Date[] = [];
    const currentDate = new Date(startDate);

    // Generate payment dates based on schedule
    for (let i = 0; i < scheduleConfig.numberOfPayments; i++) {
      paymentDates.push(new Date(currentDate));
      
      // Advance to next payment date
      if (i < scheduleConfig.numberOfPayments - 1) {
        this.advanceDateBySchedule(currentDate, schedule);
      }
    }

    // Calculate equal payment amounts
    const amountPerPayment = Number((totalCost / scheduleConfig.numberOfPayments).toFixed(2));
    const amounts = new Array(scheduleConfig.numberOfPayments - 1).fill(amountPerPayment);
    
    // Last payment gets any remaining amount due to rounding
    const remainingAmount = Number((totalCost - (amountPerPayment * (scheduleConfig.numberOfPayments - 1))).toFixed(2));
    amounts.push(remainingAmount);

    return {
      dates: paymentDates,
      amounts
    };
  }

  /**
   * Update payment plan for a submission vendor.
   * @param vendorId - ID of the submission vendor
   * @param paymentPlan - Payment plan data
   * @returns Updated submission vendor
   */
  async updateSubmissionVendorPaymentPlan(
    vendorId: string,
    paymentPlan: {
      costs: number[];
      schedule: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
      customDates?: string[];
      startDate: string;
    }
  ): Promise<SubmissionVendor> {
    // Validate the payment plan
    const validation = this.validatePaymentPlan(paymentPlan.costs, paymentPlan.schedule, paymentPlan.customDates);
    if (!validation.isValid) {
      throw new Error(`Invalid payment plan: ${validation.errors.join(', ')}`);
    }

    // Update the submission vendor with payment plan data
    const [updatedVendor] = await db
      .update(submissionVendors)
      .set({
        paymentPlanCosts: paymentPlan.costs.map(String), // Convert to string array for decimal array
        paymentPlanSchedule: paymentPlan.schedule,
        paymentPlanCustomDates: paymentPlan.customDates || null,
        paymentPlanStartDate: paymentPlan.startDate,
        updatedAt: new Date()
      })
      .where(eq(submissionVendors.id, vendorId))
      .returning();

    if (!updatedVendor) {
      throw new Error(`Submission vendor with ID ${vendorId} not found`);
    }

    return updatedVendor;
  }

  /**
   * Get payment plan for a submission vendor.
   * @param vendorId - ID of the submission vendor
   * @returns Payment plan data or null if not found
   */
  async getSubmissionVendorPaymentPlan(vendorId: string): Promise<{
    costs: number[];
    schedule: string;
    customDates?: string[];
    startDate: string;
  } | null> {
    const vendor = await db
      .select({
        paymentPlanCosts: submissionVendors.paymentPlanCosts,
        paymentPlanSchedule: submissionVendors.paymentPlanSchedule,
        paymentPlanCustomDates: submissionVendors.paymentPlanCustomDates,
        paymentPlanStartDate: submissionVendors.paymentPlanStartDate
      })
      .from(submissionVendors)
      .where(eq(submissionVendors.id, vendorId))
      .limit(1);

    if (vendor.length === 0 || !vendor[0].paymentPlanCosts) {
      return null;
    }

    const vendorData = vendor[0];
    
    return {
      costs: vendorData.paymentPlanCosts.map(Number), // Convert string array back to numbers
      schedule: vendorData.paymentPlanSchedule || 'monthly',
      customDates: vendorData.paymentPlanCustomDates || undefined,
      startDate: vendorData.paymentPlanStartDate || new Date().toISOString().split('T')[0]
    };
  }

  /**
   * Remove payment plan from a submission vendor.
   * @param vendorId - ID of the submission vendor
   * @returns Updated submission vendor
   */
  async removeSubmissionVendorPaymentPlan(vendorId: string): Promise<SubmissionVendor> {
    const [updatedVendor] = await db
      .update(submissionVendors)
      .set({
        paymentPlanCosts: null,
        paymentPlanSchedule: null,
        paymentPlanCustomDates: null,
        paymentPlanStartDate: null,
        updatedAt: new Date()
      })
      .where(eq(submissionVendors.id, vendorId))
      .returning();

    if (!updatedVendor) {
      throw new Error(`Submission vendor with ID ${vendorId} not found`);
    }

    return updatedVendor;
  }

  // Private helper methods

  /**
   * Validate payment plan inputs.
   */
  private validatePaymentPlanInputs(
    totalCost: number,
    schedule: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom',
    customDates?: Date[]
  ): void {
    if (totalCost <= 0) {
      throw new Error('Total cost must be greater than 0');
    }

    if (schedule === 'custom' && (!customDates || customDates.length === 0)) {
      throw new Error('Custom dates are required for custom schedule');
    }

    const validSchedules = ['weekly', 'monthly', 'quarterly', 'yearly', 'custom'];
    if (!validSchedules.includes(schedule)) {
      throw new Error(`Invalid schedule: ${schedule}. Must be one of: ${validSchedules.join(', ')}`);
    }
  }

  /**
   * Get configuration for standard payment schedules.
   */
  private getScheduleConfiguration(schedule: 'weekly' | 'monthly' | 'quarterly' | 'yearly'): {
    numberOfPayments: number;
  } {
    switch (schedule) {
      case 'weekly':
        return { numberOfPayments: 4 }; // Default to 4 weekly payments
      case 'monthly':
        return { numberOfPayments: 12 }; // Default to 12 monthly payments
      case 'quarterly':
        return { numberOfPayments: 4 }; // 4 quarterly payments
      case 'yearly':
        return { numberOfPayments: 1 }; // Single yearly payment
      default:
        throw new Error(`Unsupported schedule: ${schedule}`);
    }
  }

  /**
   * Advance date based on schedule type.
   */
  private advanceDateBySchedule(date: Date, schedule: 'weekly' | 'monthly' | 'quarterly' | 'yearly'): void {
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
    }
  }
}

// Export singleton instance
export const projectPaymentService = new ProjectPaymentService();