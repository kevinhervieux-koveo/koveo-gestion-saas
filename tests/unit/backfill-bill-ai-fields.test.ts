import { describe, it, expect } from '@jest/globals';
import {
  pickIssueDate,
  pickVendorInvoiceNumber,
  pickInstallmentCosts,
  VENDOR_INVOICE_NUMBER_MAX_LENGTH,
} from '../../scripts/backfill-bill-ai-fields';

describe('backfill-bill-ai-fields helpers', () => {
  describe('pickIssueDate', () => {
    it('accepts a well-formed YYYY-MM-DD date', () => {
      expect(pickIssueDate({ issueDate: '2024-03-15' })).toBe('2024-03-15');
    });

    it('also accepts the snake_case variant', () => {
      expect(pickIssueDate({ issue_date: '2024-03-15' })).toBe('2024-03-15');
    });

    it('trims surrounding whitespace before validating', () => {
      expect(pickIssueDate({ issueDate: '  2024-03-15  ' })).toBe('2024-03-15');
    });

    it('rejects malformed strings', () => {
      expect(pickIssueDate({ issueDate: '15/03/2024' })).toBeNull();
      expect(pickIssueDate({ issueDate: '2024-3-5' })).toBeNull();
      expect(pickIssueDate({ issueDate: '2024-03-15T00:00:00Z' })).toBeNull();
      expect(pickIssueDate({ issueDate: 'not-a-date' })).toBeNull();
    });

    it('rejects impossible calendar dates', () => {
      expect(pickIssueDate({ issueDate: '2024-02-30' })).toBeNull();
      expect(pickIssueDate({ issueDate: '2023-02-29' })).toBeNull();
      expect(pickIssueDate({ issueDate: '2024-13-01' })).toBeNull();
      expect(pickIssueDate({ issueDate: '2024-00-10' })).toBeNull();
    });

    it('accepts a real leap day', () => {
      expect(pickIssueDate({ issueDate: '2024-02-29' })).toBe('2024-02-29');
    });

    it('rejects missing/non-string values', () => {
      expect(pickIssueDate({})).toBeNull();
      expect(pickIssueDate({ issueDate: null })).toBeNull();
      expect(pickIssueDate({ issueDate: 20240315 })).toBeNull();
      expect(pickIssueDate({ issueDate: '' })).toBeNull();
      expect(pickIssueDate({ issueDate: '   ' })).toBeNull();
    });
  });

  describe('pickVendorInvoiceNumber', () => {
    it('returns the trimmed value when within the 100 char limit', () => {
      expect(pickVendorInvoiceNumber({ invoiceNumber: '  INV-123  ' })).toBe('INV-123');
    });

    it('falls back across the supported field aliases', () => {
      expect(pickVendorInvoiceNumber({ billNumber: 'BN-1' })).toBe('BN-1');
      expect(pickVendorInvoiceNumber({ bill_number: 'BN-2' })).toBe('BN-2');
      expect(pickVendorInvoiceNumber({ invoiceNumber: 'IN-3' })).toBe('IN-3');
      expect(pickVendorInvoiceNumber({ vendorInvoiceNumber: 'VI-4' })).toBe('VI-4');
    });

    it('returns null for empty / whitespace / non-string / missing values', () => {
      expect(pickVendorInvoiceNumber({ invoiceNumber: '' })).toBeNull();
      expect(pickVendorInvoiceNumber({ invoiceNumber: '     ' })).toBeNull();
      expect(pickVendorInvoiceNumber({})).toBeNull();
      expect(pickVendorInvoiceNumber({ invoiceNumber: null })).toBeNull();
      expect(pickVendorInvoiceNumber({ invoiceNumber: 12345 })).toBeNull();
    });

    it('truncates values longer than 100 characters', () => {
      const longNumber = 'A'.repeat(150);
      const picked = pickVendorInvoiceNumber({ invoiceNumber: longNumber });
      expect(picked).not.toBeNull();
      expect(picked!.length).toBe(VENDOR_INVOICE_NUMBER_MAX_LENGTH);
      expect(picked).toBe('A'.repeat(100));
    });

    it('keeps a value of exactly 100 characters intact', () => {
      const exactly100 = 'B'.repeat(100);
      expect(pickVendorInvoiceNumber({ invoiceNumber: exactly100 })).toBe(exactly100);
    });

    it('trims first, then truncates', () => {
      const padded = '   ' + 'C'.repeat(120) + '   ';
      expect(pickVendorInvoiceNumber({ invoiceNumber: padded })).toBe('C'.repeat(100));
    });
  });

  describe('pickInstallmentCosts', () => {
    it('overwrites a single-entry costs array when customPayments sum to total', () => {
      const result = pickInstallmentCosts(
        {
          customPayments: [
            { amount: 400, date: '2024-01-15' },
            { amount: 400, date: '2024-02-15' },
            { amount: 400, date: '2024-03-15' },
          ],
        },
        ['1200.00'],
        '1200.00',
      );
      expect(result).toEqual(['400.00', '400.00', '400.00']);
    });

    it('preserves printed unequal installment amounts', () => {
      const result = pickInstallmentCosts(
        {
          customPayments: [
            { amount: 600, date: '2024-01-15' },
            { amount: 250, date: '2024-02-15' },
            { amount: 150, date: '2024-03-15' },
          ],
        },
        ['1000.00'],
        '1000.00',
      );
      expect(result).toEqual(['600.00', '250.00', '150.00']);
    });

    it('tolerates cent rounding within the default tolerance', () => {
      const result = pickInstallmentCosts(
        {
          customPayments: [
            { amount: 33.33, date: '2024-01-15' },
            { amount: 33.33, date: '2024-02-15' },
            { amount: 33.34, date: '2024-03-15' },
          ],
        },
        ['100.00'],
        '100.00',
      );
      expect(result).toEqual(['33.33', '33.33', '33.34']);
    });

    it('refuses to overwrite when the existing costs array already has multiple entries', () => {
      const result = pickInstallmentCosts(
        {
          customPayments: [
            { amount: 600, date: '2024-01-15' },
            { amount: 600, date: '2024-02-15' },
          ],
        },
        ['400.00', '400.00', '400.00'],
        '1200.00',
      );
      expect(result).toBeNull();
    });

    it('refuses when customPayments sum diverges from totalAmount beyond tolerance', () => {
      const result = pickInstallmentCosts(
        {
          customPayments: [
            { amount: 500, date: '2024-01-15' },
            { amount: 500, date: '2024-02-15' },
          ],
        },
        ['1200.00'],
        '1200.00',
      );
      expect(result).toBeNull();
    });

    it('refuses when customPayments has fewer than two entries', () => {
      const result = pickInstallmentCosts(
        { customPayments: [{ amount: 1200, date: '2024-01-15' }] },
        ['1200.00'],
        '1200.00',
      );
      expect(result).toBeNull();
    });

    it('refuses when customPayments is missing or malformed', () => {
      expect(pickInstallmentCosts({}, ['100.00'], '100.00')).toBeNull();
      expect(pickInstallmentCosts({ customPayments: null }, ['100.00'], '100.00')).toBeNull();
      expect(
        pickInstallmentCosts(
          { customPayments: [{ amount: 'oops' }, { amount: 50 }] },
          ['100.00'],
          '100.00',
        ),
      ).toBeNull();
      expect(
        pickInstallmentCosts(
          { customPayments: [{ amount: -50 }, { amount: 150 }] },
          ['100.00'],
          '100.00',
        ),
      ).toBeNull();
    });

    it('refuses when totalAmount is non-numeric', () => {
      expect(
        pickInstallmentCosts(
          {
            customPayments: [
              { amount: 50, date: '2024-01-15' },
              { amount: 50, date: '2024-02-15' },
            ],
          },
          ['100.00'],
          'not-a-number',
        ),
      ).toBeNull();
    });
  });
});
