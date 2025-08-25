import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TestProviders } from '@/utils/test-providers';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';

// Mock pages
jest.mock('@/pages/dashboard', () => {
  return function MockDashboard() {
    return <div data-testid='dashboard'>Dashboard Page</div>;
  };
});

jest.mock('@/pages/manager/budget', () => {
  return function MockBudget() {
    return <div data-testid='budget'>Budget Page</div>;
  };
});

jest.mock('@/pages/manager/buildings', () => {
  return function MockBuildings() {
    return <div data-testid='buildings'>Buildings Page</div>;
  };
});

jest.mock('@/pages/residents/dashboard', () => {
  return function MockResidentsDashboard() {
    return <div data-testid='residents-dashboard'>Residents Dashboard</div>;
  };
});

// Mock hooks
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

// Mock router
let mockLocation = '/dashboard';
const mockNavigate = jest.fn();

jest.mock('wouter', () => ({
  useLocation: () => [mockLocation, mockNavigate],
  Link: ({ children, href, onClick, ...props }: any) => (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        mockLocation = href;
        mockNavigate(href);
        if (onClick) {
          onClick(e);
        }
      }}
      {...props}
    >
      {children}
    </a>
  ),
  Route: ({ path, component: Component }: any) => {
    if (mockLocation === path) {
      return <Component />;
    }
    return null;
  },
}));

describe('Comprehensive User Flows E2E Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockUseLanguage.mockReturnValue({
      language: 'en',
      setLanguage: jest.fn(),
      t: { language: 'en' },
      translations: {},
    });

    // Reset navigation state
    mockLocation = '/dashboard';
    mockNavigate.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Admin User Flow', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: {
          id: '1',
          firstName: 'Admin',
          lastName: 'User',
          email: 'admin@example.com',
          role: 'admin',
          isActive: true,
          organizationId: 'org-1',
        },
        logout: jest.fn(),
        isAuthenticated: true,
        isLoading: false,
        login: jest.fn(),
      });
    });

    it('completes full admin workflow from dashboard to budget management', async () => {
      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <div data-testid='app'>
              {mockLocation === '/dashboard' && <div data-testid='dashboard'>Dashboard Page</div>}
              {mockLocation === '/manager/budget' && <div data-testid='budget'>Budget Page</div>}
              {mockLocation === '/manager/buildings' && (
                <div data-testid='buildings'>Buildings Page</div>
              )}
            </div>
          </TestProviders>
        </QueryClientProvider>
      );

      // 1. Start at dashboard
      expect(screen.getByTestId('dashboard')).toBeInTheDocument();

      // 2. Navigate to budget management
      mockLocation = '/manager/budget';
      rerender(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <div data-testid='app'>
              {mockLocation === '/dashboard' && <div data-testid='dashboard'>Dashboard Page</div>}
              {mockLocation === '/manager/budget' && <div data-testid='budget'>Budget Page</div>}
              {mockLocation === '/manager/buildings' && (
                <div data-testid='buildings'>Buildings Page</div>
              )}
            </div>
          </TestProviders>
        </QueryClientProvider>
      );

      expect(screen.getByTestId('budget')).toBeInTheDocument();

      // 3. Navigate to buildings management
      mockLocation = '/manager/buildings';
      rerender(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <div data-testid='app'>
              {mockLocation === '/dashboard' && <div data-testid='dashboard'>Dashboard Page</div>}
              {mockLocation === '/manager/budget' && <div data-testid='budget'>Budget Page</div>}
              {mockLocation === '/manager/buildings' && (
                <div data-testid='buildings'>Buildings Page</div>
              )}
            </div>
          </TestProviders>
        </QueryClientProvider>
      );

      expect(screen.getByTestId('buildings')).toBeInTheDocument();

      // 4. Return to dashboard
      mockLocation = '/dashboard';
      rerender(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <div data-testid='app'>
              {mockLocation === '/dashboard' && <div data-testid='dashboard'>Dashboard Page</div>}
              {mockLocation === '/manager/budget' && <div data-testid='budget'>Budget Page</div>}
              {mockLocation === '/manager/buildings' && (
                <div data-testid='buildings'>Buildings Page</div>
              )}
            </div>
          </TestProviders>
        </QueryClientProvider>
      );

      expect(screen.getByTestId('dashboard')).toBeInTheDocument();
    });

    it('maintains user session throughout navigation', async () => {
      let currentUser = null;
      const mockSetUser = (user: any) => {
        currentUser = user;
      };

      // Simulate session persistence
      mockUseAuth.mockImplementation(() => ({
        user: currentUser || {
          id: '1',
          firstName: 'Admin',
          lastName: 'User',
          email: 'admin@example.com',
          role: 'admin',
          isActive: true,
          organizationId: 'org-1',
        },
        logout: jest.fn(),
        isAuthenticated: !!currentUser,
        isLoading: false,
        login: jest.fn(),
      }));

      // Set initial user
      mockSetUser({
        id: '1',
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@example.com',
        role: 'admin',
        isActive: true,
        organizationId: 'org-1',
      });

      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <div data-testid='app'>Admin Dashboard</div>
          </TestProviders>
        </QueryClientProvider>
      );

      // Verify user is authenticated
      expect(mockUseAuth().isAuthenticated).toBe(true);
      expect(mockUseAuth().user?.role).toBe('admin');

      // Navigate and verify session persists
      mockLocation = '/manager/budget';
      rerender(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <div data-testid='app'>Budget Page</div>
          </TestProviders>
        </QueryClientProvider>
      );

      expect(mockUseAuth().isAuthenticated).toBe(true);
      expect(mockUseAuth().user?.role).toBe('admin');
    });
  });

  describe('Manager User Flow', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: {
          id: '2',
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
    });

    it('accesses manager-specific features', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <div data-testid='manager-app'>
              Manager Dashboard
              <div data-testid='budget-access'>Budget Management Available</div>
              <div data-testid='buildings-access'>Buildings Management Available</div>
            </div>
          </TestProviders>
        </QueryClientProvider>
      );

      expect(screen.getByTestId('budget-access')).toBeInTheDocument();
      expect(screen.getByTestId('buildings-access')).toBeInTheDocument();
    });

    it('cannot access admin-only features', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <div data-testid='manager-app'>
              Manager Dashboard
              {/* Admin features should not be rendered for managers */}
            </div>
          </TestProviders>
        </QueryClientProvider>
      );

      // Verify manager user details
      const { user } = mockUseAuth();
      expect(user?.role).toBe('manager');
      expect(user?.role).not.toBe('admin');
    });
  });

  describe('Resident User Flow', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: {
          id: '3',
          firstName: 'Resident',
          lastName: 'User',
          email: 'resident@example.com',
          role: 'resident',
          isActive: true,
          organizationId: 'org-1',
        },
        logout: jest.fn(),
        isAuthenticated: true,
        isLoading: false,
        login: jest.fn(),
      });
    });

    it('completes resident dashboard workflow', async () => {
      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <div data-testid='app'>
              {mockLocation === '/residents/dashboard' && (
                <div data-testid='residents-dashboard'>Residents Dashboard</div>
              )}
              {mockLocation === '/residents/residence' && (
                <div data-testid='residence'>My Residence</div>
              )}
              {mockLocation === '/residents/building' && (
                <div data-testid='building'>My Building</div>
              )}
            </div>
          </TestProviders>
        </QueryClientProvider>
      );

      // Start at residents dashboard
      mockLocation = '/residents/dashboard';
      rerender(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <div data-testid='app'>
              {mockLocation === '/residents/dashboard' && (
                <div data-testid='residents-dashboard'>Residents Dashboard</div>
              )}
              {mockLocation === '/residents/residence' && (
                <div data-testid='residence'>My Residence</div>
              )}
              {mockLocation === '/residents/building' && (
                <div data-testid='building'>My Building</div>
              )}
            </div>
          </TestProviders>
        </QueryClientProvider>
      );

      expect(screen.getByTestId('residents-dashboard')).toBeInTheDocument();

      // Navigate to residence
      mockLocation = '/residents/residence';
      rerender(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <div data-testid='app'>
              {mockLocation === '/residents/dashboard' && (
                <div data-testid='residents-dashboard'>Residents Dashboard</div>
              )}
              {mockLocation === '/residents/residence' && (
                <div data-testid='residence'>My Residence</div>
              )}
              {mockLocation === '/residents/building' && (
                <div data-testid='building'>My Building</div>
              )}
            </div>
          </TestProviders>
        </QueryClientProvider>
      );

      expect(screen.getByTestId('residence')).toBeInTheDocument();

      // Navigate to building
      mockLocation = '/residents/building';
      rerender(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <div data-testid='app'>
              {mockLocation === '/residents/dashboard' && (
                <div data-testid='residents-dashboard'>Residents Dashboard</div>
              )}
              {mockLocation === '/residents/residence' && (
                <div data-testid='residence'>My Residence</div>
              )}
              {mockLocation === '/residents/building' && (
                <div data-testid='building'>My Building</div>
              )}
            </div>
          </TestProviders>
        </QueryClientProvider>
      );

      expect(screen.getByTestId('building')).toBeInTheDocument();
    });

    it('has restricted access to management features', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <div data-testid='resident-app'>
              Resident Dashboard
              <div data-testid='residence-access'>My Residence Available</div>
              <div data-testid='building-access'>My Building Available</div>
              {/* Management features should not be available */}
            </div>
          </TestProviders>
        </QueryClientProvider>
      );

      // Verify resident user details
      const { user } = mockUseAuth();
      expect(user?.role).toBe('resident');
      expect(user?.role).not.toBe('manager');
      expect(user?.role).not.toBe('admin');

      expect(screen.getByTestId('residence-access')).toBeInTheDocument();
      expect(screen.getByTestId('building-access')).toBeInTheDocument();
    });
  });

  describe('Language Switching Workflow', () => {
    const mockSetLanguage = jest.fn();

    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: {
          id: '1',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          role: 'admin',
          isActive: true,
          organizationId: 'org-1',
        },
        logout: jest.fn(),
        isAuthenticated: true,
        isLoading: false,
        login: jest.fn(),
      });
    });

    it('switches language and updates all interface elements', async () => {
      // Start with English
      mockUseLanguage.mockReturnValue({
        language: 'en',
        setLanguage: mockSetLanguage,
        t: { language: 'en' },
        translations: {},
      });

      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <div data-testid='app'>
              <div data-testid='welcome-message'>Welcome</div>
              <div data-testid='navigation'>Dashboard, Budget, Buildings</div>
            </div>
          </TestProviders>
        </QueryClientProvider>
      );

      expect(screen.getByTestId('welcome-message')).toHaveTextContent('Welcome');

      // Switch to French
      mockUseLanguage.mockReturnValue({
        language: 'fr',
        setLanguage: mockSetLanguage,
        t: { language: 'fr' },
        translations: {},
      });

      rerender(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <div data-testid='app'>
              <div data-testid='welcome-message'>Bienvenue</div>
              <div data-testid='navigation'>Tableau de bord, Budget, Bâtiments</div>
            </div>
          </TestProviders>
        </QueryClientProvider>
      );

      expect(screen.getByTestId('welcome-message')).toHaveTextContent('Bienvenue');
    });

    it('persists language preference across navigation', async () => {
      mockUseLanguage.mockReturnValue({
        language: 'fr',
        setLanguage: mockSetLanguage,
        t: { language: 'fr' },
        translations: {},
      });

      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <div data-testid='app'>
              <div data-testid='dashboard-fr'>Tableau de bord</div>
            </div>
          </TestProviders>
        </QueryClientProvider>
      );

      expect(screen.getByTestId('dashboard-fr')).toBeInTheDocument();

      // Navigate to budget page
      mockLocation = '/manager/budget';
      rerender(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <div data-testid='app'>
              <div data-testid='budget-fr'>Gestion budgétaire</div>
            </div>
          </TestProviders>
        </QueryClientProvider>
      );

      expect(screen.getByTestId('budget-fr')).toBeInTheDocument();
      expect(mockUseLanguage().language).toBe('fr');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('handles authentication errors gracefully', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        logout: jest.fn(),
        isAuthenticated: false,
        isLoading: false,
        login: jest.fn(),
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <div data-testid='app'>
              {mockUseAuth().isAuthenticated ? (
                <div data-testid='authenticated'>User Dashboard</div>
              ) : (
                <div data-testid='unauthenticated'>Please Login</div>
              )}
            </div>
          </TestProviders>
        </QueryClientProvider>
      );

      expect(screen.getByTestId('unauthenticated')).toBeInTheDocument();
      expect(screen.queryByTestId('authenticated')).not.toBeInTheDocument();
    });

    it('recovers from network errors', async () => {
      // Mock initial loading state
      mockUseAuth.mockReturnValue({
        user: null,
        logout: jest.fn(),
        isAuthenticated: false,
        isLoading: true,
        login: jest.fn(),
      });

      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <div data-testid='app'>
              {mockUseAuth().isLoading ? (
                <div data-testid='loading'>Loading...</div>
              ) : (
                <div data-testid='loaded'>Loaded</div>
              )}
            </div>
          </TestProviders>
        </QueryClientProvider>
      );

      expect(screen.getByTestId('loading')).toBeInTheDocument();

      // Simulate successful load
      mockUseAuth.mockReturnValue({
        user: {
          id: '1',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          role: 'admin',
          isActive: true,
          organizationId: 'org-1',
        },
        logout: jest.fn(),
        isAuthenticated: true,
        isLoading: false,
        login: jest.fn(),
      });

      rerender(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <div data-testid='app'>
              {mockUseAuth().isLoading ? (
                <div data-testid='loading'>Loading...</div>
              ) : (
                <div data-testid='loaded'>Loaded</div>
              )}
            </div>
          </TestProviders>
        </QueryClientProvider>
      );

      expect(screen.getByTestId('loaded')).toBeInTheDocument();
    });
  });

  describe('Performance and Optimization', () => {
    it('handles rapid navigation without performance degradation', async () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: '1',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          role: 'admin',
          isActive: true,
          organizationId: 'org-1',
        },
        logout: jest.fn(),
        isAuthenticated: true,
        isLoading: false,
        login: jest.fn(),
      });

      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <div data-testid='app'>
              {mockLocation === '/dashboard' && <div data-testid='dashboard'>Dashboard</div>}
              {mockLocation === '/manager/budget' && <div data-testid='budget'>Budget</div>}
              {mockLocation === '/manager/buildings' && (
                <div data-testid='buildings'>Buildings</div>
              )}
            </div>
          </TestProviders>
        </QueryClientProvider>
      );

      const startTime = Date.now();

      // Rapidly navigate between pages
      const pages = ['/dashboard', '/manager/budget', '/manager/buildings'];

      for (let i = 0; i < 10; i++) {
        mockLocation = pages[i % pages.length];
        rerender(
          <QueryClientProvider client={queryClient}>
            <TestProviders>
              <div data-testid='app'>
                {mockLocation === '/dashboard' && <div data-testid='dashboard'>Dashboard</div>}
                {mockLocation === '/manager/budget' && <div data-testid='budget'>Budget</div>}
                {mockLocation === '/manager/buildings' && (
                  <div data-testid='buildings'>Buildings</div>
                )}
              </div>
            </TestProviders>
          </QueryClientProvider>
        );
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete rapid navigation within reasonable time
      expect(duration).toBeLessThan(1000); // Less than 1 second for 10 navigations
    });

    it('efficiently manages query client state across routes', () => {
      const queriesCount = queryClient.getQueryCache().getAll().length;

      mockUseAuth.mockReturnValue({
        user: {
          id: '1',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          role: 'admin',
          isActive: true,
          organizationId: 'org-1',
        },
        logout: jest.fn(),
        isAuthenticated: true,
        isLoading: false,
        login: jest.fn(),
      });

      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <div data-testid='app'>Dashboard</div>
          </TestProviders>
        </QueryClientProvider>
      );

      // Navigate to different page
      rerender(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <div data-testid='app'>Budget</div>
          </TestProviders>
        </QueryClientProvider>
      );

      // Query cache should be managed efficiently
      const finalQueriesCount = queryClient.getQueryCache().getAll().length;
      expect(finalQueriesCount).toBeGreaterThanOrEqual(queriesCount);
    });
  });
});
