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

// Enhanced useLanguage mock to prevent context errors
jest.mock('@/hooks/use-language', () => ({
  useLanguage: jest.fn(() => ({
    language: 'en' as const,
    setLanguage: jest.fn(),
    t: jest.fn((_key: string) => _key),
  })),
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

// Import real Demo organization data
import { 
  DEMO_ORG_ID, 
  getDemoBuildings, 
  getDemoBills, 
  getDemoOrganization,
  getDemoUsers 
} from '../utils/demo-data-helpers';

// Create sample budget data for Demo buildings based on real bills
/**
 *
 * @param buildingId
  * @returns Function result.
*/
function createDemoBudgetData(buildingId: string) {
  const demoBills = getDemoBills();
  
  // Convert bills to budget income/expense structure
  const expenses = demoBills.map(bill => ({
    id: bill.id,
    buildingId,
    category: bill.category,
    description: `${bill.category} - ${bill.billNumber}`,
    amount: bill.totalAmount,
    date: bill.startDate,
    type: 'expense' as const
  }));

  // Create some income entries for Demo buildings
  const income = [
    {
      id: 'demo-income-1',
      buildingId,
      category: 'monthly_fees',
      description: 'Monthly condo fees',
      amount: 15000,
      date: '2025-01-01',
      type: 'income' as const
    },
    {
      id: 'demo-income-2', 
      buildingId,
      category: 'parking_fees',
      description: 'Parking fees',
      amount: 2500,
      date: '2025-01-01',
      type: 'income' as const
    }
  ];

  return {
    income,
    expenses,
    bankAccount: {
      accountNumber: 'DEMO-123456789',
      bankName: 'Banque Démonstration',
      accountType: 'checking',
      balance: 75000,
      lastUpdated: '2025-01-01T00:00:00Z'
    },
    minimumBalances: {
      emergency: 50000,
      maintenance: 25000,
      administrative: 10000
    }
  };
}

// Generate residences for Demo buildings
/**
 *
 * @param buildingId
 * @param startUnit
 * @param count
 */
function createDemoResidences(buildingId: string, startUnit: number = 101, count: number = 5) {
  return Array.from({ length: count }, (_, i) => ({
    id: `demo-residence-${buildingId}-${i + 1}`,
    buildingId,
    unitNumber: String(startUnit + i),
    floor: Math.floor((startUnit + i - 101) / 10) + 1,
    squareFootage: 850 + (i * 50),
    bedrooms: 2,
    bathrooms: 1,
    parkingSpots: [`P-${startUnit + i}`],
    storageSpaces: [`S-${startUnit + i}`],
    isActive: true,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z')
  }));
}

// Create a query client that uses real Demo organization data
export const createBudgetTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { 
      retry: false,
      queryFn: async ({ queryKey }) => {
        const url = Array.isArray(queryKey) ? queryKey[0] : queryKey;
        
        // Return real Demo organization data based on URL
        if (url === '/api/buildings') {
          return getDemoBuildings();
        }
        
        if (typeof url === 'string' && url.includes('/api/budgets/')) {
          // Extract building ID for budget queries
          const buildingId = url.split('/api/budgets/')[1]?.split('/')[0];
          
          if (url.includes('/summary')) {
            const budgetData = createDemoBudgetData(buildingId || 'demo-building-1');
            const totalIncome = budgetData.income.reduce((sum, item) => sum + item.amount, 0);
            const totalExpenses = budgetData.expenses.reduce((sum, item) => sum + item.amount, 0);
            
            return {
              totalIncome,
              totalExpenses,
              netCashFlow: totalIncome - totalExpenses,
              specialContributions: totalIncome - totalExpenses < 0 ? [
                {
                  id: 'special-1',
                  description: 'Emergency assessment',
                  amount: Math.abs(totalIncome - totalExpenses),
                  perUnit: Math.abs(totalIncome - totalExpenses) / 5
                }
              ] : []
            };
          }
          
          if (url.includes('/bank-account')) {
            return createDemoBudgetData(buildingId || 'demo-building-1').bankAccount;
          }
          
          return createDemoBudgetData(buildingId || 'demo-building-1');
        }
        
        if (typeof url === 'string' && url.includes('/api/residences')) {
          // Parse building ID from query parameters if present
          const urlObj = new URL(url, 'http://localhost');
          const buildingId = urlObj.searchParams.get('buildingId');
          
          if (buildingId) {
            return createDemoResidences(buildingId);
          }
          
          // Return all residences for all Demo buildings
          const buildings = getDemoBuildings();
          return buildings.flatMap((building, _index) => 
            createDemoResidences(building.id, 101 + (_index * 100), 5)
          );
        }
        
        // Default empty responses for other endpoints
        return null;
      },
    },
    mutations: { retry: false },
  },
});

// Create proper LanguageContext mock
import { createContext } from 'react';

const MockLanguageContext = createContext({
  language: 'en' as const,
  setLanguage: jest.fn(),
  t: jest.fn((_key: string) => _key),
});

// Mock LanguageProvider for tests
const MockLanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <MockLanguageContext.Provider value={{
      language: 'en' as const,
      setLanguage: jest.fn(),
      t: jest.fn((_key: string) => _key),
    }}>
      {children}
    </MockLanguageContext.Provider>
  );
};

// Helper function to render Budget component with all required setup
export const renderBudgetComponent = (component: React.ReactElement) => {
  const queryClient = createBudgetTestQueryClient();
  
  return render(
    <QueryClientProvider client={queryClient}>
      <MockLanguageProvider>
        {component}
      </MockLanguageProvider>
    </QueryClientProvider>
  );
};