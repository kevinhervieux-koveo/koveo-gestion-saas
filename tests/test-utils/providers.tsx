/**
 * Test providers for wrapping components during testing.
 */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { jest } from '@jest/globals';

// Create a test query client
const createTestQueryClient = () =>
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

// Mock language provider
const MockLanguageProvider = ({ children }: { children: React.ReactNode }) => {
  return <div data-testid='mock-language-provider'>{children}</div>;
};

// Mock toast provider
const MockToastProvider = ({ children }: { children: React.ReactNode }) => {
  return <div data-testid='mock-toast-provider'>{children}</div>;
};

/**
 * Test providers wrapper component.
 * @param root0
 * @param root0.children
 */
export const TestProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <MockLanguageProvider>
        <MockToastProvider>{children}</MockToastProvider>
      </MockLanguageProvider>
    </QueryClientProvider>
  );
};

export { createTestQueryClient };
