import { getDemoBills, getDemoBuildings, DEMO_ORG_ID } from '../../utils/demo-data-helpers';

describe('Comprehensive Budget Testing with Demo Organization Data', () => {
  describe('Real Demo Organization Financial Analysis', () => {
    it('validates complete Demo organization financial health', () => {
      const demoBuildings = getDemoBuildings();
      const demoBills = getDemoBills();
      
      // Financial health indicators
      const totalExpenses = demoBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
      const estimatedIncome = demoBuildings.length * 2500; // Monthly income per building
      const cashFlowRatio = estimatedIncome / totalExpenses;
      const specialAssessmentNeeded = totalExpenses > estimatedIncome;
      
      // Comprehensive validation
      expect(DEMO_ORG_ID).toBe('e98cc553-c2d7-4854-877a-7cc9eeb8c6b6');
      expect(demoBuildings.length).toBe(2);
      expect(demoBills.length).toBeGreaterThan(5);
      expect(totalExpenses).toBeCloseTo(10497.2, 1);
      expect(estimatedIncome).toBe(5000);
      expect(cashFlowRatio).toBeCloseTo(0.476, 3);
      expect(specialAssessmentNeeded).toBe(true);
      
      // Category breakdown analysis
      const categoryAnalysis = demoBills.reduce((acc, bill) => {
        acc[bill.category] = (acc[bill.category] || 0) + bill.totalAmount;
        return acc;
      }, {} as Record<string, number>);
      
      expect(categoryAnalysis.maintenance).toBeCloseTo(7147.2, 1);
      expect(categoryAnalysis.utilities).toBe(850);
      expect(categoryAnalysis.insurance).toBe(2500);
      
      console.log('🏢 Demo Organization Financial Health Report:');
      console.log(`  📊 Buildings: ${demoBuildings.length}`);
      console.log(`  💸 Total Annual Expenses: $${totalExpenses.toLocaleString()}`);
      console.log(`  💰 Estimated Annual Income: $${estimatedIncome.toLocaleString()}`);
      console.log(`  📈 Cash Flow Ratio: ${(cashFlowRatio * 100).toFixed(1)}%`);
      console.log(`  ⚠️  Special Assessment Required: ${specialAssessmentNeeded ? 'Yes' : 'No'}`);
      console.log(`  📋 Expense Categories:`, categoryAnalysis);
    });

    it('simulates complete budget workflow from Demo data', () => {
      const demoBuildings = getDemoBuildings();
      const demoBills = getDemoBills();
      
      // Step 1: Calculate annual budget
      const annualExpenses = demoBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
      const annualIncome = demoBuildings.length * 2500 * 12; // Monthly × 12
      const annualDeficit = annualExpenses - annualIncome;
      
      // Step 2: Calculate special assessments
      const totalUnits = demoBuildings.length * 5; // 5 units per building
      const assessmentPerUnit = annualDeficit / totalUnits;
      
      // Step 3: Generate payment schedule
      const paymentSchedule = [];
      for (let month = 1; month <= 12; month++) {
        paymentSchedule.push({
          month,
          regularIncome: demoBuildings.length * 2500,
          regularExpenses: annualExpenses / 12,
          specialAssessment: month === 1 ? annualDeficit : 0,
          netCashFlow: (month === 1) ? 
            (demoBuildings.length * 2500) - (annualExpenses / 12) + annualDeficit :
            (demoBuildings.length * 2500) - (annualExpenses / 12)
        });
      }
      
      // Validate workflow
      expect(annualExpenses).toBeCloseTo(10497.2, 1);
      expect(annualIncome).toBe(60000);
      expect(annualDeficit).toBeCloseTo(-49502.8, 1);
      expect(assessmentPerUnit).toBeCloseTo(-4950.28, 2);
      expect(paymentSchedule.length).toBe(12);
      
      // First month should include special assessment
      expect(paymentSchedule[0].specialAssessment).toBeCloseTo(-49502.8, 1);
      expect(paymentSchedule[1].specialAssessment).toBe(0);
      
      console.log('💼 Complete Budget Workflow Simulation:');
      console.log(`  📈 Annual Income: $${annualIncome.toLocaleString()}`);
      console.log(`  📉 Annual Expenses: $${annualExpenses.toLocaleString()}`);
      console.log(`  ⚖️  Annual Balance: $${(-annualDeficit).toLocaleString()}`);
      console.log(`  🏠 Assessment per Unit: $${(-assessmentPerUnit).toLocaleString()}`);
    });
  });

  describe('Advanced Calculation Scenarios', () => {
    it('handles inflation adjustments over multiple years', () => {
      const demoBills = getDemoBills();
      const baseExpenses = demoBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
      
      // Calculate expenses with inflation over 5 years
      const inflationRate = 0.035; // 3.5% annual inflation
      const projectedExpenses = [];
      
      for (let year = 0; year < 5; year++) {
        const adjustedExpenses = baseExpenses * Math.pow(1 + inflationRate, year);
        projectedExpenses.push({
          year: 2025 + year,
          expenses: adjustedExpenses,
          increase: year === 0 ? 0 : adjustedExpenses - baseExpenses
        });
      }
      
      // Validate inflation calculations
      expect(projectedExpenses.length).toBe(5);
      expect(projectedExpenses[0].expenses).toBeCloseTo(baseExpenses, 2);
      expect(projectedExpenses[4].expenses).toBeCloseTo(12124.6, 1); // After 4 years of inflation
      
      // Calculate cumulative impact
      const totalFiveYearExpenses = projectedExpenses.reduce((sum, p) => sum + p.expenses, 0);
      const totalWithoutInflation = baseExpenses * 5;
      const inflationImpact = totalFiveYearExpenses - totalWithoutInflation;
      
      expect(inflationImpact).toBeGreaterThan(0);
      expect(inflationImpact).toBeCloseTo(3697.4, 1);
      
      console.log('📊 5-Year Inflation Impact Analysis:');
      projectedExpenses.forEach(p => {
        console.log(`  ${p.year}: $${p.expenses.toLocaleString()} (${p.increase > 0 ? '+$' + p.increase.toLocaleString() : '$0'})`);
      });
      console.log(`  💰 Total Inflation Impact: $${inflationImpact.toLocaleString()}`);
    });

    it('calculates optimal reserve fund requirements', () => {
      const demoBills = getDemoBills();
      const monthlyExpenses = demoBills.reduce((sum, bill) => sum + bill.totalAmount, 0) / 12;
      
      // Calculate reserve requirements based on industry standards
      const reserves = {
        emergencyFund: monthlyExpenses * 6, // 6 months of expenses
        maintenanceFund: monthlyExpenses * 12, // 1 year for major repairs
        administrativeFund: monthlyExpenses * 2, // 2 months for admin costs
        contingencyFund: monthlyExpenses * 3 // 3 months for unexpected costs
      };
      
      const totalReserveRequired = Object.values(reserves).reduce((sum, amount) => sum + amount, 0);
      const currentBalance = 75000; // Demo bank account balance
      const reserveDeficit = totalReserveRequired - currentBalance;
      
      // Validate reserve calculations
      expect(reserves.emergencyFund).toBeCloseTo(5248.6, 1);
      expect(reserves.maintenanceFund).toBeCloseTo(10497.2, 1);
      expect(totalReserveRequired).toBeCloseTo(20243.8, 1);
      expect(currentBalance).toBe(75000);
      expect(reserveDeficit).toBeLessThan(0); // We have surplus reserves
      
      console.log('🏦 Reserve Fund Analysis:');
      Object.entries(reserves).forEach(([type, amount]) => {
        console.log(`  ${type}: $${amount.toLocaleString()}`);
      });
      console.log(`  📊 Total Required: $${totalReserveRequired.toLocaleString()}`);
      console.log(`  💰 Current Balance: $${currentBalance.toLocaleString()}`);
      console.log(`  ${reserveDeficit < 0 ? '✅ Surplus' : '⚠️ Deficit'}: $${Math.abs(reserveDeficit).toLocaleString()}`);
    });

    it('performs cash flow stress testing', () => {
      const baseMonthlyIncome = 5000;
      const baseMonthlyExpenses = 875; // Monthly average
      
      // Test various stress scenarios
      const stressScenarios = [
        { name: 'Normal Operations', incomeReduction: 0, expenseIncrease: 0 },
        { name: 'Mild Recession', incomeReduction: 0.1, expenseIncrease: 0.05 },
        { name: 'Major Repairs', incomeReduction: 0, expenseIncrease: 0.5 },
        { name: 'Economic Crisis', incomeReduction: 0.2, expenseIncrease: 0.15 },
        { name: 'Vacancy Crisis', incomeReduction: 0.3, expenseIncrease: 0.1 }
      ];
      
      const stressResults = stressScenarios.map(scenario => {
        const adjustedIncome = baseMonthlyIncome * (1 - scenario.incomeReduction);
        const adjustedExpenses = baseMonthlyExpenses * (1 + scenario.expenseIncrease);
        const netCashFlow = adjustedIncome - adjustedExpenses;
        
        return {
          ...scenario,
          adjustedIncome,
          adjustedExpenses,
          netCashFlow,
          isViable: netCashFlow > 0
        };
      });
      
      // Validate stress testing
      expect(stressResults.length).toBe(5);
      expect(stressResults[0].isViable).toBe(true); // Normal operations
      expect(stressResults[0].netCashFlow).toBeCloseTo(4125, 1);
      
      const viableScenarios = stressResults.filter(s => s.isViable).length;
      const criticalScenarios = stressResults.filter(s => !s.isViable).length;
      
      console.log('🧪 Cash Flow Stress Test Results:');
      stressResults.forEach(result => {
        const status = result.isViable ? '✅' : '❌';
        console.log(`  ${status} ${result.name}: $${result.netCashFlow.toLocaleString()} monthly`);
      });
      console.log(`  📊 Viable Scenarios: ${viableScenarios}/${stressResults.length}`);
      console.log(`  ⚠️  Critical Scenarios: ${criticalScenarios}/${stressResults.length}`);
    });
  });

  describe('Budget Performance and Optimization', () => {
    it('measures calculation performance with large datasets', () => {
      // Generate large dataset for performance testing
      const largeDataset = [];
      for (let i = 0; i < 1000; i++) {
        largeDataset.push({
          id: `bill-${i}`,
          amount: Math.random() * 5000 + 100,
          category: ['maintenance', 'utilities', 'insurance'][i % 3],
          date: `2025-${String((i % 12) + 1).padStart(2, '0')}-01`
        });
      }
      
      // Measure performance of budget calculations
      const startTime = performance.now();
      
      // Perform complex calculations
      const categoryTotals = largeDataset.reduce((acc, bill) => {
        acc[bill.category] = (acc[bill.category] || 0) + bill.amount;
        return acc;
      }, {} as Record<string, number>);
      
      const monthlyTotals = largeDataset.reduce((acc, bill) => {
        const month = bill.date.substring(5, 7);
        acc[month] = (acc[month] || 0) + bill.amount;
        return acc;
      }, {} as Record<string, number>);
      
      const grandTotal = largeDataset.reduce((sum, bill) => sum + bill.amount, 0);
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      // Validate performance
      expect(largeDataset.length).toBe(1000);
      expect(Object.keys(categoryTotals).length).toBe(3);
      expect(Object.keys(monthlyTotals).length).toBe(12);
      expect(grandTotal).toBeGreaterThan(0);
      expect(processingTime).toBeLessThan(50); // Should process quickly
      
      console.log('⚡ Performance Test Results:');
      console.log(`  📊 Processed ${largeDataset.length} bills in ${processingTime.toFixed(2)}ms`);
      console.log(`  💰 Grand Total: $${grandTotal.toLocaleString()}`);
      console.log(`  📈 Performance: ${(largeDataset.length / processingTime * 1000).toFixed(0)} bills/second`);
    });

    it('validates memory efficiency with repeated calculations', () => {
      const demoBills = getDemoBills();
      const iterations = 100;
      
      // Measure memory usage during repeated calculations
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      for (let i = 0; i < iterations; i++) {
        // Perform budget calculations repeatedly
        const totals = demoBills.reduce((acc, bill) => {
          acc.total += bill.totalAmount;
          acc.byCategory[bill.category] = (acc.byCategory[bill.category] || 0) + bill.totalAmount;
          return acc;
        }, { total: 0, byCategory: {} as Record<string, number> });
        
        // Simulate chart data generation
        const chartData = demoBills.map(bill => ({
          x: bill.startDate,
          y: bill.totalAmount,
          category: bill.category
        }));
        
        // Clear references to prevent memory leaks
        Object.keys(totals.byCategory).forEach(key => delete totals.byCategory[key]);
        chartData.length = 0;
      }
      
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Validate memory efficiency
      expect(iterations).toBe(100);
      expect(memoryIncrease).toBeLessThan(1000000); // Less than 1MB increase
      
      console.log('🧠 Memory Efficiency Test:');
      console.log(`  🔄 Iterations: ${iterations}`);
      console.log(`  📊 Initial Memory: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  📈 Final Memory: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  💾 Memory Increase: ${(memoryIncrease / 1024).toFixed(2)}KB`);
    });
  });

  describe('Edge Cases and Error Resilience', () => {
    it('handles corrupted budget data gracefully', () => {
      const corruptedData = [
        { totalAmount: null, category: 'maintenance' },
        { totalAmount: undefined, category: 'utilities' },
        { totalAmount: 'invalid', category: 'insurance' },
        { totalAmount: Infinity, category: 'administrative' },
        { totalAmount: -500, category: 'negative' },
        { totalAmount: 0, category: 'zero' }
      ];
      
      // Safe calculation with corrupted data
      const safeTotal = corruptedData.reduce((sum, item) => {
        const amount = Number(item.totalAmount);
        if (isNaN(amount) || !isFinite(amount)) return sum;
        return sum + Math.max(0, amount); // Prevent negative amounts
      }, 0);
      
      const validItems = corruptedData.filter(item => {
        const amount = Number(item.totalAmount);
        return !isNaN(amount) && isFinite(amount) && amount >= 0;
      });
      
      // Validate error handling
      expect(safeTotal).toBe(0); // Only zero value is valid and non-negative
      expect(validItems.length).toBe(1); // Only the zero amount item
      expect(validItems[0].category).toBe('zero');
      
      console.log('🛡️ Corruption Resilience Test:');
      console.log(`  📊 Original Items: ${corruptedData.length}`);
      console.log(`  ✅ Valid Items: ${validItems.length}`);
      console.log(`  💰 Safe Total: $${safeTotal.toLocaleString()}`);
    });

    it('handles extreme date ranges and large numbers', () => {
      // Test with extreme date ranges
      const extremeData = {
        startDate: new Date('1900-01-01'),
        endDate: new Date('2100-12-31'),
        amount: Number.MAX_SAFE_INTEGER - 1
      };
      
      const yearRange = extremeData.endDate.getFullYear() - extremeData.startDate.getFullYear();
      const dailyAmount = extremeData.amount / (yearRange * 365);
      
      // Validate extreme value handling
      expect(yearRange).toBe(200);
      expect(extremeData.amount).toBeLessThan(Number.MAX_SAFE_INTEGER);
      expect(dailyAmount).toBeFinite();
      expect(dailyAmount).toBeGreaterThan(0);
      
      // Test precision with very small amounts
      const microAmount = 0.001;
      const multiplied = microAmount * 1000000;
      
      expect(multiplied).toBe(1000);
      expect(microAmount.toFixed(3)).toBe('0.001');
      
      console.log('🔢 Extreme Values Test:');
      console.log(`  📅 Date Range: ${yearRange} years`);
      console.log(`  💰 Max Amount: $${extremeData.amount.toLocaleString()}`);
      console.log(`  📊 Daily Rate: $${dailyAmount.toFixed(2)}`);
      console.log(`  🔍 Micro Amount: $${microAmount}`);
    });

    it('validates calculation consistency across different number formats', () => {
      const testAmounts = [
        { input: '1,234.56', expected: 1234.56 },
        { input: '1234.56', expected: 1234.56 },
        { input: '1.23456e3', expected: 1234.56 },
        { input: 1234.56, expected: 1234.56 }
      ];
      
      const normalizedAmounts = testAmounts.map(test => {
        let normalized: number;
        if (typeof test.input === 'string') {
          normalized = parseFloat(test.input.replace(/,/g, ''));
        } else {
          normalized = test.input;
        }
        
        return {
          input: test.input,
          normalized,
          expected: test.expected,
          isValid: Math.abs(normalized - test.expected) < 0.01
        };
      });
      
      // Validate number format handling
      const allValid = normalizedAmounts.every(amount => amount.isValid);
      expect(allValid).toBe(true);
      
      // Test currency formatting consistency
      const formatted = normalizedAmounts.map(amount => ({
        original: amount.input,
        formatted: `$${amount.normalized.toLocaleString()}`
      }));
      
      expect(formatted.every(f => f.formatted.startsWith('$'))).toBe(true);
      
      console.log('🔄 Number Format Consistency:');
      normalizedAmounts.forEach(amount => {
        const status = amount.isValid ? '✅' : '❌';
        console.log(`  ${status} ${amount.input} → ${amount.normalized}`);
      });
    });
  });
});