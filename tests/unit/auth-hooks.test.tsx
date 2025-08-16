/**
 * @file Authentication hooks tests.
 * @description Test suite for useAuth hook and authentication functionality.
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '../../client/src/hooks/use-auth';

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

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return authenticated user when logged in', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
    };

    // Mock successful user fetch
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockUser,
    } as Response);

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
  });

  it('should return unauthenticated when user fetch fails', async () => {
    // Mock failed user fetch
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
    } as Response);

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeUndefined();
  });

  it('should handle network errors gracefully', async () => {
    // Mock network error
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should start with loading state', () => {
    global.fetch = jest.fn().mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should handle logout successfully', async () => {
    const mockApiRequest = require('../../client/src/lib/queryClient').apiRequest;
    mockApiRequest.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.logout).toBeDefined();
    });

    // Test logout functionality
    await result.current.logout.mutateAsync();

    expect(mockApiRequest).toHaveBeenCalledWith('POST', '/api/auth/logout');
  });

  it('should handle logout errors', async () => {
    const mockApiRequest = require('../../client/src/lib/queryClient').apiRequest;
    mockApiRequest.mockRejectedValueOnce(new Error('Logout failed'));

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.logout).toBeDefined();
    });

    try {
      await result.current.logout.mutateAsync();
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });
});