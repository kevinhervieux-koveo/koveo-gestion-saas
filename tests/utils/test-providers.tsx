import React, { createContext, useContext } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from '../../client/src/hooks/use-language';
// Import statement removed - MobileMenuProvider mocked instead

// Mock Auth Context for testing
/**
 *
 */
interface MockAuthContextType {
  user: any | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ user: any }>;
  logout: () => Promise<void>;
  hasRole: (role: string | string[]) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
}

const MockAuthContext = createContext<MockAuthContextType | undefined>(undefined);

const MockAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const mockAuthValue: MockAuthContextType = {
    user: null,
    isLoading: false,
    isAuthenticated: false,
    login: async () => ({ user: null }),
    logout: async () => {},
    hasRole: () => false,
    hasAnyRole: () => false,
  };

  return <MockAuthContext.Provider value={mockAuthValue}>{children}</MockAuthContext.Provider>;
};

export const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

/**
 *
 */
interface TestProvidersProps {
  children: React.ReactNode;
  queryClient?: QueryClient;
}

// Mock MobileMenuProvider
const MockMobileMenuContext = createContext({
  isMobileMenuOpen: false,
  toggleMobileMenu: () => {},
  closeMobileMenu: () => {},
});

const MockMobileMenuProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const mockValue = {
    isMobileMenuOpen: false,
    toggleMobileMenu: () => {},
    closeMobileMenu: () => {},
  };
  return (
    <MockMobileMenuContext.Provider value={mockValue}>{children}</MockMobileMenuContext.Provider>
  );
};

export const TestProviders: React.FC<TestProvidersProps> = ({
  children,
  queryClient = createTestQueryClient(),
}) => {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <MockAuthProvider>
          <MockMobileMenuProvider>{children}</MockMobileMenuProvider>
        </MockAuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
};

export const renderWithProviders = (ui: React.ReactElement, options = {}) => {
  const { render } = require('@testing-library/react');

  return render(<TestProviders>{ui}</TestProviders>, options);
};
