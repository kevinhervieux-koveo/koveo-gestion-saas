// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '@/hooks/use-language';
import { MobileMenuProvider } from '@/hooks/use-mobile-menu';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthErrorBoundary } from '@/components/common/AuthErrorBoundary';
import type { User } from '@shared/schema';

// Import auth hook - mocking is handled by Jest configuration

/**
 * Creates a test-optimized QueryClient instance.
 * Disables retries and sets infinite cache time for deterministic testing.
 */
export const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity, // Prevent automatic cleanup during tests
        staleTime: Infinity, // Always use cached data in tests
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
      },
      mutations: {
        retry: false,
        gcTime: Infinity,
      },
    },
  });

// Auth mocking is now handled by __mocks__/@/hooks/use-auth.tsx
// This provides better integration with the actual useAuth hook

/**
 * Configuration options for renderWithProviders
 */
interface RenderWithProvidersOptions {
  /**
   * Custom QueryClient instance. If not provided, creates a test-optimized one.
   */
  queryClient?: QueryClient;
  
  /**
   * Initial route for MemoryRouter. Defaults to '/'.
   */
  initialRoute?: string;
  
  /**
   * Mock user for authentication context. 
   * If provided, user will be considered authenticated.
   */
  user?: User | null;
  
  /**
   * Whether the user should be considered authenticated.
   * Defaults to true if user is provided, false otherwise.
   */
  isAuthenticated?: boolean;
  
  /**
   * Whether authentication is in loading state.
   */
  isAuthLoading?: boolean;
  
  /**
   * Initial language for the LanguageProvider. Defaults to 'en'.
   */
  initialLanguage?: 'en' | 'fr';
  
  /**
   * Whether to skip certain providers for isolated testing.
   */
  skipProviders?: {
    auth?: boolean;
    language?: boolean;
    router?: boolean;
    tooltip?: boolean;
    mobileMenu?: boolean;
    errorBoundary?: boolean;
  };
}

/**
 * All providers wrapper component for testing.
 * Includes all essential providers used in the main application.
 */
interface AllProvidersProps extends RenderWithProvidersOptions {
  children: React.ReactNode;
}

const AllProviders = ({ 
  children, 
  queryClient: customQueryClient,
  initialRoute = '/',
  user,
  isAuthenticated,
  isAuthLoading = false,
  skipProviders = {},
}: AllProvidersProps) => {
  const queryClient = customQueryClient || createTestQueryClient();
  
  // Determine authentication state
  const shouldBeAuthenticated = isAuthenticated ?? (user !== null && user !== undefined);

  let wrappedChildren = children;

  // Wrap with providers in reverse order (innermost first)
  if (!skipProviders.errorBoundary) {
    wrappedChildren = (
      <AuthErrorBoundary>
        {wrappedChildren}
      </AuthErrorBoundary>
    );
  }

  if (!skipProviders.tooltip) {
    wrappedChildren = (
      <TooltipProvider>
        {wrappedChildren}
      </TooltipProvider>
    );
  }

  if (!skipProviders.mobileMenu) {
    wrappedChildren = (
      <MobileMenuProvider>
        {wrappedChildren}
      </MobileMenuProvider>
    );
  }

  // Auth mocking is handled by jest mocks now - simplified approach
  // The MockAuthProvider from the real hook should handle state management

  if (!skipProviders.language) {
    wrappedChildren = (
      <LanguageProvider>
        {wrappedChildren}
      </LanguageProvider>
    );
  }

  if (!skipProviders.router) {
    wrappedChildren = (
      <MemoryRouter initialEntries={[initialRoute || '/']}>
        {wrappedChildren}
      </MemoryRouter>
    );
  }

  wrappedChildren = (
    <QueryClientProvider client={queryClient}>
      {wrappedChildren}
    </QueryClientProvider>
  );

  return <>{wrappedChildren}</>;
};

/**
 * Custom render function that wraps components with all necessary providers.
 * This is the main function you should use for testing React components.
 * 
 * @param ui - The React element to render
 * @param options - Render options including provider configuration
 * @returns Testing Library render result
 */
export const renderWithProviders = (
  ui: React.ReactElement,
  options: RenderWithProvidersOptions & Omit<RenderOptions, 'wrapper'> = {}
) => {
  const {
    queryClient,
    initialRoute,
    user,
    isAuthenticated,
    isAuthLoading,
    skipProviders,
    ...renderOptions
  } = options;

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <AllProviders
      queryClient={queryClient}
      initialRoute={initialRoute}
      user={user}
      isAuthenticated={isAuthenticated}
      isAuthLoading={isAuthLoading}
      skipProviders={skipProviders}
    >
      {children}
    </AllProviders>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

/**
 * Specialized render function for testing routing behavior.
 * Provides additional utilities for navigation testing.
 */
export const renderWithRouter = (
  ui: React.ReactElement,
  options: { initialRoute?: string } & RenderWithProvidersOptions = {}
) => {
  const result = renderWithProviders(ui, options);
  
  // Auth state setup is handled by the mocked useAuth hook
  
  return {
    ...result,
    // Helper to get current location for MemoryRouter tests
    getCurrentLocation: () => window.location.pathname,
  };
};

// Fallback mock user utilities for compatibility
export const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: 'test-user-id',
  username: 'testuser@example.com',
  email: 'testuser@example.com',
  password: 'hashed-password',
  firstName: 'Test',
  lastName: 'User',
  phone: '+1-514-555-0123',
  profileImage: null,
  language: 'en',
  role: 'admin',
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockAdminUser = (overrides: Partial<User> = {}): User =>
  createMockUser({ role: 'admin', ...overrides });

export const createMockManagerUser = (overrides: Partial<User> = {}): User =>
  createMockUser({ role: 'manager', ...overrides });

export const createMockResidentUser = (overrides: Partial<User> = {}): User =>
  createMockUser({ role: 'resident', ...overrides });

// Mock auth utilities - simplified for compatibility
export const __mockAuthUtils = {
  setAuthenticatedUser: (user: User | Partial<User> = {}) => {
    // Mock implementation - actual mocking happens in Jest mocks
    // Auth state setting handled by Jest mocks
  },
  setUnauthenticated: () => {
    // Auth state setting handled by Jest mocks
  },
  setLoading: (isLoading = true) => {
    // Loading state setting handled by Jest mocks
  },
  reset: () => {
    // Auth mock state reset handled by Jest mocks
  },
  createMockUser,
  createMockAdminUser,
  createMockManagerUser,
  createMockResidentUser,
};

/**
 * Utility to wait for all pending promises and timers.
 * Useful for waiting for async operations in tests.
 */
export const waitForLoadingToFinish = () => 
  new Promise(resolve => setTimeout(resolve, 0));

/**
 * Custom matcher for testing if an element has a specific data-testid.
 * Usage: expect(element).toHaveTestId('button-submit')
 */
export const hasTestId = (element: Element, testId: string): boolean => {
  return element.getAttribute('data-testid') === testId;
};

/**
 * Helper to create mock form data for testing forms.
 */
export const createMockFormData = (data: Record<string, any> = {}): FormData => {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value instanceof File) {
      formData.append(key, value);
    } else {
      formData.append(key, String(value));
    }
  });
  return formData;
};

/**
 * Helper to create a mock file for testing file uploads.
 */
export const createMockFile = (
  name = 'test-file.txt',
  content = 'test content',
  type = 'text/plain'
): File => {
  const blob = new Blob([content], { type });
  return new File([blob], name, { type });
};

// Re-export everything from @testing-library/react for convenience
export * from '@testing-library/react';

// Override the default render method to use our enhanced version
export { renderWithProviders as render };

/**
 * Clean up function to reset all test state between tests
 * This should be called in afterEach or beforeEach blocks
 */
export const cleanupTestUtils = () => {
  // Reset any test state here
  jest.clearAllMocks();
};