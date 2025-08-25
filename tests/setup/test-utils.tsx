import React from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext } from 'react';

// Mock LanguageContext
const MockLanguageContext = createContext({
  language: 'en' as const,
  setLanguage: jest.fn(),
  t: jest.fn((key: string) => key),
});

// Mock LanguageProvider
export const MockLanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <MockLanguageContext.Provider value={{
      language: 'en' as const,
      setLanguage: jest.fn(),
      t: jest.fn((key: string) => key),
    }}>
      {children}
    </MockLanguageContext.Provider>
  );
};

// Mock MobileMenuProvider
export const MockMobileMenuProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const mockContext = {
    isMobileMenuOpen: false,
    toggleMobileMenu: jest.fn(),
    closeMobileMenu: jest.fn(),
  };

  return (
    <div data-mobile-menu-context="true">
      {children}
    </div>
  );
};

// Create test query client
export const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: Infinity,
      queryFn: async ({ queryKey }) => {
        const url = Array.isArray(queryKey) ? queryKey[0] : queryKey;
        const response = await fetch(url as string);
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      },
    },
    mutations: {
      retry: false,
    },
  },
});

// All providers wrapper
export const AllProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = createTestQueryClient();
  
  return (
    <QueryClientProvider client={queryClient}>
      <MockLanguageProvider>
        <MockMobileMenuProvider>
          {children}
        </MockMobileMenuProvider>
      </MockLanguageProvider>
    </QueryClientProvider>
  );
};

// Alternative TestProviders alias for compatibility
export const TestProviders = AllProviders;

// Custom render with all providers
export const renderWithProviders = (ui: React.ReactElement) => {
  return render(ui, { wrapper: AllProviders });
};

// Export everything from testing-library
export * from '@testing-library/react';
// Override render
export { renderWithProviders as render };