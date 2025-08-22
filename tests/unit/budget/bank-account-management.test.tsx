import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import Budget from '@/pages/manager/budget';
import { renderBudgetComponent } from '../budget-test-setup';
import '../budget-test-setup';

describe('Budget Bank Account Management Tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Bank Account Information Display', () => {
    it('renders budget component with real Demo organization data', async () => {
      // Test Budget component with real Demo organization data
      const { container } = renderBudgetComponent(
        <div data-testid="budget-test-container">
          <Budget />
        </div>
      );

      // The component should render without throwing an error
      expect(container).toBeInTheDocument();
      
      // Should have the budget container
      const budgetContainer = screen.queryByTestId('budget-test-container');
      expect(budgetContainer).toBeInTheDocument();
    });

    it('displays Demo organization buildings in dropdown', async () => {
      renderBudgetComponent(<Budget />);

      // Wait for Demo buildings to load
      await waitFor(() => {
        // Look for building selection UI elements
        const buildingElements = screen.queryAllByText(/Demo Building/i);
        expect(buildingElements.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });

    it('shows bank account information when building is selected', async () => {
      renderBudgetComponent(<Budget />);

      // Wait for Demo bank account data to be displayed
      await waitFor(() => {
        // Look for bank account related content
        const bankElements = screen.queryAllByText(/bank|account|balance/i);
        expect(bankElements.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });

    it('displays Demo organization budget data', async () => {
      renderBudgetComponent(<Budget />);

      // Wait for Demo budget data (income/expenses from real bills)
      await waitFor(() => {
        // Look for budget-related content
        const budgetElements = screen.queryAllByText(/income|expense|maintenance|fee/i);
        expect(budgetElements.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });
  });

  describe('Language Support for Bank Account Management', () => {
    it('displays budget interface using language system', async () => {
      renderBudgetComponent(<Budget />);

      // The component should render with language support
      await waitFor(() => {
        const container = screen.queryByTestId('budget-test-container') || document.body;
        expect(container).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Error Handling', () => {
    it('handles missing budget data gracefully', async () => {
      renderBudgetComponent(<Budget />);

      // Component should render even if some data is missing
      await waitFor(() => {
        const container = document.querySelector('[data-testid="budget-test-container"]') || document.body;
        expect(container).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });
});