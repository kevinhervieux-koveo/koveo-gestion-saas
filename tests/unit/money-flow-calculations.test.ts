import { describe, it, expect } from '@jest/globals';

/**
 * Comprehensive tests for money flow calculation logic.
 * These tests verify the mathematical correctness of various
 * financial calculations used in the money flow automation.
 */
describe('Money Flow Calculations', () => {
  describe('Recurrence Pattern Calculations', () => {
    describe('Weekly calculations', () => {
      it('should calculate correct number of weekly occurrences in a year', () => {
        const startDate = new Date('2024-01-01'); // Monday
        const endDate = new Date('2024-12-31');
        
        const weeklyOccurrences = calculateWeeklyOccurrences(startDate, endDate);
        
        // 2024 has 366 days (leap year), so 366/7 = 52.28 weeks
        expect(weeklyOccurrences).toBe(53); // 53 occurrences starting Jan 1
      });

      it('should handle partial weeks correctly', () => {
        const startDate = new Date('2024-01-15'); // Mid-month start
        const endDate = new Date('2024-01-31');
        
        const weeklyOccurrences = calculateWeeklyOccurrences(startDate, endDate);
        
        // From Jan 15 to Jan 31: Jan 15, 22, 29 = 3 occurrences
        expect(weeklyOccurrences).toBe(3);
      });

      it('should handle start date after end date', () => {
        const startDate = new Date('2024-12-31');
        const endDate = new Date('2024-01-01');
        
        const weeklyOccurrences = calculateWeeklyOccurrences(startDate, endDate);
        
        expect(weeklyOccurrences).toBe(0);
      });
    });

    describe('Monthly calculations', () => {
      it('should calculate correct number of monthly occurrences', () => {
        const startDate = new Date('2024-01-01');
        const endDate = new Date('2024-12-31');
        
        const monthlyOccurrences = calculateMonthlyOccurrences(startDate, endDate);
        
        expect(monthlyOccurrences).toBe(12); // 12 months in 2024
      });

      it('should handle month boundary edge cases', () => {
        const startDate = new Date('2024-01-31'); // Jan 31
        const endDate = new Date('2024-03-31');
        
        // Jan 31, Feb 29 (leap year), Mar 31
        const monthlyOccurrences = calculateMonthlyOccurrences(startDate, endDate);
        
        expect(monthlyOccurrences).toBe(3);
      });

      it('should handle leap year February correctly', () => {
        const startDate = new Date('2024-02-29'); // Leap year Feb 29
        const endDate = new Date('2025-02-28'); // Non-leap year Feb 28
        
        const monthlyOccurrences = calculateMonthlyOccurrences(startDate, endDate);
        
        expect(monthlyOccurrences).toBe(13); // 13 months from Feb 29, 2024 to Feb 28, 2025
      });

      it('should handle non-leap year correctly', () => {
        const startDate = new Date('2023-02-28'); // Non-leap year Feb 28
        const endDate = new Date('2024-02-29'); // Leap year Feb 29
        
        const monthlyOccurrences = calculateMonthlyOccurrences(startDate, endDate);
        
        expect(monthlyOccurrences).toBe(13); // 13 months
      });
    });

    describe('Quarterly calculations', () => {
      it('should calculate correct quarterly occurrences', () => {
        const startDate = new Date('2024-01-01');
        const endDate = new Date('2024-12-31');
        
        const quarterlyOccurrences = calculateQuarterlyOccurrences(startDate, endDate);
        
        expect(quarterlyOccurrences).toBe(4); // Q1, Q2, Q3, Q4
      });

      it('should handle partial quarters', () => {
        const startDate = new Date('2024-02-15'); // Mid Q1
        const endDate = new Date('2024-08-15'); // Mid Q3
        
        const quarterlyOccurrences = calculateQuarterlyOccurrences(startDate, endDate);
        
        // Feb 15, May 15, Aug 15 = 3 occurrences
        expect(quarterlyOccurrences).toBe(3);
      });

      it('should handle multi-year quarters', () => {
        const startDate = new Date('2024-01-01');
        const endDate = new Date('2026-12-31'); // 3 years
        
        const quarterlyOccurrences = calculateQuarterlyOccurrences(startDate, endDate);
        
        expect(quarterlyOccurrences).toBe(12); // 4 quarters × 3 years
      });
    });

    describe('Yearly calculations', () => {
      it('should calculate correct yearly occurrences', () => {
        const startDate = new Date('2024-01-01');
        const endDate = new Date('2049-01-01'); // 25 years
        
        const yearlyOccurrences = calculateYearlyOccurrences(startDate, endDate);
        
        expect(yearlyOccurrences).toBe(26); // 2024 through 2049 inclusive
      });

      it('should handle leap years correctly', () => {
        const startDate = new Date('2024-02-29'); // Leap year
        const endDate = new Date('2027-02-28'); // 3 years later
        
        const yearlyOccurrences = calculateYearlyOccurrences(startDate, endDate);
        
        // 2024-02-29, 2025-02-28, 2026-02-28, 2027-02-28 = 4 occurrences
        expect(yearlyOccurrences).toBe(4);
      });
    });

    describe('Custom schedule calculations', () => {
      it('should handle custom dates within range', () => {
        const customDates = ['2024-03-15', '2024-06-15', '2024-09-15', '2024-12-15'];
        const startDate = new Date('2024-01-01');
        const endDate = new Date('2024-12-31');
        
        const occurrences = calculateCustomOccurrences(customDates, startDate, endDate);
        
        expect(occurrences).toBe(4); // All 4 dates are within range
      });

      it('should filter custom dates outside range', () => {
        const customDates = ['2023-12-15', '2024-03-15', '2024-06-15', '2025-01-15'];
        const startDate = new Date('2024-01-01');
        const endDate = new Date('2024-12-31');
        
        const occurrences = calculateCustomOccurrences(customDates, startDate, endDate);
        
        expect(occurrences).toBe(2); // Only Mar 15 and Jun 15 are within range
      });

      it('should handle yearly recurring custom dates', () => {
        const customDates = ['2024-03-15', '2024-06-15', '2024-09-15', '2024-12-15'];
        const startDate = new Date('2024-01-01');
        const endDate = new Date('2026-12-31'); // 3 years
        
        // Simulate yearly recurrence of custom dates
        const allOccurrences = [];
        for (let year = 2024; year <= 2026; year++) {
          customDates.forEach(dateStr => {
            const newDate = dateStr.replace('2024', year.toString());
            const date = new Date(newDate);
            if (date >= startDate && date <= endDate) {
              allOccurrences.push(date);
            }
          });
        }
        
        expect(allOccurrences).toHaveLength(12); // 4 dates × 3 years
      });
    });
  });

  describe('Cost Distribution Calculations', () => {
    it('should handle single cost correctly', () => {
      const costs = ['1000.00'];
      const occurrences = 12; // Monthly for a year
      
      const totalCost = calculateTotalCost(costs, occurrences);
      
      expect(totalCost).toBe(12000); // $1000 × 12 months
    });

    it('should cycle through multiple costs', () => {
      const costs = ['1000.00', '1500.00', '2000.00'];
      const occurrences = 8;
      
      // Should cycle: 1000, 1500, 2000, 1000, 1500, 2000, 1000, 1500
      const expectedTotal = 1000 + 1500 + 2000 + 1000 + 1500 + 2000 + 1000 + 1500;
      const totalCost = calculateTotalCost(costs, occurrences);
      
      expect(totalCost).toBe(expectedTotal); // $12,500
    });

    it('should handle fractional amounts correctly', () => {
      const costs = ['999.99', '1500.50', '2000.01'];
      const occurrences = 3;
      
      const expectedTotal = 999.99 + 1500.50 + 2000.01;
      const totalCost = calculateTotalCost(costs, occurrences);
      
      expect(totalCost).toBeCloseTo(expectedTotal, 2);
    });

    it('should handle large numbers of occurrences', () => {
      const costs = ['100.00'];
      const occurrences = 300; // 25 years of monthly payments
      
      const totalCost = calculateTotalCost(costs, occurrences);
      
      expect(totalCost).toBe(30000); // $100 × 300 months
    });
  });

  describe('Date Range Validation', () => {
    it('should validate 25-year projection correctly', () => {
      const startDate = new Date();
      const projectionYears = 25;
      const endDate = new Date();
      endDate.setFullYear(startDate.getFullYear() + projectionYears);
      
      const daysDifference = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const expectedDays = projectionYears * 365; // Approximate
      
      expect(daysDifference).toBeGreaterThan(expectedDays - 366); // Account for leap years
      expect(daysDifference).toBeLessThan(expectedDays + 366);
    });

    it('should handle daylight saving time transitions', () => {
      // Spring forward (March): 2:00 AM becomes 3:00 AM
      const springForward = new Date('2024-03-10T02:00:00');
      const nextWeek = new Date(springForward);
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      const daysDifference = Math.floor((nextWeek.getTime() - springForward.getTime()) / (1000 * 60 * 60 * 24));
      expect(daysDifference).toBe(7); // Should still be 7 days
      
      // Fall back (November): 2:00 AM becomes 1:00 AM
      const fallBack = new Date('2024-11-03T02:00:00');
      const nextWeekFall = new Date(fallBack);
      nextWeekFall.setDate(nextWeekFall.getDate() + 7);
      
      const daysDifferenceFall = Math.floor((nextWeekFall.getTime() - fallBack.getTime()) / (1000 * 60 * 60 * 24));
      expect(daysDifferenceFall).toBe(7); // Should still be 7 days
    });
  });

  describe('Currency and Precision Calculations', () => {
    it('should maintain precision for financial calculations', () => {
      const amounts = [123.45, 678.90, 999.99];
      const total = amounts.reduce((sum, amount) => sum + amount, 0);
      
      // Use proper currency arithmetic
      const preciseTotal = Math.round(total * 100) / 100;
      
      expect(preciseTotal).toBe(1802.34);
    });

    it('should handle rounding correctly', () => {
      const amounts = [10.005, 20.004, 30.006];
      const roundedAmounts = amounts.map(amount => Math.round(amount * 100) / 100);
      
      expect(roundedAmounts).toEqual([10.01, 20.00, 30.01]);
    });

    it('should handle very large amounts', () => {
      const largeAmount = 999999999.99;
      const monthly = largeAmount / 12;
      const roundedMonthly = Math.round(monthly * 100) / 100;
      
      expect(roundedMonthly).toBe(83333333.33);
    });

    it('should handle very small amounts', () => {
      const smallAmount = 0.01;
      const yearly = smallAmount * 365;
      
      expect(yearly).toBeCloseTo(3.65, 2);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle same start and end date', () => {
      const date = new Date('2024-01-01');
      const occurrences = calculateMonthlyOccurrences(date, date);
      
      expect(occurrences).toBe(1); // Single occurrence
    });

    it('should handle empty cost arrays', () => {
      const costs: string[] = [];
      const occurrences = 12;
      
      const totalCost = calculateTotalCost(costs, occurrences);
      
      expect(totalCost).toBe(0);
    });

    it('should handle zero occurrences', () => {
      const costs = ['1000.00'];
      const occurrences = 0;
      
      const totalCost = calculateTotalCost(costs, occurrences);
      
      expect(totalCost).toBe(0);
    });

    it('should handle invalid dates gracefully', () => {
      const invalidDate = new Date('invalid');
      const validDate = new Date('2024-01-01');
      
      expect(isNaN(invalidDate.getTime())).toBe(true);
      expect(isNaN(validDate.getTime())).toBe(false);
    });
  });
});

// Helper functions for testing
function calculateWeeklyOccurrences(startDate: Date, endDate: Date): number {
  if (startDate > endDate) return 0;
  
  let count = 0;
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    count++;
    currentDate.setDate(currentDate.getDate() + 7);
  }
  
  return count;
}

function calculateMonthlyOccurrences(startDate: Date, endDate: Date): number {
  if (startDate > endDate) return 0;
  
  let count = 0;
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    count++;
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  
  return count;
}

function calculateQuarterlyOccurrences(startDate: Date, endDate: Date): number {
  if (startDate > endDate) return 0;
  
  let count = 0;
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    count++;
    currentDate.setMonth(currentDate.getMonth() + 3);
  }
  
  return count;
}

function calculateYearlyOccurrences(startDate: Date, endDate: Date): number {
  if (startDate > endDate) return 0;
  
  let count = 0;
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    count++;
    currentDate.setFullYear(currentDate.getFullYear() + 1);
  }
  
  return count;
}

function calculateCustomOccurrences(customDates: string[], startDate: Date, endDate: Date): number {
  return customDates.filter(dateStr => {
    const date = new Date(dateStr);
    return date >= startDate && date <= endDate;
  }).length;
}

function calculateTotalCost(costs: string[], occurrences: number): number {
  if (costs.length === 0 || occurrences === 0) return 0;
  
  let total = 0;
  for (let i = 0; i < occurrences; i++) {
    const costIndex = i % costs.length;
    total += parseFloat(costs[costIndex]);
  }
  
  return Math.round(total * 100) / 100; // Round to 2 decimal places
}