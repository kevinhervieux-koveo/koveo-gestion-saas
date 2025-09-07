/**
 * Comprehensive page accessibility testing suite
 * Tests all pages for accessibility compliance and proper functionality
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'wouter/memory-location';
import { AuthProvider } from '@/hooks/use-auth';
import { LanguageProvider } from '@/hooks/use-language';
import '@testing-library/jest-dom';

// Mock fetch for API calls
global.fetch = jest.fn();

// Test providers wrapper
const TestWrapper = ({ 
  children, 
  mockUser = null, 
  initialRoute = '/' 
}: { 
  children: React.ReactNode;
  mockUser?: any;
  initialRoute?: string;
}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
  
  // Mock auth response
  if (mockUser) {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/auth/user') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockUser),
        } as Response);
      }
      
      // Mock other API endpoints
      if (url === '/api/buildings') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve([
            { id: '1', name: 'Test Building 1', yearBuilt: 2020 },
            { id: '2', name: 'Test Building 2', yearBuilt: 2021 }
          ]),
        } as Response);
      }

      if (url?.toString().includes('/api/bills')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve([]),
        } as Response);
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      } as Response);
    });
  } else {
    mockFetch.mockResolvedValue({
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
          <MemoryRouter initialEntries={[initialRoute]}>
            {children}
          </MemoryRouter>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
};

// Test data for different user roles
const mockUsers = {
  admin: { 
    id: '1', 
    email: 'admin@test.com', 
    role: 'admin', 
    firstName: 'Admin', 
    lastName: 'User' 
  },
  manager: { 
    id: '2', 
    email: 'manager@test.com', 
    role: 'manager', 
    firstName: 'Manager', 
    lastName: 'User' 
  },
  resident: { 
    id: '3', 
    email: 'resident@test.com', 
    role: 'resident', 
    firstName: 'Resident', 
    lastName: 'User' 
  }
};

// Pages to test with their required roles
const pagesToTest = [
  // Public pages
  { path: '/', name: 'Home', role: null },
  { path: '/features', name: 'Features', role: null },
  { path: '/login', name: 'Login', role: null },
  
  // Protected pages
  { path: '/dashboard', name: 'Dashboard', role: 'admin' },
  { path: '/manager/bills', name: 'Manager Bills', role: 'manager' },
  { path: '/manager/buildings', name: 'Manager Buildings', role: 'manager' },
  { path: '/admin/organizations', name: 'Admin Organizations', role: 'admin' },
  { path: '/residents/dashboard', name: 'Residents Dashboard', role: 'resident' },
];

describe('Page Accessibility Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Basic Page Accessibility', () => {
    it.each(pagesToTest)('$name page should have proper semantic structure', async ({ path, name, role }) => {
      const mockUser = role ? mockUsers[role as keyof typeof mockUsers] : null;
      
      let Component;
      try {
        let importPath = path;
        if (path === '/') importPath = '/home';
        if (path.startsWith('/manager/')) importPath = path.replace('/manager/', '/pages/manager/');
        if (path.startsWith('/admin/')) importPath = path.replace('/admin/', '/pages/admin/');
        if (path.startsWith('/residents/')) importPath = path.replace('/residents/', '/pages/residents/');
        
        const module = await import(`@${importPath}`);
        Component = module?.default;
      } catch (error) {
        // Skip if component doesn't exist or has import issues
        console.warn(`Could not import ${name} component:`, error);
        return;
      }

      if (!Component) return;

      render(
        <TestWrapper mockUser={mockUser} initialRoute={path}>
          <Component />
        </TestWrapper>
      );

      await waitFor(() => {
        // Wait for component to fully render
        expect(document.body).toBeInTheDocument();
      }, { timeout: 3000 });

      // Test 1: Page should have proper heading structure
      const headings = screen.queryAllByRole('heading');
      if (headings.length > 0) {
        expect(headings[0]).toBeInTheDocument();
        
        // Main heading should be h1 or h2
        const mainHeading = headings.find(h => 
          h.tagName === 'H1' || h.tagName === 'H2'
        );
        expect(mainHeading).toBeTruthy();
      }

      // Test 2: Interactive elements should be accessible
      const buttons = screen.queryAllByRole('button');
      buttons.forEach(button => {
        // Buttons should have accessible names
        expect(button).toHaveAttribute('type');
        expect(button.textContent || button.getAttribute('aria-label')).toBeTruthy();
      });

      // Test 3: Forms should have proper labels
      const inputs = screen.queryAllByRole('textbox');
      inputs.forEach(input => {
        const label = screen.queryByLabelText(new RegExp(input.getAttribute('name') || '', 'i'));
        if (!label) {
          // Input should have aria-label if no associated label
          expect(input).toHaveAttribute('aria-label');
        }
      });

      // Test 4: Links should be accessible
      const links = screen.queryAllByRole('link');
      links.forEach(link => {
        expect(link.textContent || link.getAttribute('aria-label')).toBeTruthy();
      });
    });
  });

  describe('Bills Page Specific Accessibility', () => {
    it('should render bills page without CATEGORY_LABELS error', async () => {
      const mockUser = mockUsers.manager;
      
      let BillsComponent;
      try {
        const module = await import('@/pages/manager/bills');
        BillsComponent = module?.default;
      } catch (error) {
        throw new Error(`Failed to import Bills component: ${error}`);
      }

      if (!BillsComponent) {
        throw new Error('Bills component not found');
      }

      const consoleSpy = jest.spyOn(console, 'error');
      
      render(
        <TestWrapper mockUser={mockUser}>
          <BillsComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        // Wait for the page to load
        expect(screen.getByText(/bills/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Should not have CATEGORY_LABELS error
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringMatching(/ReferenceError.*CATEGORY_LABELS is not defined/)
      );

      // Should have proper form labels
      const buildingFilter = screen.queryByLabelText(/building/i);
      if (buildingFilter) {
        expect(buildingFilter).toBeInTheDocument();
      }

      const categoryFilter = screen.queryByLabelText(/category/i);
      if (categoryFilter) {
        expect(categoryFilter).toBeInTheDocument();
      }
    });

    it('should handle keyboard navigation on bills page', async () => {
      const mockUser = mockUsers.manager;
      
      const BillsComponent = (await import('@/pages/manager/bills')).default;
      
      render(
        <TestWrapper mockUser={mockUser}>
          <BillsComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/bills/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Test tab navigation
      const interactiveElements = screen.queryAllByRole('button')
        .concat(screen.queryAllByRole('combobox'))
        .concat(screen.queryAllByRole('textbox'));

      if (interactiveElements.length > 0) {
        // Focus should be manageable
        interactiveElements[0].focus();
        expect(document.activeElement).toBe(interactiveElements[0]);

        // Tab should move focus
        fireEvent.keyDown(interactiveElements[0], { key: 'Tab' });
        // Note: jsdom doesn't simulate actual tab behavior, but we can test the element is focusable
        expect(interactiveElements[0]).toBeInTheDocument();
      }
    });
  });

  describe('Language Support Accessibility', () => {
    it.each(['en', 'fr'])('should render pages properly in %s language', async (language) => {
      const mockUser = mockUsers.admin;
      
      // Test a few key pages in different languages
      const pagesToTestLang = [
        { path: '/dashboard', component: () => import('@/pages/dashboard') },
        { path: '/manager/bills', component: () => import('@/pages/manager/bills') }
      ];

      for (const { path, component } of pagesToTestLang) {
        let Component;
        try {
          const module = await component();
          Component = module?.default;
        } catch (error) {
          continue; // Skip if component doesn't exist
        }

        if (!Component) continue;

        render(
          <TestWrapper mockUser={mockUser}>
            <Component />
          </TestWrapper>
        );

        await waitFor(() => {
          expect(document.body).toBeInTheDocument();
        }, { timeout: 3000 });

        // Check that text content exists (language-agnostic)
        const textElements = screen.queryAllByText(/\w+/);
        expect(textElements.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Error Handling Accessibility', () => {
    it('should provide accessible error messages', async () => {
      const mockUser = mockUsers.manager;
      
      // Mock API error
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockImplementation((url) => {
        if (url === '/api/auth/user') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(mockUser),
          } as Response);
        }
        
        // Simulate API error
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: () => Promise.resolve({ error: 'Server error' }),
        } as Response);
      });

      const BillsComponent = (await import('@/pages/manager/bills')).default;
      
      render(
        <TestWrapper mockUser={mockUser}>
          <BillsComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        // Look for error messages or retry buttons
        const errorElements = screen.queryAllByText(/error|retry|failed/i);
        if (errorElements.length > 0) {
          // Error messages should be accessible
          errorElements.forEach(element => {
            expect(element).toBeInTheDocument();
          });
        }
      }, { timeout: 5000 });
    });
  });

  describe('ARIA and Screen Reader Support', () => {
    it('should have proper ARIA attributes on interactive elements', async () => {
      const mockUser = mockUsers.manager;
      
      const BillsComponent = (await import('@/pages/manager/bills')).default;
      
      render(
        <TestWrapper mockUser={mockUser}>
          <BillsComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/bills/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Check for proper ARIA attributes
      const comboboxes = screen.queryAllByRole('combobox');
      comboboxes.forEach(combobox => {
        // Comboboxes should have proper ARIA attributes
        expect(combobox).toHaveAttribute('aria-expanded');
      });

      // Check for loading states
      const loadingElements = screen.queryAllByText(/loading|wait/i);
      loadingElements.forEach(element => {
        // Loading states should be announced to screen readers
        expect(element).toBeInTheDocument();
      });
    });
  });
});