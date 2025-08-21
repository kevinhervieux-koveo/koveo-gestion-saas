/**
 * Data validation tests for Budget Dashboard
 * Tests calculation accuracy, data integrity, and business logic
 */

import { describe, it, expect } from '@jest/globals';

describe('Budget Data Validation', () => {
  describe('Monthly Fee Calculations', () => {
    interface Residence {
      unitNumber: string;
      monthlyFees: number;
      isActive: boolean;
    }

    function calculateMonthlyIncome(residences: Residence[]): number {
      return residences
        .filter(r => r.isActive && r.monthlyFees > 0)
        .reduce((total, r) => total + r.monthlyFees, 0);
    }

    it('should calculate monthly income correctly from residences', () => {
      const residences: Residence[] = [
        { unitNumber: '101', monthlyFees: 1800, isActive: true },
        { unitNumber: '102', monthlyFees: 1650, isActive: true },
        { unitNumber: '103', monthlyFees: 2000, isActive: true }
      ];

      const totalIncome = calculateMonthlyIncome(residences);
      expect(totalIncome).toBe(5450);
    });

    it('should exclude inactive residences from income calculation', () => {
      const residences: Residence[] = [
        { unitNumber: '101', monthlyFees: 1800, isActive: true },
        { unitNumber: '102', monthlyFees: 1650, isActive: false }, // Inactive
        { unitNumber: '103', monthlyFees: 2000, isActive: true }
      ];

      const totalIncome = calculateMonthlyIncome(residences);
      expect(totalIncome).toBe(3800); // 1800 + 2000
    });

    it('should exclude residences with zero or negative fees', () => {
      const residences: Residence[] = [
        { unitNumber: '101', monthlyFees: 1800, isActive: true },
        { unitNumber: '102', monthlyFees: 0, isActive: true }, // Zero fee
        { unitNumber: '103', monthlyFees: -100, isActive: true } // Negative fee
      ];

      const totalIncome = calculateMonthlyIncome(residences);
      expect(totalIncome).toBe(1800);
    });
  });

  describe('Bill Schedule Calculations', () => {
    interface Bill {
      title: string;
      category: string;
      totalAmount: number;
      schedulePayment: 'monthly' | 'quarterly' | 'yearly' | 'weekly' | 'custom';
      scheduleCustom?: string[];
      startDate: string;
      endDate?: string;
    }

    function calculateMonthlyBillAmount(
      bill: Bill, 
      targetYear: number, 
      targetMonth: number // 1-12
    ): number {
      const billStartDate = new Date(bill.startDate);
      const billEndDate = bill.endDate ? new Date(bill.endDate) : null;
      const targetDate = new Date(targetYear, targetMonth - 1, 1);

      // Check if bill is active for this month
      if (targetDate < billStartDate) return 0;
      if (billEndDate && targetDate > billEndDate) return 0;

      switch (bill.schedulePayment) {
        case 'monthly':
          return bill.totalAmount;
        
        case 'quarterly':
          // Quarters: Jan, Apr, Jul, Oct (months 1, 4, 7, 10)
          return [1, 4, 7, 10].includes(targetMonth) ? bill.totalAmount : 0;
        
        case 'yearly':
          // Only in the start month of each year
          const startMonth = billStartDate.getMonth() + 1;
          return targetMonth === startMonth ? bill.totalAmount : 0;
        
        case 'weekly':
          // Approximate: 4.33 weeks per month
          return bill.totalAmount * 4.33;
        
        case 'custom':
          if (bill.scheduleCustom?.some(date => {
            const customDate = new Date(date);
            return customDate.getFullYear() === targetYear && 
                   customDate.getMonth() + 1 === targetMonth;
          })) {
            return bill.totalAmount;
          }
          return 0;
        
        default:
          return 0;
      }
    }

    it('should calculate monthly bills correctly', () => {
      const bill: Bill = {
        title: 'Monthly Utilities',
        category: 'utilities',
        totalAmount: 2500,
        schedulePayment: 'monthly',
        startDate: '2024-01-01'
      };

      // Should charge every month
      expect(calculateMonthlyBillAmount(bill, 2024, 1)).toBe(2500);
      expect(calculateMonthlyBillAmount(bill, 2024, 6)).toBe(2500);
      expect(calculateMonthlyBillAmount(bill, 2024, 12)).toBe(2500);
    });

    it('should calculate quarterly bills correctly', () => {
      const bill: Bill = {
        title: 'Quarterly Insurance',
        category: 'insurance',
        totalAmount: 6000,
        schedulePayment: 'quarterly',
        startDate: '2024-01-01'
      };

      // Should charge in quarters: Jan, Apr, Jul, Oct
      expect(calculateMonthlyBillAmount(bill, 2024, 1)).toBe(6000); // Q1
      expect(calculateMonthlyBillAmount(bill, 2024, 2)).toBe(0);     // Not quarter
      expect(calculateMonthlyBillAmount(bill, 2024, 4)).toBe(6000); // Q2
      expect(calculateMonthlyBillAmount(bill, 2024, 5)).toBe(0);     // Not quarter
      expect(calculateMonthlyBillAmount(bill, 2024, 7)).toBe(6000); // Q3
      expect(calculateMonthlyBillAmount(bill, 2024, 10)).toBe(6000); // Q4
      expect(calculateMonthlyBillAmount(bill, 2024, 11)).toBe(0);    // Not quarter
    });

    it('should calculate yearly bills correctly', () => {
      const bill: Bill = {
        title: 'Annual Property Tax',
        category: 'taxes',
        totalAmount: 15000,
        schedulePayment: 'yearly',
        startDate: '2024-03-01' // Starts in March
      };

      // Should only charge in March each year
      expect(calculateMonthlyBillAmount(bill, 2024, 1)).toBe(0);     // Wrong month
      expect(calculateMonthlyBillAmount(bill, 2024, 3)).toBe(15000); // Correct month
      expect(calculateMonthlyBillAmount(bill, 2024, 6)).toBe(0);     // Wrong month
      expect(calculateMonthlyBillAmount(bill, 2025, 3)).toBe(15000); // Next year, correct month
    });

    it('should calculate custom schedule bills correctly', () => {
      const bill: Bill = {
        title: 'Semi-Annual Maintenance',
        category: 'maintenance',
        totalAmount: 10000,
        schedulePayment: 'custom',
        scheduleCustom: ['2024-06-15', '2024-12-15'],
        startDate: '2024-01-01'
      };

      // Should only charge in June and December
      expect(calculateMonthlyBillAmount(bill, 2024, 1)).toBe(0);     // Not scheduled
      expect(calculateMonthlyBillAmount(bill, 2024, 6)).toBe(10000); // June
      expect(calculateMonthlyBillAmount(bill, 2024, 9)).toBe(0);     // Not scheduled
      expect(calculateMonthlyBillAmount(bill, 2024, 12)).toBe(10000); // December
    });

    it('should respect bill end dates', () => {
      const bill: Bill = {
        title: 'Temporary Service',
        category: 'utilities',
        totalAmount: 1000,
        schedulePayment: 'monthly',
        startDate: '2024-01-01',
        endDate: '2024-06-30'
      };

      // Should charge until June, then stop
      expect(calculateMonthlyBillAmount(bill, 2024, 3)).toBe(1000); // Active period
      expect(calculateMonthlyBillAmount(bill, 2024, 6)).toBe(1000); // Last month
      expect(calculateMonthlyBillAmount(bill, 2024, 7)).toBe(0);    // After end date
      expect(calculateMonthlyBillAmount(bill, 2024, 12)).toBe(0);   // After end date
    });

    it('should handle bills starting in the future', () => {
      const bill: Bill = {
        title: 'Future Service',
        category: 'utilities',
        totalAmount: 1500,
        schedulePayment: 'monthly',
        startDate: '2024-06-01'
      };

      // Should not charge before start date
      expect(calculateMonthlyBillAmount(bill, 2024, 1)).toBe(0);    // Before start
      expect(calculateMonthlyBillAmount(bill, 2024, 5)).toBe(0);    // Before start
      expect(calculateMonthlyBillAmount(bill, 2024, 6)).toBe(1500); // Start month
      expect(calculateMonthlyBillAmount(bill, 2024, 12)).toBe(1500); // After start
    });

    it('should calculate weekly bills approximately', () => {
      const bill: Bill = {
        title: 'Weekly Cleaning',
        category: 'cleaning',
        totalAmount: 200, // Per week
        schedulePayment: 'weekly',
        startDate: '2024-01-01'
      };

      const monthlyAmount = calculateMonthlyBillAmount(bill, 2024, 1);
      
      // Should be approximately 200 * 4.33 weeks per month
      expect(monthlyAmount).toBeCloseTo(866, 0);
    });
  });

  describe('Special Contribution Calculations', () => {
    interface PropertyContribution {
      unitNumber: string;
      ownershipPercentage: number;
      contribution: number;
    }

    function calculateSpecialContributions(
      totalShortfall: number,
      residences: { unitNumber: string; ownershipPercentage: number }[]
    ): PropertyContribution[] {
      return residences.map(residence => ({
        unitNumber: residence.unitNumber,
        ownershipPercentage: residence.ownershipPercentage,
        contribution: (totalShortfall * residence.ownershipPercentage) / 100
      }));
    }

    it('should calculate special contributions based on ownership percentage', () => {
      const shortfall = 50000; // Negative cash flow requiring contribution
      const residences = [
        { unitNumber: '101', ownershipPercentage: 5.5 },
        { unitNumber: '102', ownershipPercentage: 4.2 },
        { unitNumber: '103', ownershipPercentage: 6.8 }
      ];

      const contributions = calculateSpecialContributions(shortfall, residences);

      expect(contributions[0].contribution).toBeCloseTo(2750, 2); // 50000 * 0.055
      expect(contributions[1].contribution).toBeCloseTo(2100, 2); // 50000 * 0.042
      expect(contributions[2].contribution).toBeCloseTo(3400, 2); // 50000 * 0.068

      // Total contributions should equal shortfall * (total ownership / 100)
      const totalContributions = contributions.reduce((sum, c) => sum + c.contribution, 0);
      const totalOwnership = residences.reduce((sum, r) => sum + r.ownershipPercentage, 0);
      expect(totalContributions).toBeCloseTo(shortfall * (totalOwnership / 100), 2);
    });

    it('should handle zero ownership percentages', () => {
      const shortfall = 30000;
      const residences = [
        { unitNumber: '101', ownershipPercentage: 5.0 },
        { unitNumber: '102', ownershipPercentage: 0 }, // Zero ownership
        { unitNumber: '103', ownershipPercentage: 3.5 }
      ];

      const contributions = calculateSpecialContributions(shortfall, residences);

      expect(contributions[0].contribution).toBeCloseTo(1500, 2); // 30000 * 0.05
      expect(contributions[1].contribution).toBe(0); // 30000 * 0
      expect(contributions[2].contribution).toBeCloseTo(1050, 2); // 30000 * 0.035
    });

    it('should handle fractional ownership percentages accurately', () => {
      const shortfall = 100000;
      const residences = [
        { unitNumber: 'A101', ownershipPercentage: 2.33 },
        { unitNumber: 'A102', ownershipPercentage: 4.67 },
        { unitNumber: 'B201', ownershipPercentage: 1.15 }
      ];

      const contributions = calculateSpecialContributions(shortfall, residences);

      expect(contributions[0].contribution).toBeCloseTo(2330, 2);
      expect(contributions[1].contribution).toBeCloseTo(4670, 2);
      expect(contributions[2].contribution).toBeCloseTo(1150, 2);
    });
  });

  describe('Financial Summary Calculations', () => {
    function calculateSummary(monthlyData: Array<{
      totalIncome: number;
      totalExpenses: number;
      netCashFlow: number;
    }>) {
      const totalIncome = monthlyData.reduce((sum, month) => sum + month.totalIncome, 0);
      const totalExpenses = monthlyData.reduce((sum, month) => sum + month.totalExpenses, 0);
      const monthCount = monthlyData.length || 1;

      return {
        totalIncome,
        totalExpenses,
        netCashFlow: totalIncome - totalExpenses,
        averageMonthlyIncome: totalIncome / monthCount,
        averageMonthlyExpenses: totalExpenses / monthCount,
      };
    }

    it('should calculate annual summary correctly', () => {
      const monthlyData = Array.from({ length: 12 }, (_, i) => ({
        totalIncome: 5000 + (i * 100), // Varying income: 5000, 5100, 5200, etc.
        totalExpenses: 4000 + (i * 50), // Varying expenses: 4000, 4050, 4100, etc.
        netCashFlow: 0 // Will be recalculated in summary
      }));

      const summary = calculateSummary(monthlyData);

      // Total income: 5000*12 + 100*(0+1+2+...+11) = 60000 + 100*66 = 66600
      expect(summary.totalIncome).toBe(66600);
      
      // Total expenses: 4000*12 + 50*(0+1+2+...+11) = 48000 + 50*66 = 51300
      expect(summary.totalExpenses).toBe(51300);
      
      // Net cash flow: 66600 - 51300 = 15300
      expect(summary.netCashFlow).toBe(15300);
      
      // Average monthly income: 66600 / 12 = 5550
      expect(summary.averageMonthlyIncome).toBe(5550);
      
      // Average monthly expenses: 51300 / 12 = 4275
      expect(summary.averageMonthlyExpenses).toBe(4275);
    });

    it('should handle zero data gracefully', () => {
      const monthlyData = Array.from({ length: 12 }, () => ({
        totalIncome: 0,
        totalExpenses: 0,
        netCashFlow: 0
      }));

      const summary = calculateSummary(monthlyData);

      expect(summary.totalIncome).toBe(0);
      expect(summary.totalExpenses).toBe(0);
      expect(summary.netCashFlow).toBe(0);
      expect(summary.averageMonthlyIncome).toBe(0);
      expect(summary.averageMonthlyExpenses).toBe(0);
    });

    it('should handle empty data array', () => {
      const monthlyData: any[] = [];
      const summary = calculateSummary(monthlyData);

      expect(summary.totalIncome).toBe(0);
      expect(summary.totalExpenses).toBe(0);
      expect(summary.netCashFlow).toBe(0);
      expect(summary.averageMonthlyIncome).toBe(0);
      expect(summary.averageMonthlyExpenses).toBe(0);
    });

    it('should calculate multi-year summaries correctly', () => {
      // 24 months of data (2 years)
      const monthlyData = Array.from({ length: 24 }, (_, i) => ({
        totalIncome: 6000,
        totalExpenses: 4500,
        netCashFlow: 1500
      }));

      const summary = calculateSummary(monthlyData);

      expect(summary.totalIncome).toBe(144000); // 6000 * 24
      expect(summary.totalExpenses).toBe(108000); // 4500 * 24
      expect(summary.netCashFlow).toBe(36000); // 144000 - 108000
      expect(summary.averageMonthlyIncome).toBe(6000);
      expect(summary.averageMonthlyExpenses).toBe(4500);
    });
  });

  describe('Data Type Validations', () => {
    it('should handle string numbers correctly', () => {
      const stringAmount = '2500.50';
      const numberAmount = parseFloat(stringAmount);
      
      expect(numberAmount).toBe(2500.5);
      expect(typeof numberAmount).toBe('number');
    });

    it('should handle null and undefined values', () => {
      const nullAmount = null;
      const undefinedAmount = undefined;
      const emptyStringAmount = '';
      
      expect(parseFloat(nullAmount as any) || 0).toBe(0);
      expect(parseFloat(undefinedAmount as any) || 0).toBe(0);
      expect(parseFloat(emptyStringAmount) || 0).toBe(0);
    });

    it('should validate percentage calculations precision', () => {
      const total = 123456.78;
      const percentage = 5.555;
      
      const calculated = (total * percentage) / 100;
      const rounded = Math.round(calculated * 100) / 100; // Round to 2 decimal places
      
      expect(rounded).toBeCloseTo(6858.81, 2);
    });

    it('should handle floating point precision correctly', () => {
      // Common floating point precision issues
      const a = 0.1 + 0.2;
      const b = 0.3;
      
      // Direct comparison would fail due to floating point precision
      expect(a).not.toBe(b);
      
      // But should be approximately equal
      expect(a).toBeCloseTo(b, 10);
      
      // For financial calculations, round to 2 decimal places
      const rounded = Math.round(a * 100) / 100;
      expect(rounded).toBe(0.3);
    });
  });
});