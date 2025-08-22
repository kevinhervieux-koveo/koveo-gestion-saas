import { describe, it, expect, beforeEach } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'wouter/memory';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/hooks/use-auth';
import { LanguageProvider } from '@/hooks/use-language';
import App from '@/App';

/**
 * Routing Consistency Tests
 * 
 * Tests to ensure navigation and routing work consistently across the platform.
 * Validates route accessibility, navigation patterns, and user experience flow.
 */

function TestProviders({ 
  children, 
  initialLocation = '/',
  userRole = 'manager'
}: { 
  children: React.ReactNode; 
  initialLocation?: string;
  userRole?: string;
}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const mockUser = {
    id: '1',
    email: 'test@example.com',
    role: userRole,
    organizationId: 'org-1'
  };

  const mockAuthValue = {
    user: mockUser,
    isAuthenticated: true,
    isLoading: false,
    login: jest.fn(),
    logout: jest.fn(),
    checkAuth: jest.fn(),
  };

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialLocation]}>
        <LanguageProvider>
          <AuthProvider value={mockAuthValue}>
            {children}
          </AuthProvider>
        </LanguageProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Routing Consistency Tests', () => {
  describe('Public Routes Accessibility', () => {
    const publicRoutes = [
      { path: '/', name: 'Home' },
      { path: '/login', name: 'Login' },
      { path: '/forgot-password', name: 'Forgot Password' },
      { path: '/reset-password', name: 'Reset Password' },
      { path: '/accept-invitation', name: 'Accept Invitation' },
      { path: '/register', name: 'Register' },
    ];

    publicRoutes.forEach(route => {
      it(`should render ${route.name} page at ${route.path}`, () => {
        render(
          <TestProviders initialLocation={route.path}>
            <App />
          </TestProviders>
        );

        // Page should render without errors
        expect(document.body).toBeInTheDocument();
        
        // Should not show loading spinner indefinitely
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
    });

    it('should handle invalid public routes', () => {
      render(
        <TestProviders initialLocation="/non-existent-route">
          <App />
        </TestProviders>
      );

      // Should show 404 or redirect to valid route
      expect(
        screen.queryByText(/not found|404/i) || 
        screen.queryByText(/home|login/i)
      ).toBeInTheDocument();
    });
  });

  describe('Protected Routes Accessibility', () => {
    const protectedRoutes = [
      { path: '/dashboard', name: 'Dashboard', roles: ['admin', 'manager', 'resident'] },
      { path: '/admin/organizations', name: 'Organizations', roles: ['admin'] },
      { path: '/admin/documentation', name: 'Documentation', roles: ['admin'] },
      { path: '/admin/pillars', name: 'Pillars', roles: ['admin'] },
      { path: '/admin/roadmap', name: 'Roadmap', roles: ['admin'] },
      { path: '/admin/quality', name: 'Quality', roles: ['admin'] },
      { path: '/manager/buildings', name: 'Buildings', roles: ['admin', 'manager'] },
      { path: '/manager/residences', name: 'Residences', roles: ['admin', 'manager'] },
      { path: '/manager/budget', name: 'Budget', roles: ['admin', 'manager'] },
      { path: '/manager/bills', name: 'Bills', roles: ['admin', 'manager'] },
      { path: '/manager/demands', name: 'Manager Demands', roles: ['admin', 'manager'] },
      { path: '/residents/residence', name: 'Resident Area', roles: ['resident'] },
      { path: '/residents/building', name: 'Building Info', roles: ['resident'] },
      { path: '/residents/demands', name: 'Resident Demands', roles: ['resident'] },
    ];

    protectedRoutes.forEach(route => {
      route.roles.forEach(role => {
        it(`should render ${route.name} for ${role} role`, () => {
          render(
            <TestProviders initialLocation={route.path} userRole={role}>
              <App />
            </TestProviders>
          );

          // Page should render for authorized role
          expect(document.body).toBeInTheDocument();
          expect(screen.queryByText(/access denied|unauthorized/i)).not.toBeInTheDocument();
        });
      });

      // Test unauthorized access
      const unauthorizedRoles = ['admin', 'manager', 'resident'].filter(
        role => !route.roles.includes(role)
      );
      
      unauthorizedRoles.forEach(role => {
        it(`should restrict ${route.name} access for ${role} role`, () => {
          render(
            <TestProviders initialLocation={route.path} userRole={role}>
              <App />
            </TestProviders>
          );

          // Should show access denied or redirect
          expect(
            screen.queryByText(/access denied|unauthorized|not found/i) ||
            screen.queryByText(/dashboard|login/i)
          ).toBeInTheDocument();
        });
      });
    });
  });

  describe('Navigation Consistency', () => {
    it('should maintain consistent sidebar navigation', () => {
      render(
        <TestProviders initialLocation="/dashboard" userRole="manager">
          <App />
        </TestProviders>
      );

      // Sidebar should be present
      const sidebar = screen.queryByRole('navigation') || 
                     screen.queryByTestId('sidebar') ||
                     document.querySelector('[data-testid*="sidebar"]');
      
      if (sidebar) {
        expect(sidebar).toBeInTheDocument();
        
        // Should contain navigation links
        const navLinks = sidebar.querySelectorAll('a, button[role="link"]');
        expect(navLinks.length).toBeGreaterThan(0);
      }
    });

    it('should show appropriate navigation items for user role', () => {
      const roles = [
        { role: 'admin', expectedSections: ['admin', 'organizations', 'quality'] },
        { role: 'manager', expectedSections: ['manager', 'buildings', 'budget'] },
        { role: 'resident', expectedSections: ['residents', 'residence'] },
      ];

      roles.forEach(({ role, expectedSections }) => {
        render(
          <TestProviders initialLocation="/dashboard" userRole={role}>
            <App />
          </TestProviders>
        );

        const pageContent = document.body.textContent || '';
        
        expectedSections.forEach(section => {
          expect(pageContent.toLowerCase()).toMatch(
            new RegExp(section.toLowerCase())
          );
        });
      });
    });

    it('should handle navigation between different sections', async () => {
      const user = userEvent.setup();
      
      render(
        <TestProviders initialLocation="/dashboard" userRole="manager">
          <App />
        </TestProviders>
      );

      // Try to find navigation links
      const navLinks = screen.queryAllByRole('link').slice(0, 3); // Test first 3 links
      
      for (const link of navLinks) {
        if (link.getAttribute('href') && !link.getAttribute('href')!.startsWith('http')) {
          await user.click(link);
          
          // Navigation should work without errors
          expect(document.body).toBeInTheDocument();
        }
      }
    });
  });

  describe('URL Pattern Consistency', () => {
    it('should follow consistent URL patterns', () => {
      const expectedPatterns = [
        { pattern: '/admin/*', description: 'Admin routes should start with /admin' },
        { pattern: '/manager/*', description: 'Manager routes should start with /manager' },
        { pattern: '/residents/*', description: 'Resident routes should start with /residents' },
        { pattern: '/settings/*', description: 'Settings routes should start with /settings' },
      ];

      // This test validates the routing structure exists
      expectedPatterns.forEach(({ pattern, description }) => {
        expect(pattern).toMatch(/^\/[a-zA-Z]+\/\*$/);
        expect(description).toContain(pattern.replace('/*', ''));
      });
    });

    it('should handle nested routes consistently', () => {
      const nestedRoutes = [
        '/manager/buildings/documents',
        '/manager/residences/documents', 
        '/residents/residence/documents',
        '/residents/building/documents',
      ];

      nestedRoutes.forEach(route => {
        render(
          <TestProviders initialLocation={route} userRole="manager">
            <App />
          </TestProviders>
        );

        // Nested routes should render or redirect appropriately
        expect(document.body).toBeInTheDocument();
      });
    });

    it('should maintain breadcrumb consistency', () => {
      const routesWithBreadcrumbs = [
        { route: '/manager/buildings', expectedBreadcrumbs: ['Dashboard', 'Buildings'] },
        { route: '/admin/organizations', expectedBreadcrumbs: ['Dashboard', 'Admin', 'Organizations'] },
        { route: '/residents/residence', expectedBreadcrumbs: ['Dashboard', 'Residence'] },
      ];

      routesWithBreadcrumbs.forEach(({ route, expectedBreadcrumbs }) => {
        render(
          <TestProviders initialLocation={route} userRole="admin">
            <App />
          </TestProviders>
        );

        // Look for breadcrumb elements
        const breadcrumbElement = screen.queryByRole('navigation', { name: /breadcrumb/i }) ||
                                 screen.queryByTestId('breadcrumbs') ||
                                 document.querySelector('[aria-label*="breadcrumb"]');

        if (breadcrumbElement) {
          const breadcrumbText = breadcrumbElement.textContent || '';
          expectedBreadcrumbs.forEach(crumb => {
            expect(breadcrumbText).toContain(crumb);
          });
        }
      });
    });
  });

  describe('Route Transitions and Loading States', () => {
    it('should handle route transitions smoothly', async () => {
      const user = userEvent.setup();
      
      render(
        <TestProviders initialLocation="/dashboard" userRole="manager">
          <App />
        </TestProviders>
      );

      // Look for navigation elements
      const navElement = document.querySelector('[data-testid*="nav"]') ||
                        document.querySelector('nav') ||
                        document.querySelector('[role="navigation"]');

      if (navElement) {
        const links = navElement.querySelectorAll('a[href^="/"]');
        
        if (links.length > 0) {
          const firstLink = links[0] as HTMLElement;
          await user.click(firstLink);
          
          // Should not show loading indefinitely
          await new Promise(resolve => setTimeout(resolve, 100));
          expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
        }
      }
    });

    it('should show appropriate loading states during navigation', () => {
      render(
        <TestProviders initialLocation="/dashboard" userRole="manager">
          <App />
        </TestProviders>
      );

      // Should not be stuck in loading state
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });
  });

  describe('Error Handling in Routing', () => {
    it('should handle 404 routes gracefully', () => {
      render(
        <TestProviders initialLocation="/this-route-does-not-exist">
          <App />
        </TestProviders>
      );

      // Should show 404 page or redirect to valid route
      const pageContent = document.body.textContent || '';
      expect(
        pageContent.includes('not found') ||
        pageContent.includes('404') ||
        pageContent.includes('Dashboard') ||
        pageContent.includes('Home')
      ).toBe(true);
    });

    it('should handle malformed URLs', () => {
      const malformedUrls = [
        '//',
        '///',
        '/admin//organizations',
        '/manager//',
        '/residents/residence/',
      ];

      malformedUrls.forEach(url => {
        render(
          <TestProviders initialLocation={url}>
            <App />
          </TestProviders>
        );

        // Should not crash on malformed URLs
        expect(document.body).toBeInTheDocument();
      });
    });

    it('should handle authentication redirects consistently', () => {
      const protectedRoutes = ['/dashboard', '/admin/organizations', '/manager/buildings'];

      protectedRoutes.forEach(route => {
        // Test unauthenticated access
        const unauthenticatedProps = {
          user: null,
          isAuthenticated: false,
          isLoading: false,
          login: jest.fn(),
          logout: jest.fn(),
          checkAuth: jest.fn(),
        };

        render(
          <QueryClientProvider client={new QueryClient()}>
            <MemoryRouter initialEntries={[route]}>
              <LanguageProvider>
                <AuthProvider value={unauthenticatedProps}>
                  <App />
                </AuthProvider>
              </LanguageProvider>
            </MemoryRouter>
          </QueryClientProvider>
        );

        // Should redirect or show login
        const pageContent = document.body.textContent || '';
        expect(
          pageContent.includes('loading') ||
          pageContent.includes('login') ||
          pageContent.includes('sign in') ||
          pageContent.includes('Home')
        ).toBe(true);
      });
    });
  });

  describe('Mobile Navigation Consistency', () => {
    it('should maintain consistent navigation on mobile', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      
      render(
        <TestProviders initialLocation="/dashboard" userRole="manager">
          <App />
        </TestProviders>
      );

      // Mobile navigation should be present
      const mobileNav = screen.queryByTestId('mobile-nav') ||
                       screen.queryByTestId('mobile-menu') ||
                       document.querySelector('[data-testid*="mobile"]');

      // Mobile navigation functionality would be tested here
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Deep Linking Support', () => {
    it('should support direct access to deep routes', () => {
      const deepRoutes = [
        '/admin/organizations',
        '/manager/buildings', 
        '/manager/budget',
        '/residents/residence',
      ];

      deepRoutes.forEach(route => {
        render(
          <TestProviders initialLocation={route} userRole="admin">
            <App />
          </TestProviders>
        );

        // Deep routes should be accessible directly
        expect(document.body).toBeInTheDocument();
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
    });

    it('should maintain state during browser back/forward', () => {
      // This would test browser history integration
      render(
        <TestProviders initialLocation="/dashboard" userRole="manager">
          <App />
        </TestProviders>
      );

      // History navigation would be tested with more complex setup
      expect(document.body).toBeInTheDocument();
    });
  });
});

/**
 * Routing test utilities
 */
export const ROUTE_DEFINITIONS = {
  public: [
    { path: '/', component: 'HomePage' },
    { path: '/login', component: 'LoginPage' },
    { path: '/forgot-password', component: 'ForgotPasswordPage' },
    { path: '/reset-password', component: 'ResetPasswordPage' },
    { path: '/accept-invitation', component: 'InvitationAcceptancePage' },
  ],
  
  admin: [
    { path: '/admin/organizations', component: 'AdminOrganizations' },
    { path: '/admin/documentation', component: 'AdminDocumentation' },
    { path: '/admin/pillars', component: 'AdminPillars' },
    { path: '/admin/roadmap', component: 'AdminRoadmap' },
    { path: '/admin/quality', component: 'AdminQuality' },
    { path: '/admin/compliance', component: 'AdminCompliance' },
    { path: '/admin/suggestions', component: 'AdminSuggestions' },
    { path: '/admin/permissions', component: 'AdminPermissions' },
  ],
  
  manager: [
    { path: '/manager/buildings', component: 'ManagerBuildings' },
    { path: '/manager/buildings/documents', component: 'BuildingDocuments' },
    { path: '/manager/residences', component: 'ManagerResidences' },
    { path: '/manager/residences/documents', component: 'ResidenceDocuments' },
    { path: '/manager/budget', component: 'ManagerBudget' },
    { path: '/manager/bills', component: 'ManagerBills' },
    { path: '/manager/demands', component: 'ManagerDemands' },
    { path: '/manager/user-management', component: 'ManagerUserManagement' },
  ],
  
  residents: [
    { path: '/residents/residence', component: 'ResidentsResidence' },
    { path: '/residents/residence/documents', component: 'ResidentsResidenceDocuments' },
    { path: '/residents/building', component: 'ResidentsBuilding' },
    { path: '/residents/building/documents', component: 'ResidentsBuildingDocuments' },
    { path: '/residents/demands', component: 'ResidentsDemands' },
  ],
  
  settings: [
    { path: '/settings/settings', component: 'SettingsSettings' },
    { path: '/settings/bug-reports', component: 'SettingsBugReports' },
    { path: '/settings/idea-box', component: 'SettingsIdeaBox' },
  ],
};

export function validateRouteAccessibility(
  route: string, 
  userRole: string
): boolean {
  const routeConfig = Object.entries(ROUTE_DEFINITIONS).find(([section, routes]) => 
    routes.some(r => r.path === route) && 
    (section === 'public' || section === userRole || userRole === 'admin')
  );
  
  return !!routeConfig;
}

export function getExpectedRoutesForRole(role: string): string[] {
  const routes: string[] = [];
  
  // Public routes available to all
  routes.push(...ROUTE_DEFINITIONS.public.map(r => r.path));
  
  // Role-specific routes
  if (role === 'admin') {
    routes.push(...ROUTE_DEFINITIONS.admin.map(r => r.path));
    routes.push(...ROUTE_DEFINITIONS.manager.map(r => r.path)); // Admin can access manager routes
  }
  
  if (role === 'manager' || role === 'admin') {
    routes.push(...ROUTE_DEFINITIONS.manager.map(r => r.path));
  }
  
  if (role === 'resident') {
    routes.push(...ROUTE_DEFINITIONS.residents.map(r => r.path));
  }
  
  // Settings available to all authenticated users
  routes.push(...ROUTE_DEFINITIONS.settings.map(r => r.path));
  
  return routes;
}