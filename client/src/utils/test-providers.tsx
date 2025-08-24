import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 *
 */
interface TestProvidersProps {
  children: React.ReactNode;
  queryClient?: QueryClient;
}

export const TestProviders = ({ 
  children, 
  queryClient
}: TestProvidersProps) => {
  const testQueryClient = queryClient || new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={testQueryClient}>
      <div data-testid="test-providers">
        {children}
      </div>
    </QueryClientProvider>
  );
};

export const createTestQueryClient = () => 
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });