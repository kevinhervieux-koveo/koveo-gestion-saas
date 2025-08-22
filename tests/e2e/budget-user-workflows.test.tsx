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

const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseLanguage = useLanguage as jest.MockedFunction<typeof useLanguage>;

describe('Budget End-to-End User Workflows', () => {
  let queryClient: QueryClient;

  const mockBuildings = [
    {
      id: 'building-1',
      name: 'Maple Heights Condos',
      address: '123 Maple Street',
      organizationId: 'org-1',
    },
    {
      id: 'building-2',
      name: 'Oak Park Towers',
      address: '456 Oak Avenue',
      organizationId: 'org-1',
    },
  ];

  const mockResidences = [
    {
      id: 'res-1',
      building_id: 'building-1',
      unit_number: '101',
      ownership_percentage: 8.5,
      floor: 1,
    },
    {
      id: 'res-2',
      building_id: 'building-1',
      unit_number: '102',
      ownership_percentage: 7.2,
      floor: 1,
    },
    {
      id: 'res-3',
      building_id: 'building-1',
      unit_number: '201',
      ownership_percentage: 9.1,
      floor: 2,
    },
    {
      id: 'res-4',
      building_id: 'building-1',
      unit_number: '202',
      ownership_percentage: 8.8,
      floor: 2,
    },
    {
      id: 'res-5',
      building_id: 'building-1',
      unit_number: '301',
      ownership_percentage: 10.2,
      floor: 3,
    },
  ];

  const mockComprehensiveBudgetData = {
    summary: [
      {
        year: 2024,
        month: 1,
        incomes: [48000, 6000, 2000],
        spendings: [18000, 9500, 6000, 3500],
        incomeTypes: ['monthly_fees', 'parking_fees', 'other_income'],
        spendingTypes: ['maintenance_expense', 'utilities', 'insurance', 'cleaning'],
      },
      {
        year: 2024,
        month: 2,
        incomes: [48000, 6000, 1500],
        spendings: [22000, 9800, 6000, 3500],
        incomeTypes: ['monthly_fees', 'parking_fees', 'other_income'],
        spendingTypes: ['maintenance_expense', 'utilities', 'insurance', 'cleaning'],
      },
      {
        year: 2024,
        month: 3,
        incomes: [48000, 6000, 2500],
        spendings: [15000, 10200, 6200, 3800],
        incomeTypes: ['monthly_fees', 'parking_fees', 'other_income'],
        spendingTypes: ['maintenance_expense', 'utilities', 'insurance', 'cleaning'],
      },
    ],
  };

  const mockBankAccount = {
    bankAccountNumber: '5555444433332222',
    bankAccountNotes: 'Primary building account',
    bankAccountUpdatedAt: '2024-01-15T10:00:00Z',
    bankAccountStartDate: '2024-01-01',
    bankAccountStartAmount: 175000,
    bankAccountMinimums: JSON.stringify([
      { id: '1', amount: 80000, description: 'Emergency fund' },
      { id: '2', amount: 40000, description: 'Major repairs reserve' },
      { id: '3', amount: 20000, description: 'Insurance deductible reserve' },
    ]),
    inflationSettings: JSON.stringify({
      incomeSettings: [],
      expenseSettings: [],
      generalIncome: 2.5,
      generalExpense: 3.2,
    }),
  };

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
        firstName: 'Property',
        lastName: 'Manager',
        email: 'manager@mapleheights.com',
        role: 'manager',
        isActive: true,
        organizationId: 'org-1',
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

  describe('Complete Manager Budget Review Workflow', () => {
    beforeEach(() => {
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
            json: () => Promise.resolve(mockComprehensiveBudgetData),
          });
        }
        if (url.includes('/bank-account')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBankAccount),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });
    });

    it('completes full budget analysis workflow from building selection to detailed review', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      // Step 1: Manager arrives at budget dashboard
      expect(screen.getByText('Budget Dashboard')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Select a building...')).toBeInTheDocument();

      // Step 2: Select building to analyze
      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { _value: 'building-1' } });

      // Step 3: Review financial summary
      await waitFor(() => {
        expect(screen.getByText('Total Income')).toBeInTheDocument();
        expect(screen.getByText('$167,500')).toBeInTheDocument(); // Q1 total income
        expect(screen.getByText('Total Expenses')).toBeInTheDocument();
        expect(screen.getByText('$112,500')).toBeInTheDocument(); // Q1 total expenses
        expect(screen.getByText('Net Cash Flow')).toBeInTheDocument();
        expect(screen.getByText('$55,000')).toBeInTheDocument(); // Q1 net cash flow
      });

      // Step 4: Review bank account status
      await waitFor(() => {
        expect(screen.getByText('Bank Account Management')).toBeInTheDocument();
        expect(screen.getByText('5555444433332222')).toBeInTheDocument();
        expect(screen.getByText('Primary building account')).toBeInTheDocument();
        expect(screen.getByText('$175,000')).toBeInTheDocument(); // Starting balance
      });

      // Step 5: Check minimum balance requirements
      expect(screen.getByText('Emergency fund')).toBeInTheDocument();
      expect(screen.getByText('$80,000')).toBeInTheDocument();
      expect(screen.getByText('Major repairs reserve')).toBeInTheDocument();
      expect(screen.getByText('$40,000')).toBeInTheDocument();
      expect(screen.getByText('Insurance deductible reserve')).toBeInTheDocument();
      expect(screen.getByText('$20,000')).toBeInTheDocument();

      // Step 6: Analyze category breakdown
      const categoriesButton = screen.getByText('Categories');
      fireEvent.click(categoriesButton);

      await waitFor(() => {
        expect(screen.getByText('Income: Monthly Fees')).toBeInTheDocument();
        expect(screen.getByText('Income: Parking Fees')).toBeInTheDocument();
        expect(screen.getByText('Income: Other Income')).toBeInTheDocument();
        expect(screen.getByText('Expense: Maintenance')).toBeInTheDocument();
        expect(screen.getByText('Expense: Utilities')).toBeInTheDocument();
        expect(screen.getByText('Expense: Insurance')).toBeInTheDocument();
        expect(screen.getByText('Expense: Cleaning')).toBeInTheDocument();
      });

      // Step 7: Filter by specific category (focus on maintenance)
      const maintenanceCategory = screen.getByText('Expense: Maintenance');
      fireEvent.click(maintenanceCategory);

      await waitFor(() => {
        expect(screen.getByText('1 categories')).toBeInTheDocument();
      });

      // Step 8: Verify financial trends chart is displayed
      expect(screen.getByText('Financial Trends')).toBeInTheDocument();

      // Step 9: Check that no special contribution is required (positive cash flow)
      expect(screen.getByText('No special contribution required - positive cash flow')).toBeInTheDocument();
    });

    it('completes bank account management workflow', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { _value: 'building-1' } });

      // Step 1: Access bank account management
      await waitFor(() => {
        const updateAccountButton = screen.getByText('Update Account');
        fireEvent.click(updateAccountButton);
      });

      // Step 2: Review current account information in dialog
      await waitFor(() => {
        expect(screen.getByText('Update Bank Account')).toBeInTheDocument();
        expect(screen.getByDisplayValue('5555444433332222')).toBeInTheDocument();
        expect(screen.getByDisplayValue('2024-01-01')).toBeInTheDocument();
        expect(screen.getByDisplayValue('175000')).toBeInTheDocument();
      });

      // Step 3: Update reconciliation note
      const reconciliationNote = screen.getByLabelText('Reconciliation Note');
      fireEvent.change(reconciliationNote, { 
        target: { _value: 'Monthly reconciliation for Q1 2024' } 
      });

      // Step 4: Close dialog without saving
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      // Step 5: Access minimum balances management
      await waitFor(() => {
        const manageMinimumButton = screen.getByText('Manage Minimum Balances');
        fireEvent.click(manageMinimumButton);
      });

      // Step 6: Review existing minimum balance settings
      await waitFor(() => {
        expect(screen.getByText('Manage Minimum Balances')).toBeInTheDocument();
        const amountInputs = screen.getAllByPlaceholderText('Amount');
        expect(amountInputs).toHaveLength(3);
      });

      // Step 7: Add new minimum balance requirement
      const addMinimumButton = screen.getByText('Add Minimum');
      fireEvent.click(addMinimumButton);

      await waitFor(() => {
        const amountInputs = screen.getAllByPlaceholderText('Amount');
        expect(amountInputs).toHaveLength(4);
        
        // Fill in new requirement
        const newAmountInput = amountInputs[3];
        fireEvent.change(newAmountInput, { target: { _value: '10000' } });
        
        const descriptionInputs = screen.getAllByPlaceholderText(/e\.g\./);
        const newDescriptionInput = descriptionInputs[descriptionInputs.length - 1];
        fireEvent.change(newDescriptionInput, { target: { _value: 'Legal fees reserve' } });
      });

      // Step 8: Cancel minimum balance changes
      const cancelMinimumButton = screen.getByText('Cancel');
      fireEvent.click(cancelMinimumButton);
    });

    it('completes view type switching and year range analysis workflow', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { _value: 'building-1' } });

      // Step 1: Start in yearly view and verify default data
      await waitFor(() => {
        expect(screen.getByText('Total Income')).toBeInTheDocument();
      });

      // Step 2: Switch to monthly view
      const monthlyButton = screen.getByText('Monthly');
      fireEvent.click(monthlyButton);

      // Step 3: Verify monthly controls appear
      expect(screen.getByText('Start Month:')).toBeInTheDocument();
      expect(screen.getByText('End Month:')).toBeInTheDocument();

      // Step 4: Adjust month range (focus on Q1)
      const startMonthSelect = screen.getByDisplayValue((new Date().getMonth() + 1).toString());
      fireEvent.change(startMonthSelect, { target: { _value: '1' } });

      const endMonthSelect = screen.getByDisplayValue('12');
      fireEvent.change(endMonthSelect, { target: { _value: '3' } });

      // Step 5: Adjust year range for multi-year analysis
      const startYearInput = screen.getByDisplayValue(new Date().getFullYear().toString());
      fireEvent.change(startYearInput, { target: { _value: '2024' } });

      const endYearInput = screen.getByDisplayValue((new Date().getFullYear() + 3).toString());
      fireEvent.change(endYearInput, { target: { _value: '2025' } });

      // Step 6: Switch back to yearly view
      const yearlyButton = screen.getByText('Yearly');
      fireEvent.click(yearlyButton);

      // Step 7: Verify month controls are hidden
      expect(screen.queryByText('Start Month:')).not.toBeInTheDocument();
      expect(screen.queryByText('End Month:')).not.toBeInTheDocument();
    });
  });

  describe('Special Contribution Analysis Workflow', () => {
    beforeEach(() => {
      // Mock scenario with negative cash flow requiring special contributions
      const negativeFlowData = {
        summary: [
          {
            year: 2024,
            month: 1,
            incomes: [35000, 4000],
            spendings: [45000, 12000, 8000],
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
        if (url.includes('/api/residences')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockResidences),
          });
        }
        if (url.includes('/summary')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(negativeFlowData),
          });
        }
        if (url.includes('/bank-account')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBankAccount),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });
    });

    it('completes special contribution analysis workflow', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { _value: 'building-1' } });

      // Step 1: Identify negative cash flow
      await waitFor(() => {
        expect(screen.getByText('$39,000')).toBeInTheDocument(); // Total Income
        expect(screen.getByText('$65,000')).toBeInTheDocument(); // Total Expenses
        expect(screen.getByText('-$26,000')).toBeInTheDocument(); // Negative Net Cash Flow
      });

      // Step 2: Review special contribution breakdown
      await waitFor(() => {
        expect(screen.getByText('Special Contribution Breakdown')).toBeInTheDocument();
        expect(screen.getByText('Required amount per property based on ownership percentage')).toBeInTheDocument();
        expect(screen.getByText('Total required:')).toBeInTheDocument();
        expect(screen.getByText('$26,000')).toBeInTheDocument(); // Total contribution needed
      });

      // Step 3: Analyze individual property contributions
      await waitFor(() => {
        // Unit 101: 8.5% of $26,000 = $2,210
        expect(screen.getByText('101')).toBeInTheDocument();
        expect(screen.getByText('8.5%')).toBeInTheDocument();
        expect(screen.getByText('$2,210.00')).toBeInTheDocument();

        // Unit 102: 7.2% of $26,000 = $1,872
        expect(screen.getByText('102')).toBeInTheDocument();
        expect(screen.getByText('7.2%')).toBeInTheDocument();
        expect(screen.getByText('$1,872.00')).toBeInTheDocument();

        // Unit 201: 9.1% of $26,000 = $2,366
        expect(screen.getByText('201')).toBeInTheDocument();
        expect(screen.getByText('9.1%')).toBeInTheDocument();
        expect(screen.getByText('$2,366.00')).toBeInTheDocument();
      });

      // Step 4: Check contribution table headers
      expect(screen.getByText('Unit')).toBeInTheDocument();
      expect(screen.getByText('Ownership (%)')).toBeInTheDocument();
      expect(screen.getByText('Contribution ($)')).toBeInTheDocument();
      expect(screen.getByText('Floor')).toBeInTheDocument();

      // Step 5: Verify floor information is displayed
      const floorElements = screen.getAllByText(/^[123]$/);
      expect(floorElements.length).toBeGreaterThan(0);
    });

    it('navigates through contribution pagination when many units exist', async () => {
      // Mock more residences to test pagination
      const manyResidences = Array.from({ length: 25 }, (_, _index) => ({
        id: `res-${index + 1}`,
        building_id: 'building-1',
        unit_number: `${Math.floor(index / 10) + 1}${String(index % 10 + 1).padStart(2, '0')}`,
        ownership_percentage: 3.5 + (index * 0.1),
        floor: Math.floor(index / 10) + 1,
      }));

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/residences')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(manyResidences),
          });
        }
        if (url.includes('/api/buildings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBuildings),
          });
        }
        if (url.includes('/summary')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              summary: [{
                year: 2024,
                month: 1,
                incomes: [50000],
                spendings: [75000],
                incomeTypes: ['monthly_fees'],
                spendingTypes: ['maintenance_expense'],
              }],
            }),
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
        expect(screen.getByText('Special Contribution Breakdown')).toBeInTheDocument();
      });

      // Step 1: Verify pagination controls exist
      await waitFor(() => {
        expect(screen.getByText('Page')).toBeInTheDocument();
        expect(screen.getByText('of')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument(); // 25 units / 10 per page = 3 pages
      });

      // Step 2: Navigate to next page
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);

      // Step 3: Verify different units are shown on page 2
      await waitFor(() => {
        expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
      });

      // Step 4: Navigate back to previous page
      const prevButton = screen.getByText('Previous');
      fireEvent.click(prevButton);

      await waitFor(() => {
        expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
      });
    });
  });

  describe('Bilingual User Workflow', () => {
    it('completes budget analysis in French', async () => {
      mockUseLanguage.mockReturnValue({
        language: 'fr',
        setLanguage: jest.fn(),
        t: jest.fn((_key) => _key),
        translations: {},
      });

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
            json: () => Promise.resolve(mockComprehensiveBudgetData),
          });
        }
        if (url.includes('/bank-account')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBankAccount),
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

      // Step 1: Navigate interface in French
      expect(screen.getByText('Tableau de bord budgétaire')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Sélectionner un bâtiment...')).toBeInTheDocument();

      // Step 2: Select building and view French financial summary
      const buildingSelect = screen.getByDisplayValue('Sélectionner un bâtiment...');
      fireEvent.change(buildingSelect, { target: { _value: 'building-1' } });

      await waitFor(() => {
        expect(screen.getByText('Revenus Totaux')).toBeInTheDocument();
        expect(screen.getByText('Dépenses Totales')).toBeInTheDocument();
        expect(screen.getByText('Flux de Trésorerie Net')).toBeInTheDocument();
      });

      // Step 3: Access French bank account management
      await waitFor(() => {
        expect(screen.getByText('Gestion du compte bancaire')).toBeInTheDocument();
        expect(screen.getByText('Compte actuel:')).toBeInTheDocument();
        expect(screen.getByText('Soldes minimums:')).toBeInTheDocument();
        expect(screen.getByText('Mettre à jour le compte')).toBeInTheDocument();
      });

      // Step 4: View French category breakdown
      const categoriesButton = screen.getByText('Catégories');
      fireEvent.click(categoriesButton);

      await waitFor(() => {
        expect(screen.getByText('Revenus: Frais mensuels')).toBeInTheDocument();
        expect(screen.getByText('Revenus: Frais de stationnement')).toBeInTheDocument();
        expect(screen.getByText('Dépenses: Entretien')).toBeInTheDocument();
        expect(screen.getByText('Dépenses: Services publics')).toBeInTheDocument();
      });

      // Step 5: Verify French positive cash flow message
      expect(screen.getByText('Aucune contribution spéciale requise - flux de trésorerie positif')).toBeInTheDocument();
    });

    it('switches between English and French during workflow', async () => {
      let currentLanguage = 'en';
      const mockSetLanguage = jest.fn((lang) => {
        currentLanguage = lang;
      });

      mockUseLanguage.mockImplementation(() => ({
        language: currentLanguage as 'en' | 'fr',
        setLanguage: mockSetLanguage,
        t: jest.fn((_key) => _key),
        translations: {},
      }));

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
            json: () => Promise.resolve(mockComprehensiveBudgetData),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      // Step 1: Start in English
      expect(screen.getByText('Budget Dashboard')).toBeInTheDocument();

      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { _value: 'building-1' } });

      // Step 2: Switch to French
      currentLanguage = 'fr';
      rerender(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      expect(screen.getByText('Tableau de bord budgétaire')).toBeInTheDocument();

      // Step 3: Switch back to English
      currentLanguage = 'en';
      rerender(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      expect(screen.getByText('Budget Dashboard')).toBeInTheDocument();
    });
  });

  describe('Error Recovery Workflows', () => {
    it('handles API errors gracefully and allows user to retry', async () => {
      let apiCallCount = 0;
      
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        apiCallCount++;
        
        if (url.includes('/api/buildings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBuildings),
          });
        }
        
        if (url.includes('/summary')) {
          if (apiCallCount <= 2) {
            // Fail first two attempts
            return Promise.resolve({
              ok: false,
              status: 500,
              json: () => Promise.resolve({ _error: 'Server error' }),
            });
          } else {
            // Succeed on retry
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockComprehensiveBudgetData),
            });
          }
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

      // Step 1: Select building (will trigger failed API call)
      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { _value: 'building-1' } });

      // Step 2: Wait for error handling (component should not crash)
      await waitFor(() => {
        expect(screen.getByText('Budget Dashboard')).toBeInTheDocument();
      });

      // Step 3: Try switching buildings to trigger retry
      fireEvent.change(buildingSelect, { target: { _value: 'building-2' } });
      fireEvent.change(buildingSelect, { target: { _value: 'building-1' } });

      // Step 4: Should eventually succeed on retry
      await waitFor(() => {
        expect(screen.getByText('Total Income')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('handles empty data gracefully', async () => {
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/buildings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([]), // Empty buildings array
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

      // Should handle empty buildings list gracefully
      expect(screen.getByText('Budget Dashboard')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Select a building...')).toBeInTheDocument();
    });
  });

  describe('Performance-Critical Workflows', () => {
    it('handles large datasets efficiently', async () => {
      // Mock large budget dataset (12 months x 3 years)
      const largeBudgetData = {
        summary: Array.from({ length: 36 }, (_, _index) => ({
          year: 2022 + Math.floor(index / 12),
          month: (index % 12) + 1,
          incomes: [45000 + (index * 100), 5000 + (index * 10)],
          spendings: [20000 + (index * 50), 8000 + (index * 20), 5000],
          incomeTypes: ['monthly_fees', 'parking_fees'],
          spendingTypes: ['maintenance_expense', 'utilities', 'insurance'],
        })),
      };

      // Mock many residences
      const manyResidences = Array.from({ length: 100 }, (_, _index) => ({
        id: `res-${index + 1}`,
        building_id: 'building-1',
        unit_number: `${Math.floor(index / 10) + 1}${String(index % 10 + 1).padStart(2, '0')}`,
        ownership_percentage: 1.0 + (index * 0.01),
        floor: Math.floor(index / 10) + 1,
      }));

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
            json: () => Promise.resolve(manyResidences),
          });
        }
        if (url.includes('/summary')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(largeBudgetData),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      const startTime = performance.now();

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
        expect(screen.getByText('Total Income')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should handle large dataset within reasonable time (less than 3 seconds)
      expect(renderTime).toBeLessThan(3000);
    });

    it('maintains responsiveness during multiple rapid interactions', async () => {
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
            json: () => Promise.resolve(mockComprehensiveBudgetData),
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

      // Rapidly switch between buildings and view types
      for (let i = 0; i < 5; i++) {
        fireEvent.change(buildingSelect, { target: { _value: 'building-1' } });
        fireEvent.change(buildingSelect, { target: { _value: 'building-2' } });
        
        const yearlyButton = screen.getByText('Yearly');
        const monthlyButton = screen.getByText('Monthly');
        
        fireEvent.click(monthlyButton);
        fireEvent.click(yearlyButton);
      }

      // Should remain responsive
      await waitFor(() => {
        expect(screen.getByText('Budget Dashboard')).toBeInTheDocument();
      });
    });
  });
});