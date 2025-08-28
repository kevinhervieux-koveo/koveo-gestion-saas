import { QueryClient, QueryFunction, QueryCache, MutationCache } from '@tanstack/react-query';

// Enhanced query client with aggressive memory management for Quebec property management
const MAX_CACHE_SIZE = 50; // Limit cache to 50 queries
const MEMORY_CLEANUP_INTERVAL = 3 * 60 * 1000; // 3 minutes

// Track query cache size and clean up when needed
let queryCount = 0;
const cleanupOldQueries = () => {
  if (queryCount > MAX_CACHE_SIZE) {
    queryClient.getQueryCache().clear();
    queryCount = 0;
  }
};

/**
 * Throws an error if the HTTP response is not successful (status not ok).
 * Extracts error message from response body or uses status text as fallback.
 * @param res - Fetch API Response object to check.
 * @throws Error with status code and message if response is not ok.
 */
async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * Makes an HTTP API request with proper error handling and JSON serialization.
 * Automatically includes credentials and sets Content-Type header for JSON data.
 * @param method - HTTP method (GET, POST, PUT, DELETE, etc.).
 * @param url - API endpoint URL.
 * @param data - Optional data to send in request body (will be JSON stringified).
 * @returns Fetch API Response object.
 * @throws Error if response status is not ok.
 */
export async function apiRequest(method: string, url: string, data?: unknown): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { 'Content-Type': 'application/json' } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: 'include',
  });

  await throwIfResNotOk(res);
  return res;
}

/**
 * Defines behavior when encountering 401 Unauthorized responses.
 * - 'returnNull': Returns null for 401 responses (useful for optional authentication)
 * - 'throw': Throws error for 401 responses (default behavior).
 */
type UnauthorizedBehavior = 'returnNull' | 'throw';

/**
 * Creates a query function for React Query with configurable 401 handling.
 * Used as default query function for all React Query queries in the application.
 * @param options - Configuration options.
 * @param options.on401 - How to handle 401 responses.
 * @returns Configured query function for React Query.
 */
export const getQueryFn: <T>(_options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join('/') as string, {
      credentials: 'include',
    });

    if (unauthorizedBehavior === 'returnNull' && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);

    // Check if response is JSON before parsing
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await res.text();
      throw new Error(
        `Expected JSON response but received ${contentType || 'unknown content type'}. Response: ${text.substring(0, 100)}...`
      );
    }

    return await res.json();
  };

/**
 * Global React Query client instance with configured defaults.
 * Provides centralized data fetching, caching, and synchronization for the application.
 * Configured with custom error handling and optimized memory management.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: 'throw' }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      // Allow data to become stale after 2 minutes for better performance
      staleTime: 2 * 60 * 1000, // 2 minutes
      // Cache data for 5 minutes before removal to prevent memory bloat
      gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
      retry: (failureCount, error: any) => {
        // Retry authentication and common timing errors
        if (
          (error?.message?.includes('401') ||
            error?.message?.includes('404') ||
            error?.message?.includes('Authentication required')) &&
          failureCount < 2
        ) {
          return true;
        }
        // Don't retry other client errors (4xx)
        if (error?.message?.includes('4')) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
      // Don't cache mutation results indefinitely
      gcTime: 2 * 60 * 1000, // 2 minutes
    },
  },
  // Limit query cache size to prevent memory bloat
  queryCache: new QueryCache({
    onError: (error) => {
      // Handle session expiry globally - redirect to login
      if (error.message.includes('401') || error.message.includes('Authentication required')) {
        // Check if we're not already on login or public pages
        const currentPath = window.location.pathname;
        const isPublicPath = ['/', '/auth/login', '/auth/register', '/features', '/pricing', '/security', '/story'].includes(currentPath);
        
        if (!isPublicPath) {
          console.warn('Session expired during API call, redirecting to login');
          window.location.href = '/auth/login';
          return;
        }
      }

      // Only log query errors in development
      if (process.env.NODE_ENV === 'development') {
        // Skip logging authentication timing errors and common API errors to reduce console noise
        if (
          error.message.includes('401') ||
          error.message.includes('Authentication required') ||
          error.message.includes('404') ||
          error.message.includes('API endpoint not found')
        ) {
          return; // Authentication timing issues and 404s will be retried automatically
        }

        // Provide more helpful error messages for common issues
        if (error.message.includes('DOCTYPE') || error.message.includes('Unexpected token')) {
          console.error('❌ API returned HTML instead of JSON. This usually means:', error.message);
          console.error('• API endpoint not found (404)');
          console.error('• Server error returning error page');
          console.error('• Route mismatch between frontend and backend');
        } else {
          console.error('Query error:', error);
        }
      }
    },
    onSuccess: () => {
      queryCount++;
      if (queryCount % 10 === 0) {
        // Check memory usage every 10 queries
        cleanupOldQueries();
      }
    },
  }),
  // Limit mutation cache size
  mutationCache: new MutationCache({
    onError: (error) => {
      // Handle session expiry globally for mutations - redirect to login
      if (error.message.includes('401') || error.message.includes('Authentication required')) {
        // Check if we're not already on login or public pages
        const currentPath = window.location.pathname;
        const isPublicPath = ['/', '/auth/login', '/auth/register', '/features', '/pricing', '/security', '/story'].includes(currentPath);
        
        if (!isPublicPath) {
          console.warn('Session expired during mutation, redirecting to login');
          window.location.href = '/auth/login';
          return;
        }
      }

      // Only log mutation errors in development
      if (process.env.NODE_ENV === 'development') {
        console.error('Mutation error:', error);
      }
    },
  }),
});

// Set up automatic memory cleanup
setInterval(() => {
  cleanupOldQueries();
}, MEMORY_CLEANUP_INTERVAL);
