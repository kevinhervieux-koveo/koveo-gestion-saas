import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';
import React, { ReactElement, ReactNode } from 'react';
import { LanguageProvider } from '@/hooks/use-language';
import { AuthProvider } from '@/hooks/use-auth';
import { MobileMenuProvider } from '@/hooks/use-mobile-menu';

// Create a test utility for rendering with all providers
/**
 *
 */
interface AllProvidersProps {
  children: ReactNode;
}

/**
 *
 * @param root0
 * @param root0.children
 */
/**
 * AllProviders function.
 * @param root0
 * @param root0.children
 * @returns Function result.
 */
function AllProviders({ children }: AllProvidersProps) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: () => Promise.resolve([]), // Default mock queryFn
      },
      mutations: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <MobileMenuProvider>
          <Router>
            <AuthProvider>{children}</AuthProvider>
          </Router>
        </MobileMenuProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

/**
 *
 */
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  wrapper?: React.ComponentType<{ children: React.ReactNode }>;
}

const customRender = (ui: ReactElement, options?: CustomRenderOptions) =>
  render(ui, { wrapper: AllProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };
