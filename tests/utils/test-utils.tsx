import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';
import '@testing-library/jest-dom';

// Use a simple mock LanguageProvider for tests to avoid complex i18n dependencies
const TestLanguageProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <div data-testid="language-provider">
      {children}
    </div>
  );
};

const TestAuthProvider = ({ children }: { children: React.ReactNode }) => {
  return <div data-testid="auth-provider">{children}</div>;
};

const TestMobileMenuProvider = ({ children }: { children: React.ReactNode }) => {
  return <div data-testid="mobile-menu-provider">{children}</div>;
};

interface AllTheProvidersProps {
  children: React.ReactNode;
}

const AllTheProviders = ({ children }: AllTheProvidersProps) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          // Default queryFn for tests - simulates API calls
          const url = Array.isArray(queryKey) ? queryKey.join('/') : String(queryKey);
          const response = await fetch(url, { credentials: 'include' });
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        },
      },
      mutations: {
        retry: false,
      },
    },
  });

  return (
    <Router>
      <QueryClientProvider client={queryClient}>
        <TestLanguageProvider>
          <TestAuthProvider>
            <TestMobileMenuProvider>
              {children}
            </TestMobileMenuProvider>
          </TestAuthProvider>
        </TestLanguageProvider>
      </QueryClientProvider>
    </Router>
  );
};

const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

// Re-export everything
export * from '@testing-library/react';

// Override render method
export { customRender as render };

// Create mock user data for tests
export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  username: 'testuser',
  email: 'test@example.com',
  role: 'admin' as const,
  firstName: 'Test',
  lastName: 'User',
  language: 'en' as const,
  ...overrides,
});

// Create mock organization data for tests
export const createMockOrganization = (overrides = {}) => ({
  id: 'test-org-id',
  name: 'Test Organization',
  type: 'property_management' as const,
  ...overrides,
});

// Create mock building data for tests
export const createMockBuilding = (overrides = {}) => ({
  id: 'test-building-id',
  name: 'Test Building',
  organizationId: 'test-org-id',
  address: '123 Test St',
  city: 'Montreal',
  province: 'QC',
  postalCode: 'H1A 1A1',
  ...overrides,
});

// Mock form data helpers
export const createMockFormData = (overrides = {}) => ({
  title: 'Test Form',
  description: 'Test description',
  ...overrides,
});