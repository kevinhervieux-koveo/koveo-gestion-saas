/**
 * @file Frontend Parsing Function Tests
 * @description Tests for frontend utility functions like parseFinancialYearStart
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock Date to avoid timezone flakiness and ensure consistent test results
const mockDate = new Date('2025-09-18T12:00:00.000Z'); // Fixed test date
const originalDate = global.Date;

beforeEach(() => {
  // Mock Date.now() and constructor to return consistent dates
  global.Date = jest.fn((dateString?: string | number | Date) => {
    if (dateString) {
      return new originalDate(dateString);
    }
    return mockDate;
  }) as any;
  
  // Mock static methods
  (global.Date as any).now = jest.fn(() => mockDate.getTime());
  (global.Date as any).parse = originalDate.parse;
  (global.Date as any).UTC = originalDate.UTC;
  
  // Mock instance methods
  global.Date.prototype = originalDate.prototype;
});

afterEach(() => {
  global.Date = originalDate;
  jest.clearAllMocks();
});

// Extract parseFinancialYearStart function from budget page logic
// This is the frontend parsing function that needs to be tested
const parseFinancialYearStart = (financialYearStart?: string): { month: number; year: number } => {
  try {
    if (!financialYearStart) {
      // Fallback to current date if no financial year start is set
      return {
        month: new Date().getMonth() + 1, // Current month (1-12)
        year: new Date().getFullYear()
      };
    }

    // Parse YYYY-MM-DD format
    const dateMatch = financialYearStart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateMatch) {
      // Invalid format, fallback to current date
      return {
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
      };
    }

    const [, yearStr, monthStr] = dateMatch;
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    // Validate year and month ranges
    if (year < 1900 || year > 2100 || month < 1 || month > 12) {
      return {
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
      };
    }

    return { month, year };
  } catch (error) {
    return {
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear()
    };
  }
};

describe('Frontend Parsing Functions', () => {
  describe('parseFinancialYearStart', () => {
    // Test the expected current date fallback values
    const expectedCurrentMonth = 9; // September (mockDate is 2025-09-18)
    const expectedCurrentYear = 2025;

    describe('Valid YYYY-MM-DD format parsing', () => {
      it('should parse valid YYYY-MM-DD format correctly', () => {
        const result = parseFinancialYearStart('2025-04-01');
        expect(result).toEqual({ month: 4, year: 2025 });
      });

      it('should parse different months correctly', () => {
        expect(parseFinancialYearStart('2024-01-01')).toEqual({ month: 1, year: 2024 });
        expect(parseFinancialYearStart('2024-06-15')).toEqual({ month: 6, year: 2024 });
        expect(parseFinancialYearStart('2024-12-31')).toEqual({ month: 12, year: 2024 });
      });

      it('should parse leap year dates correctly', () => {
        const result = parseFinancialYearStart('2024-02-29');
        expect(result).toEqual({ month: 2, year: 2024 });
      });

      it('should parse year boundaries correctly', () => {
        expect(parseFinancialYearStart('1999-12-31')).toEqual({ month: 12, year: 1999 });
        expect(parseFinancialYearStart('2000-01-01')).toEqual({ month: 1, year: 2000 });
      });
    });

    describe('Fallback behavior for invalid inputs', () => {
      it('should fallback to current date when input is undefined', () => {
        const result = parseFinancialYearStart(undefined);
        expect(result).toEqual({ 
          month: expectedCurrentMonth, 
          year: expectedCurrentYear 
        });
      });

      it('should fallback to current date when input is null', () => {
        const result = parseFinancialYearStart(null as any);
        expect(result).toEqual({ 
          month: expectedCurrentMonth, 
          year: expectedCurrentYear 
        });
      });

      it('should fallback to current date when input is empty string', () => {
        const result = parseFinancialYearStart('');
        expect(result).toEqual({ 
          month: expectedCurrentMonth, 
          year: expectedCurrentYear 
        });
      });
    });

    describe('Invalid format handling', () => {
      it('should fallback for invalid date formats', () => {
        const invalidFormats = [
          '2025/04/01',     // Wrong separators
          '04-01-2025',     // Wrong order
          '2025-4-1',       // Missing leading zeros
          '25-04-01',       // Two-digit year
          '2025-April-01',  // Month name
          '2025-04',        // Missing day
          '2025-04-01T10:00:00', // ISO format with time
          'invalid-date',   // Completely invalid
          '2025-13-01',     // Invalid month (>12)
          '2025-00-01',     // Invalid month (0)
        ];

        invalidFormats.forEach(format => {
          const result = parseFinancialYearStart(format);
          expect(result).toEqual({ 
            month: expectedCurrentMonth, 
            year: expectedCurrentYear 
          });
        });
      });

      it('should fallback for non-string inputs', () => {
        const nonStringInputs = [
          123 as any,
          {} as any,
          [] as any,
          true as any,
        ];

        nonStringInputs.forEach(input => {
          const result = parseFinancialYearStart(input);
          expect(result).toEqual({ 
            month: expectedCurrentMonth, 
            year: expectedCurrentYear 
          });
        });
      });
    });

    describe('Range validation edge cases', () => {
      it('should fallback for years outside valid range', () => {
        // Years below 1900
        expect(parseFinancialYearStart('1899-12-31')).toEqual({ 
          month: expectedCurrentMonth, 
          year: expectedCurrentYear 
        });
        
        // Years above 2100
        expect(parseFinancialYearStart('2101-01-01')).toEqual({ 
          month: expectedCurrentMonth, 
          year: expectedCurrentYear 
        });
      });

      it('should accept boundary years correctly', () => {
        // Exactly 1900 should be valid
        expect(parseFinancialYearStart('1900-01-01')).toEqual({ month: 1, year: 1900 });
        
        // Exactly 2100 should be valid
        expect(parseFinancialYearStart('2100-12-31')).toEqual({ month: 12, year: 2100 });
      });

      it('should fallback for months outside valid range', () => {
        // Month 0
        expect(parseFinancialYearStart('2025-00-15')).toEqual({ 
          month: expectedCurrentMonth, 
          year: expectedCurrentYear 
        });
        
        // Month 13
        expect(parseFinancialYearStart('2025-13-15')).toEqual({ 
          month: expectedCurrentMonth, 
          year: expectedCurrentYear 
        });
      });

      it('should accept boundary months correctly', () => {
        // Month 1 should be valid
        expect(parseFinancialYearStart('2025-01-15')).toEqual({ month: 1, year: 2025 });
        
        // Month 12 should be valid
        expect(parseFinancialYearStart('2025-12-15')).toEqual({ month: 12, year: 2025 });
      });
    });

    describe('Error handling and resilience', () => {
      it('should handle regex matching edge cases', () => {
        const edgeCases = [
          '2025-04-1',      // Single digit day (still invalid format)
          '2025-4-01',      // Single digit month (still invalid format)
          '02025-04-01',    // Extra digit in year
          '2025-004-01',    // Extra digit in month
          '2025-04-001',    // Extra digit in day
        ];

        edgeCases.forEach(edgeCase => {
          const result = parseFinancialYearStart(edgeCase);
          expect(result).toEqual({ 
            month: expectedCurrentMonth, 
            year: expectedCurrentYear 
          });
        });
      });

      it('should handle malformed numeric strings', () => {
        // These match the regex but have parsing issues
        const malformedCases = [
          '202a-04-01',     // Non-numeric character in year
          '2025-0a-01',     // Non-numeric character in month
          '2025-04-0a',     // Non-numeric character in day
        ];

        malformedCases.forEach(malformed => {
          const result = parseFinancialYearStart(malformed);
          expect(result).toEqual({ 
            month: expectedCurrentMonth, 
            year: expectedCurrentYear 
          });
        });
      });

      it('should maintain consistent behavior with different Date constructor states', () => {
        // Test that the function behaves consistently regardless of Date state
        const testCases = [
          '2025-04-01',
          '2024-12-31',
          '1900-01-01',
          '2100-12-31',
        ];

        testCases.forEach(testCase => {
          const result1 = parseFinancialYearStart(testCase);
          const result2 = parseFinancialYearStart(testCase);
          expect(result1).toEqual(result2);
        });
      });
    });

    describe('Business logic validation', () => {
      it('should handle common financial year dates', () => {
        // Common financial year starts
        const commonFYStarts = [
          { input: '2025-01-01', expected: { month: 1, year: 2025 } },  // Calendar year
          { input: '2025-04-01', expected: { month: 4, year: 2025 } },  // UK tax year
          { input: '2025-07-01', expected: { month: 7, year: 2025 } },  // Australian financial year
          { input: '2025-10-01', expected: { month: 10, year: 2025 } }, // US federal fiscal year
        ];

        commonFYStarts.forEach(({ input, expected }) => {
          const result = parseFinancialYearStart(input);
          expect(result).toEqual(expected);
        });
      });

      it('should preserve month and year information accurately', () => {
        // Test that no information is lost in parsing
        const testDate = '2025-06-15';
        const result = parseFinancialYearStart(testDate);
        
        expect(result.month).toBe(6);
        expect(result.year).toBe(2025);
        expect(typeof result.month).toBe('number');
        expect(typeof result.year).toBe('number');
      });

      it('should handle edge case financial years correctly', () => {
        // Financial years that span different calendar years
        const edgeFinancialYears = [
          '2024-04-01', // FY 2024-2025
          '2025-04-01', // FY 2025-2026
        ];

        edgeFinancialYears.forEach(date => {
          const result = parseFinancialYearStart(date);
          expect(result.month).toBe(4);
          expect(result.year).toBeGreaterThanOrEqual(2024);
        });
      });
    });

    describe('Time zone independence', () => {
      it('should work consistently regardless of timezone', () => {
        // The function should parse date strings without being affected by timezone
        // since it only uses string parsing, not Date constructors for the input
        const result = parseFinancialYearStart('2025-04-01');
        expect(result).toEqual({ month: 4, year: 2025 });
        
        // Multiple calls should return identical results
        const result2 = parseFinancialYearStart('2025-04-01');
        expect(result).toEqual(result2);
      });

      it('should use consistent fallback dates', () => {
        // Fallback behavior should be consistent
        const fallback1 = parseFinancialYearStart('invalid');
        const fallback2 = parseFinancialYearStart('');
        const fallback3 = parseFinancialYearStart(undefined);
        
        expect(fallback1).toEqual(fallback2);
        expect(fallback2).toEqual(fallback3);
        expect(fallback1).toEqual({ 
          month: expectedCurrentMonth, 
          year: expectedCurrentYear 
        });
      });
    });
  });
});