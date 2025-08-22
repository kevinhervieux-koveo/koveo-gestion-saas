import { getDemoBills, getDemoBuildings, DEMO_ORG_ID } from '../../utils/demo-data-helpers';

describe('Budget Calculation Logic with Demo Organization Data', () => {
  describe('Income and Expense Calculations', () => {
    it('calculates total expenses from real Demo bills', () => {
      const demoBills = getDemoBills();
      
      // Calculate total expenses using the same logic as the Budget component
      const totalExpenses = demoBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
      
      // Verify we have real Demo data
      expect(demoBills.length).toBeGreaterThan(0);
      expect(totalExpenses).toBeGreaterThan(0);
      
      // Verify specific Demo bills are included
      const maintenanceBills = getDemoBills('unique', 'maintenance');
      const maintenanceTotal = maintenanceBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
      
      expect(maintenanceBills.length).toBeGreaterThan(0);
      expect(maintenanceTotal).toBeGreaterThan(0);
      
      console.log(`Demo Organization Total Expenses: $${totalExpenses.toLocaleString()}`);
      console.log(`Maintenance Expenses: $${maintenanceTotal.toLocaleString()}`);
    });

    it('categorizes expenses correctly from Demo bills', () => {
      const demoBills = getDemoBills();
      
      // Group expenses by category (same logic as Budget component)
      const expensesByCategory: Record<string, number> = {};
      
      demoBills.forEach(bill => {
        if (!expensesByCategory[bill.category]) {
          expensesByCategory[bill.category] = 0;
        }
        expensesByCategory[bill.category] += bill.totalAmount;
      });
      
      // Verify categories exist
      expect(Object.keys(expensesByCategory).length).toBeGreaterThan(0);
      expect(expensesByCategory.maintenance).toBeGreaterThan(0);
      
      // Verify all amounts are positive
      Object.values(expensesByCategory).forEach(amount => {
        expect(amount).toBeGreaterThan(0);
      });
      
      console.log('Demo Organization Expenses by Category:', expensesByCategory);
    });

    it('calculates net cash flow with realistic income and expenses', () => {
      const demoBills = getDemoBills();
      const totalExpenses = demoBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
      
      // Simulate income based on Demo buildings (realistic amounts)
      const demoBuildings = getDemoBuildings();
      const monthlyFeesPerUnit = 450; // Typical condo fees in Montreal
      const unitsPerBuilding = 5; // Based on our Demo data structure
      const totalIncome = demoBuildings.length * unitsPerBuilding * monthlyFeesPerUnit;
      
      const netCashFlow = totalIncome - totalExpenses;
      
      expect(totalIncome).toBeGreaterThan(0);
      expect(totalExpenses).toBeGreaterThan(0);
      expect(typeof netCashFlow).toBe('number');
      
      console.log(`Demo Organization Cash Flow Analysis:`);
      console.log(`  Total Income: $${totalIncome.toLocaleString()}`);
      console.log(`  Total Expenses: $${totalExpenses.toLocaleString()}`);
      console.log(`  Net Cash Flow: $${netCashFlow.toLocaleString()}`);
      
      // Determine if special contributions are needed
      if (netCashFlow < 0) {
        const specialContribution = Math.abs(netCashFlow);
        const perUnitContribution = specialContribution / (demoBuildings.length * unitsPerBuilding);
        
        console.log(`  Special Contribution Required: $${specialContribution.toLocaleString()}`);
        console.log(`  Per Unit Assessment: $${perUnitContribution.toLocaleString()}`);
        
        expect(specialContribution).toBeGreaterThan(0);
        expect(perUnitContribution).toBeGreaterThan(0);
      }
    });
  });

  describe('Bank Account Balance Calculations', () => {
    it('calculates running balance over time with real data', () => {
      const demoBills = getDemoBills();
      const startingBalance = 75000; // From Demo bank account
      
      // Simulate monthly cash flows
      const monthlyExpenses = demoBills.reduce((sum, bill) => sum + bill.totalAmount, 0) / 12;
      const monthlyIncome = 4500; // 10 units × $450 monthly fees
      const monthlyCashFlow = monthlyIncome - monthlyExpenses;
      
      // Calculate running balance over 12 months
      let runningBalance = startingBalance;
      const balanceHistory = [runningBalance];
      
      for (let month = 1; month <= 12; month++) {
        runningBalance += monthlyCashFlow;
        balanceHistory.push(runningBalance);
      }
      
      expect(balanceHistory.length).toBe(13); // Starting + 12 months
      expect(balanceHistory[0]).toBe(startingBalance);
      
      // Check that balance calculations are consistent
      const finalBalance = startingBalance + (monthlyCashFlow * 12);
      expect(balanceHistory[12]).toBeCloseTo(finalBalance, 2);
      
      console.log('Demo Bank Account Balance Projection:');
      console.log(`  Starting Balance: $${startingBalance.toLocaleString()}`);
      console.log(`  Monthly Cash Flow: $${monthlyCashFlow.toLocaleString()}`);
      console.log(`  Ending Balance: $${balanceHistory[12].toLocaleString()}`);
    });

    it('validates minimum balance requirements', () => {
      const minimumBalances = {
        emergency: 50000,
        maintenance: 25000,
        administrative: 10000
      };
      
      const totalMinimumRequired = Object.values(minimumBalances).reduce((sum, min) => sum + min, 0);
      const currentBalance = 75000;
      
      expect(totalMinimumRequired).toBe(85000);
      expect(currentBalance).toBeLessThan(totalMinimumRequired);
      
      // Calculate deficit
      const deficit = totalMinimumRequired - currentBalance;
      expect(deficit).toBe(10000);
      
      console.log('Demo Minimum Balance Analysis:');
      console.log(`  Total Required: $${totalMinimumRequired.toLocaleString()}`);
      console.log(`  Current Balance: $${currentBalance.toLocaleString()}`);
      console.log(`  Deficit: $${deficit.toLocaleString()}`);
    });
  });

  describe('Special Contribution Calculations', () => {
    it('calculates property-based contributions using real Demo data', () => {
      const demoBuildings = getDemoBuildings();
      const unitsPerBuilding = 5;
      const totalUnits = demoBuildings.length * unitsPerBuilding;
      
      // Simulate negative cash flow requiring special assessment
      const shortfall = 15000;
      const baseContribution = shortfall / totalUnits;
      
      // Create property contribution breakdown
      const propertyContributions = [];
      let unitNumber = 101;
      
      for (const building of demoBuildings) {
        for (let i = 0; i < unitsPerBuilding; i++) {
          const ownershipPercentage = 10; // Equal ownership for simplicity
          const contribution = (shortfall * ownershipPercentage) / 100;
          
          propertyContributions.push({
            buildingId: building.id,
            unitNumber: unitNumber.toString(),
            ownershipPercentage,
            contribution: contribution,
            squareFootage: 850 + (i * 50)
          });
          
          unitNumber++;
        }
      }
      
      // Validate calculations
      expect(propertyContributions.length).toBe(totalUnits);
      expect(baseContribution).toBe(1500); // $15,000 / 10 units
      
      const totalContributions = propertyContributions.reduce((sum, prop) => sum + prop.contribution, 0);
      expect(totalContributions).toBeCloseTo(shortfall, 2);
      
      console.log('Demo Special Contribution Breakdown:');
      console.log(`  Total Shortfall: $${shortfall.toLocaleString()}`);
      console.log(`  Base Contribution per Unit: $${baseContribution.toLocaleString()}`);
      console.log(`  Number of Properties: ${propertyContributions.length}`);
    });

    it('handles different ownership percentages correctly', () => {
      const contributions = [
        { unit: '101', ownership: 8.5, amount: 0 },
        { unit: '102', ownership: 10.0, amount: 0 },
        { unit: '103', ownership: 12.5, amount: 0 },
        { unit: '201', ownership: 9.0, amount: 0 },
        { unit: '202', ownership: 11.0, amount: 0 }
      ];
      
      const totalShortfall = 10000;
      
      // Calculate contributions based on ownership
      contributions.forEach(contrib => {
        contrib.amount = (totalShortfall * contrib.ownership) / 100;
      });
      
      // Verify total ownership adds up correctly
      const totalOwnership = contributions.reduce((sum, c) => sum + c.ownership, 0);
      expect(totalOwnership).toBe(51.0); // Partial ownership for demo
      
      // Verify contributions are proportional
      const totalContributions = contributions.reduce((sum, c) => sum + c.amount, 0);
      expect(totalContributions).toBeCloseTo(5100, 2); // 51% of $10,000
      
      console.log('Ownership-Based Contributions:', contributions);
    });
  });

  describe('Data Validation and Edge Cases', () => {
    it('validates Demo organization data integrity', () => {
      const demoBuildings = getDemoBuildings();
      const demoBills = getDemoBills();
      
      // Validate Demo organization structure
      expect(DEMO_ORG_ID).toBe('e98cc553-c2d7-4854-877a-7cc9eeb8c6b6');
      expect(demoBuildings.length).toBe(2);
      expect(demoBills.length).toBeGreaterThan(5);
      
      // Validate building data
      demoBuildings.forEach(building => {
        expect(building.organizationId).toBe(DEMO_ORG_ID);
        expect(building.name).toContain('Demo Building');
        expect(building.isActive).toBe(true);
      });
      
      // Validate bill data
      demoBills.forEach(bill => {
        expect(bill.totalAmount).toBeGreaterThan(0);
        expect(bill.costs).toBeInstanceOf(Array);
        expect(bill.costs.length).toBeGreaterThan(0);
        expect(['maintenance', 'utilities', 'insurance']).toContain(bill.category);
        expect(['unique', 'recurrent']).toContain(bill.paymentType);
      });
    });

    it('handles zero and negative values in calculations', () => {
      // Test with zero income scenario
      const zeroIncome = 0;
      const normalExpenses = 5000;
      const cashFlow = zeroIncome - normalExpenses;
      
      expect(cashFlow).toBe(-5000);
      expect(Math.abs(cashFlow)).toBe(5000); // Special contribution needed
      
      // Test with zero expenses scenario
      const normalIncome = 5000;
      const zeroExpenses = 0;
      const positiveCashFlow = normalIncome - zeroExpenses;
      
      expect(positiveCashFlow).toBe(5000);
      expect(positiveCashFlow > 0).toBe(true); // No special contribution
      
      // Test boundary conditions
      const equalIncomeExpenses = 5000;
      const breakEvenCashFlow = equalIncomeExpenses - equalIncomeExpenses;
      
      expect(breakEvenCashFlow).toBe(0);
    });

    it('formats currency values correctly', () => {
      const testAmounts = [1234.56, 12345.67, 123456.78];
      
      testAmounts.forEach(amount => {
        const formatted = amount.toLocaleString();
        expect(formatted).toMatch(/^[0-9,]+(\.\d{2})?$/);
        
        // Test with currency symbol
        const withSymbol = `$${formatted}`;
        expect(withSymbol).toMatch(/^\$[0-9,]+(\.\d{2})?$/);
      });
    });
  });

  describe('Performance and Optimization', () => {
    it('efficiently processes large datasets', () => {
      const demoBills = getDemoBills();
      
      // Measure calculation performance
      const startTime = performance.now();
      
      // Simulate complex budget calculations
      const calculations = demoBills.map(bill => ({
        originalAmount: bill.totalAmount,
        withInflation: bill.totalAmount * 1.03, // 3% inflation
        monthly: bill.totalAmount / 12,
        category: bill.category,
        processed: true
      }));
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      expect(calculations.length).toBe(demoBills.length);
      expect(processingTime).toBeLessThan(100); // Should be very fast
      
      // Verify all calculations completed
      calculations.forEach(calc => {
        expect(calc.withInflation).toBeGreaterThan(calc.originalAmount);
        expect(calc.monthly).toBe(calc.originalAmount / 12);
        expect(calc.processed).toBe(true);
      });
      
      console.log(`Processed ${calculations.length} bills in ${processingTime.toFixed(2)}ms`);
    });
  });
});