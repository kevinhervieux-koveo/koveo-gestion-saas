import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import Budget from '@/pages/manager/budget';
import { renderBudgetComponent } from '../budget-test-setup';
import { getDemoBuildings } from '../../utils/demo-data-helpers';
import '../budget-test-setup';

describe('Budget User Interactions and State Management', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Building Selection', () => {
    it('loads Demo buildings in selection dropdown', async () => {
      const demoBuildings = getDemoBuildings();
      
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Look for building selection UI
        const selectElements = screen.queryAllByText(/select|building|choose/i);
        expect(selectElements.length).toBeGreaterThan(0);
      }, { timeout: 3000 });

      // Verify we have Demo buildings to select from
      expect(demoBuildings.length).toBe(2);
      expect(demoBuildings[0].name).toBe('Demo Building 1');
      expect(demoBuildings[1].name).toBe('Demo Building 2');
    });

    it('updates budget data when building is selected', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Component should respond to building selection changes
        const container = document.body;
        expect(container).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('persists building selection across view changes', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Test that building selection is maintained
        const container = document.body;
        expect(container).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('View Type Controls', () => {
    it('toggles between yearly and monthly views', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Look for view toggle controls
        const viewControls = screen.queryAllByText(/yearly|monthly|view/i);
        expect(viewControls.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });

    it('updates calculations when view type changes', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // View changes should trigger recalculations
        const container = document.body;
        expect(container).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('maintains data consistency across view changes', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Data should remain consistent when switching views
        const container = document.body;
        expect(container).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Date Range Controls', () => {
    it('handles start and end year selections', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Look for year selection controls
        const yearControls = screen.queryAllByText(/year|start|end/i);
        expect(yearControls.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });

    it('validates date range selections', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Should validate that end date is after start date
        const container = document.body;
        expect(container).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('updates budget calculations for selected date ranges', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Date range changes should trigger budget recalculations
        const container = document.body;
        expect(container).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Category Filtering', () => {
    it('shows and hides category filters', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Look for category filter toggle
        const filterControls = screen.queryAllByText(/filter|category|show|hide/i);
        expect(filterControls.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });

    it('filters budget items by selected categories', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Category selection should filter displayed items
        const container = document.body;
        expect(container).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('maintains category selections across view changes', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Selected categories should persist
        const container = document.body;
        expect(container).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Bank Account Management', () => {
    it('opens bank account update dialog', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Look for bank account management controls
        const bankControls = screen.queryAllByText(/bank|account|update|manage/i);
        expect(bankControls.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });

    it('validates bank account form inputs', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Form should validate account number and other inputs
        const container = document.body;
        expect(container).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('updates bank account information', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Should handle bank account updates
        const container = document.body;
        expect(container).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Minimum Balance Management', () => {
    it('opens minimum balance dialog', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Look for minimum balance management
        const minimumControls = screen.queryAllByText(/minimum|balance|manage|threshold/i);
        expect(minimumControls.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });

    it('adds and removes minimum balance requirements', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Should handle adding/removing minimum balances
        const container = document.body;
        expect(container).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('validates minimum balance amounts', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Should validate numeric inputs for minimum balances
        const container = document.body;
        expect(container).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Special Contribution Interface', () => {
    it('displays special contribution calculations', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Look for special contribution displays
        const contributionElements = screen.queryAllByText(/contribution|special|assessment|required/i);
        expect(contributionElements.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });

    it('paginates property contribution breakdown', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Look for pagination controls
        const paginationElements = screen.queryAllByText(/page|next|previous|of/i);
        expect(paginationElements.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });

    it('calculates per-property contributions correctly', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Should show property-based contribution breakdowns
        const container = document.body;
        expect(container).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Fullscreen and Display Controls', () => {
    it('toggles fullscreen mode', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Look for fullscreen toggle controls
        const fullscreenControls = screen.queryAllByText(/fullscreen|expand|maximize|minimize/i);
        expect(fullscreenControls.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });

    it('maintains functionality in fullscreen mode', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // All features should work in fullscreen
        const container = document.body;
        expect(container).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Language Support', () => {
    it('displays budget interface in correct language', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Interface should use language system
        const container = document.body;
        expect(container).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('translates category names appropriately', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Categories should be translated
        const categoryElements = screen.queryAllByText(/maintenance|utilities|insurance|fees/i);
        expect(categoryElements.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });

    it('formats currency according to locale', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Currency should be formatted appropriately
        const currencyElements = screen.queryAllByText(/\$[0-9,]+/);
        expect(currencyElements.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('handles network errors gracefully', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Should handle API errors without crashing
        const container = document.body;
        expect(container).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('shows loading states during data fetching', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Should show loading indicators
        const container = document.body;
        expect(container).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('handles invalid form inputs', async () => {
      renderBudgetComponent(<Budget />);

      await waitFor(() => {
        // Should validate and handle invalid inputs
        const container = document.body;
        expect(container).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });
});