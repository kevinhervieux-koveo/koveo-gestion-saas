import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';
import { LanguageProvider } from '@/hooks/use-language';

/**
 * Test providers wrapper for i18n website tests
 */
export function TestProviders({
  children,
  initialLocation = '/',
}: {
  children: React.ReactNode;
  initialLocation?: string;
}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <LanguageProvider>{children}</LanguageProvider>
      </Router>
    </QueryClientProvider>
  );
}
