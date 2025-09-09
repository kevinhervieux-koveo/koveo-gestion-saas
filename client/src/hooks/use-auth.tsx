import { createContext, useContext, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import type { User } from '@shared/schema';

/**
 * Authentication context interface for Koveo Gestion Quebec property management platform.
 * Provides user authentication state and actions with RBAC support.
 * 
 * Updated: September 09, 2025 with enhanced session management.
 */
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticating: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ user: User }>;
  logout: () => Promise<void>;
  hasRole: (role: string | string[]) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
}

/**
 * Authentication context for managing user state across the application.
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Authentication provider component that wraps the application.
 * Manages user authentication state and provides authentication actions.
 * @param props - Component props.
 * @param props.children - Child components to wrap with authentication context.
 * @returns JSX element providing authentication context.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [lastAuthCheck, setLastAuthCheck] = useState<number>(0);

  // Check if we're on a public page that doesn't need auth
  const isPublicPage =
    window.location.pathname.includes('/register') ||
    window.location.pathname.includes('/login') ||
    window.location.pathname.includes('/forgot-password') ||
    window.location.pathname.includes('/reset-password') ||
    window.location.pathname.includes('/accept-invitation') ||
    window.location.pathname === '/' ||
    window.location.pathname === '/features' ||
    window.location.pathname === '/pricing' ||
    window.location.pathname === '/security' ||
    window.location.pathname === '/story' ||
    window.location.pathname === '/privacy-policy' ||
    window.location.pathname === '/terms-of-service';

  // Query to get current user with optimized caching and minimal refetches
  const {
    data: userData,
    isLoading,
    isError,
    isFetching,
  } = useQuery<User | null>({
    queryKey: ['/api/auth/user'],
    enabled: true,
    queryFn: async () => {
      setIsAuthenticating(true);
      try {
        const response = await fetch('/api/auth/user', {
          credentials: 'include',
        });

        if (response.status === 401) {
          return null; // Not authenticated
        }

        if (!response.ok) {
          throw new Error(`${response.status}: ${response.statusText}`);
        }

        const userData = (await response.json()) as User;
        setLastAuthCheck(Date.now());
        return userData;
      } catch (error) {
        // Silently handle auth failures on public pages
        if (!isPublicPage) {
          // Auth error occurred
        }
        return null;
      } finally {
        setIsAuthenticating(false);
      }
    },
    retry: (failureCount, error: any) => {
      // Don't retry on 401 (not authenticated) - it's expected
      if (error?.message?.includes('401') || error?.status === 401) {
        return false;
      }
      // Retry network errors up to 2 times
      return failureCount < 2;
    },
    retryOnMount: true, // Allow retry on mount for better resilience
    staleTime: 10 * 60 * 1000, // 10 minutes - longer cache time for better UX
    gcTime: 15 * 60 * 1000, // 15 minutes garbage collection
    refetchOnWindowFocus: true, // Re-enable focus refetches for session validation
    refetchOnMount: true, // Always check on mount
    refetchInterval: false, // No automatic intervals
    networkMode: 'online', // More reliable than offlineFirst
  });

  useEffect(() => {
    // Optimistic state management - maintain user state during refetches
    if (userData !== undefined) {
      setUser(userData);
    }

    // Only redirect after a complete auth check with proper delays
    // Ensure we're not in any loading/fetching state before redirecting
    if (
      userData === null && 
      !isPublicPage && 
      !isLoading && 
      !isFetching && 
      !isAuthenticating && 
      !isError &&
      Date.now() - lastAuthCheck > 2000 // Increased to 2 second delay for stability
    ) {
      // Add longer delay to prevent flash redirects and allow for network issues
      const redirectTimer = setTimeout(() => {
        console.log('🔄 Redirecting to login due to authentication failure');
        setLocation('/login');
      }, 1000); // Increased delay
      
      return () => clearTimeout(redirectTimer);
    }
  }, [userData, isPublicPage, isLoading, isFetching, isAuthenticating, isError, lastAuthCheck, setLocation]);

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setUser(data.user);
      queryClient.setQueryData(['/api/auth/user'], data.user);
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      // Redirect to dashboard after successful login
      setLocation('/dashboard/quick-actions');
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Logout failed');
      }

      return response.json();
    },
    onSuccess: () => {
      setUser(null);
      queryClient.setQueryData(['/api/auth/user'], null);
      queryClient.clear();
      // Redirect to login page after logout
      setLocation('/login');
    },
  });

  /**
   * Login function that authenticates a user with email and password.
   *
   * @param email - User's email address.
   * @param password - User's password.
   * @returns Promise resolving to user data.
   */
  const login =
    /**
     * Async function.
     * @param email - Email parameter.
     * @param password - Password parameter.
     * @returns Promise resolving to .
     */ /**
     * Async function.
     * @param email - Email parameter.
     * @param password - Password parameter.
     * @returns Promise resolving to .
     */

    async (email: string, password: string): Promise<{ user: User }> => {
      const result = await loginMutation.mutateAsync({ email, password });
      return result;
    };

  /**
   * Logout function that ends the user session.
   */
  const logout =
    /**
     * Async function.
     * @returns Promise resolving to void=.
     */ /**
     * Async function.
     * @returns Promise resolving to void=.
     */

    async (): Promise<void> => {
      await logoutMutation.mutateAsync();
    };

  /**
   * Check if the current user has a specific role or any of the provided roles.
   *
   * @param role - Single role string or array of roles to check.
   * @returns True if user has the required role(s).
   */
  const hasRole = (role: string | string[]): boolean => {
    /**
     * If function.
     * @param !user - !user parameter.
     */
    /**
     * If function.
     * @param !user - !user parameter.
     */ /**
     * If function.
     * @param !user - !user parameter.
     */

    /**
     * If function.
     * @param !user - !user parameter.
     */

    if (!user) {
      return false;
    }
    if (Array.isArray(role)) {
      return role.includes(user.role);
    }
    return user.role === role;
  };

  /**
   * Check if the current user has any of the provided roles.
   *
   * @param roles - Array of roles to check against.
   * @returns True if user has any of the specified roles.
   */
  const hasAnyRole = (roles: string[]): boolean => {
    if (!user) {
      return false;
    }
    return roles.includes(user.role);
  };

  const _value: AuthContextType = {
    user,
    isLoading: isLoading || isFetching,
    isAuthenticating,
    isAuthenticated: !!user,
    login,
    logout,
    hasRole,
    hasAnyRole,
  };

  return <AuthContext.Provider value={_value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access authentication context.
 * Must be used within an AuthProvider.
 *
 * @returns Authentication context with user state and actions.
 * @throws Error if used outside of AuthProvider.
 */
/**
 * UseAuth function.
 * @returns Function result.
 */
/**
 * Use auth function.
 * @returns AuthContextType result.
 */
export function /**
 * Use auth function.
 * @returns AuthContextType result.
 */ /**
 * Use auth function.
 * @returns AuthContextType result.
 */

useAuth(): AuthContextType {
  const context = useContext(AuthContext); /**
   * If function.
   * @param context === undefined - context === undefined parameter.
   */ /**
   * If function.
   * @param context === undefined - context === undefined parameter.
   */

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
