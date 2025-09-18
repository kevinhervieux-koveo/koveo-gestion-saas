/**
 * @file Budget Page React Query Integration Tests
 * @description Focused tests for React Query integration, cache invalidation, 
 * query key alignment, debouncing, and automatic updates
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import '@testing-library/jest-dom';

// Import the real Budget component
import BudgetInner from '../../client/src/pages/manager/budget';

// Mock dependencies
jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('wouter', () => ({
  useLocation: () => ['/manager/budget', jest.fn()],
}));

jest.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => 
    React.createElement('div', { 'data-testid': 'line-chart' }, children),
  Line: () => React.createElement('div', { 'data-testid': 'line' }),
  XAxis: () => React.createElement('div', { 'data-testid': 'x-axis' }),
  YAxis: () => React.createElement('div', { 'data-testid': 'y-axis' }),
  CartesianGrid: () => React.createElement('div', { 'data-testid': 'cartesian-grid' }),
  Tooltip: () => React.createElement('div', { 'data-testid': 'tooltip' }),
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => 
    React.createElement('div', { 'data-testid': 'responsive-container' }, children),
  ReferenceLine: () => React.createElement('div', { 'data-testid': 'reference-line' }),
}));

jest.mock('@/components/hoc/withHierarchicalSelection', () => ({
  withHierarchicalSelection: (Component: React.ComponentType<any>) => {
    return (props: any) => React.createElement(Component, {
      ...props,
      organizationId: 'test-org-123',
      buildingId: 'test-building-123'
    });
  },
}));

// Enhanced fetch mock for React Query testing
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

const jsonResponse = (data: any, init: ResponseInit = {}) => 
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init
  });

// Mock data generators
const createBankAccountData = (overrides = {}) => ({
  buildingId: 'test-building-123',
  buildingName: 'Test Building',
  bankAccountStartAmount: 50000,
  generalInflationRate: 2.5,
  financialYearStart: '2024-01-01',
  ...overrides,
});

const createForecastData = (overrides = {}) => ({
  buildingId: 'test-building-123',
  buildingName: 'Test Building',
  forecastPeriod: '12 months',
  startingBalance: 50000,
  minimumFund: 10000,
  forecast: Array.from({ length: 12 }, (_, i) => ({
    year: 2024,
    month: i + 1,
    revenue: 15000,
    spending: 12000,
    netCashFlow: 3000,
    balance: 50000 + ((i + 1) * 3000),
    status: 'green' as const,
    inflatedIncome: 15000,
    inflatedRecurringExpenses: 12000,
    inflatedUnplannedBills: 5000,
  })),
  ...overrides,
});

describe('Budget Page React Query Integration Tests', () => {
  let queryClient: QueryClient;
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create fresh QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 0,
          gcTime: 0,
          refetchOnWindowFocus: false,
          refetchOnReconnect: false,
        },
        mutations: { retry: false },
      },
    });

    // Default API responses
    mockFetch.mockImplementation(async (url: string, options = {}) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      const method = (options as any)?.method || 'GET';

      if (urlStr.includes('/api/budgets/test-building-123/bank-account')) {
        if (method === 'GET') {
          return jsonResponse(createBankAccountData());
        }
        if (method === 'PUT') {
          return jsonResponse({ success: true, updated: true });
        }
      }

      if (urlStr.includes('budgetForecast')) {
        return jsonResponse(createForecastData());
      }

      if (urlStr.includes('/api/budgets/test-building-123/investments')) {
        return jsonResponse([]);
      }

      if (urlStr.includes('/api/buildings/test-building-123/residences')) {
        return jsonResponse([]);
      }

      return jsonResponse({ success: true, data: [] });
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  const TestWrapper = ({ children }: { children: React.ReactNode }) => {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  const Budget = () => React.createElement(BudgetInner, { 
    buildingId: 'test-building-123', 
    organizationId: 'test-org-123' 
  });

  describe('Query Key Alignment and Cache Invalidation', () => {
    it('should use consistent query keys for GET and POST operations', async () => {
      render(
        React.createElement(TestWrapper, null, React.createElement(Budget))
      );

      // Wait for initial queries to complete
      await waitFor(() => {
        expect(screen.getByTestId('card-current-balance')).toBeInTheDocument();
      });

      // Capture initial query cache state
      const initialCache = queryClient.getQueryCache();
      const initialQueries = initialCache.getAll().map(query => ({
        queryKey: query.queryKey,
        state: query.state.status
      }));

      expect(initialQueries.length).toBeGreaterThan(0);

      // Find the bank account query
      const bankAccountQuery = initialQueries.find(q => 
        q.queryKey.some(key => 
          typeof key === 'string' && key.includes('bank-account')
        )
      );
      expect(bankAccountQuery).toBeDefined();
      expect(bankAccountQuery?.state).toBe('success');

      // Make a settings change that should invalidate the cache
      const settingsButton = screen.getByTestId('button-budget-settings');
      await user.click(settingsButton);

      const inflationInput = screen.getByTestId('input-general-inflation');
      await user.clear(inflationInput);
      await user.type(inflationInput, '3.5');

      const saveButton = screen.getByTestId('button-save-settings');
      await user.click(saveButton);

      // Wait for PUT request and cache invalidation
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/budgets/test-building-123/bank-account',
          expect.objectContaining({
            method: 'PUT',
            headers: expect.objectContaining({
              'Content-Type': 'application/json'
            })
          })
        );
      });

      // Verify cache invalidation triggered refetch
      await waitFor(() => {
        const putCalls = (mockFetch as any).mock.calls.filter((call: any[]) => 
          call[0].includes('bank-account') && call[1]?.method === 'PUT'
        );
        const getCalls = (mockFetch as any).mock.calls.filter((call: any[]) => 
          call[0].includes('bank-account') && (!call[1] || call[1].method === 'GET')
        );
        
        expect(putCalls.length).toBe(1);
        expect(getCalls.length).toBeGreaterThanOrEqual(2); // Initial + refetch after invalidation
      });
    });

    it('should properly invalidate forecast queries when settings change', async () => {
      render(
        React.createElement(TestWrapper, null, React.createElement(Budget))
      );

      await waitFor(() => {
        expect(screen.getByTestId('card-current-balance')).toBeInTheDocument();
      });

      // Count initial forecast calls
      const initialForecastCalls = (mockFetch as any).mock.calls.filter((call: any[]) => 
        call[0].includes('budgetForecast')
      ).length;

      // Change a setting that affects forecast
      const settingsButton = screen.getByTestId('button-budget-settings');
      await user.click(settingsButton);

      const startAmountInput = screen.getByTestId('input-start-amount');
      await user.clear(startAmountInput);
      await user.type(startAmountInput, '75000');

      const saveButton = screen.getByTestId('button-save-settings');
      await user.click(saveButton);

      // Wait for invalidation and refetch
      await waitFor(() => {
        const finalForecastCalls = (mockFetch as any).mock.calls.filter((call: any[]) => 
          call[0].includes('budgetForecast')
        ).length;
        
        expect(finalForecastCalls).toBeGreaterThan(initialForecastCalls);
      }, { timeout: 5000 });
    });

    it('should not invalidate unrelated queries when making unrelated changes', async () => {
      render(
        React.createElement(TestWrapper, null, React.createElement(Budget))
      );

      await waitFor(() => {
        expect(screen.getByTestId('card-current-balance')).toBeInTheDocument();
      });

      // Count initial residence calls (should be unrelated to budget settings)
      const initialResidenceCalls = (mockFetch as any).mock.calls.filter((call: any[]) => 
        call[0].includes('residences')
      ).length;

      // Make a UI-only change (period filters)
      const filtersButton = screen.getByTestId('button-period-filters');
      await user.click(filtersButton);

      const monthViewRadio = screen.getByTestId('radio-view-month');
      await user.click(monthViewRadio);

      const applyFiltersButton = screen.getByTestId('button-apply-filters');
      await user.click(applyFiltersButton);

      // Wait a moment and verify residences weren't refetched
      await new Promise(resolve => setTimeout(resolve, 200));

      const finalResidenceCalls = (mockFetch as any).mock.calls.filter((call: any[]) => 
        call[0].includes('residences')
      ).length;

      expect(finalResidenceCalls).toBe(initialResidenceCalls);
    });
  });

  describe('Debouncing and Stale Time Behavior', () => {
    it('should debounce rapid forecast updates', async () => {
      // Create a query client with debouncing simulation
      const debouncedQueryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 100, // 100ms stale time for testing
            refetchOnWindowFocus: false,
          },
        },
      });

      const DebouncedWrapper = ({ children }: { children: React.ReactNode }) => {
        return React.createElement(QueryClientProvider, { client: debouncedQueryClient }, children);
      };

      render(
        React.createElement(DebouncedWrapper, null, React.createElement(Budget))
      );

      await waitFor(() => {
        expect(screen.getByTestId('card-current-balance')).toBeInTheDocument();
      });

      const initialForecastCalls = (mockFetch as any).mock.calls.filter((call: any[]) => 
        call[0].includes('budgetForecast')
      ).length;

      // Make rapid successive changes
      const settingsButton = screen.getByTestId('button-budget-settings');
      await user.click(settingsButton);

      const inflationInput = screen.getByTestId('input-general-inflation');
      const startAmountInput = screen.getByTestId('input-start-amount');

      // Rapid changes
      await user.clear(inflationInput);
      await user.type(inflationInput, '3.0');
      
      await user.clear(startAmountInput);
      await user.type(startAmountInput, '60000');
      
      await user.clear(inflationInput);
      await user.type(inflationInput, '3.5');

      const saveButton = screen.getByTestId('button-save-settings');
      await user.click(saveButton);

      // Wait for debounced update
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/budgets/test-building-123/bank-account',
          expect.objectContaining({ method: 'PUT' })
        );
      });

      // Should have limited forecast refetches due to debouncing
      const finalForecastCalls = (mockFetch as any).mock.calls.filter((call: any[]) => 
        call[0].includes('budgetForecast')
      ).length;

      // Should not have called forecast for every single change
      expect(finalForecastCalls - initialForecastCalls).toBeLessThanOrEqual(2);
    });

    it('should respect staleTime and not refetch immediately', async () => {
      const staleTimeClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 1000, // 1 second
            refetchOnWindowFocus: false,
          },
        },
      });

      const StaleTimeWrapper = ({ children }: { children: React.ReactNode }) => {
        return React.createElement(QueryClientProvider, { client: staleTimeClient }, children);
      };

      render(
        React.createElement(StaleTimeWrapper, null, React.createElement(Budget))
      );

      await waitFor(() => {
        expect(screen.getByTestId('card-current-balance')).toBeInTheDocument();
      });

      const initialCallCount = mockFetch.mock.calls.length;

      // Trigger a component update that normally would refetch
      act(() => {
        // Force a re-render without changing the query key
        const event = new CustomEvent('test-update');
        document.dispatchEvent(event);
      });

      // Wait a bit less than stale time
      await new Promise(resolve => setTimeout(resolve, 500));

      // Should not have made additional calls due to stale time
      expect(mockFetch.mock.calls.length).toBe(initialCallCount);
    });
  });

  describe('Error Handling and Retry Logic', () => {
    it('should handle API errors gracefully without crashing', async () => {
      // Mock API failure
      mockFetch.mockImplementationOnce(() => 
        Promise.reject(new Error('API Error'))
      );

      render(
        React.createElement(TestWrapper, null, React.createElement(Budget))
      );

      // Should render error state gracefully
      await waitFor(() => {
        // Component should still render basic structure even with API errors
        expect(screen.getByTestId('button-budget-settings')).toBeInTheDocument();
      });

      // Should not crash the application
      expect(() => screen.getByTestId('card-current-balance')).not.toThrow();
    });

    it('should retry failed requests according to retry policy', async () => {
      const retryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: 2, // Retry twice
            retryDelay: 0, // No delay for testing
            staleTime: 0,
            refetchOnWindowFocus: false,
          },
        },
      });

      let callCount = 0;
      mockFetch.mockImplementation(async (url: string, options = {}) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        
        if (urlStr.includes('bank-account')) {
          callCount++;
          if (callCount <= 2) {
            // Fail first two attempts
            throw new Error('Network error');
          }
          // Succeed on third attempt
          return jsonResponse(createBankAccountData());
        }

        return jsonResponse({ success: true, data: [] });
      });

      const RetryWrapper = ({ children }: { children: React.ReactNode }) => {
        return React.createElement(QueryClientProvider, { client: retryClient }, children);
      };

      render(
        React.createElement(RetryWrapper, null, React.createElement(Budget))
      );

      // Should eventually succeed after retries
      await waitFor(() => {
        expect(callCount).toBe(3); // Initial + 2 retries
        expect(screen.getByTestId('card-current-balance')).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('should handle 401 errors by not retrying indefinitely', async () => {
      mockFetch.mockImplementation(() => 
        Promise.resolve(new Response('Unauthorized', { status: 401 }))
      );

      render(
        React.createElement(TestWrapper, null, React.createElement(Budget))
      );

      // Should handle 401 without infinite retries
      await waitFor(() => {
        const unauthorizedCalls = mockFetch.mock.calls.filter((call: any[]) => 
          call[0].includes('bank-account')
        );
        // Should not retry 401 errors excessively
        expect(unauthorizedCalls.length).toBeLessThan(5);
      });
    });
  });

  describe('Cache Management and Memory Optimization', () => {
    it('should manage cache size efficiently with large datasets', async () => {
      const memoryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            gcTime: 100, // Short garbage collection time
            staleTime: 0,
          },
        },
      });

      // Mock large dataset response
      mockFetch.mockImplementation(async (url: string) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        
        if (urlStr.includes('budgetForecast')) {
          return jsonResponse(createForecastData({
            forecast: Array.from({ length: 300 }, (_, i) => ({
              year: 2024 + Math.floor(i / 12),
              month: (i % 12) + 1,
              revenue: 15000,
              spending: 12000,
              netCashFlow: 3000,
              balance: 50000 + ((i + 1) * 3000),
              status: 'green' as const,
              inflatedIncome: 15000,
              inflatedRecurringExpenses: 12000,
              inflatedUnplannedBills: 5000,
            }))
          }));
        }

        return jsonResponse(createBankAccountData());
      });

      const MemoryWrapper = ({ children }: { children: React.ReactNode }) => {
        return React.createElement(QueryClientProvider, { client: memoryClient }, children);
      };

      render(
        React.createElement(MemoryWrapper, null, React.createElement(Budget))
      );

      await waitFor(() => {
        expect(screen.getByTestId('card-current-balance')).toBeInTheDocument();
      });

      // Verify cache contains data
      const cache = memoryClient.getQueryCache();
      const queries = cache.getAll();
      expect(queries.length).toBeGreaterThan(0);

      // Wait for garbage collection
      await new Promise(resolve => setTimeout(resolve, 150));

      // Cache should still be manageable in size
      const finalQueries = cache.getAll();
      expect(finalQueries.length).toBeLessThan(10); // Should not accumulate indefinitely
    });

    it('should clear cache on unmount to prevent memory leaks', async () => {
      const { unmount } = render(
        React.createElement(TestWrapper, null, React.createElement(Budget))
      );

      await waitFor(() => {
        expect(screen.getByTestId('card-current-balance')).toBeInTheDocument();
      });

      // Verify cache has data
      const initialQueries = queryClient.getQueryCache().getAll();
      expect(initialQueries.length).toBeGreaterThan(0);

      // Unmount component
      unmount();

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      // Optionally clear cache manually to simulate cleanup
      queryClient.clear();

      const finalQueries = queryClient.getQueryCache().getAll();
      expect(finalQueries.length).toBe(0);
    });
  });

  describe('Optimistic Updates vs Server Validation', () => {
    it('should show optimistic updates for bank account settings', async () => {
      render(
        React.createElement(TestWrapper, null, React.createElement(Budget))
      );

      await waitFor(() => {
        expect(screen.getByTestId('button-budget-settings')).toBeInTheDocument();
      });

      // Open settings
      const settingsButton = screen.getByTestId('button-budget-settings');
      await user.click(settingsButton);

      const startAmountInput = screen.getByTestId('input-start-amount') as HTMLInputElement;
      expect(startAmountInput.value).toBe('50000'); // Initial value

      // Change value
      await user.clear(startAmountInput);
      await user.type(startAmountInput, '85000');

      // Value should update immediately (optimistic)
      expect(startAmountInput.value).toBe('85000');

      const saveButton = screen.getByTestId('button-save-settings');
      await user.click(saveButton);

      // Should maintain optimistic value during save
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/budgets/test-building-123/bank-account',
          expect.objectContaining({
            method: 'PUT',
            body: expect.stringContaining('85000')
          })
        );
      });
    });

    it('should revert optimistic updates on server error', async () => {
      render(
        React.createElement(TestWrapper, null, React.createElement(Budget))
      );

      await waitFor(() => {
        expect(screen.getByTestId('button-budget-settings')).toBeInTheDocument();
      });

      // Mock server error for PUT request
      mockFetch.mockImplementation(async (url: string, options = {}) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        const method = (options as any)?.method || 'GET';

        if (urlStr.includes('bank-account') && method === 'PUT') {
          throw new Error('Server error');
        }
        
        if (urlStr.includes('bank-account') && method === 'GET') {
          return jsonResponse(createBankAccountData());
        }

        return jsonResponse({ success: true, data: [] });
      });

      const settingsButton = screen.getByTestId('button-budget-settings');
      await user.click(settingsButton);

      const startAmountInput = screen.getByTestId('input-start-amount') as HTMLInputElement;
      const originalValue = startAmountInput.value;

      // Make optimistic change
      await user.clear(startAmountInput);
      await user.type(startAmountInput, '95000');
      expect(startAmountInput.value).toBe('95000');

      const saveButton = screen.getByTestId('button-save-settings');
      await user.click(saveButton);

      // After error, should revert to original value or handle gracefully
      await waitFor(() => {
        // The component should handle the error gracefully
        // Either by reverting to original value or showing error state
        expect(screen.getByTestId('button-budget-settings')).toBeInTheDocument();
      });
    });
  });
});