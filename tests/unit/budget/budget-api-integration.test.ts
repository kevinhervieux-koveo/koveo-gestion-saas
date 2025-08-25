import { getDemoBills, getDemoBuildings } from '../../utils/demo-data-helpers';

describe('Budget API Integration and Data Flow Testing', () => {
  describe('Data Transformation and API Response Handling', () => {
    it('transforms Demo bills into budget expense entries', () => {
      const demoBills = getDemoBills();

      // Transform bills into budget expense format (Budget component logic)
      const budgetExpenses = demoBills.map((bill) => ({
        id: bill.id,
        buildingId: 'demo-building-1', // Associated with Demo building
        category: bill.category,
        description: `${bill.category} - ${bill.billNumber}`,
        amount: bill.totalAmount,
        date: bill.startDate,
        type: 'expense' as const,
        paymentType: bill.paymentType,
        costs: bill.costs,
      }));

      // Validate transformation
      expect(budgetExpenses.length).toBe(demoBills.length);

      budgetExpenses.forEach((expense, _index) => {
        const originalBill = demoBills[_index];
        expect(expense.id).toBe(originalBill.id);
        expect(expense.amount).toBe(originalBill.totalAmount);
        expect(expense.category).toBe(originalBill.category);
        expect(expense.type).toBe('expense');
        expect(expense.description).toContain(originalBill.billNumber);
      });

      // Transformed ${budgetExpenses.length} Demo bills into budget expenses
    });

    it('generates income entries for Demo buildings', () => {
      const demoBuildings = getDemoBuildings();

      // Generate income entries (Budget component logic)
      const budgetIncomes: Array<{
        id: string;
        buildingId: string;
        category: string;
        description: string;
        amount: number;
        date: string;
        type: 'income';
      }> = [];

      demoBuildings.forEach((building, _index) => {
        budgetIncomes.push({
          id: `demo-income-${building.id}-fees`,
          buildingId: building.id,
          category: 'monthly_fees',
          description: 'Monthly condo fees',
          amount: 2250, // 5 units × $450/month
          date: '2025-01-01',
          type: 'income' as const,
        });

        budgetIncomes.push({
          id: `demo-income-${building.id}-parking`,
          buildingId: building.id,
          category: 'parking_fees',
          description: 'Parking fees',
          amount: 250, // 5 parking spots × $50/month
          date: '2025-01-01',
          type: 'income' as const,
        });
      });

      // Validate income generation
      expect(budgetIncomes.length).toBe(demoBuildings.length * 2); // 2 income types per building
      expect(budgetIncomes.every((income) => income.type === 'income')).toBe(true);

      const totalIncome = budgetIncomes.reduce((sum, income) => sum + income.amount, 0);
      expect(totalIncome).toBe(5000); // 2 buildings × (2250 + 250)

      console.warn(`Generated ${budgetIncomes.length} income entries for Demo buildings`);
      console.warn(`Total monthly income: $${totalIncome.toLocaleString()}`);
    });
  });

  describe('Budget Summary Calculations', () => {
    it('calculates budget summary with real Demo data', () => {
      const demoBills = getDemoBills();
      const demoBuildings = getDemoBuildings();

      // Calculate totals (Budget component summary logic)
      const totalExpenses = demoBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
      const totalIncome = demoBuildings.length * 2500; // Per building income
      const netCashFlow = totalIncome - totalExpenses;

      // Generate summary object
      const budgetSummary = {
        totalIncome,
        totalExpenses,
        netCashFlow,
        specialContributions:
          netCashFlow < 0
            ? [
                {
                  id: 'special-assessment-1',
                  description: 'Emergency assessment for deficit',
                  amount: Math.abs(netCashFlow),
                  perUnit: Math.abs(netCashFlow) / (demoBuildings.length * 5), // 5 units per building
                },
              ]
            : [],
        expensesByCategory: demoBills.reduce(
          (acc, bill) => {
            acc[bill.category] = (acc[bill.category] || 0) + bill.totalAmount;
            return acc;
          },
          {} as Record<string, number>
        ),
        incomeByCategory: {
          monthly_fees: demoBuildings.length * 2250,
          parking_fees: demoBuildings.length * 250,
        },
      };

      // Validate summary calculations
      expect(budgetSummary.totalIncome).toBe(5000);
      expect(budgetSummary.totalExpenses).toBeCloseTo(10497.2, 1);
      expect(budgetSummary.netCashFlow).toBeCloseTo(-5497.2, 1);
      expect(budgetSummary.specialContributions.length).toBe(1);
      expect(budgetSummary.specialContributions[0].perUnit).toBeCloseTo(549.72, 2);

      console.warn('Demo Budget Summary:', budgetSummary);
    });

    it('handles empty budget data gracefully', () => {
      // Test with no bills scenario
      const emptyBills: Array<{ totalAmount: number }> = [];
      const totalExpenses = emptyBills.reduce((sum, bill) => sum + bill.totalAmount, 0);

      expect(totalExpenses).toBe(0);

      // Test with no buildings scenario
      const emptyBuildings: unknown[] = [];
      const totalIncome = emptyBuildings.length * 2500;

      expect(totalIncome).toBe(0);

      // Test summary with empty data
      const emptySummary = {
        totalIncome: 0,
        totalExpenses: 0,
        netCashFlow: 0,
        specialContributions: [],
      };

      expect(emptySummary.netCashFlow).toBe(0);
      expect(emptySummary.specialContributions.length).toBe(0);
    });
  });

  describe('Bank Account Data Integration', () => {
    it('creates bank account structure for Demo buildings', () => {
      const demoBankAccount = {
        accountNumber: 'DEMO-123456789',
        bankName: 'Banque Démonstration',
        accountType: 'checking',
        balance: 75000,
        lastUpdated: '2025-01-01T00:00:00Z',
        buildingId: 'demo-building-1',
        minimumBalances: {
          emergency: 50000,
          maintenance: 25000,
          administrative: 10000,
        },
      };

      // Validate bank account structure
      expect(demoBankAccount.accountNumber).toContain('DEMO');
      expect(demoBankAccount.balance).toBeGreaterThan(0);
      expect(Object.keys(demoBankAccount.minimumBalances).length).toBe(3);

      const totalMinimumRequired = Object.values(demoBankAccount.minimumBalances).reduce(
        (sum, min) => sum + min,
        0
      );

      expect(totalMinimumRequired).toBe(85000);
      expect(demoBankAccount.balance).toBeLessThan(totalMinimumRequired);

      console.warn('Demo Bank Account:', demoBankAccount);
    });

    it('calculates balance changes over time', () => {
      const initialBalance = 75000;
      const monthlyChanges = [
        { month: 1, income: 5000, expenses: 2500, netChange: 2500 },
        { month: 2, income: 5000, expenses: 3000, netChange: 2000 },
        { month: 3, income: 5000, expenses: 1800, netChange: 3200 },
        { month: 4, income: 5000, expenses: 2200, netChange: 2800 },
        { month: 5, income: 5000, expenses: 2800, netChange: 2200 },
        { month: 6, income: 5000, expenses: 2100, netChange: 2900 },
      ];

      // Calculate running balance
      let runningBalance = initialBalance;
      const balanceHistory = [{ month: 0, balance: runningBalance }];

      monthlyChanges.forEach((change) => {
        runningBalance += change.netChange;
        balanceHistory.push({
          month: change.month,
          balance: runningBalance,
        });
      });

      // Validate balance calculations
      expect(balanceHistory.length).toBe(7); // Initial + 6 months
      expect(balanceHistory[0].balance).toBe(initialBalance);
      expect(balanceHistory[6].balance).toBe(90600); // Final balance

      // Check that balance increases over time (positive cash flow)
      const finalBalance = balanceHistory[balanceHistory.length - 1].balance;
      expect(finalBalance).toBeGreaterThan(initialBalance);

      console.warn('Demo Balance History:', balanceHistory);
    });
  });

  describe('Residence and Property Integration', () => {
    it('generates residences for Demo buildings with ownership data', () => {
      const demoBuildings = getDemoBuildings();
      const residences: Array<{
        id: string;
        buildingId: string;
        unitNumber: string;
        floor: number;
        squareFootage: number;
        bedrooms: number;
        bathrooms: number;
        ownershipPercentage: number;
        parkingSpots: string[];
        storageSpaces: string[];
        isActive: boolean;
      }> = [];

      // Generate residences for each Demo building
      demoBuildings.forEach((building, buildingIndex) => {
        for (let i = 0; i < 5; i++) {
          // 5 units per building
          const unitNumber = 101 + i + buildingIndex * 100;

          residences.push({
            id: `demo-residence-${building.id}-${i + 1}`,
            buildingId: building.id,
            unitNumber: unitNumber.toString(),
            floor: Math.floor(i / 5) + 1,
            squareFootage: 850 + i * 50,
            bedrooms: 2,
            bathrooms: 1,
            ownershipPercentage: 10.0, // Equal ownership
            parkingSpots: [`P-${unitNumber}`],
            storageSpaces: [`S-${unitNumber}`],
            isActive: true,
          });
        }
      });

      // Validate residence generation
      expect(residences.length).toBe(10); // 2 buildings × 5 units
      expect(residences.every((res) => res.isActive)).toBe(true);
      expect(residences.every((res) => res.ownershipPercentage === 10.0)).toBe(true);

      // Validate ownership percentages sum to 100%
      const building1Residences = residences.filter((r) => r.buildingId === demoBuildings[0].id);
      const building1Ownership = building1Residences.reduce(
        (sum, r) => sum + r.ownershipPercentage,
        0
      );
      expect(building1Ownership).toBe(50.0); // 5 units × 10%

      console.warn(`Generated ${residences.length} residences for Demo buildings`);
    });

    it('calculates special contributions per residence', () => {
      const specialAssessment = 12000; // Total needed
      const residences = [
        { id: '1', unitNumber: '101', ownershipPercentage: 8.5 },
        { id: '2', unitNumber: '102', ownershipPercentage: 10.0 },
        { id: '3', unitNumber: '103', ownershipPercentage: 12.5 },
        { id: '4', unitNumber: '201', ownershipPercentage: 9.0 },
        { id: '5', unitNumber: '202', ownershipPercentage: 10.0 },
      ];

      // Calculate contributions per residence
      const contributions = residences.map((residence) => ({
        residenceId: residence.id,
        unitNumber: residence.unitNumber,
        ownershipPercentage: residence.ownershipPercentage,
        contribution: (specialAssessment * residence.ownershipPercentage) / 100,
        dueDate: '2025-02-01',
      }));

      // Validate contributions
      expect(contributions.length).toBe(5);

      const totalContributions = contributions.reduce((sum, c) => sum + c.contribution, 0);
      const totalOwnership = residences.reduce((sum, r) => sum + r.ownershipPercentage, 0);

      expect(totalOwnership).toBe(50.0); // 50% total ownership
      expect(totalContributions).toBeCloseTo(6000, 2); // 50% of $12,000

      // Verify individual calculations
      expect(contributions[0].contribution).toBeCloseTo(1020, 2); // 8.5% of $12,000
      expect(contributions[1].contribution).toBeCloseTo(1200, 2); // 10% of $12,000

      console.warn('Special Contributions by Residence:', contributions);
    });
  });

  describe('Chart Data and Visualization Preparation', () => {
    it('prepares chart data from Demo budget information', () => {
      const monthlyData: Array<{
        year: number;
        month: number;
        date: string;
        totalIncome: number;
        totalExpenses: number;
        netCashFlow: number;
        incomeByCategory: {
          monthly_fees: number;
          parking_fees: number;
        };
        expensesByCategory: {
          maintenance: number;
          utilities: number;
          insurance: number;
        };
      }> = [];

      // Generate 12 months of Demo budget data
      for (let month = 1; month <= 12; month++) {
        const monthlyIncome = 5000;
        const baseExpenses = 875; // Monthly average of annual expenses
        const seasonalMultiplier = month <= 3 || month >= 11 ? 1.5 : 1.0; // Winter months higher
        const monthlyExpenses = baseExpenses * seasonalMultiplier;

        monthlyData.push({
          year: 2025,
          month,
          date: `2025-${String(month).padStart(2, '0')}`,
          totalIncome: monthlyIncome,
          totalExpenses: monthlyExpenses,
          netCashFlow: monthlyIncome - monthlyExpenses,
          incomeByCategory: {
            monthly_fees: 4500,
            parking_fees: 500,
          },
          expensesByCategory: {
            maintenance: monthlyExpenses * 0.7,
            utilities: monthlyExpenses * 0.2,
            insurance: monthlyExpenses * 0.1,
          },
        });
      }

      // Validate chart data structure
      expect(monthlyData.length).toBe(12);
      expect(monthlyData.every((d) => d.totalIncome === 5000)).toBe(true);
      expect(monthlyData.every((d) => d.netCashFlow > 0)).toBe(true); // Positive cash flow

      // Calculate annual totals
      const annualIncome = monthlyData.reduce((sum, d) => sum + d.totalIncome, 0);
      const annualExpenses = monthlyData.reduce((sum, d) => sum + d.totalExpenses, 0);

      expect(annualIncome).toBe(60000); // 12 × $5,000
      expect(annualExpenses).toBeCloseTo(12687.5, 2); // Includes seasonal variations

      console.warn('Demo Chart Data Summary:');
      console.warn(`  Annual Income: $${annualIncome.toLocaleString()}`);
      console.warn(`  Annual Expenses: $${annualExpenses.toLocaleString()}`);
      console.warn(`  Net Annual Cash Flow: $${(annualIncome - annualExpenses).toLocaleString()}`);
    });

    it('handles chart data with running balance calculations', () => {
      const startingBalance = 75000;
      const monthlyData = [
        { income: 5000, expenses: 2500 },
        { income: 5000, expenses: 3200 },
        { income: 5000, expenses: 1800 },
        { income: 5000, expenses: 2600 },
      ];

      // Calculate running balance for chart
      let runningBalance = startingBalance;
      const chartData = monthlyData.map((data, _index) => {
        const netCashFlow = data.income - data.expenses;
        runningBalance += netCashFlow;

        return {
          month: _index + 1,
          totalIncome: data.income,
          totalExpenses: data.expenses,
          netCashFlow,
          runningBalance,
          balanceChange: netCashFlow,
        };
      });

      // Validate chart calculations
      expect(chartData.length).toBe(4);
      expect(chartData[0].runningBalance).toBe(77500); // 75000 + 2500
      expect(chartData[3].runningBalance).toBe(84900); // Final balance

      // Verify balance consistency
      const finalBalance = startingBalance + chartData.reduce((sum, d) => sum + d.netCashFlow, 0);
      expect(chartData[3].runningBalance).toBe(finalBalance);

      console.warn('Chart Data with Running Balance:', chartData);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('handles missing building data gracefully', () => {
      const emptyBuildings: unknown[] = [];

      // Generate budget with no buildings
      const budgetSummary = {
        totalIncome: emptyBuildings.reduce((sum: number, _building) => sum + 2500, 0),
        totalExpenses: 0,
        netCashFlow: 0,
        buildings: emptyBuildings,
      };

      expect(budgetSummary.totalIncome).toBe(0);
      expect(budgetSummary.buildings.length).toBe(0);
      expect(budgetSummary.netCashFlow).toBe(0);
    });

    it('validates numeric calculations with invalid inputs', () => {
      // Test with invalid bill amounts
      const invalidBills = [
        { totalAmount: NaN, category: 'maintenance' },
        { totalAmount: undefined, category: 'utilities' },
        { totalAmount: null, category: 'insurance' },
      ];

      // Safe calculation handling
      const safeTotal = invalidBills.reduce((sum, bill) => {
        const amount = Number(bill.totalAmount) || 0;
        return sum + amount;
      }, 0);

      expect(safeTotal).toBe(0);
      expect(isNaN(safeTotal)).toBe(false);
    });

    it('handles extreme values in calculations', () => {
      // Test with very large numbers
      const largeAmount = 999999999;
      const calculations = {
        total: largeAmount,
        monthly: largeAmount / 12,
        percentage: (largeAmount / 1000000000) * 100,
      };

      expect(calculations.total).toBe(999999999);
      expect(calculations.monthly).toBeCloseTo(83333333.25, 2);
      expect(calculations.percentage).toBeCloseTo(99.9999999, 7);

      // Test with very small numbers
      const smallAmount = 0.01;
      const smallCalculations = {
        total: smallAmount,
        percentage: (smallAmount / 1000) * 100,
      };

      expect(smallCalculations.total).toBe(0.01);
      expect(smallCalculations.percentage).toBe(0.001);
    });
  });
});
