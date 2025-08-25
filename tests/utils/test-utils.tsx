import { ReactElement } from 'react';
import { render, RenderOptions, waitFor as originalWaitFor, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';
import { AuthProvider } from '@/hooks/use-auth';
import { LanguageProvider } from '@/hooks/use-language';

// Create a custom render function that includes providers
const customRender = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) => {
  const queryClient = new QueryClient({
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

  const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
    return (
      <QueryClientProvider client={queryClient}>
        <Router>
          <LanguageProvider>
            <AuthProvider>{children}</AuthProvider>
          </LanguageProvider>
        </Router>
      </QueryClientProvider>
    );
  };

  return render(ui, { wrapper: AllTheProviders, ...options });
};

// Enhanced utilities for better timeout handling
export const waitFor = (callback: () => void, options?: Parameters<typeof originalWaitFor>[1]) => {
  return originalWaitFor(callback, {
    timeout: 12000,
    interval: 100,
    ...options,
  });
};

// Helper for user interactions with better timing
const user = userEvent.setup({
  delay: 100, // Add delay between actions for stability
});

// Enhanced screen utilities with better timeouts
export const findByTextWithTimeout = async (text: string, timeout = 10000) => {
  return await screen.findByText(text, {}, { timeout });
};

export const findByRoleWithTimeout = async (
  role: any,
  _options: Parameters<typeof screen.findByRole>[1] = {},
  timeout = 10000
) => {
  return await screen.findByRole(role, options, { timeout });
};

// Async utility that waits for elements to be present and stable
export const waitForElementToBeStable = async (elementSelector: () => HTMLElement) => {
  let element;
  await waitFor(() => {
    element = elementSelector();
    expect(element).toBeInTheDocument();
  });

  // Additional wait to ensure element is stable
  await new Promise((resolve) => setTimeout(resolve, 200));
  return element;
};

// Re-export everything
export * from '@testing-library/react';
export { customRender as render, screen, user };
