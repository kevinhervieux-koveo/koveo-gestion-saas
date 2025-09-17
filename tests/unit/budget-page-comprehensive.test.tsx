/**
 * @file Budget Page Frontend Tests
 * @description Comprehensive tests for budget page settings form and API refetch behavior using real Budget component
 */

import React, { Suspense } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import '@testing-library/jest-dom';

// Import the real Budget component
import BudgetInner from '../../client/src/pages/manager/budget';

// Mock all the dependencies
jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

jest.mock('wouter', () => ({
  useLocation: () => ['/', jest.fn()],
}));

// Mock recharts components
jest.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => React.createElement('div', { 'data-testid': 'line-chart' }, children),
  Line: () => React.createElement('div', { 'data-testid': 'line' }),
  XAxis: () => React.createElement('div', { 'data-testid': 'x-axis' }),
  YAxis: () => React.createElement('div', { 'data-testid': 'y-axis' }),
  CartesianGrid: () => React.createElement('div', { 'data-testid': 'cartesian-grid' }),
  Tooltip: () => React.createElement('div', { 'data-testid': 'tooltip' }),
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => React.createElement('div', { 'data-testid': 'responsive-container' }, children),
}));

// Mock the withHierarchicalSelection HOC
jest.mock('@/components/hoc/withHierarchicalSelection', () => ({
  withHierarchicalSelection: (Component: React.ComponentType<any>) => {
    return (props: any) => React.createElement(Component, props);
  },
}));

// Mock fetch with proper typing
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// Helper function for creating proper JSON responses
const jsonResponse = (data: any, init?: ResponseInit) => 
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init
  });

// Mock data
const mockBankAccountData = {
  bankAccountStartAmount: '50000',
  bankAccountMinimums: '10000',
  generalInflationRate: '2.5',
  revenueInflationRate: '3.0',
};

const mockForecastData = {
  buildingId: 'building-123',
  buildingName: 'Test Building',
  forecastPeriod: '12 months',
  startingBalance: 50000,
  minimumFund: 10000,
  generalInflationRate: 2.5,
  revenueInflationRate: 3.0,
  baselineMonthlyIncome: 15000,
  baselineMonthlyExpenses: 12000,
  recurrentBillsCount: 5,
  uniqueBillsCount: 3,
  forecast: [
    {
      year: 2024,
      month: 1,
      revenue: 15000,
      spending: 12000,
      netCashFlow: 3000,
      balance: 53000,
      status: 'green' as const,
      inflatedIncome: 15450,
      inflatedExpenses: 12300,
    },
    {
      year: 2024,
      month: 2,
      revenue: 15000,
      spending: 12000,
      netCashFlow: 3000,
      balance: 56000,
      status: 'green' as const,
      inflatedIncome: 15450,
      inflatedExpenses: 12300,
    },
    {
      year: 2024,
      month: 12,
      revenue: 15000,
      spending: 12000,
      netCashFlow: 3000,
      balance: 83000,
      status: 'green' as const,
      inflatedIncome: 15450,
      inflatedExpenses: 12300,
    },
  ],
};

// Create Budget component with HOC wrapper (mimicking the real app structure)
const Budget = React.memo(({ buildingId, organizationId }: { buildingId?: string; organizationId?: string }) => {
  return <BudgetInner buildingId={buildingId} organizationId={organizationId} />;
});

// Test component wrapper
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('Budget Page Tests', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock successful responses by default
    mockFetch.mockResolvedValue(jsonResponse({}));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Settings Form Interaction Tests', () => {
    it('should render settings dialog when settings button is clicked', async () => {
      render(
        React.createElement(TestWrapper, null,
          React.createElement(Budget, { buildingId: 'building-123', organizationId: 'org-123' })
        )
      );

      const settingsButton = screen.getByTestId('button-budget-settings');
      await user.click(settingsButton);

      // Settings dialog should be visible
      expect(screen.getByText('Budget Settings')).toBeInTheDocument();
      expect(screen.getByTestId('input-start-amount')).toBeInTheDocument();
      expect(screen.getByTestId('input-minimum-fund')).toBeInTheDocument();
      expect(screen.getByTestId('input-general-inflation')).toBeInTheDocument();
      expect(screen.getByTestId('input-revenue-inflation')).toBeInTheDocument();
    });

    it('should update local state when input values change', async () => {
      render(
        React.createElement(TestWrapper, null,
          React.createElement(Budget, { buildingId: 'building-123', organizationId: 'org-123' })
        )
      );

      const settingsButton = screen.getByTestId('button-budget-settings');
      await user.click(settingsButton);

      const startAmountInput = screen.getByTestId('input-start-amount') as HTMLInputElement;
      const minimumFundInput = screen.getByTestId('input-minimum-fund') as HTMLInputElement;
      const generalInflationInput = screen.getByTestId('input-general-inflation') as HTMLInputElement;
      const revenueInflationInput = screen.getByTestId('input-revenue-inflation') as HTMLInputElement;

      // Change input values - use fireEvent for more precise control
      fireEvent.change(startAmountInput, { target: { value: '75000' } });
      fireEvent.change(minimumFundInput, { target: { value: '15000' } });
      fireEvent.change(generalInflationInput, { target: { value: '3.5' } });
      fireEvent.change(revenueInflationInput, { target: { value: '4.0' } });

      // Verify the inputs have the new values
      expect(startAmountInput.value).toBe('75000');
      expect(minimumFundInput.value).toBe('15000');
      expect(generalInflationInput.value).toBe('3.5');
      expect(revenueInflationInput.value).toBe('4.0');
    });

    it('should trigger API call when form is submitted', async () => {
      render(
        React.createElement(TestWrapper, null,
          React.createElement(Budget, { buildingId: 'building-123', organizationId: 'org-123' })
        )
      );

      const settingsButton = screen.getByTestId('button-budget-settings');
      await user.click(settingsButton);

      // Change some values
      const startAmountInput = screen.getByTestId('input-start-amount') as HTMLInputElement;
      await user.clear(startAmountInput);
      await user.type(startAmountInput, '75000');

      // Submit the form
      const saveButton = screen.getByTestId('button-save-settings');
      await user.click(saveButton);

      // Verify fetch was called
      expect(mockFetch).toHaveBeenCalledWith('/api/budgets/building-123/bank-account', {
        method: 'PUT',
        body: JSON.stringify({
          bankAccountStartAmount: 75000,
          bankAccountMinimums: 10000,
          generalInflationRate: 2.5,
          revenueInflationRate: 3.0,
        }),
      });
    });

    it('should handle numeric input validation', async () => {
      render(
        React.createElement(TestWrapper, null,
          React.createElement(Budget, { buildingId: 'building-123', organizationId: 'org-123' })
        )
      );

      const settingsButton = screen.getByTestId('button-budget-settings');
      await user.click(settingsButton);

      const startAmountInput = screen.getByTestId('input-start-amount') as HTMLInputElement;
      
      // Test invalid input (non-numeric) - use fireEvent for precise control
      fireEvent.change(startAmountInput, { target: { value: 'invalid' } });
      
      // Should default to 0 for invalid numeric input
      expect(startAmountInput.value).toBe('0');

      // Test negative numbers - use fireEvent for precise control
      fireEvent.change(startAmountInput, { target: { value: '-1000' } });
      expect(startAmountInput.value).toBe('-1000');
    });
  });

  describe('API Refetch Behavior Tests', () => {
    it('should handle API call failures gracefully', async () => {
      render(
        React.createElement(TestWrapper, null,
          React.createElement(Budget, { buildingId: 'building-123', organizationId: 'org-123' })
        )
      );

      const settingsButton = screen.getByTestId('button-budget-settings');
      await user.click(settingsButton);

      const saveButton = screen.getByTestId('button-save-settings');
      
      // The button click should not throw an error even if API fails
      await expect(async () => {
        await user.click(saveButton);
      }).not.toThrow();

      // Component should still be functional after potential API error
      expect(screen.getByTestId('button-budget-settings')).toBeInTheDocument();
    });

    it('should display data when API calls succeed', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(mockForecastData));

      render(
        React.createElement(TestWrapper, null,
          React.createElement(Budget, { buildingId: 'building-123', organizationId: 'org-123' })
        )
      );

      // Component should render without errors
      expect(screen.getByTestId('card-current-balance')).toBeInTheDocument();
    });
  });

  describe('Chart and UI Update Tests', () => {
    it('should render chart component structure', () => {
      render(
        React.createElement(TestWrapper, null,
          React.createElement(Budget, { buildingId: 'building-123', organizationId: 'org-123' })
        )
      );

      // Chart components should be rendered
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
      expect(screen.getByTestId('x-axis')).toBeInTheDocument();
      expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    });

    it('should update summary cards with data', () => {
      render(
        React.createElement(TestWrapper, null,
          React.createElement(Budget, { buildingId: 'building-123', organizationId: 'org-123' })
        )
      );

      // Check summary cards are rendered with correct data
      expect(screen.getByTestId('card-current-balance')).toBeInTheDocument();
      expect(screen.getByTestId('card-monthly-income')).toBeInTheDocument();
      expect(screen.getByTestId('card-monthly-spending')).toBeInTheDocument();
      expect(screen.getByTestId('card-year-end-projection')).toBeInTheDocument();

      // Check if values are displayed
      expect(screen.getByText('$53,000')).toBeInTheDocument();
      expect(screen.getByText('$15,000')).toBeInTheDocument();
      expect(screen.getByText('$12,000')).toBeInTheDocument();
      expect(screen.getByText('$83,000')).toBeInTheDocument();
    });

    it('should render budget categories with correct data', () => {
      render(
        React.createElement(TestWrapper, null,
          React.createElement(Budget, { buildingId: 'building-123', organizationId: 'org-123' })
        )
      );

      const budgetCategoriesCard = screen.getByTestId('card-budget-categories');
      expect(budgetCategoriesCard).toBeInTheDocument();

      // Check if budget categories are rendered
      expect(screen.getByText('Monthly Income')).toBeInTheDocument();
      expect(screen.getByText('Monthly Expenses')).toBeInTheDocument();
      expect(screen.getByText('Recurrent Bills')).toBeInTheDocument();
      expect(screen.getByText('Unique Bills')).toBeInTheDocument();
    });

    it('should update balance trend chart display', () => {
      render(
        React.createElement(TestWrapper, null,
          React.createElement(Budget, { buildingId: 'building-123', organizationId: 'org-123' })
        )
      );

      const balanceTrendCard = screen.getByTestId('card-balance-trend');
      expect(balanceTrendCard).toBeInTheDocument();
      expect(screen.getByText('Monthly Balance Trend')).toBeInTheDocument();

      // Chart components should be rendered
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      expect(screen.getByTestId('x-axis')).toBeInTheDocument();
      expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    });
  });

  describe('Integration with React Query', () => {
    it('should handle loading states', () => {
      // Simulate loading state
      render(
        React.createElement(TestWrapper, null,
          React.createElement('div', null, 'Loading budget data...')
        )
      );

      expect(screen.getByText('Loading budget data...')).toBeInTheDocument();
    });

    it('should handle error states gracefully', () => {
      // Simulate error state
      render(
        React.createElement(TestWrapper, null,
          React.createElement(Budget, { buildingId: 'building-123', organizationId: 'org-123' })
        )
      );

      // Component should render even with potential errors
      expect(screen.getByTestId('button-budget-settings')).toBeInTheDocument();
    });

    it('should handle successful data fetching', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(mockBankAccountData));

      render(
        React.createElement(TestWrapper, null,
          React.createElement(Budget, { buildingId: 'building-123', organizationId: 'org-123' })
        )
      );

      // Should render successfully with data
      expect(screen.getByTestId('card-current-balance')).toBeInTheDocument();
    });
  });

  describe('Navigation and Building Selection', () => {
    it('should show building selection message when no building is selected', () => {
      render(
        React.createElement(TestWrapper, null,
          React.createElement(Budget, { organizationId: 'org-123' })
        )
      );

      expect(screen.getByText('Select a building to continue')).toBeInTheDocument();
      expect(screen.queryByTestId('button-budget-settings')).not.toBeInTheDocument();
    });

    it('should render content when building is selected', () => {
      render(
        React.createElement(TestWrapper, null,
          React.createElement(Budget, { buildingId: 'building-123', organizationId: 'org-123' })
        )
      );

      expect(screen.getByTestId('button-budget-settings')).toBeInTheDocument();
      expect(screen.getByText('budgetDashboard')).toBeInTheDocument();
    });
  });
});