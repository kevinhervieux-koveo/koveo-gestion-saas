import { describe, it, expect, beforeEach } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/hooks/use-auth';
import { LanguageProvider } from '@/hooks/use-language';
import { MobileMenuProvider } from '@/hooks/use-mobile-menu';
import { TooltipProvider } from '@/components/ui/tooltip';
import Buildings from '@/pages/manager/buildings';
import Budget from '@/pages/manager/budget';
import Bills from '@/pages/manager/bills';

// Mock the API calls
const mockBuildings = [
  {
    id: '1',
    name: 'Test Building',
    address: '123 Test St',
    city: 'Montreal',
    province: 'QC',
    postalCode: 'H1H 1H1',
    buildingType: 'apartment',
    totalUnits: 10,
    organizationId: 'test-org',
    isActive: true,
  }
];

// Mock fetch
const mockFetch = (data: any) => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(data),
    })
  ) as jest.Mock;
};

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LanguageProvider>
          <AuthProvider>
            <MobileMenuProvider>
              <div className="h-full flex bg-gray-50 font-inter">
                {/* Simulate the app layout structure */}
                <div className="hidden md:block">
                  <div data-testid="sidebar" className="w-64 h-full bg-white">Sidebar</div>
                </div>
                <div className="flex-1 flex flex-col min-w-0">
                  {children}
                </div>
              </div>
            </MobileMenuProvider>
          </AuthProvider>
        </LanguageProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

describe('Sidebar Layout Consistency Tests', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('Buildings Page Layout', () => {
    it('should maintain sidebar when buildings page renders', async () => {
      mockFetch(mockBuildings);

      render(
        <TestWrapper>
          <Buildings />
        </TestWrapper>
      );

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      });

      // Check that the buildings page content is rendered
      await waitFor(() => {
        expect(screen.getByText('Buildings')).toBeInTheDocument();
      });

      // Verify sidebar is still present
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    });

    it('should have consistent layout classes with other manager pages', async () => {
      mockFetch(mockBuildings);

      const { container } = render(
        <TestWrapper>
          <Buildings />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Buildings')).toBeInTheDocument();
      });

      // Check for the main layout container
      const mainContainer = container.querySelector('.flex-1.flex.flex-col.overflow-hidden');
      expect(mainContainer).toBeInTheDocument();

      // Check for the content area
      const contentArea = container.querySelector('.flex-1.overflow-auto');
      expect(contentArea).toBeInTheDocument();
    });
  });

  describe('Page Layout Comparison', () => {
    it('should have same layout structure as budget page', async () => {
      mockFetch([]);
      
      const buildingsResult = render(
        <TestWrapper>
          <Buildings />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Buildings')).toBeInTheDocument();
      });

      const buildingsContainer = buildingsResult.container.querySelector('.flex-1.flex.flex-col.overflow-hidden');
      expect(buildingsContainer).toBeInTheDocument();

      buildingsResult.unmount();

      // Test budget page
      const budgetResult = render(
        <TestWrapper>
          <Budget />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/Budget Dashboard|Tableau de bord budgétaire/)).toBeInTheDocument();
      });

      // Budget page should NOT use min-h-screen (that's the bug we need to fix)
      const budgetFullScreen = budgetResult.container.querySelector('.min-h-screen');
      if (budgetFullScreen) {
        console.log('🚨 ISSUE FOUND: Budget page uses min-h-screen which breaks the sidebar layout');
      }
    });

    it('should have same layout structure as bills page', async () => {
      mockFetch(mockBuildings);
      
      const buildingsResult = render(
        <TestWrapper>
          <Buildings />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Buildings')).toBeInTheDocument();
      });

      const buildingsContainer = buildingsResult.container.querySelector('.flex-1.flex.flex-col.overflow-hidden');
      expect(buildingsContainer).toBeInTheDocument();

      buildingsResult.unmount();

      // Test bills page
      const billsResult = render(
        <TestWrapper>
          <Bills />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Bills Management')).toBeInTheDocument();
      });

      const billsContainer = billsResult.container.querySelector('.flex-1.flex.flex-col.overflow-hidden');
      expect(billsContainer).toBeInTheDocument();
    });
  });

  describe('Layout Consistency Rules', () => {
    it('should never use min-h-screen in manager pages', async () => {
      mockFetch(mockBuildings);

      const pages = [
        { name: 'Buildings', component: Buildings },
        { name: 'Bills', component: Bills },
        { name: 'Budget', component: Budget },
      ];

      for (const page of pages) {
        const { container, unmount } = render(
          <TestWrapper>
            <page.component />
          </TestWrapper>
        );

        // Wait for page to load
        await waitFor(() => {
          const pageContent = container.querySelector('[data-testid], .card, header');
          expect(pageContent).toBeInTheDocument();
        });

        // Check for problematic min-h-screen class
        const minHeightScreen = container.querySelector('.min-h-screen');
        expect(minHeightScreen).toBeNull();

        // Check for correct layout structure
        const flexContainer = container.querySelector('.flex-1.flex.flex-col.overflow-hidden');
        expect(flexContainer).toBeInTheDocument();

        unmount();
      }
    });
  });
});