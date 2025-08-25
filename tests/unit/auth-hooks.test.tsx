/**
 * @file Authentication hooks tests.
 * @description Test suite for useAuth hook and authentication functionality.
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth, AuthProvider } from '../../client/src/hooks/use-auth';

// Mock fetch globally
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// Mock API client
jest.mock('../../client/src/lib/queryClient', () => ({
  apiRequest: jest.fn(),
  queryClient: {
    invalidateQueries: jest.fn(),
  },
}));

// Mock toast
jest.mock('../../client/src/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Mock wouter
jest.mock('wouter', () => ({
  useLocation: () => ['/', jest.fn()],
}));

describe('useAuth Hook Tests', () => {
  let queryClient: QueryClient;
  let mockApiRequest: jest.Mock;

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
    mockApiRequest = require('../../client/src/lib/queryClient').apiRequest;
    mockApiRequest.mockClear();
  });

  it('should return authenticated user when logged in', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'admin',
      organizationId: 'org-123',
      isActive: true
    };

    // Mock successful user fetch - useAuth uses fetch directly via useQuery
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockUser,
      status: 200,
      statusText: 'OK',
    } as Response);

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    // Wait for the query to complete and auth state to update
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    expect(result.current.user).toEqual(mockUser);
  });

  it('should return unauthenticated when user fetch fails', async () => {
    // Mock failed user fetch
    mockApiRequest.mockRejectedValueOnce(new Error('Unauthorized'));

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('should handle network errors gracefully', async () => {
    // Mock network error
    mockApiRequest.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should start with loading state', () => {
    mockApiRequest.mockImplementation(() => new Promise(() => {
      // Intentionally empty promise for testing loading state
    }));

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should handle logout successfully', async () => {
    const mockUser = {
      id: 'user-456',
      email: 'logout@example.com',
      firstName: 'Logout',
      lastName: 'Test',
      role: 'user',
      organizationId: 'org-456',
      isActive: true
    };

    // Mock initial authenticated state
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockUser,
      status: 200,
      statusText: 'OK',
    } as Response);
    
    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    // Mock logout success via fetch (since logout uses fetch directly)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    } as Response);
    
    // Test logout functionality
    await result.current.logout();

    expect(mockFetch).toHaveBeenCalledWith('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  });

  it('should handle logout errors', async () => {
    // First mock for the initial user fetch
    mockApiRequest.mockResolvedValueOnce(null);
    
    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Mock logout error via fetch
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Logout failed' })
    } as Response);

    try {
      await result.current.logout();
    } catch (_error) {
      expect(_error).toBeInstanceOf(Error);
    }
  });
});