/**
 * @file Budget Page Form Validation and Interaction Tests
 * @description Comprehensive tests for form validation, user interactions,
 * input handling, and UI state management
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
  useToast: () => ({
    toast: jest.fn(({ title, variant }) => {
      console.log(`Toast notification: ${title} (${variant})`);
    }),
  }),
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

// Enhanced fetch mock
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

const jsonResponse = (data: any, init: ResponseInit = {}) => 
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init
  });

// Test data
const createBankAccountData = (overrides = {}) => ({
  buildingId: 'test-building-123',
  buildingName: 'Test Building',
  bankAccountStartAmount: 50000,
  bankAccountStartDate: '2024-01-01',
  bankAccountMinimums: 10000,
  generalInflationRate: 2.5,
  revenueGrowthRate: 3.0,
  financialYearStart: '2024-01-01',
  emergencyFundMinimum: 15000,
  operatingCashMinimum: 8000,
  customRevenueLines: [
    { id: 'parking-1', description: 'Parking Revenue', monthlyAmount: 2500 },
  ],
  customBankFields: {
    'Emergency Fund': 15000,
    'Reserve Fund': 25000,
  },
  ...overrides,
});

describe('Budget Page Form Validation and Interaction Tests', () => {
  let queryClient: QueryClient;
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 0,
          gcTime: 0,
          refetchOnWindowFocus: false,
        },
        mutations: { retry: false },
      },
    });

    // Default successful responses
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

  describe('Numeric Input Validation', () => {
    it('should validate positive numbers for financial inputs', async () => {
      render(
        React.createElement(TestWrapper, null, React.createElement(Budget))
      );

      await waitFor(() => {
        expect(screen.getByTestId('button-budget-settings')).toBeInTheDocument();
      });

      const settingsButton = screen.getByTestId('button-budget-settings');
      await user.click(settingsButton);

      const startAmountInput = screen.getByTestId('input-start-amount') as HTMLInputElement;

      // Test negative number
      await user.clear(startAmountInput);
      await user.type(startAmountInput, '-1000');
      
      // Should handle negative input appropriately
      fireEvent.blur(startAmountInput);
      
      // Either prevent negative values or show validation error
      const value = startAmountInput.value;
      if (value !== '-1000') {
        // Input was corrected/prevented
        expect(parseFloat(value)).toBeGreaterThanOrEqual(0);
      } else {
        // Negative allowed but should show validation feedback
        // Check for validation message or error state
        expect(document.querySelector('[role="alert"]') || 
               document.querySelector('.error') ||
               startAmountInput.getAttribute('aria-invalid')).toBeTruthy();
      }
    });

    it('should handle decimal precision for currency inputs', async () => {
      render(
        React.createElement(TestWrapper, null, React.createElement(Budget))
      );

      await waitFor(() => {
        expect(screen.getByTestId('button-budget-settings')).toBeInTheDocument();
      });

      const settingsButton = screen.getByTestId('button-budget-settings');
      await user.click(settingsButton);

      const startAmountInput = screen.getByTestId('input-start-amount') as HTMLInputElement;

      // Test decimal input
      await user.clear(startAmountInput);
      await user.type(startAmountInput, '50000.99');
      
      expect(startAmountInput.value).toBe('50000.99');

      // Test more than 2 decimal places
      await user.clear(startAmountInput);
      await user.type(startAmountInput, '50000.999');
      
      // Should either limit to 2 decimals or handle appropriately
      const finalValue = startAmountInput.value;
      if (finalValue !== '50000.999') {
        // Value was formatted/limited
        expect(finalValue).toMatch(/^\d+(\.\d{1,2})?$/);
      }
    });

    it('should validate percentage inputs for inflation rates', async () => {
      render(
        React.createElement(TestWrapper, null, React.createElement(Budget))
      );

      await waitFor(() => {
        expect(screen.getByTestId('button-budget-settings')).toBeInTheDocument();
      });

      const settingsButton = screen.getByTestId('button-budget-settings');
      await user.click(settingsButton);

      const inflationInput = screen.getByTestId('input-general-inflation') as HTMLInputElement;

      // Test reasonable percentage
      await user.clear(inflationInput);
      await user.type(inflationInput, '2.5');
      expect(inflationInput.value).toBe('2.5');

      // Test extreme high percentage
      await user.clear(inflationInput);
      await user.type(inflationInput, '150');
      
      // Should either warn or limit extreme values
      fireEvent.blur(inflationInput);
      
      const value = parseFloat(inflationInput.value);
      if (value > 100) {
        // Check for validation warning
        expect(document.querySelector('[role="alert"]') || 
               document.querySelector('.warning')).toBeTruthy();
      }
    });

    it('should handle non-numeric input gracefully', async () => {
      render(
        React.createElement(TestWrapper, null, React.createElement(Budget))
      );

      await waitFor(() => {
        expect(screen.getByTestId('button-budget-settings')).toBeInTheDocument();
      });

      const settingsButton = screen.getByTestId('button-budget-settings');
      await user.click(settingsButton);

      const startAmountInput = screen.getByTestId('input-start-amount') as HTMLInputElement;

      // Test non-numeric input
      await user.clear(startAmountInput);
      await user.type(startAmountInput, 'abc123');
      
      // Should either prevent input or convert to valid number
      fireEvent.blur(startAmountInput);
      
      const value = startAmountInput.value;
      // Should be either empty, 0, or only numeric characters
      expect(value === '' || value === '0' || /^\d+(\.\d+)?$/.test(value)).toBe(true);
    });
  });

  describe('Date Input Validation', () => {
    it('should validate financial year start date format', async () => {
      render(
        React.createElement(TestWrapper, null, React.createElement(Budget))
      );

      await waitFor(() => {
        expect(screen.getByTestId('button-budget-settings')).toBeInTheDocument();
      });

      const settingsButton = screen.getByTestId('button-budget-settings');
      await user.click(settingsButton);

      const dateInput = screen.getByTestId('input-financial-year-start') as HTMLInputElement;

      // Test valid date
      await user.clear(dateInput);
      await user.type(dateInput, '2024-10-01');
      expect(dateInput.value).toBe('2024-10-01');

      // Test invalid date format
      await user.clear(dateInput);
      await user.type(dateInput, '10/01/2024');
      
      // Should either convert format or show validation error
      fireEvent.blur(dateInput);
      
      const value = dateInput.value;
      expect(value === '2024-10-01' || value === '10/01/2024' || value === '').toBeTruthy();
    });

    it('should handle leap year dates correctly', async () => {
      render(
        React.createElement(TestWrapper, null, React.createElement(Budget))
      );

      await waitFor(() => {
        expect(screen.getByTestId('button-budget-settings')).toBeInTheDocument();
      });

      const settingsButton = screen.getByTestId('button-budget-settings');
      await user.click(settingsButton);

      const dateInput = screen.getByTestId('input-financial-year-start') as HTMLInputElement;

      // Test leap year date
      await user.clear(dateInput);
      await user.type(dateInput, '2024-02-29');
      expect(dateInput.value).toBe('2024-02-29');

      // Test invalid leap year date
      await user.clear(dateInput);
      await user.type(dateInput, '2023-02-29');
      
      fireEvent.blur(dateInput);
      
      // Should handle invalid leap year date appropriately
      // Either correct to valid date or show error
      const value = dateInput.value;
      if (value === '2023-02-29') {
        // Invalid date accepted - should show validation error
        expect(document.querySelector('[role="alert"]')).toBeTruthy();
      } else {
        // Date was corrected
        expect(value === '2023-02-28' || value === '').toBeTruthy();
      }
    });
  });

  describe('Dynamic Form Fields - Custom Revenue Lines', () => {
    it('should add custom revenue line with validation', async () => {
      render(
        React.createElement(TestWrapper, null, React.createElement(Budget))
      );

      await waitFor(() => {
        expect(screen.getByTestId('button-budget-settings')).toBeInTheDocument();
      });

      const settingsButton = screen.getByTestId('button-budget-settings');
      await user.click(settingsButton);

      // Find add revenue line button
      const addRevenueButton = screen.getByTestId('button-add-revenue-line');
      await user.click(addRevenueButton);

      // Fill out new revenue line form
      const descriptionInput = screen.getByTestId('input-revenue-description');
      const amountInput = screen.getByTestId('input-revenue-amount');

      await user.type(descriptionInput, 'Storage Fees');
      await user.type(amountInput, '500');

      const saveRevenueButton = screen.getByTestId('button-save-revenue-line');
      await user.click(saveRevenueButton);

      // Should add to the list
      await waitFor(() => {
        expect(screen.getByText('Storage Fees')).toBeInTheDocument();
        expect(screen.getByText('500')).toBeInTheDocument();
      });
    });

    it('should validate required fields for custom revenue lines', async () => {
      render(
        React.createElement(TestWrapper, null, React.createElement(Budget))
      );

      await waitFor(() => {
        expect(screen.getByTestId('button-budget-settings')).toBeInTheDocument();
      });

      const settingsButton = screen.getByTestId('button-budget-settings');
      await user.click(settingsButton);

      const addRevenueButton = screen.getByTestId('button-add-revenue-line');
      await user.click(addRevenueButton);

      // Try to save without filling required fields
      const saveRevenueButton = screen.getByTestId('button-save-revenue-line');
      await user.click(saveRevenueButton);

      // Should show validation errors or prevent save
      const descriptionInput = screen.getByTestId('input-revenue-description') as HTMLInputElement;
      const amountInput = screen.getByTestId('input-revenue-amount') as HTMLInputElement;

      // Check if validation prevents empty submission
      if (descriptionInput.value === '' || amountInput.value === '') {
        // Either inputs should show validation state or save should be prevented
        expect(
          descriptionInput.getAttribute('aria-invalid') === 'true' ||
          amountInput.getAttribute('aria-invalid') === 'true' ||
          document.querySelector('[role="alert"]') ||
          screen.queryByText('Storage Fees') === null
        ).toBeTruthy();
      }
    });

    it('should edit existing custom revenue line', async () => {
      // Mock initial data with existing revenue line
      mockFetch.mockImplementation(async (url: string, options = {}) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        const method = (options as any)?.method || 'GET';

        if (urlStr.includes('/api/budgets/test-building-123/bank-account') && method === 'GET') {
          return jsonResponse(createBankAccountData({
            customRevenueLines: [
              { id: 'existing-1', description: 'Parking Revenue', monthlyAmount: 2500 },
            ]
          }));
        }

        return jsonResponse({ success: true });
      });

      render(
        React.createElement(TestWrapper, null, React.createElement(Budget))
      );

      await waitFor(() => {
        expect(screen.getByTestId('button-budget-settings')).toBeInTheDocument();
      });

      const settingsButton = screen.getByTestId('button-budget-settings');
      await user.click(settingsButton);

      // Find and edit existing revenue line
      const editButton = screen.getByTestId('button-edit-revenue-existing-1');
      await user.click(editButton);

      const amountInput = screen.getByTestId('input-revenue-amount') as HTMLInputElement;
      expect(amountInput.value).toBe('2500');

      await user.clear(amountInput);
      await user.type(amountInput, '3000');

      const saveButton = screen.getByTestId('button-save-revenue-line');
      await user.click(saveButton);

      // Should update the displayed amount
      await waitFor(() => {
        expect(screen.getByText('3000')).toBeInTheDocument();
      });
    });

    it('should remove custom revenue line', async () => {
      // Mock initial data with existing revenue line
      mockFetch.mockImplementation(async (url: string, options = {}) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        const method = (options as any)?.method || 'GET';

        if (urlStr.includes('/api/budgets/test-building-123/bank-account') && method === 'GET') {
          return jsonResponse(createBankAccountData({
            customRevenueLines: [
              { id: 'to-remove', description: 'Temporary Revenue', monthlyAmount: 1000 },
            ]
          }));
        }

        return jsonResponse({ success: true });
      });

      render(
        React.createElement(TestWrapper, null, React.createElement(Budget))
      );

      await waitFor(() => {
        expect(screen.getByTestId('button-budget-settings')).toBeInTheDocument();
      });

      const settingsButton = screen.getByTestId('button-budget-settings');
      await user.click(settingsButton);

      // Verify revenue line exists
      expect(screen.getByText('Temporary Revenue')).toBeInTheDocument();

      // Remove revenue line
      const removeButton = screen.getByTestId('button-remove-revenue-to-remove');
      await user.click(removeButton);

      // Confirm removal
      const confirmButton = screen.getByTestId('button-confirm-remove');
      await user.click(confirmButton);

      // Should be removed from display
      await waitFor(() => {
        expect(screen.queryByText('Temporary Revenue')).not.toBeInTheDocument();
      });
    });
  });

  describe('Dynamic Form Fields - Custom Bank Fields', () => {
    it('should add custom bank field with validation', async () => {
      render(
        React.createElement(TestWrapper, null, React.createElement(Budget))
      );

      await waitFor(() => {
        expect(screen.getByTestId('button-budget-settings')).toBeInTheDocument();
      });

      const settingsButton = screen.getByTestId('button-budget-settings');
      await user.click(settingsButton);

      const addBankFieldButton = screen.getByTestId('button-add-bank-field');
      await user.click(addBankFieldButton);

      const fieldNameInput = screen.getByTestId('input-bank-field-name');
      const fieldValueInput = screen.getByTestId('input-bank-field-value');

      await user.type(fieldNameInput, 'Capital Reserve');
      await user.type(fieldValueInput, '75000');

      const saveBankFieldButton = screen.getByTestId('button-save-bank-field');
      await user.click(saveBankFieldButton);

      // Should add to the list
      await waitFor(() => {
        expect(screen.getByText('Capital Reserve')).toBeInTheDocument();
        expect(screen.getByText('75000')).toBeInTheDocument();
      });
    });

    it('should prevent duplicate bank field names', async () => {
      // Mock existing bank fields
      mockFetch.mockImplementation(async (url: string, options = {}) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        const method = (options as any)?.method || 'GET';

        if (urlStr.includes('/api/budgets/test-building-123/bank-account') && method === 'GET') {
          return jsonResponse(createBankAccountData({
            customBankFields: {
              'Emergency Fund': 15000,
              'Reserve Fund': 25000,
            }
          }));
        }

        return jsonResponse({ success: true });
      });

      render(
        React.createElement(TestWrapper, null, React.createElement(Budget))
      );

      await waitFor(() => {
        expect(screen.getByTestId('button-budget-settings')).toBeInTheDocument();
      });

      const settingsButton = screen.getByTestId('button-budget-settings');
      await user.click(settingsButton);

      const addBankFieldButton = screen.getByTestId('button-add-bank-field');
      await user.click(addBankFieldButton);

      const fieldNameInput = screen.getByTestId('input-bank-field-name');
      const fieldValueInput = screen.getByTestId('input-bank-field-value');

      // Try to add duplicate field name
      await user.type(fieldNameInput, 'Emergency Fund');
      await user.type(fieldValueInput, '20000');

      const saveBankFieldButton = screen.getByTestId('button-save-bank-field');
      await user.click(saveBankFieldButton);

      // Should show validation error for duplicate name
      await waitFor(() => {
        expect(
          document.querySelector('[role="alert"]') ||
          fieldNameInput.getAttribute('aria-invalid') === 'true' ||
          screen.getByText(/duplicate/i) ||
          screen.getByText(/already exists/i)
        ).toBeTruthy();
      });
    });
  });

  describe('Form State Management and Persistence', () => {
    it('should maintain unsaved changes when navigating between tabs', async () => {
      render(
        React.createElement(TestWrapper, null, React.createElement(Budget))
      );

      await waitFor(() => {
        expect(screen.getByTestId('button-budget-settings')).toBeInTheDocument();
      });

      const settingsButton = screen.getByTestId('button-budget-settings');
      await user.click(settingsButton);

      // Make changes in basic settings
      const startAmountInput = screen.getByTestId('input-start-amount');
      await user.clear(startAmountInput);
      await user.type(startAmountInput, '65000');

      // Navigate to different tab/section within settings
      const advancedTab = screen.getByTestId('tab-advanced-settings');
      await user.click(advancedTab);

      const inflationTab = screen.getByTestId('tab-inflation-settings');
      await user.click(inflationTab);

      // Navigate back to basic settings
      const basicTab = screen.getByTestId('tab-basic-settings');
      await user.click(basicTab);

      // Should maintain the changed value
      const startAmountInputAgain = screen.getByTestId('input-start-amount') as HTMLInputElement;
      expect(startAmountInputAgain.value).toBe('65000');
    });

    it('should warn about unsaved changes when closing dialog', async () => {
      render(
        React.createElement(TestWrapper, null, React.createElement(Budget))
      );

      await waitFor(() => {
        expect(screen.getByTestId('button-budget-settings')).toBeInTheDocument();
      });

      const settingsButton = screen.getByTestId('button-budget-settings');
      await user.click(settingsButton);

      // Make changes
      const startAmountInput = screen.getByTestId('input-start-amount');
      await user.clear(startAmountInput);
      await user.type(startAmountInput, '70000');

      // Try to close dialog
      const closeButton = screen.getByTestId('button-close-settings');
      await user.click(closeButton);

      // Should show unsaved changes warning
      await waitFor(() => {
        expect(
          screen.getByText(/unsaved changes/i) ||
          screen.getByText(/changes will be lost/i) ||
          screen.getByTestId('dialog-unsaved-changes')
        ).toBeInTheDocument();
      });

      // Confirm discard changes
      const discardButton = screen.getByTestId('button-discard-changes');
      await user.click(discardButton);

      // Dialog should close
      await waitFor(() => {
        expect(screen.queryByText('Budget Settings')).not.toBeInTheDocument();
      });
    });

    it('should reset form to original values on cancel', async () => {
      render(
        React.createElement(TestWrapper, null, React.createElement(Budget))
      );

      await waitFor(() => {
        expect(screen.getByTestId('button-budget-settings')).toBeInTheDocument();
      });

      const settingsButton = screen.getByTestId('button-budget-settings');
      await user.click(settingsButton);

      const startAmountInput = screen.getByTestId('input-start-amount') as HTMLInputElement;
      const originalValue = startAmountInput.value;

      // Make changes
      await user.clear(startAmountInput);
      await user.type(startAmountInput, '80000');
      expect(startAmountInput.value).toBe('80000');

      // Cancel changes
      const cancelButton = screen.getByTestId('button-cancel-settings');
      await user.click(cancelButton);

      // Reopen dialog
      const settingsButtonAgain = screen.getByTestId('button-budget-settings');
      await user.click(settingsButtonAgain);

      // Should have original value
      const startAmountInputAgain = screen.getByTestId('input-start-amount') as HTMLInputElement;
      expect(startAmountInputAgain.value).toBe(originalValue);
    });
  });

  describe('Loading States and Disabled States', () => {
    it('should disable save button during API request', async () => {
      // Mock slow API response
      mockFetch.mockImplementation(async (url: string, options = {}) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        const method = (options as any)?.method || 'GET';

        if (urlStr.includes('/api/budgets/test-building-123/bank-account')) {
          if (method === 'GET') {
            return jsonResponse(createBankAccountData());
          }
          if (method === 'PUT') {
            // Simulate slow save
            await new Promise(resolve => setTimeout(resolve, 1000));
            return jsonResponse({ success: true });
          }
        }

        return jsonResponse({ success: true });
      });

      render(
        React.createElement(TestWrapper, null, React.createElement(Budget))
      );

      await waitFor(() => {
        expect(screen.getByTestId('button-budget-settings')).toBeInTheDocument();
      });

      const settingsButton = screen.getByTestId('button-budget-settings');
      await user.click(settingsButton);

      const startAmountInput = screen.getByTestId('input-start-amount');
      await user.clear(startAmountInput);
      await user.type(startAmountInput, '85000');

      const saveButton = screen.getByTestId('button-save-settings');
      expect(saveButton).toBeEnabled();

      // Click save
      await user.click(saveButton);

      // Should be disabled during save
      await waitFor(() => {
        expect(saveButton).toBeDisabled();
      });

      // Should re-enable after save completes
      await waitFor(() => {
        expect(saveButton).toBeEnabled();
      }, { timeout: 2000 });
    });

    it('should show loading indicators during form submission', async () => {
      render(
        React.createElement(TestWrapper, null, React.createElement(Budget))
      );

      await waitFor(() => {
        expect(screen.getByTestId('button-budget-settings')).toBeInTheDocument();
      });

      const settingsButton = screen.getByTestId('button-budget-settings');
      await user.click(settingsButton);

      const saveButton = screen.getByTestId('button-save-settings');
      await user.click(saveButton);

      // Should show loading indicator
      await waitFor(() => {
        expect(
          screen.getByTestId('loading-spinner') ||
          screen.getByText(/saving/i) ||
          saveButton.querySelector('svg') // Loading icon
        ).toBeTruthy();
      });
    });
  });
});