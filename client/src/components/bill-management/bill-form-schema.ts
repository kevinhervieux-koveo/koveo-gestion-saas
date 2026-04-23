import { z } from 'zod';
import { BILL_CATEGORIES } from '@shared/schemas/financial';
import type { Bill } from '@shared/schema';

export interface FieldConfidenceData {
  vendorName: number;
  totalAmount: number;
  dueDate: number;
  category: number;
  paymentType: number;
  frequency: number;
}

export type CustomPayment = {
  amount: string;
  date: string;
  description?: string;
};

export interface ModularBillFormProps {
  bill?: Bill | null;
  isTemplate?: boolean;
  onSuccess?: (billId: string, action: 'created' | 'updated') => void;
  onCancel?: () => void;
  buildingId?: string;
}

export const billFormSchema = z.object({
  title: z.string().min(1, 'Bill title is required').max(200, 'Title must be less than 200 characters'),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  category: z.enum(BILL_CATEGORIES),
  vendor: z.string().max(150, 'Vendor name must be less than 150 characters').optional(),
  // Vendor's own invoice/bill number printed on the document (distinct from
  // the system-generated `bill_number` minted server-side).
  vendorInvoiceNumber: z.string().max(100, 'Bill number must be less than 100 characters').optional(),
  // Date the vendor issued the document (separate from `startDate`, which is
  // when our payment series starts).
  issueDate: z.string().optional().refine((val) => {
    if (!val) return true;
    return !isNaN(Date.parse(val));
  }, 'Issue date must be a valid date'),
  billType: z.enum(['unique', 'recurrent']),
  paymentStructure: z.enum(['single', 'installment']),
  paymentCount: z.enum(['1', 'multiple']).optional(),
  recurrence: z.boolean().optional(),
  paymentType: z.enum(['unique', 'recurrent']).optional(),
  schedulePayment: z.enum(['weekly', 'monthly', 'quarterly', 'yearly', 'custom']).nullable().optional(),
  yearInterval: z.coerce.number().int().min(1).max(99).optional().default(1),
  hasInitialPayment: z.boolean().optional(),
  recurringPaymentsEqual: z.boolean().optional(),
  singlePaymentAmount: z.string().optional().refine((val) => {
    if (!val) return true;
    const num = parseFloat(val);
    return !isNaN(num) && num > 0 && num <= 999999.99;
  }, 'Payment amount must be between $0.01 and $999,999.99'),
  initialPaymentAmount: z.string().optional().refine((val) => {
    if (!val) return true;
    const num = parseFloat(val);
    return !isNaN(num) && num > 0 && num <= 999999.99;
  }, 'Initial payment amount must be between $0.01 and $999,999.99'),
  recurringPaymentAmount: z.string().optional().refine((val) => {
    if (!val) return true;
    const num = parseFloat(val);
    return !isNaN(num) && num > 0 && num <= 999999.99;
  }, 'Recurring payment amount must be between $0.01 and $999,999.99'),
  customPayments: z.array(z.object({
    amount: z.string().refine((val) => {
      if (!val || val.trim() === '') return false;
      const num = parseFloat(val);
      return !isNaN(num) && num > 0 && num <= 999999.99;
    }, 'Amount must be between $0.01 and $999,999.99'),
    date: z.string().refine((val) => {
      if (!val || val.trim() === '') return true;
      return !isNaN(Date.parse(val));
    }, 'Date must be a valid date'),
    description: z.string().optional()
  })).optional(),
  totalAmount: z.string().optional().refine((val) => {
    if (!val) return true;
    const num = parseFloat(val);
    return !isNaN(num) && num > 0 && num <= 999999.99;
  }, 'Total amount must be between $0.01 and $999,999.99'),
  startDate: z.string().min(1, 'Start date is required').refine((val) => {
    return !isNaN(Date.parse(val));
  }, 'Start date must be a valid date'),
  endDate: z.string().optional().refine((val) => {
    if (!val) return true;
    return !isNaN(Date.parse(val));
  }, 'End date must be a valid date'),
  status: z.enum(['draft', 'sent', 'overdue', 'paid', 'cancelled']),
}).superRefine((data, ctx) => {
  if (data.paymentStructure === 'single') {
    if (!data.singlePaymentAmount || data.singlePaymentAmount.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Payment amount is required for single payment bills',
        path: ['singlePaymentAmount']
      });
    }
  } else if (data.paymentStructure === 'installment') {
    if (data.billType === 'recurrent' && !data.schedulePayment) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Payment schedule is required for recurring bills with installment payments',
        path: ['schedulePayment']
      });
    }
    
    if (data.hasInitialPayment && (!data.initialPaymentAmount || data.initialPaymentAmount.trim() === '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Initial payment amount is required when initial payment is enabled',
        path: ['initialPaymentAmount']
      });
    }
    if (data.recurringPaymentsEqual && data.schedulePayment !== 'custom' && (!data.recurringPaymentAmount || data.recurringPaymentAmount.trim() === '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Payment amount is required for equal installment payments',
        path: ['recurringPaymentAmount']
      });
    }
    if ((data.schedulePayment === 'custom' || !data.recurringPaymentsEqual) && (!data.customPayments || data.customPayments.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one payment is required for custom payment schedule',
        path: ['customPayments']
      });
    }
    
    if (data.schedulePayment === 'custom' && data.customPayments && data.customPayments.length > 0) {
      const missingDates = data.customPayments.filter((payment) => !payment.date || payment.date.trim() === '');
      
      if (missingDates.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Please enter a date for each payment. ${missingDates.length} payment${missingDates.length > 1 ? 's are' : ' is'} missing a date.`,
          path: ['customPayments']
        });
        
        data.customPayments.forEach((payment, index) => {
          if (!payment.date || payment.date.trim() === '') {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Date is required',
              path: ['customPayments', index, 'date']
            });
          }
        });
      }
    }
  }
  
  if (data.billType === 'recurrent' && data.paymentStructure === 'single' && !data.schedulePayment) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Payment schedule is required for recurring bills',
      path: ['schedulePayment']
    });
  }
});

export type BillFormData = z.infer<typeof billFormSchema>;

export function getCategoryLabel(category: string, t: (key: string) => string): string {
  const categoryKey = `category${category.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('')}`;
  return t(categoryKey);
}

export function parseBillPaymentData(bill: Bill | null | undefined) {
  if (!bill) {
    return {
      billType: 'unique' as const,
      paymentStructure: 'single' as const,
      paymentCount: '1' as const,
      recurrence: false,
      schedulePayment: undefined,
      yearInterval: 1,
      hasInitialPayment: false,
      recurringPaymentsEqual: true,
      singlePaymentAmount: '',
      initialPaymentAmount: '',
      recurringPaymentAmount: '',
      customPayments: [] as CustomPayment[],
      issueDate: '',
      vendorInvoiceNumber: '',
    };
  }

  const costs = bill.costs || [];
  const scheduleCustom = bill.scheduleCustom || [];
  
  let billType: 'unique' | 'recurrent';
  if (bill.billType) {
    billType = bill.billType;
  } else if (bill.paymentType) {
    billType = bill.paymentType;
  } else {
    billType = 'unique';
  }
  
  let paymentStructure: 'single' | 'installment';
  if (bill.paymentStructure) {
    paymentStructure = bill.paymentStructure;
  } else {
    paymentStructure = costs.length > 1 ? 'installment' : 'single';
  }

  let paymentCount: '1' | 'multiple' = paymentStructure === 'single' ? '1' : 'multiple';
  let recurrence = billType === 'recurrent';

  let singlePaymentAmount = '';
  let hasInitialPayment = false;
  let recurringPaymentsEqual = true;
  let initialPaymentAmount = '';
  let recurringPaymentAmount = '';
  let customPayments: CustomPayment[] = [];

  if (paymentStructure === 'single' && costs.length === 1) {
    singlePaymentAmount = costs[0].toString();
  } else if (paymentStructure === 'installment' && costs.length > 0) {
    const isCustomSchedule = 
      bill.schedulePayment === 'custom' || 
      scheduleCustom.length > 0;
    
    if (isCustomSchedule && costs.length > 0) {
      recurringPaymentsEqual = false;
      customPayments = costs.map((cost, index) => ({
        amount: cost.toString(),
        date: scheduleCustom[index] || '',
        description: `Payment ${index + 1}`,
      }));
    } else if (costs.length === 1) {
      singlePaymentAmount = costs[0].toString();
    } else {
      const firstCost = parseFloat(costs[0].toString());
      const otherCosts = costs.slice(1).map(c => parseFloat(c.toString()));
      
      const allOthersEqual = otherCosts.every(cost => cost === otherCosts[0]);
      const firstDifferent = firstCost !== otherCosts[0];
      
      if (firstDifferent && allOthersEqual && otherCosts.length > 0) {
        hasInitialPayment = true;
        initialPaymentAmount = firstCost.toString();
        recurringPaymentAmount = otherCosts[0].toString();
      } else if (allOthersEqual && costs.every(c => parseFloat(c.toString()) === firstCost)) {
        recurringPaymentAmount = firstCost.toString();
      } else {
        recurringPaymentsEqual = false;
        
        customPayments = costs.map((cost, index) => ({
          amount: cost.toString(),
          date: scheduleCustom[index] || '',
          description: `Payment ${index + 1}`,
        }));
      }
    }
  }

  let schedulePayment = bill.schedulePayment as 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom' | undefined;
  
  if (customPayments.length > 0 || !recurringPaymentsEqual) {
    schedulePayment = 'custom';
  } else if (paymentStructure === 'installment' && billType === 'recurrent' && !schedulePayment) {
    schedulePayment = 'monthly';
  } else if (billType === 'recurrent' && paymentStructure === 'single' && !schedulePayment) {
    schedulePayment = 'yearly';
  }

  let calculatedTotalFromCustomPayments: string | undefined;
  if (customPayments.length > 0) {
    const total = customPayments.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);
    calculatedTotalFromCustomPayments = total.toFixed(2);
  }

  return {
    billType,
    paymentStructure,
    paymentCount,
    recurrence,
    schedulePayment,
    yearInterval: bill.yearInterval || 1,
    hasInitialPayment,
    recurringPaymentsEqual,
    singlePaymentAmount,
    initialPaymentAmount,
    recurringPaymentAmount,
    customPayments,
    calculatedTotalFromCustomPayments,
    issueDate: bill.issueDate ? String(bill.issueDate).split('T')[0] : '',
    vendorInvoiceNumber: bill.vendorInvoiceNumber || '',
  };
}
