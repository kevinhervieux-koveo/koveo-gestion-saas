import { describe, it, expect } from '@jest/globals';
import { convertBillResponseToFormData } from '../../../client/src/components/bill-management/GeminiBillExtractor';

describe('convertBillResponseToFormData', () => {
  it('returns an empty object when given null or non-object input', () => {
    expect(convertBillResponseToFormData(null)).toEqual({});
    expect(convertBillResponseToFormData(undefined)).toEqual({});
    expect(convertBillResponseToFormData('not an object')).toEqual({});
  });

  it('maps a simple single-payment bill and passes through issueDate / vendorInvoiceNumber', () => {
    const aiData = {
      vendorName: 'Hydro Quebec',
      totalAmount: '125.50',
      dueDate: '2026-05-15',
      issueDate: '2026-04-15',
      billNumber: 'INV-9001',
      description: 'Monthly electricity service',
      paymentType: 'one-time',
      category: 'utilities',
    };

    const result = convertBillResponseToFormData(aiData);

    expect(result.vendor).toBe('Hydro Quebec');
    expect(result.totalAmount).toBe('125.50');
    expect(result.singlePaymentAmount).toBe('125.50');
    expect(result.startDate).toBe('2026-05-15');
    expect(result.issueDate).toBe('2026-04-15');
    expect(result.vendorInvoiceNumber).toBe('INV-9001');
    expect(result.category).toBe('utilities');
    expect(result.billType).toBe('unique');
    expect(result.paymentStructure).toBe('single');
    expect(result.description).toBe('Monthly electricity service');
  });

  it('also accepts invoiceNumber as the vendor invoice number alias', () => {
    const result = convertBillResponseToFormData({
      vendorName: 'Acme',
      totalAmount: 50,
      invoiceNumber: 'ACM-77',
    });
    expect(result.vendorInvoiceNumber).toBe('ACM-77');
  });

  it('builds equal installments by dividing the total over customPaymentDates', () => {
    const aiData = {
      vendorName: 'Plumber Co',
      totalAmount: '900.00',
      customPaymentDates: ['2026-01-15', '2026-02-15', '2026-03-15'],
    };

    const result = convertBillResponseToFormData(aiData);

    expect(result.billType).toBe('recurrent');
    expect(result.paymentStructure).toBe('installment');
    expect(result.paymentCount).toBe('multiple');
    expect(result.recurrence).toBe(true);
    expect(result.customPayments).toHaveLength(3);
    expect(result.customPayments[0]).toEqual({
      amount: '300.00',
      date: '2026-01-15',
      description: 'Payment 1',
    });
    expect(result.customPayments[1].date).toBe('2026-02-15');
    expect(result.customPayments[2].date).toBe('2026-03-15');
    // All amounts equal => recurringPaymentsEqual should be detected as true
    expect(result.recurringPaymentsEqual).toBe(true);
  });

  it('preserves unequal installments via customPayments and flags recurringPaymentsEqual=false', () => {
    const aiData = {
      vendorName: 'Roofing Inc',
      totalAmount: '1000.00',
      frequency: 'custom',
      customPayments: [
        { amount: '400.00', date: '2026-04-01', description: 'Deposit' },
        { amount: '300.00', date: '2026-05-01' },
        { amount: '300.00', date: '2026-06-01' },
      ],
    };

    const result = convertBillResponseToFormData(aiData);

    expect(result.paymentStructure).toBe('installment');
    expect(result.customPayments).toHaveLength(3);
    expect(result.customPayments[0]).toEqual({
      amount: '400.00',
      date: '2026-04-01',
      description: 'Deposit',
    });
    expect(result.customPayments[1].description).toBe('Payment 2');
    expect(result.recurringPaymentsEqual).toBe(false);
  });

  it('honours an initial-payment + recurring-amount layout', () => {
    const aiData = {
      vendorName: 'Lease Co',
      totalAmount: '3500.00',
      paymentType: 'recurring installment',
      hasInitialPayment: true,
      initialPaymentAmount: 500,
      recurringPaymentAmount: '250.00',
      recurringPaymentsEqual: true,
    };

    const result = convertBillResponseToFormData(aiData);

    expect(result.billType).toBe('recurrent');
    expect(result.paymentStructure).toBe('installment');
    expect(result.hasInitialPayment).toBe(true);
    expect(result.initialPaymentAmount).toBe('500.00');
    expect(result.recurringPaymentAmount).toBe('250.00');
    expect(result.recurringPaymentsEqual).toBe(true);
  });

  it('infers hasInitialPayment when only initialPaymentAmount is provided', () => {
    const result = convertBillResponseToFormData({
      vendorName: 'Lease Co',
      totalAmount: '1000.00',
      paymentType: 'recurring installment',
      initialPaymentAmount: '200.00',
    });
    expect(result.hasInitialPayment).toBe(true);
    expect(result.initialPaymentAmount).toBe('200.00');
  });

  it('passes through a multi-year yearInterval', () => {
    const result = convertBillResponseToFormData({
      vendorName: 'Insurance Corp',
      totalAmount: '2400.00',
      paymentType: 'recurring',
      frequency: 'yearly',
      yearInterval: 3,
    });

    expect(result.yearInterval).toBe(3);
    expect(result.schedulePayment).toBe('yearly');
    expect(result.billType).toBe('recurrent');
  });

  it('ignores yearInterval values that are not numeric or are below 1', () => {
    const result1 = convertBillResponseToFormData({
      vendorName: 'X',
      totalAmount: '10',
      yearInterval: 0,
    });
    expect(result1.yearInterval).toBeUndefined();

    const result2 = convertBillResponseToFormData({
      vendorName: 'X',
      totalAmount: '10',
      yearInterval: 'two' as any,
    });
    expect(result2.yearInterval).toBeUndefined();
  });

  it('does not include endDate when payment structure is installment', () => {
    const result = convertBillResponseToFormData({
      vendorName: 'Plumber',
      totalAmount: '300.00',
      endDate: '2026-12-31',
      customPaymentDates: ['2026-01-15', '2026-02-15'],
    });
    expect(result.paymentStructure).toBe('installment');
    expect(result.endDate).toBeUndefined();
  });

  it('keeps endDate for non-installment bills', () => {
    const result = convertBillResponseToFormData({
      vendorName: 'Cleaning Co',
      totalAmount: '100.00',
      paymentType: 'one-time',
      endDate: '2026-12-31',
    });
    expect(result.endDate).toBe('2026-12-31');
  });

  it('forces installment when frequency is custom even without explicit dates', () => {
    const result = convertBillResponseToFormData({
      vendorName: 'Custom Co',
      totalAmount: '500.00',
      frequency: 'custom',
    });
    expect(result.billType).toBe('recurrent');
    expect(result.paymentStructure).toBe('installment');
    expect(result.recurrence).toBe(true);
  });

  it('infers a category from the vendor name when AI category is missing or invalid', () => {
    const result = convertBillResponseToFormData({
      vendorName: 'City Water Utility',
      totalAmount: '80',
      category: 'not-a-real-category',
    });
    expect(result.category).toBe('utilities');
  });
});
