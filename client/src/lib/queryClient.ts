import { QueryClient, QueryFunction, QueryCache, MutationCache } from '@tanstack/react-query';

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
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown
): Promise<Response> {
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
      // Allow data to become stale after 5 minutes to enable garbage collection
      staleTime: 5 * 60 * 1000, // 5 minutes
      // Cache data for 10 minutes before removal
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: false,
    },
    mutations: {
      retry: false,
      // Don't cache mutation results indefinitely
      gcTime: 2 * 60 * 1000, // 2 minutes
    },
  },
  // Limit query cache size to prevent memory bloat
  queryCache: new QueryCache({
    onError: (_error) => {
      console.error('Query _error:', _error);
    },
  }),
  // Limit mutation cache size
  mutationCache: new MutationCache({
    onError: (_error) => {
      console.error('Mutation _error:', _error);
    },
  }),
});