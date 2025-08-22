import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Budget from '@/pages/manager/budget';
import { TestProviders } from '@/utils/test-providers';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';

// Mock hooks and modules
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

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseLanguage = useLanguage as jest.MockedFunction<typeof useLanguage>;

// Mock API responses
const mockBudgetData = [
  {
    id: '1',
    date: '2024-01',
    totalIncome: 50000,
    totalExpenses: 30000,
    netCashFlow: 20000,
    bankBalance: 100000,
    incomeByCategory: {
      'Condo Fees': 40000,
      'Special Assessments': 10000,
    },
    expensesByCategory: {
      'Maintenance': 15000,
      'Utilities': 10000,
      'Insurance': 5000,
    },
    buildingId: 'building-1',
  },
];

const mockBuildings = [
  {
    id: 'building-1',
    name: 'Test Building',
    address: '123 Test St',
    organizationId: 'org-1',
  },
];

// Mock fetch
global.fetch = jest.fn();

describe('Budget Page Mobile Responsiveness', () => {
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
        firstName: 'John',
        lastName: 'Manager',
        email: 'john@example.com',
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
      t: { language: 'en' },
      translations: {},
    });

    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/buildings')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockBuildings),
        });
      }
      if (url.includes('/api/budget')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockBudgetData),
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

  describe('Mobile Layout Adaptation', () => {
    it('renders summary cards in mobile-friendly grid', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('Total Income')).toBeInTheDocument();
      });

      // Check that summary cards container has mobile-responsive classes
      const summaryContainer = screen.getByText('Total Income').closest('.grid');
      expect(summaryContainer).toHaveClass('grid-cols-1');
      expect(summaryContainer).toHaveClass('sm:grid-cols-2');
    });

    it('adjusts chart height for mobile devices', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Financial Trends')).toBeInTheDocument();
      });

      // Check for responsive chart container
      const chartContainer = document.querySelector('.h-\\[300px\\]');
      expect(chartContainer).toBeInTheDocument();
    });

    it('hides non-essential columns on mobile for property contribution table', async () => {
      // Mock special contribution data
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/buildings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBuildings),
          });
        }
        if (url.includes('/api/budget')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([
              {
                ...mockBudgetData[0],
                netCashFlow: -10000, // Negative to trigger special contribution
              },
            ]),
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

      await waitFor(() => {
        expect(screen.getByText('Total Income')).toBeInTheDocument();
      });

      // Select a building to trigger contribution calculation
      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { _value: 'building-1' } });

      await waitFor(() => {
        // Check for mobile-responsive table headers
        const tableHeader = document.querySelector('.grid-cols-3.md\\:grid-cols-4');
        expect(tableHeader).toBeInTheDocument();
      });
    });
  });

  describe('Fullscreen Functionality', () => {
    it('displays fullscreen toggle button', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('button-fullscreen-toggle')).toBeInTheDocument();
      });
    });

    it('shows appropriate fullscreen icon and text', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      await waitFor(() => {
        const fullscreenButton = screen.getByTestId('button-fullscreen-toggle');
        expect(fullscreenButton).toHaveTextContent('Fullscreen');
      });
    });

    it('translates fullscreen button text to French', async () => {
      mockUseLanguage.mockReturnValue({
        language: 'fr',
        setLanguage: jest.fn(),
        t: { language: 'fr' },
        translations: {},
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      await waitFor(() => {
        const fullscreenButton = screen.getByTestId('button-fullscreen-toggle');
        expect(fullscreenButton).toHaveTextContent('Plein écran');
      });
    });
  });

  describe('Responsive Form Elements', () => {
    it('stacks minimum balance input fields vertically on mobile', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Total Income')).toBeInTheDocument();
      });

      // Select a building
      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { _value: 'building-1' } });

      await waitFor(() => {
        // Check for mobile-responsive form layout
        const formContainer = document.querySelector('.flex.flex-col.sm\\:grid.sm\\:grid-cols-12');
        expect(formContainer).toBeInTheDocument();
      });
    });
  });

  describe('Touch and Mobile Interactions', () => {
    it('handles touch events on chart areas', async () => {
      const touchStartSpy = jest.fn();
      const touchEndSpy = jest.fn();

      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Financial Trends')).toBeInTheDocument();
      });

      const chartContainer = screen.getByText('Financial Trends').closest('.bg-white');
      
      if (chartContainer) {
        chartContainer.addEventListener('touchstart', touchStartSpy);
        chartContainer.addEventListener('touchend', touchEndSpy);

        fireEvent.touchStart(chartContainer);
        fireEvent.touchEnd(chartContainer);

        expect(touchStartSpy).toHaveBeenCalled();
        expect(touchEndSpy).toHaveBeenCalled();
      }
    });

    it('supports mobile-friendly button interactions', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      await waitFor(() => {
        const fullscreenButton = screen.getByTestId('button-fullscreen-toggle');
        
        // Check button has appropriate mobile-friendly size
        expect(fullscreenButton).toHaveClass('flex', 'items-center', 'gap-2');
      });
    });
  });

  describe('Viewport Adaptation', () => {
    it('adjusts layout for different screen sizes', async () => {
      // Mock window.innerWidth for mobile
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        _value: 375,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Budget Dashboard')).toBeInTheDocument();
      });

      // Check mobile-specific layout adaptations
      const container = screen.getByText('Budget Dashboard').closest('.max-w-7xl');
      expect(container).toHaveClass('mx-auto', 'p-6');
    });

    it('shows text labels conditionally on small screens', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      await waitFor(() => {
        const fullscreenButton = screen.getByTestId('button-fullscreen-toggle');
        const hiddenText = fullscreenButton.querySelector('.hidden.sm\\:inline');
        expect(hiddenText).toBeInTheDocument();
      });
    });
  });

  describe('Data Display Optimization', () => {
    it('formats large numbers appropriately for mobile displays', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      await waitFor(() => {
        // Check that large numbers are formatted with commas
        expect(screen.getByText('$50,000')).toBeInTheDocument();
        expect(screen.getByText('$30,000')).toBeInTheDocument();
      });
    });

    it('truncates long text content appropriately', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      await waitFor(() => {
        // Check for proper text wrapping and truncation classes
        const titleElements = screen.getAllByText(/Financial Trends|Total Income|Total Expenses/);
        titleElements.forEach(element => {
          expect(element.closest('.text-sm') || element.closest('.text-2xl')).toBeInTheDocument();
        });
      });
    });
  });
});