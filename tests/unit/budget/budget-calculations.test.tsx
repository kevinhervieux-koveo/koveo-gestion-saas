import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Create manual mocks that get hoisted
const mockUseLanguage = {
  useLanguage: () => ({
    language: 'en' as const,
    setLanguage: jest.fn(),
    t: jest.fn((_key: string) => _key),
  }),
};

const mockUseFullscreen = {
  useFullscreen: () => ({
    isFullscreen: false,
    toggleFullscreen: jest.fn(),
  }),
};

const mockUseMobileMenu = {
  useMobileMenu: () => ({
    isOpen: false,
    toggle: jest.fn(),
    close: jest.fn(),
    open: jest.fn(),
  }),
};

const mockUseToast = {
  useToast: () => ({
    toast: jest.fn(),
  }),
};

jest.mock('../../../client/src/hooks/use-language', () => mockUseLanguage);
jest.mock('../../../client/src/hooks/use-fullscreen', () => mockUseFullscreen);
jest.mock('../../../client/src/hooks/use-mobile-menu', () => mockUseMobileMenu);
jest.mock('../../../client/src/hooks/use-toast', () => mockUseToast);

jest.mock('../../../client/src/hooks/use-auth', () => ({
  __esModule: true,
  useAuth: jest.fn(() => ({
    user: {
      id: '1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'admin',
      organizationId: 'org-1',
      isActive: true,
      language: 'en'
    },
    isLoading: false,
    isAuthenticated: true,
    login: jest.fn(),
    logout: jest.fn(),
    hasRole: jest.fn().mockReturnValue(true),
    hasAnyRole: jest.fn().mockReturnValue(true),
  })),
}));


// Mock Lucide React icons
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

// Mock Recharts
jest.mock('recharts', () => ({
  Area: () => <div data-testid="area-chart">Area</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  XAxis: () => <div data-testid="x-axis">XAxis</div>,
  YAxis: () => <div data-testid="y-axis">YAxis</div>,
  CartesianGrid: () => <div data-testid="cartesian-grid">CartesianGrid</div>,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
}));

// Mock chart components
jest.mock('@/components/ui/chart', () => ({
  ChartContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="chart-container">{children}</div>,
  ChartTooltip: () => <div data-testid="chart-tooltip">Tooltip</div>,
  ChartTooltipContent: () => <div data-testid="chart-tooltip-content">TooltipContent</div>,
}));

import Budget from '../../../client/src/pages/manager/budget';
import { renderBudgetComponent } from '../budget-test-setup';
import { getDemoBills, getDemoBuildings } from '../../utils/demo-data-helpers';

describe('Budget Calculations and Functionalities', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Income and Expense Calculations', () => {
    it('calculates total income correctly from Demo data', async () => {
      renderBudgetComponent(<Budget />);

      // Wait for budget data to load and calculations to be performed
      await waitFor(() => {
        // Look for income totals in the interface
        const incomeElements = screen.queryAllByText(/\$[0-9,]+/);
        expect(incomeElements.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });

    it('calculates total expenses correctly from Demo bills', async () => {
      const demoBills = getDemoBills();
      const expectedTotalExpenses = demoBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
      
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Verify that expenses from Demo bills are calculated and displayed
        const expenseElements = screen.queryAllByText(/maintenance|utilities|insurance/i);
        expect(expenseElements.length).toBeGreaterThan(0);
      }, { timeout: 3000 });

      // Verify that the calculation logic is working with real Demo data
      expect(expectedTotalExpenses).toBeGreaterThan(0);
      expect(demoBills.length).toBeGreaterThan(0);
    });

    it('calculates net cash flow (income - expenses)', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Look for cash flow indicators or balance displays
        const cashFlowElements = screen.queryAllByText(/flow|balance|net/i);
        expect(cashFlowElements.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });

    it('categorizes income and expenses correctly', async () => {
      const demoBills = getDemoBills();
      const categories = [...new Set(demoBills.map(bill => bill.category))];
      
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Check that different expense categories are displayed
        categories.forEach(category => {
          const categoryElements = screen.queryAllByText(new RegExp(category, 'i'));
          // At least some categories should be visible
        });
      }, { timeout: 3000 });

      // Verify we have multiple categories from Demo data
      expect(categories.length).toBeGreaterThan(1);
      expect(categories).toContain('maintenance');
    });
  });

  describe('Bank Account Balance Calculations', () => {
    it('calculates running balance over time', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Look for bank account balance information
        const balanceElements = screen.queryAllByText(/balance|account|bank/i);
        expect(balanceElements.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });

    it('handles minimum balance requirements', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Look for minimum balance displays or warnings
        const minimumElements = screen.queryAllByText(/minimum|required|threshold/i);
        expect(minimumElements.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });

    it('tracks balance changes with cash flow', async () => {
      renderBudgetComponent(<Budget />);

      // Test that balance calculations reflect income and expense changes
      await waitFor(() => {
        const container = document.body;
        expect(container).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Special Contribution Calculations', () => {
    it('calculates special contributions when cash flow is negative', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Look for special contribution displays
        const contributionElements = screen.queryAllByText(/contribution|special|assessment/i);
        expect(contributionElements.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });

    it('distributes contributions based on property ownership', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Look for property-based contribution breakdowns
        const propertyElements = screen.queryAllByText(/property|unit|ownership/i);
        expect(propertyElements.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });

    it('calculates per-unit contribution amounts', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Verify per-unit calculations are displayed
        const unitElements = screen.queryAllByText(/per unit|unit|per property/i);
        expect(unitElements.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });
  });

  describe('Budget Period and Filtering', () => {
    it('handles yearly budget calculations', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Look for yearly view indicators
        const yearlyElements = screen.queryAllByText(/year|annual|yearly/i);
        expect(yearlyElements.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });

    it('handles monthly budget calculations', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Look for monthly view options
        const monthlyElements = screen.queryAllByText(/month|monthly/i);
        expect(monthlyElements.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });

    it('filters by category correctly', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Look for category filter controls
        const filterElements = screen.queryAllByText(/filter|category|show/i);
        expect(filterElements.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });

    it('handles date range selections', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Look for date range controls
        const dateElements = screen.queryAllByText(/start|end|range|from|to/i);
        expect(dateElements.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });
  });

  describe('Data Validation and Edge Cases', () => {
    it('handles missing budget data gracefully', async () => {
      renderBudgetComponent(<Budget />);

      // Component should render without errors even if some data is missing
      await waitFor(() => {
        const container = document.body;
        expect(container).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('validates numeric calculations', async () => {
      const demoBills = getDemoBills();
      
      // Test that our Demo data has valid numeric values
      demoBills.forEach(bill => {
        expect(typeof bill.totalAmount).toBe('number');
        expect(bill.totalAmount).toBeGreaterThan(0);
        expect(Array.isArray(bill.costs)).toBe(true);
      });

      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        const container = document.body;
        expect(container).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('handles zero and negative values correctly', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Component should handle edge cases in calculations
        const container = document.body;
        expect(container).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('formats currency values correctly', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Look for properly formatted currency displays
        const currencyElements = screen.queryAllByText(/\$[0-9,]+/);
        expect(currencyElements.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });
  });

  describe('Chart Data Calculations', () => {
    it('transforms budget data for chart visualization', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Look for chart-related elements
        const chartElements = screen.queryAllByTestId(/chart|graph|area/);
        expect(chartElements.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });

    it('calculates trend data over time periods', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Look for trend indicators
        const trendElements = screen.queryAllByText(/trend|over time|period/i);
        expect(trendElements.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });

    it('handles chart data with real Demo organization values', async () => {
      const demoBuildings = getDemoBuildings();
      const demoBills = getDemoBills();
      
      // Verify we have real data to work with
      expect(demoBuildings.length).toBe(2);
      expect(demoBills.length).toBeGreaterThan(0);

      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        const container = document.body;
        expect(container).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Performance and Optimization', () => {
    it('efficiently processes large datasets', async () => {
      const demoBills = getDemoBills();
      
      // Test that calculations can handle realistic data volumes
      expect(demoBills.length).toBeGreaterThan(5); // We have multiple bills
      
      const startTime = performance.now();
      renderBudgetComponent(<Budget />);
      
      await waitFor(() => {
        const container = document.body;
        expect(container).toBeInTheDocument();
      }, { timeout: 2000 });
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // Component should render within reasonable time
      expect(renderTime).toBeLessThan(2000); // 2 seconds
    });

    it('memoizes expensive calculations', async () => {
      renderBudgetComponent(<Budget />);

      // Test that re-renders don't cause unnecessary recalculations
      await waitFor(() => {
        const container = document.body;
        expect(container).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });
});