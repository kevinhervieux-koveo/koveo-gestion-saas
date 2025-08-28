import { createContext, useContext, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import type { User } from '@shared/schema';

/**
 * Authentication context interface for Koveo Gestion.
 * Provides user authentication state and actions throughout the application.
 */
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
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

  // Check if we're on a public page that doesn't need auth
  const isPublicPage =
    window.location.pathname.includes('/register') ||
    window.location.pathname.includes('/login') ||
    window.location.pathname.includes('/forgot-password') ||
    window.location.pathname.includes('/reset-password') ||
    window.location.pathname.includes('/accept-invitation') ||
    window.location.pathname === '/';

  // Query to get current user (always enabled, but we handle public pages differently)
  const {
    data: userData,
    isLoading,
    isError,
  } = useQuery<User | null>({
    queryKey: ['/api/auth/user'],
    enabled: true, // Always run auth query to prevent reload redirects
    queryFn: async () => {
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

        return (await response.json()) as User;
      } catch (_error) {
        // Silently handle auth failures on public pages
        if (!isPublicPage) {
          console.warn('Auth check failed:', _error);
        }
        return null;
      }
    },
    retry: false,
    staleTime: 30 * 60 * 1000, // 30 minutes - longer to prevent frequent re-auth
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: true, // Check auth when user returns to tab
    refetchOnMount: true, // Always check on mount to handle page refreshes
    refetchInterval: 15 * 60 * 1000, // Check every 15 minutes if user is active
  });

  useEffect(() => {
    setUser(userData || null);

    // If user is null (unauthorized) and we're not on a public page, redirect to login

    if (userData === null && !isPublicPage && !isLoading) {
      console.warn('Session expired, redirecting to login page');
      setLocation('/auth/login');
    }
  }, [userData, isPublicPage, isLoading, setLocation]);

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
    isLoading,
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
