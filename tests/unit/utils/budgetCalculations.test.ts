/**
 * @file Pure Unit Tests for Budget Calculation Functions
 * @description Tests budget calculation utilities directly without Express router dependencies
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  calculateMonthlyRecurringCosts,
  groupUniqueBillsByYear,
  calculateBaselineMonthlyIncome,
  applyInflation,
  determineBalanceStatus,
  roundToCurrency,
  generateBudgetForecast,
  type BillData,
  type UniqueBillData,
  type BaselineBudgetData,
} from '../../../server/utils/budgetCalculations';

describe('Budget Calculation Utilities', () => {
  
  describe('calculateMonthlyRecurringCosts', () => {
    it('should correctly convert yearly bills to monthly', () => {
      const bills: BillData[] = [
        {
          id: 'insurance',
          category: 'insurance',
          costs: ['12000'],
          schedulePayment: 'yearly',
          startDate: new Date('2025-01-01'),
          endDate: null,
        },
      ];

      const result = calculateMonthlyRecurringCosts(bills);
      expect(result).toBe(1000); // 12000 / 12 = 1000
    });

    it('should correctly convert quarterly bills to monthly', () => {
      const bills: BillData[] = [
        {
          id: 'maintenance',
          category: 'maintenance',
          costs: ['9000'],
          schedulePayment: 'quarterly',
          startDate: new Date('2025-01-01'),
          endDate: null,
        },
      ];

      const result = calculateMonthlyRecurringCosts(bills);
      expect(result).toBe(3000); // 9000 / 3 = 3000
    });

    it('should correctly convert weekly bills to monthly', () => {
      const bills: BillData[] = [
        {
          id: 'cleaning',
          category: 'cleaning',
          costs: ['500'],
          schedulePayment: 'weekly',
          startDate: new Date('2025-01-01'),
          endDate: null,
        },
      ];

      const result = calculateMonthlyRecurringCosts(bills);
      expect(result).toBeCloseTo(2165, 0); // 500 * 4.33 ≈ 2165
    });

    it('should handle monthly bills without conversion', () => {
      const bills: BillData[] = [
        {
          id: 'utilities',
          category: 'utilities',
          costs: ['2000'],
          schedulePayment: 'monthly',
          startDate: new Date('2025-01-01'),
          endDate: null,
        },
      ];

      const result = calculateMonthlyRecurringCosts(bills);
      expect(result).toBe(2000);
    });

    it('should handle multiple bills with different schedules', () => {
      const bills: BillData[] = [
        {
          id: 'insurance',
          category: 'insurance',
          costs: ['12000'],
          schedulePayment: 'yearly',
          startDate: new Date('2025-01-01'),
          endDate: null,
        },
        {
          id: 'utilities',
          category: 'utilities',
          costs: ['2000'],
          schedulePayment: 'monthly',
          startDate: new Date('2025-01-01'),
          endDate: null,
        },
        {
          id: 'cleaning',
          category: 'cleaning',
          costs: ['100'],
          schedulePayment: 'weekly',
          startDate: new Date('2025-01-01'),
          endDate: null,
        },
      ];

      const result = calculateMonthlyRecurringCosts(bills);
      const expected = 1000 + 2000 + (100 * 4.33); // 3433
      expect(result).toBeCloseTo(expected, 0);
    });

    it('should handle bills with multiple cost entries', () => {
      const bills: BillData[] = [
        {
          id: 'utilities',
          category: 'utilities',
          costs: ['1000', '500', '300'], // Total: 1800
          schedulePayment: 'monthly',
          startDate: new Date('2025-01-01'),
          endDate: null,
        },
      ];

      const result = calculateMonthlyRecurringCosts(bills);
      expect(result).toBe(1800);
    });

    it('should handle empty bills array', () => {
      const bills: BillData[] = [];
      const result = calculateMonthlyRecurringCosts(bills);
      expect(result).toBe(0);
    });

    it('should handle bills with empty costs array', () => {
      const bills: BillData[] = [
        {
          id: 'empty-bill',
          category: 'test',
          costs: [],
          schedulePayment: 'monthly',
          startDate: new Date('2025-01-01'),
          endDate: null,
        },
      ];

      const result = calculateMonthlyRecurringCosts(bills);
      expect(result).toBe(0);
    });
  });

  describe('groupUniqueBillsByYear', () => {
    it('should group bills by year correctly', () => {
      const uniqueBills: UniqueBillData[] = [
        {
          startDate: new Date('2025-03-15'),
          totalAmount: '50000',
          category: 'renovation',
        },
        {
          startDate: new Date('2025-08-20'),
          totalAmount: '25000',
          category: 'equipment',
        },
        {
          startDate: new Date('2026-01-10'),
          totalAmount: '75000',
          category: 'repair',
        },
      ];

      const result = groupUniqueBillsByYear(uniqueBills);
      expect(result).toEqual({
        2025: 75000, // 50000 + 25000
        2026: 75000,
      });
    });

    it('should handle empty array', () => {
      const uniqueBills: UniqueBillData[] = [];
      const result = groupUniqueBillsByYear(uniqueBills);
      expect(result).toEqual({});
    });

    it('should handle single bill', () => {
      const uniqueBills: UniqueBillData[] = [
        {
          startDate: new Date('2025-06-01'),
          totalAmount: '100000',
          category: 'major_renovation',
        },
      ];

      const result = groupUniqueBillsByYear(uniqueBills);
      expect(result).toEqual({
        2025: 100000,
      });
    });
  });

  describe('calculateBaselineMonthlyIncome', () => {
    it('should calculate total income from baseline data', () => {
      const baselineIncome: BaselineBudgetData[] = [
        {
          incomeTypes: ['monthly_fees', 'parking_fees', 'other_income'],
          incomes: ['45000', '3500', '1500'], // Total: 50000
          spendingTypes: ['maintenance'],
          spendings: ['20000'],
        },
      ];

      const result = calculateBaselineMonthlyIncome(baselineIncome);
      expect(result).toBe(50000);
    });

    it('should return default when no baseline data', () => {
      const baselineIncome: BaselineBudgetData[] = [];
      const result = calculateBaselineMonthlyIncome(baselineIncome);
      expect(result).toBe(50000); // Default fallback
    });

    it('should return default when baseline has no incomes', () => {
      const baselineIncome: BaselineBudgetData[] = [
        {
          incomeTypes: [],
          incomes: [],
          spendingTypes: ['maintenance'],
          spendings: ['20000'],
        },
      ];

      const result = calculateBaselineMonthlyIncome(baselineIncome);
      expect(result).toBe(50000); // Default fallback
    });
  });

  describe('applyInflation', () => {
    it('should apply no inflation for 0 years elapsed', () => {
      const result = applyInflation(100000, 0.02, 0);
      expect(result).toBe(100000);
    });

    it('should apply 2% inflation for 1 year', () => {
      const result = applyInflation(100000, 0.02, 1);
      expect(result).toBe(102000);
    });

    it('should apply compound inflation correctly', () => {
      const result = applyInflation(100000, 0.05, 3);
      const expected = 100000 * Math.pow(1.05, 3); // 115762.5
      expect(result).toBeCloseTo(expected, 2);
    });

    it('should handle negative inflation (deflation)', () => {
      const result = applyInflation(100000, -0.02, 2);
      const expected = 100000 * Math.pow(0.98, 2); // 96040
      expect(result).toBeCloseTo(expected, 2);
    });

    it('should handle zero inflation rate', () => {
      const result = applyInflation(100000, 0, 10);
      expect(result).toBe(100000);
    });
  });

  describe('determineBalanceStatus', () => {
    it('should return red for negative balance', () => {
      const result = determineBalanceStatus(-1000, 50000);
      expect(result).toBe('red');
    });

    it('should return red for zero balance', () => {
      const result = determineBalanceStatus(0, 50000);
      expect(result).toBe('red');
    });

    it('should return yellow for positive balance below minimum', () => {
      const result = determineBalanceStatus(25000, 50000);
      expect(result).toBe('yellow');
    });

    it('should return green for balance above minimum', () => {
      const result = determineBalanceStatus(75000, 50000);
      expect(result).toBe('green');
    });

    it('should return green for balance exactly at minimum', () => {
      const result = determineBalanceStatus(50000, 50000);
      expect(result).toBe('green');
    });
  });

  describe('roundToCurrency', () => {
    it('should round to 2 decimal places', () => {
      expect(roundToCurrency(123.456789)).toBe(123.46);
      expect(roundToCurrency(123.454)).toBe(123.45);
      expect(roundToCurrency(123)).toBe(123);
    });

    it('should handle negative numbers', () => {
      expect(roundToCurrency(-123.456)).toBe(-123.46);
    });

    it('should handle very small numbers', () => {
      expect(roundToCurrency(0.004)).toBe(0);
      expect(roundToCurrency(0.005)).toBe(0.01);
    });
  });

  describe('generateBudgetForecast', () => {
    let forecastParams: any;

    beforeEach(() => {
      forecastParams = {
        startAmount: 100000,
        minimumFund: 10000,
        generalInflation: 0.02, // 2%
        revenueInflation: 0.025, // 2.5%
        monthlyBaselineIncome: 50000,
        monthlyRecurringCosts: 30000,
        uniqueBillsByYear: { 2025: 120000 }, // 10k per month
        startYear: 2025,
      };
    });

    it('should generate 300 months of forecast data', () => {
      const result = generateBudgetForecast(forecastParams);
      expect(result).toHaveLength(300); // 25 years * 12 months
    });

    it('should have correct first month data structure', () => {
      const result = generateBudgetForecast(forecastParams);
      const firstMonth = result[0];

      expect(firstMonth).toHaveProperty('year', 2025);
      expect(firstMonth).toHaveProperty('month', 1);
      expect(firstMonth).toHaveProperty('revenue');
      expect(firstMonth).toHaveProperty('spending');
      expect(firstMonth).toHaveProperty('netCashFlow');
      expect(firstMonth).toHaveProperty('balance');
      expect(firstMonth).toHaveProperty('status');
      expect(firstMonth).toHaveProperty('inflatedIncome');
      expect(firstMonth).toHaveProperty('inflatedExpenses');
      expect(['red', 'yellow', 'green']).toContain(firstMonth.status);
    });

    it('should apply inflation annually, not monthly', () => {
      const result = generateBudgetForecast(forecastParams);
      
      // Same year months should have same inflation
      const month1Year1 = result[0]; // January 2025
      const month12Year1 = result[11]; // December 2025
      const month1Year2 = result[12]; // January 2026

      expect(month1Year1.inflatedIncome).toBeCloseTo(month12Year1.inflatedIncome, 2);
      expect(month1Year1.inflatedExpenses).toBeCloseTo(month12Year1.inflatedExpenses, 2);

      // Year 2 should show inflation applied
      expect(month1Year2.inflatedIncome).toBeCloseTo(month1Year1.inflatedIncome * 1.025, 2);
      expect(month1Year2.inflatedExpenses).toBeCloseTo(month1Year1.inflatedExpenses * 1.02, 2);
    });

    it('should handle zero inflation correctly', () => {
      const zeroInflationParams = {
        ...forecastParams,
        generalInflation: 0,
        revenueInflation: 0,
      };

      const result = generateBudgetForecast(zeroInflationParams);
      
      // With zero inflation, amounts should remain constant
      const firstMonth = result[0];
      const lastMonth = result[299];
      
      expect(firstMonth.inflatedIncome).toBeCloseTo(lastMonth.inflatedIncome, 2);
      expect(firstMonth.inflatedExpenses).toBeCloseTo(lastMonth.inflatedExpenses, 2);
    });

    it('should correctly calculate balance progression', () => {
      const result = generateBudgetForecast(forecastParams);
      
      // Verify balance calculation consistency
      let runningBalance = forecastParams.startAmount;
      for (let i = 0; i < 12; i++) {
        const month = result[i];
        runningBalance += month.netCashFlow;
        expect(month.balance).toBeCloseTo(runningBalance, 2);
      }
    });

    it('should handle scenario leading to negative balance', () => {
      const negativeParams = {
        ...forecastParams,
        startAmount: 10000, // Low start
        monthlyBaselineIncome: 20000, // Low income
        monthlyRecurringCosts: 35000, // High expenses
        uniqueBillsByYear: {}, // No unique bills
      };

      const result = generateBudgetForecast(negativeParams);
      
      // Should eventually go negative
      const negativeMonths = result.filter(month => month.balance < 0);
      expect(negativeMonths.length).toBeGreaterThan(0);
      
      // All negative months should have red status
      negativeMonths.forEach(month => {
        expect(month.status).toBe('red');
      });
    });

    it('should distribute unique bills monthly throughout the year', () => {
      const uniqueBillParams = {
        ...forecastParams,
        uniqueBillsByYear: { 2025: 60000 }, // Should be 5000 per month
        monthlyRecurringCosts: 20000, // Base recurring
      };

      const result = generateBudgetForecast(uniqueBillParams);
      
      // 2025 months should show additional 5k spending (60k/12)
      const year2025Months = result.slice(0, 12);
      year2025Months.forEach(month => {
        expect(month.spending).toBeCloseTo(25000, 2); // 20k recurring + 5k unique
      });
    });

    it('should handle multiple years of unique bills', () => {
      const multiYearParams = {
        ...forecastParams,
        uniqueBillsByYear: { 
          2025: 60000, // 5k per month
          2026: 120000, // 10k per month
          2027: 24000, // 2k per month
        },
        monthlyRecurringCosts: 20000,
      };

      const result = generateBudgetForecast(multiYearParams);
      
      // Check different years have correct spending
      const year2025Month = result[6]; // Mid-2025
      const year2026Month = result[18]; // Mid-2026  
      const year2027Month = result[30]; // Mid-2027
      
      expect(year2025Month.spending).toBeCloseTo(25000, 2); // 20k + 5k
      expect(year2026Month.spending).toBeCloseTo(30000, 2); // 20k + 10k (with some inflation)
      expect(year2027Month.spending).toBeCloseTo(22000, 2); // 20k + 2k (with some inflation)
    });

    it('should correctly transition between balance statuses', () => {
      const transitionParams = {
        ...forecastParams,
        startAmount: 80000, // Start above minimum
        minimumFund: 50000,
        monthlyBaselineIncome: 45000,
        monthlyRecurringCosts: 47000, // Slight deficit
        uniqueBillsByYear: {},
      };

      const result = generateBudgetForecast(transitionParams);
      
      // Should transition: green -> yellow -> red
      const greenMonths = result.filter(m => m.status === 'green');
      const yellowMonths = result.filter(m => m.status === 'yellow');
      const redMonths = result.filter(m => m.status === 'red');
      
      expect(greenMonths.length).toBeGreaterThan(0);
      expect(yellowMonths.length).toBeGreaterThan(0);
      expect(redMonths.length).toBeGreaterThan(0);
    });
  });
});