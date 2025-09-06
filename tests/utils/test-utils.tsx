import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock providers that match the real application structure
const TestLanguageProvider = ({ children }: { children: React.ReactNode }) => {
  // Create a React context that provides the language hook values
  const mockLanguageContext = React.createContext({
    t: (key: string, options?: any) => {
      if (options && typeof options === 'object') {
        let result = key;
        Object.keys(options).forEach(k => {
          result = result.replace(new RegExp(`{{${k}}}`, 'g'), options[k]);
        });
        return result;
      }
      return key;
    },
    language: 'en',
    setLanguage: jest.fn(),
  });
  
  return (
    <mockLanguageContext.Provider value={{
      t: jest.fn((key: string, options?: any) => {
        if (options && typeof options === 'object') {
          let result = key;
          Object.keys(options).forEach(k => {
            result = result.replace(new RegExp(`{{${k}}}`, 'g'), options[k]);
          });
          return result;
        }
        return key;
      }),
      language: 'en',
      setLanguage: jest.fn(),
    }}>
      <div data-testid="language-provider">{children}</div>
    </mockLanguageContext.Provider>
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
      },
      mutations: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <TestLanguageProvider>
        <TestAuthProvider>
          <TestMobileMenuProvider>
            {children}
          </TestMobileMenuProvider>
        </TestAuthProvider>
      </TestLanguageProvider>
    </QueryClientProvider>
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