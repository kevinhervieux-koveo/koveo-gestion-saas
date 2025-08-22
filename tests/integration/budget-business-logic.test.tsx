import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Budget from '@/pages/manager/budget';
import { TestProviders } from '../utils/test-providers';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';

// Mock hooks
jest.mock('@/hooks/use-auth');
jest.mock('@/hooks/use-language');
jest.mock('@/hooks/use-fullscreen', () => ({
  useFullscreen: () => ({
    isFullscreen: false,
    toggleFullscreen: jest.fn(),
    enterFullscreen: jest.fn(),
    exitFullscreen: jest.fn(),
  }),
}));
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseLanguage = useLanguage as jest.MockedFunction<typeof useLanguage>;

describe('Budget Business Logic Integration Tests', () => {
  let queryClient: QueryClient;

  const mockBuildings = [
    {
      id: 'building-1',
      name: 'Demo Building',
      address: '123 Demo Street',
      organizationId: 'demo-org',
    },
  ];

  const mockResidences = [
    {
      id: 'res-1',
      building_id: 'building-1',
      unit_number: '101',
      ownership_percentage: 10.0,
      floor: 1,
    },
    {
      id: 'res-2',
      building_id: 'building-1',
      unit_number: '102',
      ownership_percentage: 8.5,
      floor: 1,
    },
    {
      id: 'res-3',
      building_id: 'building-1',
      unit_number: '201',
      ownership_percentage: 12.0,
      floor: 2,
    },
    {
      id: 'res-4',
      building_id: 'building-1',
      unit_number: '202',
      ownership_percentage: 9.5,
      floor: 2,
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockUseAuth.mockReturnValue({
      user: {
        id: '1',
        firstName: 'Manager',
        lastName: 'User',
        email: 'manager@example.com',
        role: 'manager',
        isActive: true,
        organizationId: 'demo-org',
      },
      logout: jest.fn(),
      isAuthenticated: true,
      isLoading: false,
      login: jest.fn(),
    });

    mockUseLanguage.mockReturnValue({
      language: 'en',
      setLanguage: jest.fn(),
      t: jest.fn((_key) => _key),
      translations: {},
    });

    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Cash Flow Calculations', () => {
    it('calculates positive cash flow correctly', async () => {
      const positiveCashFlowData = {
        summary: [
          {
            year: 2024,
            month: 1,
            incomes: [50000, 5000],
            spendings: [20000, 8000, 5000],
            incomeTypes: ['monthly_fees', 'parking_fees'],
            spendingTypes: ['maintenance_expense', 'utilities', 'insurance'],
          },
        ],
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/buildings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBuildings),
          });
        }
        if (url.includes('/summary')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(positiveCashFlowData),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { _value: 'building-1' } });

      await waitFor(() => {
        // Should show positive cash flow
        expect(screen.getByText('$55,000')).toBeInTheDocument(); // Total Income
        expect(screen.getByText('$33,000')).toBeInTheDocument(); // Total Expenses
        expect(screen.getByText('$22,000')).toBeInTheDocument(); // Net Cash Flow
      });

      // Should show positive cash flow message instead of special contribution
      expect(screen.getByText('No special contribution required - positive cash flow')).toBeInTheDocument();
    });

    it('calculates negative cash flow and special contributions correctly', async () => {
      const negativeCashFlowData = {
        summary: [
          {
            year: 2024,
            month: 1,
            incomes: [30000],
            spendings: [45000],
            incomeTypes: ['monthly_fees'],
            spendingTypes: ['maintenance_expense'],
          },
        ],
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/buildings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBuildings),
          });
        }
        if (url.includes('/api/residences')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockResidences),
          });
        }
        if (url.includes('/summary')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(negativeCashFlowData),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { _value: 'building-1' } });

      await waitFor(() => {
        // Should show negative cash flow
        expect(screen.getByText('$30,000')).toBeInTheDocument(); // Total Income
        expect(screen.getByText('$45,000')).toBeInTheDocument(); // Total Expenses
        expect(screen.getByText('-$15,000')).toBeInTheDocument(); // Net Cash Flow
      });

      // Should show special contribution breakdown
      expect(screen.getByText('Special Contribution Breakdown')).toBeInTheDocument();
      expect(screen.getByText('Total required:')).toBeInTheDocument();
      expect(screen.getByText('$15,000')).toBeInTheDocument(); // Total contribution needed
    });

    it('calculates individual property contributions based on ownership percentage', async () => {
      const negativeCashFlowData = {
        summary: [
          {
            year: 2024,
            month: 1,
            incomes: [20000],
            spendings: [30000],
            incomeTypes: ['monthly_fees'],
            spendingTypes: ['maintenance_expense'],
          },
        ],
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/buildings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBuildings),
          });
        }
        if (url.includes('/api/residences')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockResidences),
          });
        }
        if (url.includes('/summary')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(negativeCashFlowData),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { _value: 'building-1' } });

      await waitFor(() => {
        // Check individual property contributions
        // Total shortfall: $10,000
        // Unit 101: 10.0% = $1,000
        // Unit 102: 8.5% = $850
        // Unit 201: 12.0% = $1,200
        // Unit 202: 9.5% = $950

        expect(screen.getByText('101')).toBeInTheDocument();
        expect(screen.getByText('10.0%')).toBeInTheDocument();
        expect(screen.getByText('$1,000.00')).toBeInTheDocument();

        expect(screen.getByText('102')).toBeInTheDocument();
        expect(screen.getByText('8.5%')).toBeInTheDocument();
        expect(screen.getByText('$850.00')).toBeInTheDocument();

        expect(screen.getByText('201')).toBeInTheDocument();
        expect(screen.getByText('12.0%')).toBeInTheDocument();
        expect(screen.getByText('$1,200.00')).toBeInTheDocument();
      });
    });
  });

  describe('Bank Balance Tracking', () => {
    it('calculates running bank balance with starting amount', async () => {
      const budgetData = {
        summary: [
          {
            year: 2024,
            month: 1,
            incomes: [50000],
            spendings: [30000],
            incomeTypes: ['monthly_fees'],
            spendingTypes: ['maintenance_expense'],
          },
          {
            year: 2024,
            month: 2,
            incomes: [50000],
            spendings: [35000],
            incomeTypes: ['monthly_fees'],
            spendingTypes: ['maintenance_expense'],
          },
        ],
      };

      const bankAccountInfo = {
        bankAccountNumber: '1234567890',
        bankAccountStartDate: '2024-01-01',
        bankAccountStartAmount: 100000,
        bankAccountMinimums: JSON.stringify([]),
        inflationSettings: null,
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/buildings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBuildings),
          });
        }
        if (url.includes('/summary')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(budgetData),
          });
        }
        if (url.includes('/bank-account')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(bankAccountInfo),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { _value: 'building-1' } });

      await waitFor(() => {
        // Starting balance: $100,000
        // Month 1: $100,000 + $20,000 (net) = $120,000
        // Month 2: $120,000 + $15,000 (net) = $135,000
        expect(screen.getByText('Financial Trends')).toBeInTheDocument();
      });
    });

    it('warns when balance falls below minimum requirements', async () => {
      const budgetData = {
        summary: [
          {
            year: 2024,
            month: 1,
            incomes: [10000],
            spendings: [60000],
            incomeTypes: ['monthly_fees'],
            spendingTypes: ['maintenance_expense'],
          },
        ],
      };

      const bankAccountInfo = {
        bankAccountNumber: '1234567890',
        bankAccountStartDate: '2024-01-01',
        bankAccountStartAmount: 100000,
        bankAccountMinimums: JSON.stringify([
          { id: '1', amount: 75000, description: 'Emergency fund' },
        ]),
        inflationSettings: null,
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/buildings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBuildings),
          });
        }
        if (url.includes('/summary')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(budgetData),
          });
        }
        if (url.includes('/bank-account')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(bankAccountInfo),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { _value: 'building-1' } });

      await waitFor(() => {
        // Balance would be $100,000 - $50,000 = $50,000, below minimum of $75,000
        expect(screen.getByText('Emergency fund')).toBeInTheDocument();
        expect(screen.getByText('$75,000')).toBeInTheDocument();
      });
    });
  });

  describe('Category-Based Analysis', () => {
    it('breaks down income by category correctly', async () => {
      const budgetData = {
        summary: [
          {
            year: 2024,
            month: 1,
            incomes: [45000, 5000, 2000],
            spendings: [20000],
            incomeTypes: ['monthly_fees', 'parking_fees', 'other_income'],
            spendingTypes: ['maintenance_expense'],
          },
        ],
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/buildings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBuildings),
          });
        }
        if (url.includes('/summary')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(budgetData),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { _value: 'building-1' } });

      await waitFor(() => {
        const categoriesButton = screen.getByText('Categories');
        fireEvent.click(categoriesButton);

        // Check that all income categories are displayed with correct translations
        expect(screen.getByText('Income: Monthly Fees')).toBeInTheDocument();
        expect(screen.getByText('Income: Parking Fees')).toBeInTheDocument();
        expect(screen.getByText('Income: Other Income')).toBeInTheDocument();
      });
    });

    it('breaks down expenses by category correctly', async () => {
      const budgetData = {
        summary: [
          {
            year: 2024,
            month: 1,
            incomes: [50000],
            spendings: [15000, 8000, 5000, 3000],
            incomeTypes: ['monthly_fees'],
            spendingTypes: ['maintenance_expense', 'utilities', 'insurance', 'cleaning'],
          },
        ],
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/buildings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBuildings),
          });
        }
        if (url.includes('/summary')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(budgetData),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { _value: 'building-1' } });

      await waitFor(() => {
        const categoriesButton = screen.getByText('Categories');
        fireEvent.click(categoriesButton);

        // Check that all expense categories are displayed with correct translations
        expect(screen.getByText('Expense: Maintenance')).toBeInTheDocument();
        expect(screen.getByText('Expense: Utilities')).toBeInTheDocument();
        expect(screen.getByText('Expense: Insurance')).toBeInTheDocument();
        expect(screen.getByText('Expense: Cleaning')).toBeInTheDocument();
      });
    });

    it('filters data when specific categories are selected', async () => {
      const budgetData = {
        summary: [
          {
            year: 2024,
            month: 1,
            incomes: [45000, 5000],
            spendings: [15000, 8000],
            incomeTypes: ['monthly_fees', 'parking_fees'],
            spendingTypes: ['maintenance_expense', 'utilities'],
          },
        ],
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/buildings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBuildings),
          });
        }
        if (url.includes('/summary')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(budgetData),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { _value: 'building-1' } });

      await waitFor(() => {
        const categoriesButton = screen.getByText('Categories');
        fireEvent.click(categoriesButton);

        // Select only monthly fees income category
        const monthlyFeesCategory = screen.getByText('Income: Monthly Fees');
        fireEvent.click(monthlyFeesCategory);

        // Should show filtered data
        expect(screen.getByText('1 categories')).toBeInTheDocument();
      });
    });
  });

  describe('Multi-Year Analysis', () => {
    it('calculates trends across multiple years', async () => {
      const multiYearData = {
        summary: [
          {
            year: 2023,
            month: 12,
            incomes: [40000],
            spendings: [25000],
            incomeTypes: ['monthly_fees'],
            spendingTypes: ['maintenance_expense'],
          },
          {
            year: 2024,
            month: 1,
            incomes: [45000],
            spendings: [28000],
            incomeTypes: ['monthly_fees'],
            spendingTypes: ['maintenance_expense'],
          },
          {
            year: 2024,
            month: 12,
            incomes: [50000],
            spendings: [30000],
            incomeTypes: ['monthly_fees'],
            spendingTypes: ['maintenance_expense'],
          },
        ],
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/buildings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBuildings),
          });
        }
        if (url.includes('/summary')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(multiYearData),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      // Set multi-year range
      const startYearInput = screen.getByDisplayValue(new Date().getFullYear().toString());
      fireEvent.change(startYearInput, { target: { _value: '2023' } });

      const endYearInput = screen.getByDisplayValue((new Date().getFullYear() + 3).toString());
      fireEvent.change(endYearInput, { target: { _value: '2024' } });

      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { _value: 'building-1' } });

      await waitFor(() => {
        // Should show cumulative totals across years
        expect(screen.getByText('$135,000')).toBeInTheDocument(); // Total Income
        expect(screen.getByText('$83,000')).toBeInTheDocument(); // Total Expenses
        expect(screen.getByText('$52,000')).toBeInTheDocument(); // Net Cash Flow
      });
    });

    it('handles year range changes correctly', async () => {
      const budgetData = {
        summary: [
          {
            year: 2024,
            month: 1,
            incomes: [50000],
            spendings: [30000],
            incomeTypes: ['monthly_fees'],
            spendingTypes: ['maintenance_expense'],
          },
        ],
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/buildings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBuildings),
          });
        }
        if (url.includes('/summary')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(budgetData),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { _value: 'building-1' } });

      // Change year range
      const startYearInput = screen.getByDisplayValue(new Date().getFullYear().toString());
      fireEvent.change(startYearInput, { target: { _value: '2024' } });

      const endYearInput = screen.getByDisplayValue((new Date().getFullYear() + 3).toString());
      fireEvent.change(endYearInput, { target: { _value: '2024' } });

      await waitFor(() => {
        // Should fetch new data for the selected year range
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('startYear=2024&endYear=2024')
        );
      });
    });
  });

  describe('Edge Cases and Data Validation', () => {
    it('handles missing or zero ownership percentages', async () => {
      const residencesWithMissingData = [
        {
          id: 'res-1',
          building_id: 'building-1',
          unit_number: '101',
          ownership_percentage: null,
          floor: 1,
        },
        {
          id: 'res-2',
          building_id: 'building-1',
          unit_number: '102',
          ownership_percentage: 0,
          floor: 1,
        },
        {
          id: 'res-3',
          building_id: 'building-1',
          unit_number: '201',
          ownership_percentage: 15.0,
          floor: 2,
        },
      ];

      const negativeCashFlowData = {
        summary: [
          {
            year: 2024,
            month: 1,
            incomes: [20000],
            spendings: [30000],
            incomeTypes: ['monthly_fees'],
            spendingTypes: ['maintenance_expense'],
          },
        ],
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/buildings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBuildings),
          });
        }
        if (url.includes('/api/residences')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(residencesWithMissingData),
          });
        }
        if (url.includes('/summary')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(negativeCashFlowData),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { _value: 'building-1' } });

      await waitFor(() => {
        // Should handle null/zero ownership percentages gracefully
        expect(screen.getByText('101')).toBeInTheDocument();
        expect(screen.getByText('0.0%')).toBeInTheDocument(); // null becomes 0
        expect(screen.getByText('$0.00')).toBeInTheDocument(); // 0% contribution

        expect(screen.getByText('102')).toBeInTheDocument();
        expect(screen.getByText('0.0%')).toBeInTheDocument(); // 0 stays 0
        expect(screen.getByText('$0.00')).toBeInTheDocument(); // 0% contribution

        expect(screen.getByText('201')).toBeInTheDocument();
        expect(screen.getByText('15.0%')).toBeInTheDocument();
        expect(screen.getByText('$1,500.00')).toBeInTheDocument(); // 15% of $10,000
      });
    });

    it('handles empty or malformed budget data', async () => {
      const emptyBudgetData = {
        summary: [],
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/buildings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBuildings),
          });
        }
        if (url.includes('/summary')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(emptyBudgetData),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { _value: 'building-1' } });

      await waitFor(() => {
        // Should show zero values for empty data
        expect(screen.getByText('$0')).toBeInTheDocument(); // Total Income
        expect(screen.getByText('$0')).toBeInTheDocument(); // Total Expenses
        expect(screen.getByText('$0')).toBeInTheDocument(); // Net Cash Flow
      });
    });

    it('handles malformed JSON in bank account settings', async () => {
      const bankAccountWithBadJSON = {
        bankAccountNumber: '1234567890',
        bankAccountMinimums: 'invalid json string',
        inflationSettings: '{"invalid": json}',
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/buildings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBuildings),
          });
        }
        if (url.includes('/bank-account')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(bankAccountWithBadJSON),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { _value: 'building-1' } });

      await waitFor(() => {
        // Should handle malformed JSON gracefully and show bank account info
        expect(screen.getByText('Bank Account Management')).toBeInTheDocument();
        expect(screen.getByText('1234567890')).toBeInTheDocument();
        // Should not crash despite malformed JSON
      });
    });
  });
});