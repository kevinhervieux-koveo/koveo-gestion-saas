/**
 * Comprehensive test suite to ensure all pages in the app work correctly
 * and prevent issues like missing imports and authentication failures
 */

import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router, Route, Switch } from 'wouter';
import { MemoryRouter } from 'wouter/memory-location';
import { AuthProvider } from '@/hooks/use-auth';
import { LanguageProvider } from '@/hooks/use-language';
import '@testing-library/jest-dom';

// Mock the auth API responses
global.fetch = jest.fn();

// Test data - all pages in the app
const allPages = [
  // Public pages
  { path: '/', name: 'Home' },
  { path: '/features', name: 'Features' },
  { path: '/pricing', name: 'Pricing' },
  { path: '/security', name: 'Security' },
  { path: '/story', name: 'Story' },
  { path: '/privacy-policy', name: 'Privacy Policy' },
  { path: '/terms-of-service', name: 'Terms of Service' },
  
  // Auth pages
  { path: '/login', name: 'Login' },
  { path: '/forgot-password', name: 'Forgot Password' },
  { path: '/reset-password', name: 'Reset Password' },
  
  // Dashboard pages (require auth)
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/dashboard/calendar', name: 'Calendar' },
  
  // Admin pages (require admin role)
  { path: '/admin/organizations', name: 'Admin Organizations' },
  { path: '/admin/compliance', name: 'Admin Compliance' },
  { path: '/admin/documentation', name: 'Admin Documentation' },
  { path: '/admin/permissions', name: 'Admin Permissions' },
  { path: '/admin/pillars', name: 'Admin Pillars' },
  { path: '/admin/quality', name: 'Admin Quality' },
  { path: '/admin/roadmap', name: 'Admin Roadmap' },
  { path: '/admin/suggestions', name: 'Admin Suggestions' },
  
  // Manager pages (require manager role)
  { path: '/manager/bills', name: 'Manager Bills' },
  { path: '/manager/budget', name: 'Manager Budget' },
  { path: '/manager/buildings', name: 'Manager Buildings' },
  { path: '/manager/common-spaces-stats', name: 'Manager Common Spaces Stats' },
  { path: '/manager/demands', name: 'Manager Demands' },
  { path: '/manager/invoices', name: 'Manager Invoices' },
  { path: '/manager/residences', name: 'Manager Residences' },
  { path: '/manager/user-management', name: 'Manager User Management' },
  
  // Resident pages (require resident role)
  { path: '/residents/dashboard', name: 'Residents Dashboard' },
  { path: '/residents/building', name: 'Residents Building' },
  { path: '/residents/common-spaces', name: 'Residents Common Spaces' },
  { path: '/residents/my-calendar', name: 'Residents My Calendar' },
  { path: '/residents/residence', name: 'Residents Residence' },
  
  // Settings pages
  { path: '/settings/settings', name: 'Settings' },
  { path: '/settings/bug-reports', name: 'Bug Reports' },
  { path: '/settings/idea-box', name: 'Idea Box' },
];

// Import all page components dynamically
const pageComponents = {
  '/': () => import('@/pages/home'),
  '/features': () => import('@/pages/features'),
  '/pricing': () => import('@/pages/pricing'),
  '/security': () => import('@/pages/security'),
  '/story': () => import('@/pages/story'),
  '/privacy-policy': () => import('@/pages/privacy-policy'),
  '/terms-of-service': () => import('@/pages/terms-of-service'),
  '/login': () => import('@/pages/auth/login'),
  '/forgot-password': () => import('@/pages/auth/forgot-password'),
  '/reset-password': () => import('@/pages/auth/reset-password'),
  '/dashboard': () => import('@/pages/dashboard'),
  '/dashboard/calendar': () => import('@/pages/dashboard/calendar'),
  '/admin/organizations': () => import('@/pages/admin/organizations'),
  '/admin/compliance': () => import('@/pages/admin/compliance'),
  '/admin/documentation': () => import('@/pages/admin/documentation'),
  '/admin/permissions': () => import('@/pages/admin/permissions'),
  '/admin/pillars': () => import('@/pages/admin/pillars'),
  '/admin/quality': () => import('@/pages/admin/quality'),
  '/admin/roadmap': () => import('@/pages/admin/roadmap'),
  '/admin/suggestions': () => import('@/pages/admin/suggestions'),
  '/manager/bills': () => import('@/pages/manager/bills'),
  '/manager/budget': () => import('@/pages/manager/budget'),
  '/manager/buildings': () => import('@/pages/manager/buildings'),
  '/manager/common-spaces-stats': () => import('@/pages/manager/common-spaces-stats'),
  '/manager/demands': () => import('@/pages/manager/demands'),
  '/manager/invoices': () => import('@/pages/manager/invoices'),
  '/manager/residences': () => import('@/pages/manager/residences'),
  '/manager/user-management': () => import('@/pages/manager/user-management'),
  '/residents/dashboard': () => import('@/pages/residents/dashboard'),
  '/residents/building': () => import('@/pages/residents/building'),
  '/residents/common-spaces': () => import('@/pages/residents/common-spaces'),
  '/residents/my-calendar': () => import('@/pages/residents/my-calendar'),
  '/residents/residence': () => import('@/pages/residents/residence'),
  '/settings/settings': () => import('@/pages/settings/settings'),
  '/settings/bug-reports': () => import('@/pages/settings/bug-reports'),
  '/settings/idea-box': () => import('@/pages/settings/idea-box'),
};

// Helper to create test providers
const TestWrapper = ({ children, mockUser = null }: { children: React.ReactNode, mockUser?: any }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  // Mock auth API response
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
  
  if (mockUser) {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockUser),
    } as Response);
  } else {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: () => Promise.resolve({ error: 'Unauthorized' }),
    } as Response);
  }

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <MemoryRouter>
            {children}
          </MemoryRouter>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
};

describe('All Pages Integrity Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset console.error to catch React errors
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Public Pages', () => {
    const publicPages = allPages.filter(page => 
      ['/', '/features', '/pricing', '/security', '/story', '/privacy-policy', '/terms-of-service'].includes(page.path)
    );

    it.each(publicPages)('should render $name page without errors', async ({ path, name }) => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      } as Response);

      let Component;
      try {
        const module = await pageComponents[path]?.();
        Component = module?.default;
      } catch (error) {
        throw new Error(`Failed to import component for ${name} (${path}): ${error}`);
      }

      if (!Component) {
        throw new Error(`No component found for ${name} (${path})`);
      }

      let renderError;
      try {
        render(
          <TestWrapper>
            <Component />
          </TestWrapper>
        );
      } catch (error) {
        renderError = error;
      }

      // Check for render errors
      expect(renderError).toBeUndefined();
      
      // Check for console errors (like missing imports)
      const consoleSpy = jest.spyOn(console, 'error');
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringMatching(/ReferenceError.*is not defined/)
      );
    });
  });

  describe('Authentication Pages', () => {
    const authPages = allPages.filter(page => 
      ['/login', '/forgot-password', '/reset-password'].includes(page.path)
    );

    it.each(authPages)('should render $name page without errors', async ({ path, name }) => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      } as Response);

      let Component;
      try {
        const module = await pageComponents[path]?.();
        Component = module?.default;
      } catch (error) {
        throw new Error(`Failed to import component for ${name} (${path}): ${error}`);
      }

      if (!Component) {
        throw new Error(`No component found for ${name} (${path})`);
      }

      expect(() => {
        render(
          <TestWrapper>
            <Component />
          </TestWrapper>
        );
      }).not.toThrow();
    });
  });

  describe('Protected Pages with Authentication', () => {
    const protectedPages = allPages.filter(page => 
      page.path.startsWith('/dashboard') || 
      page.path.startsWith('/admin') || 
      page.path.startsWith('/manager') || 
      page.path.startsWith('/residents') ||
      page.path.startsWith('/settings')
    );

    const mockUsers = {
      admin: { id: '1', email: 'admin@test.com', role: 'admin', firstName: 'Admin', lastName: 'User' },
      manager: { id: '2', email: 'manager@test.com', role: 'manager', firstName: 'Manager', lastName: 'User' },
      resident: { id: '3', email: 'resident@test.com', role: 'resident', firstName: 'Resident', lastName: 'User' }
    };

    it.each(protectedPages)('should render $name page with proper authentication', async ({ path, name }) => {
      // Determine required role based on path
      let mockUser = mockUsers.admin; // Default to admin
      if (path.startsWith('/manager')) mockUser = mockUsers.manager;
      if (path.startsWith('/residents')) mockUser = mockUsers.resident;

      let Component;
      try {
        const module = await pageComponents[path]?.();
        Component = module?.default;
      } catch (error) {
        throw new Error(`Failed to import component for ${name} (${path}): ${error}`);
      }

      if (!Component) {
        throw new Error(`No component found for ${name} (${path})`);
      }

      expect(() => {
        render(
          <TestWrapper mockUser={mockUser}>
            <Component />
          </TestWrapper>
        );
      }).not.toThrow();
    });
  });

  describe('Import Validation', () => {
    it('should not have missing lucide-react imports', async () => {
      const pages = [
        '/privacy-policy',
        '/home',
        '/features', 
        '/pricing',
        '/security',
        '/story',
        '/terms-of-service'
      ];

      for (const path of pages) {
        let Component;
        try {
          const module = await pageComponents[path]?.();
          Component = module?.default;
        } catch (error) {
          throw new Error(`Failed to import component for ${path}: ${error}`);
        }

        if (Component) {
          // Test that component can be rendered without import errors
          expect(() => {
            render(
              <TestWrapper>
                <Component />
              </TestWrapper>
            );
          }).not.toThrow();

          // Check that no ReferenceError is thrown for missing lucide icons
          const consoleSpy = jest.spyOn(console, 'error');
          expect(consoleSpy).not.toHaveBeenCalledWith(
            expect.stringMatching(/ReferenceError.*ArrowRight is not defined/)
          );
          expect(consoleSpy).not.toHaveBeenCalledWith(
            expect.stringMatching(/ReferenceError.*ArrowLeft is not defined/)
          );
        }
      }
    });
  });

  describe('API Integration', () => {
    it('should handle 401 responses gracefully on public pages', async () => {
      const publicPages = ['/', '/features', '/privacy-policy'];
      
      for (const path of publicPages) {
        const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
        mockFetch.mockClear();
        
        // Mock 401 response
        mockFetch.mockResolvedValue({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: () => Promise.resolve({ error: 'Unauthorized' }),
        } as Response);

        let Component;
        try {
          const module = await pageComponents[path]?.();
          Component = module?.default;
        } catch (error) {
          continue; // Skip if component doesn't exist
        }

        if (Component) {
          expect(() => {
            render(
              <TestWrapper>
                <Component />
              </TestWrapper>
            );
          }).not.toThrow();

          // Wait for auth check to complete
          await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledWith('/api/auth/user', {
              credentials: 'include',
            });
          });
        }
      }
    });
  });
});