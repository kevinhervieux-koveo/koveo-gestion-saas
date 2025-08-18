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
 * 
 * @param children.children
 * @param children - Child components to wrap with authentication context.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<User | null>(null);

  // Check if we're on a public page that doesn't need auth
  const isPublicPage = window.location.pathname.includes('/register') || 
                       window.location.pathname.includes('/login') ||
                       window.location.pathname === '/';

  // Query to get current user (disabled for public pages)
  const { data: userData, isLoading } = useQuery<User | null>({
    queryKey: ['/api/auth/user'],
    enabled: !isPublicPage, // Only run auth query on protected pages
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
        
        return await response.json() as User;
      } catch (error) {
        console.debug('Auth check failed:', error);
        return null;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  useEffect(() => {
    setUser(userData || null);
  }, [userData]);

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
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
      setLocation('/dashboard');
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
  const login = async (email: string, password: string): Promise<{ user: User }> => {
    const result = await loginMutation.mutateAsync({ email, password });
    return result;
  };

  /**
   * Logout function that ends the user session.
   */
  const logout = async (): Promise<void> => {
    await logoutMutation.mutateAsync();
  };

  /**
   * Check if the current user has a specific role or any of the provided roles.
   * 
   * @param role - Single role string or array of roles to check.
   * @returns True if user has the required role(s).
   */
  const hasRole = (role: string | string[]): boolean => {
    if (!user) {return false;}
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
    if (!user) {return false;}
    return roles.includes(user.role);
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    hasRole,
    hasAnyRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access authentication context.
 * Must be used within an AuthProvider.
 * 
 * @returns Authentication context with user state and actions.
 * @throws Error if used outside of AuthProvider.
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}