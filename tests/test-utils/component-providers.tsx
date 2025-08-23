import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';

// Create mock LanguageProvider
const MockLanguageContext = React.createContext({
  language: 'en' as const,
  setLanguage: jest.fn(),
  t: jest.fn((key: string) => key),
  currentLanguage: 'en' as const,
});

export const MockLanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <MockLanguageContext.Provider value={{
      language: 'en' as const,
      setLanguage: jest.fn(),
      t: jest.fn((key: string) => key),
      currentLanguage: 'en' as const,
    }}>
      {children}
    </MockLanguageContext.Provider>
  );
};

// Create test query client
export const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// Combined providers for component testing
export const ComponentTestProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = createTestQueryClient();
  
  return (
    <QueryClientProvider client={queryClient}>
      <MockLanguageProvider>
        {children}
      </MockLanguageProvider>
    </QueryClientProvider>
  );
};

// Helper function to render components with providers
export const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ComponentTestProviders>
      {component}
    </ComponentTestProviders>
  );
};