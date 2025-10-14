/**
 * @file Unit Tests for Inflation Calculation Functions
 * @description Tests for getMonthlyFeesInflationRate and shouldApplyInflation functions
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Import the actual production code instead of duplicating functions
import {
  ExtendedBuildingConfig,
  getMonthlyFeesInflationRate,
  safeConvertFinancialYearStart,
  shouldApplyInflation
} from '../../../server/utils/inflation';

// Mock console.warn to capture warnings
let mockConsoleWarn: any;

describe('Inflation Calculations - Production Code Tests', () => {
  beforeEach(() => {
    mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    if (mockConsoleWarn) {
      mockConsoleWarn.mockRestore();
    }
  });

  // NOTE: These tests now use the actual production code from server/utils/inflation
  // instead of duplicated test implementations

  describe('getMonthlyFeesInflationRate', () => {
    const revenueInflation = 0.025; // 2.5%
    const generalInflation = 0.02; // 2%

    it('should use category-specific rate when available (highest priority)', () => {
      const config: ExtendedBuildingConfig = {
        categoryInflationRates: {
          monthly_fees: 0.03, // 3%
        },
      };

      const result = getMonthlyFeesInflationRate(config, revenueInflation, generalInflation);
      expect(result).toBe(0.03);
    });

    it('should convert percentage to decimal for category rates', () => {
      const config: ExtendedBuildingConfig = {
        categoryInflationRates: {
          monthly_fees: 3.5, // 3.5% as percentage
        },
      };

      const result = getMonthlyFeesInflationRate(config, revenueInflation, generalInflation);
      expect(result).toBe(0.035); // Should be converted to decimal
    });

    it('should use global bills inflation when no category-specific rate (second priority)', () => {
      const config: ExtendedBuildingConfig = {
        useGlobalBillsInflation: true,
        globalBillsInflationRate: 0.028, // 2.8%
      };

      const result = getMonthlyFeesInflationRate(config, revenueInflation, generalInflation);
      expect(result).toBe(0.028);
    });

    it('should convert percentage to decimal for global bills rate', () => {
      const config: ExtendedBuildingConfig = {
        useGlobalBillsInflation: true,
        globalBillsInflationRate: 2.8, // 2.8% as percentage
      };

      const result = getMonthlyFeesInflationRate(config, revenueInflation, generalInflation);
      expect(result).toBeCloseTo(0.028, 5); // Should be converted to decimal (with floating point precision)
    });

    it('should fall back to revenueInflation for backward compatibility (third priority)', () => {
      const config: ExtendedBuildingConfig = {}; // No bills configuration

      const result = getMonthlyFeesInflationRate(config, revenueInflation, generalInflation);
      expect(result).toBe(revenueInflation); // Should use revenueInflation, not generalInflation
    });

    it('should fall back to generalInflation only when revenueInflation is invalid (final priority)', () => {
      const config: ExtendedBuildingConfig = {};

      const result = getMonthlyFeesInflationRate(config, NaN, generalInflation);
      expect(result).toBe(generalInflation);
    });

    it('should prefer category rate over global bills inflation', () => {
      const config: ExtendedBuildingConfig = {
        categoryInflationRates: {
          monthly_fees: 0.04, // 4%
        },
        useGlobalBillsInflation: true,
        globalBillsInflationRate: 0.03, // 3%
      };

      const result = getMonthlyFeesInflationRate(config, revenueInflation, generalInflation);
      expect(result).toBe(0.04); // Should use category rate, not global
    });

    it('should try different category names for monthly fees', () => {
      const config: ExtendedBuildingConfig = {
        categoryInflationRates: {
          maintenance: 0.035, // 3.5% - should match because 'maintenance' is a possible category
        },
      };

      const result = getMonthlyFeesInflationRate(config, revenueInflation, generalInflation);
      expect(result).toBe(0.035);
    });

    it('should use general category as fallback within category rates', () => {
      const config: ExtendedBuildingConfig = {
        categoryInflationRates: {
          general: 0.032, // 3.2%
          // No monthly_fees, maintenance, monthly, or fees categories
        },
      };

      const result = getMonthlyFeesInflationRate(config, revenueInflation, generalInflation);
      expect(result).toBe(0.032);
    });

    it('should test complete backward compatibility scenario', () => {
      // Scenario: Building has no bills configuration but has revenue inflation set
      // This should maintain backward compatibility by using revenueInflation
      const emptyConfig: ExtendedBuildingConfig = {};
      const buildingRevenueInflation = 0.03; // 3%
      const buildingGeneralInflation = 0.02; // 2%

      const result = getMonthlyFeesInflationRate(emptyConfig, buildingRevenueInflation, buildingGeneralInflation);
      
      // CRITICAL: Should use revenueInflation, not generalInflation for backward compatibility
      expect(result).toBe(buildingRevenueInflation);
      expect(result).not.toBe(buildingGeneralInflation);
    });
  });

  describe('safeConvertFinancialYearStart', () => {
    it('should return null for null/undefined input', () => {
      expect(safeConvertFinancialYearStart(null)).toBe(null);
      expect(safeConvertFinancialYearStart(undefined)).toBe(null);
    });

    it('should handle Date objects correctly', () => {
      const date = new Date('2025-04-01');
      const result = safeConvertFinancialYearStart(date);
      expect(result).toEqual(date);
    });

    it('should convert valid date strings', () => {
      const dateString = '2025-04-01';
      const result = safeConvertFinancialYearStart(dateString);
      expect(result).toEqual(new Date(dateString));
    });

    it('should return null for invalid date strings', () => {
      const result = safeConvertFinancialYearStart('invalid-date');
      expect(result).toBe(null);
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid financialYearStart date: invalid-date')
      );
    });

    it('should handle ISO date strings from database', () => {
      const isoString = '2025-04-01T00:00:00.000Z';
      const result = safeConvertFinancialYearStart(isoString);
      expect(result).toEqual(new Date(isoString));
    });

    it('should return null for non-string, non-Date input', () => {
      const result = safeConvertFinancialYearStart(123 as any);
      expect(result).toBe(null);
    });

    it('should handle edge case dates', () => {
      // Leap year date
      const leapYear = safeConvertFinancialYearStart('2024-02-29');
      expect(leapYear).toEqual(new Date('2024-02-29'));

      // Year boundaries
      const yearBoundary = safeConvertFinancialYearStart('2024-12-31');
      expect(yearBoundary).toEqual(new Date('2024-12-31'));
    });
  });

  describe('shouldApplyInflation', () => {
    it('should return true when no financial year start is set', () => {
      const currentDate = new Date('2025-06-01');
      const result = shouldApplyInflation(currentDate, null);
      expect(result).toBe(true);
    });

    it('should return true when current date is after financial year start', () => {
      const currentDate = new Date('2025-06-01');
      const financialYearStart = new Date('2025-04-01');
      const result = shouldApplyInflation(currentDate, financialYearStart);
      expect(result).toBe(true);
    });

    it('should return false when current date is before financial year start', () => {
      const currentDate = new Date('2025-02-01');
      const financialYearStart = new Date('2025-04-01');
      const result = shouldApplyInflation(currentDate, financialYearStart);
      expect(result).toBe(false);
    });

    it('should return true when current date equals financial year start', () => {
      const currentDate = new Date('2025-04-01');
      const financialYearStart = new Date('2025-04-01');
      const result = shouldApplyInflation(currentDate, financialYearStart);
      expect(result).toBe(true);
    });

    it('should handle invalid current date gracefully', () => {
      const invalidDate = new Date('invalid');
      const financialYearStart = new Date('2025-04-01');
      const result = shouldApplyInflation(invalidDate, financialYearStart);
      expect(result).toBe(true); // Default to applying inflation
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid dates for inflation check')
      );
    });

    it('should handle invalid financial year start date gracefully', () => {
      const currentDate = new Date('2025-06-01');
      const invalidFinancialYearStart = new Date('invalid');
      const result = shouldApplyInflation(currentDate, invalidFinancialYearStart);
      expect(result).toBe(true); // Default to applying inflation
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid dates for inflation check')
      );
    });

    it('should test months before and after financialYearStart scenarios', () => {
      const financialYearStart = new Date('2025-04-01');
      
      // Test multiple months before financial year start
      const monthsBefore = [
        new Date('2025-01-01'), // January
        new Date('2025-02-15'), // February  
        new Date('2025-03-31'), // March (last day before)
      ];
      
      monthsBefore.forEach(date => {
        expect(shouldApplyInflation(date, financialYearStart)).toBe(false);
      });
      
      // Test multiple months after financial year start
      const monthsAfter = [
        new Date('2025-04-01'), // April 1st (exact start)
        new Date('2025-05-15'), // May
        new Date('2025-12-31'), // December
      ];
      
      monthsAfter.forEach(date => {
        expect(shouldApplyInflation(date, financialYearStart)).toBe(true);
      });
    });

    it('should handle cross-year scenarios', () => {
      const financialYearStart = new Date('2025-04-01');
      
      // Previous year dates should not apply inflation
      expect(shouldApplyInflation(new Date('2024-12-31'), financialYearStart)).toBe(false);
      
      // Next year dates should apply inflation
      expect(shouldApplyInflation(new Date('2026-01-01'), financialYearStart)).toBe(true);
    });
  });

  describe('Integration scenarios for backward compatibility', () => {
    it('should maintain old behavior when no bills config exists', () => {
      // This tests the critical backward compatibility requirement
      const oldBehaviorConfig: ExtendedBuildingConfig = {}; // No bills configuration
      const revenueInflation = 0.03; // What was used before
      const generalInflation = 0.02; // Should NOT be used for monthly fees
      
      const monthlyFeesRate = getMonthlyFeesInflationRate(oldBehaviorConfig, revenueInflation, generalInflation);
      
      // CRITICAL: Must use revenueInflation for backward compatibility
      expect(monthlyFeesRate).toBe(revenueInflation);
      expect(monthlyFeesRate).not.toBe(generalInflation);
    });

    it('should use new bills config when available while maintaining fallback chain', () => {
      const newBehaviorConfig: ExtendedBuildingConfig = {
        categoryInflationRates: {
          monthly_fees: 0.035, // 3.5% - specific for monthly fees
        },
      };
      const revenueInflation = 0.03;
      const generalInflation = 0.02;
      
      const monthlyFeesRate = getMonthlyFeesInflationRate(newBehaviorConfig, revenueInflation, generalInflation);
      
      // Should use the specific rate, not the fallbacks
      expect(monthlyFeesRate).toBe(0.035);
    });

    it('should demonstrate the complete precedence chain', () => {
      const revenueInflation = 0.03;
      const generalInflation = 0.02;
      
      // 1. Category-specific (highest priority)
      const configWithCategory: ExtendedBuildingConfig = {
        categoryInflationRates: { monthly_fees: 0.04 },
        useGlobalBillsInflation: true,
        globalBillsInflationRate: 0.035,
      };
      expect(getMonthlyFeesInflationRate(configWithCategory, revenueInflation, generalInflation)).toBe(0.04);
      
      // 2. Global bills (second priority)
      const configWithGlobal: ExtendedBuildingConfig = {
        useGlobalBillsInflation: true,
        globalBillsInflationRate: 0.035,
      };
      expect(getMonthlyFeesInflationRate(configWithGlobal, revenueInflation, generalInflation)).toBe(0.035);
      
      // 3. Revenue inflation (third priority - backward compatibility)
      const configEmpty: ExtendedBuildingConfig = {};
      expect(getMonthlyFeesInflationRate(configEmpty, revenueInflation, generalInflation)).toBe(revenueInflation);
      
      // 4. General inflation (final fallback)
      expect(getMonthlyFeesInflationRate(configEmpty, NaN, generalInflation)).toBe(generalInflation);
    });
  });
});