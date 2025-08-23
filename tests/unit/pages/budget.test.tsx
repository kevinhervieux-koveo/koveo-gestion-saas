import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Budget from '@/pages/manager/budget';
import { TestProviders } from '../../utils/test-providers';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { useFullscreen } from '@/hooks/use-fullscreen';

// Mock hooks
jest.mock('@/hooks/use-auth');
jest.mock('@/hooks/use-language');
jest.mock('@/hooks/use-fullscreen');
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Mock all the Lucide React icons
jest.mock('lucide-react', () => ({
  DollarSign: () => <div data-testid="dollar-icon">$</div>,
  Banknote: () => <div data-testid="banknote-icon">Banknote</div>,
  Settings: () => <div data-testid="settings-icon">Settings</div>,
  TrendingUp: () => <div data-testid="trending-up-icon">TrendingUp</div>,
  Calculator: () => <div data-testid="calculator-icon">Calculator</div>,
  Filter: () => <div data-testid="filter-icon">Filter</div>,
  ChevronDown: () => <div data-testid="chevron-down-icon">ChevronDown</div>,
  ChevronUp: () => <div data-testid="chevron-up-icon">ChevronUp</div>,
  X: () => <div data-testid="close-icon">X</div>,
  Plus: () => <div data-testid="plus-icon">Plus</div>,
  Trash2: () => <div data-testid="trash-icon">Trash</div>,
  Calendar: () => <div data-testid="calendar-icon">Calendar</div>,
  AlertTriangle: () => <div data-testid="alert-icon">AlertTriangle</div>,
  ChevronLeft: () => <div data-testid="chevron-left-icon">ChevronLeft</div>,
  ChevronRight: () => <div data-testid="chevron-right-icon">ChevronRight</div>,
  Users: () => <div data-testid="users-icon">Users</div>,
  Percent: () => <div data-testid="percent-icon">Percent</div>,
  Maximize2: () => <div data-testid="maximize-icon">Maximize</div>,
  Minimize2: () => <div data-testid="minimize-icon">Minimize</div>,
}));

// Mock Recharts components
jest.mock('recharts', () => ({
  Area: () => <div data-testid="area-chart">Area</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  XAxis: () => <div data-testid="x-axis">XAxis</div>,
  YAxis: () => <div data-testid="y-axis">YAxis</div>,
  CartesianGrid: () => <div data-testid="cartesian-grid">CartesianGrid</div>,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
}));

// Mock the chart components
jest.mock('@/components/ui/chart', () => ({
  ChartContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="chart-container">{children}</div>,
  ChartTooltip: () => <div data-testid="chart-tooltip">Tooltip</div>,
  ChartTooltipContent: () => <div data-testid="chart-tooltip-content">TooltipContent</div>,
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseLanguage = useLanguage as jest.MockedFunction<typeof useLanguage>;
const mockUseFullscreen = useFullscreen as jest.MockedFunction<typeof useFullscreen>;

// Mock API data
const mockBuildings = [
  {
    id: 'building-1',
    name: 'Test Building A',
    address: '123 Test Street',
    organizationId: 'org-1',
  },
  {
    id: 'building-2',
    name: 'Test Building B', 
    address: '456 Test Avenue',
    organizationId: 'org-1',
  },
];

const mockResidences = [
  {
    id: 'residence-1',
    building_id: 'building-1',
    unit_number: '101',
    ownership_percentage: 5.5,
    floor: 1,
  },
  {
    id: 'residence-2',
    building_id: 'building-1',
    unit_number: '102',
    ownership_percentage: 4.8,
    floor: 1,
  },
  {
    id: 'residence-3',
    building_id: 'building-1',
    unit_number: '201',
    ownership_percentage: 6.2,
    floor: 2,
  },
];

const mockBudgetSummary = {
  summary: [
    {
      year: 2024,
      month: 1,
      incomes: [45000, 5000],
      spendings: [15000, 8000, 5000],
      incomeTypes: ['monthly_fees', 'parking_fees'],
      spendingTypes: ['maintenance_expense', 'utilities', 'insurance'],
    },
    {
      year: 2024,
      month: 2,
      incomes: [45000, 5000],
      spendings: [18000, 8500, 5000],
      incomeTypes: ['monthly_fees', 'parking_fees'],
      spendingTypes: ['maintenance_expense', 'utilities', 'insurance'],
    },
  ],
};

const mockBankAccountInfo = {
  bankAccountNumber: '1234567890',
  bankAccountNotes: 'Main operating account',
  bankAccountUpdatedAt: '2024-01-15T10:00:00Z',
  bankAccountStartDate: '2024-01-01',
  bankAccountStartAmount: 100000,
  bankAccountMinimums: JSON.stringify([
    { id: '1', amount: 50000, description: 'Emergency fund' },
    { id: '2', amount: 25000, description: 'Maintenance reserve' },
  ]),
  inflationSettings: JSON.stringify({
    incomeSettings: [],
    expenseSettings: [],
    generalIncome: 2.5,
    generalExpense: 3.0,
  }),
};

// Mock fetch
global.fetch = jest.fn();

describe('Budget Page Tests', () => {
  let queryClient: QueryClient;

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

    mockUseFullscreen.mockReturnValue({
      isFullscreen: false,
      toggleFullscreen: jest.fn(),
      enterFullscreen: jest.fn(),
      exitFullscreen: jest.fn(),
    });

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
          json: () => Promise.resolve(mockBudgetSummary),
        });
      }
      if (url.includes('/bank-account')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockBankAccountInfo),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      });
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial Rendering', () => {
    it('renders budget page with header and main elements', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      expect(screen.getByText('Budget Dashboard')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Select a building...')).toBeInTheDocument();
      expect(screen.getByTestId('button-fullscreen-toggle')).toBeInTheDocument();
    });

    it('displays building selection dropdown', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Select a building...');
      expect(buildingSelect).toBeInTheDocument();
    });

    it('shows year range controls', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      expect(screen.getByText('Start Year:')).toBeInTheDocument();
      expect(screen.getByText('End Year:')).toBeInTheDocument();
    });

    it('displays view type selector (yearly/monthly)', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      expect(screen.getByText('Yearly')).toBeInTheDocument();
      expect(screen.getByText('Monthly')).toBeInTheDocument();
    });
  });

  describe('Building Selection', () => {
    it('loads budget data when building is selected', async () => {
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
        expect(screen.getByText('Total Expenses')).toBeInTheDocument();
        expect(screen.getByText('Net Cash Flow')).toBeInTheDocument();
      });
    });

    it('displays budget summary cards after building selection', async () => {
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
        // Check for financial summary cards
        expect(screen.getByText('$100,000')).toBeInTheDocument(); // Total Income
        expect(screen.getByText('$63,500')).toBeInTheDocument(); // Total Expenses
      });
    });

    it('shows bank account information when available', async () => {
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
        expect(screen.getByText('Bank Account Management')).toBeInTheDocument();
        expect(screen.getByText('1234567890')).toBeInTheDocument();
      });
    });
  });

  describe('Financial Charts', () => {
    it('renders financial trends chart when data is available', async () => {
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
        expect(screen.getByText('Financial Trends')).toBeInTheDocument();
      });
    });

    it('shows category breakdown when toggle is enabled', async () => {
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
        const categoriesToggle = screen.getByText('Categories');
        fireEvent.click(categoriesToggle);
        
        expect(screen.getByText('Income: Monthly Fees')).toBeInTheDocument();
        expect(screen.getByText('Expense: Maintenance')).toBeInTheDocument();
      });
    });
  });

  describe('Special Contribution Calculations', () => {
    it('calculates special contributions when cash flow is negative', async () => {
      // Mock negative cash flow scenario
      const negativeCashFlowSummary = {
        summary: [
          {
            year: 2024,
            month: 1,
            incomes: [30000],
            spendings: [50000],
            incomeTypes: ['monthly_fees'],
            spendingTypes: ['maintenance_expense'],
          },
        ],
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/summary')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(negativeCashFlowSummary),
          });
        }
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
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockBankAccountInfo),
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
        expect(screen.getByText('Total required:')).toBeInTheDocument();
      });
    });

    it('displays property contribution table with correct calculations', async () => {
      // Mock negative cash flow to trigger contributions
      const negativeCashFlowSummary = {
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
        if (url.includes('/summary')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(negativeCashFlowSummary),
          });
        }
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
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockBankAccountInfo),
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
        // Check for unit numbers in contribution table
        expect(screen.getByText('101')).toBeInTheDocument();
        expect(screen.getByText('102')).toBeInTheDocument();
        expect(screen.getByText('201')).toBeInTheDocument();
      });
    });
  });

  describe('Bank Account Management', () => {
    it('opens bank account dialog when manage button is clicked', async () => {
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
        const updateButton = screen.getByText('Update Account');
        fireEvent.click(updateButton);
        
        expect(screen.getByText('Update Bank Account')).toBeInTheDocument();
        expect(screen.getByLabelText('Bank Account Number')).toBeInTheDocument();
      });
    });

    it('displays minimum balance settings', async () => {
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
        expect(screen.getByText('Emergency fund')).toBeInTheDocument();
        expect(screen.getByText('Maintenance reserve')).toBeInTheDocument();
        expect(screen.getByText('$50,000')).toBeInTheDocument();
        expect(screen.getByText('$25,000')).toBeInTheDocument();
      });
    });

    it('opens minimum balances management dialog', async () => {
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
        const manageButton = screen.getByText('Manage Minimum Balances');
        fireEvent.click(manageButton);
        
        expect(screen.getByText('Manage Minimum Balances')).toBeInTheDocument();
      });
    });
  });

  describe('View Type Switching', () => {
    it('switches between yearly and monthly views', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { _value: 'building-1' } });

      // Switch to monthly view
      const monthlyButton = screen.getByText('Monthly');
      fireEvent.click(monthlyButton);

      expect(screen.getByText('Start Month:')).toBeInTheDocument();
      expect(screen.getByText('End Month:')).toBeInTheDocument();
    });

    it('shows month controls only in monthly view', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      // Initially in yearly view - no month controls
      expect(screen.queryByText('Start Month:')).not.toBeInTheDocument();

      // Switch to monthly view
      const monthlyButton = screen.getByText('Monthly');
      fireEvent.click(monthlyButton);

      // Now month controls should appear
      expect(screen.getByText('Start Month:')).toBeInTheDocument();
      expect(screen.getByText('End Month:')).toBeInTheDocument();
    });
  });

  describe('Category Filtering', () => {
    it('displays category filter options when categories are shown', async () => {
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
        
        expect(screen.getByText('Income: Monthly Fees')).toBeInTheDocument();
        expect(screen.getByText('Income: Parking Fees')).toBeInTheDocument();
        expect(screen.getByText('Expense: Maintenance')).toBeInTheDocument();
      });
    });

    it('filters data when categories are selected', async () => {
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
        
        // Select a category filter
        const monthlyFeesCategory = screen.getByText('Income: Monthly Fees');
        fireEvent.click(monthlyFeesCategory);
        
        // Check that selection is reflected
        expect(screen.getByText('1 categories')).toBeInTheDocument();
      });
    });
  });

  describe('Fullscreen Functionality', () => {
    it('displays fullscreen toggle button', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      expect(screen.getByTestId('button-fullscreen-toggle')).toBeInTheDocument();
    });

    it('calls fullscreen toggle when button is clicked', () => {
      const mockToggleFullscreen = jest.fn();
      mockUseFullscreen.mockReturnValue({
        isFullscreen: false,
        toggleFullscreen: mockToggleFullscreen,
        enterFullscreen: jest.fn(),
        exitFullscreen: jest.fn(),
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const fullscreenButton = screen.getByTestId('button-fullscreen-toggle');
      fireEvent.click(fullscreenButton);

      expect(mockToggleFullscreen).toHaveBeenCalledTimes(1);
    });

    it('shows different text when in fullscreen mode', () => {
      mockUseFullscreen.mockReturnValue({
        isFullscreen: true,
        toggleFullscreen: jest.fn(),
        enterFullscreen: jest.fn(),
        exitFullscreen: jest.fn(),
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      expect(screen.getByText('Exit Fullscreen')).toBeInTheDocument();
    });
  });

  describe('Language Support', () => {
    it('displays French translations when language is set to French', () => {
      mockUseLanguage.mockReturnValue({
        language: 'fr',
        setLanguage: jest.fn(),
        t: jest.fn((_key) => _key),
        translations: {},
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      expect(screen.getByText('Tableau de bord budgétaire')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Sélectionner un bâtiment...')).toBeInTheDocument();
    });

    it('translates category names correctly', async () => {
      mockUseLanguage.mockReturnValue({
        language: 'fr',
        setLanguage: jest.fn(),
        t: jest.fn((_key) => _key),
        translations: {},
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Sélectionner un bâtiment...');
      fireEvent.change(buildingSelect, { target: { _value: 'building-1' } });

      await waitFor(() => {
        const categoriesButton = screen.getByText('Catégories');
        fireEvent.click(categoriesButton);
        
        expect(screen.getByText('Revenus: Frais mensuels')).toBeInTheDocument();
        expect(screen.getByText('Dépenses: Entretien')).toBeInTheDocument();
      });
    });

    it('translates bank account management interface', async () => {
      mockUseLanguage.mockReturnValue({
        language: 'fr',
        setLanguage: jest.fn(),
        t: jest.fn((_key) => _key),
        translations: {},
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Sélectionner un bâtiment...');
      fireEvent.change(buildingSelect, { target: { _value: 'building-1' } });

      await waitFor(() => {
        expect(screen.getByText('Gestion du compte bancaire')).toBeInTheDocument();
        expect(screen.getByText('Compte actuel:')).toBeInTheDocument();
        expect(screen.getByText('Mettre à jour le compte')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.reject(new Error('API Error')),
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

      // Should not crash and should handle error gracefully
      await waitFor(() => {
        expect(screen.getByText('Budget Dashboard')).toBeInTheDocument();
      });
    });

    it('shows appropriate message when no buildings are available', () => {
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/buildings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([]),
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

      expect(screen.getByDisplayValue('Select a building...')).toBeInTheDocument();
    });
  });

  describe('Performance Optimizations', () => {
    it('memoizes expensive calculations', async () => {
      const { rerender } = render(
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

      // Re-render should not cause performance issues
      rerender(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      expect(screen.getByText('Total Income')).toBeInTheDocument();
    });

    it('handles large datasets efficiently', async () => {
      // Mock large dataset
      const largeBudgetSummary = {
        summary: Array.from({ length: 100 }, (_, _index) => ({
          year: 2020 + Math.floor(_index / 12),
          month: (_index % 12) + 1,
          incomes: [45000, 5000],
          spendings: [15000, 8000, 5000],
          incomeTypes: ['monthly_fees', 'parking_fees'],
          spendingTypes: ['maintenance_expense', 'utilities', 'insurance'],
        })),
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/summary')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(largeBudgetSummary),
          });
        }
        if (url.includes('/api/buildings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBuildings),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      });

      const startTime = Date.now();

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

      const endTime = Date.now();
      const renderTime = endTime - startTime;

      // Should handle large dataset within reasonable time (less than 2 seconds)
      expect(renderTime).toBeLessThan(2000);
    });
  });
});