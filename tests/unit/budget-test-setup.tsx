import React from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TestProviders } from '../utils/test-providers';

// Mock all the dependencies that Budget component needs
jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
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
  }),
}));

jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    language: 'en',
    setLanguage: jest.fn(),
    t: jest.fn((key: string) => key),
  }),
}));

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

// Mock all the Lucide React icons used in Budget
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

// Create a query client with proper defaults for Budget component
export const createBudgetTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { 
      retry: false,
      queryFn: async ({ queryKey }) => {
        const url = Array.isArray(queryKey) ? queryKey[0] : queryKey;
        
        // Mock API responses based on URL
        if (url === '/api/buildings') {
          return [{
            id: 'building-1',
            name: 'Test Building',
            address: '123 Test St',
            city: 'Test City',
            organizationId: 'org-1',
            isActive: true
          }];
        }
        
        if (typeof url === 'string' && url.includes('/api/budgets/')) {
          return {
            income: [],
            expenses: [],
            bankAccount: {
              accountNumber: '9876543210',
              bankName: 'Test Bank',
              balance: 50000
            },
            minimumBalances: {}
          };
        }
        
        if (typeof url === 'string' && url.includes('/api/residences')) {
          return [];
        }
        
        return {};
      },
    },
    mutations: { retry: false },
  },
});

// Helper function to render Budget component with all required setup
export const renderBudgetComponent = (component: React.ReactElement) => {
  const queryClient = createBudgetTestQueryClient();
  
  return render(
    <QueryClientProvider client={queryClient}>
      <TestProviders>
        {component}
      </TestProviders>
    </QueryClientProvider>
  );
};