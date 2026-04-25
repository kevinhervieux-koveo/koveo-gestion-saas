// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
/**
 * Mock for @/hooks/use-auth.tsx - Provides controlled auth context for tests
 * This replaces the MockAuthProvider in test-utils with proper jest mocking
 */

import type { User } from '@shared/schema';

// Default mock user for tests
const createMockUser = (overrides: Partial<User> = {}): User => ({
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

// Mock auth context that can be controlled by tests
let mockAuthState = {
  user: null as User | null,
  isLoading: false,
  isAuthenticating: false,
  isAuthenticated: false,
};

// Mock functions that can be spied on and controlled
const mockLogin = jest.fn().mockResolvedValue({ user: createMockUser() });
const mockLogout = jest.fn().mockResolvedValue(undefined);
const mockHasRole = jest.fn((role: string | string[]) => {
  if (!mockAuthState.user) return false;
  if (Array.isArray(role)) return role.includes(mockAuthState.user.role);
  return mockAuthState.user.role === role;
});
const mockHasAnyRole = jest.fn((roles: string[]) => {
  if (!mockAuthState.user) return false;
  return roles.includes(mockAuthState.user.role);
});

// Mock useAuth hook
export const useAuth = jest.fn(() => ({
  user: mockAuthState.user,
  isLoading: mockAuthState.isLoading,
  isAuthenticating: mockAuthState.isAuthenticating,
  isAuthenticated: mockAuthState.isAuthenticated,
  login: mockLogin,
  logout: mockLogout,
  hasRole: mockHasRole,
  hasAnyRole: mockHasAnyRole,
}));

// Mock AuthProvider component
export const AuthProvider = jest.fn(({ children }: { children: React.ReactNode }) => {
  return children as React.ReactElement;
});

// Test utilities to control mock auth state
export const __mockAuthUtils = {
  // Set authenticated user
  setAuthenticatedUser: (user: User | Partial<User> = {}) => {
    const fullUser = createMockUser(user);
    mockAuthState = {
      user: fullUser,
      isLoading: false,
      isAuthenticating: false,
      isAuthenticated: true,
    };
    useAuth.mockReturnValue({
      user: fullUser,
      isLoading: false,
      isAuthenticating: false,
      isAuthenticated: true,
      login: mockLogin,
      logout: mockLogout,
      hasRole: mockHasRole,
      hasAnyRole: mockHasAnyRole,
    });
  },
  
  // Set unauthenticated state
  setUnauthenticated: () => {
    mockAuthState = {
      user: null,
      isLoading: false,
      isAuthenticating: false,
      isAuthenticated: false,
    };
    useAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticating: false,
      isAuthenticated: false,
      login: mockLogin,
      logout: mockLogout,
      hasRole: mockHasRole,
      hasAnyRole: mockHasAnyRole,
    });
  },
  
  // Set loading state
  setLoading: (isLoading = true) => {
    mockAuthState.isLoading = isLoading;
    useAuth.mockReturnValue({
      ...useAuth(),
      isLoading,
    });
  },
  
  // Set authenticating state
  setAuthenticating: (isAuthenticating = true) => {
    mockAuthState.isAuthenticating = isAuthenticating;
    useAuth.mockReturnValue({
      ...useAuth(),
      isAuthenticating,
    });
  },
  
  // Reset to default state
  reset: () => {
    mockAuthState = {
      user: null,
      isLoading: false,
      isAuthenticating: false,
      isAuthenticated: false,
    };
    useAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticating: false,
      isAuthenticated: false,
      login: mockLogin,
      logout: mockLogout,
      hasRole: mockHasRole,
      hasAnyRole: mockHasAnyRole,
    });
    jest.clearAllMocks();
  },
  
  // Access to mock functions for testing
  mockFunctions: {
    login: mockLogin,
    logout: mockLogout,
    hasRole: mockHasRole,
    hasAnyRole: mockHasAnyRole,
  },
  
  // Utilities for creating test users
  createMockUser,
  createMockAdminUser: (overrides: Partial<User> = {}) => createMockUser({ role: 'admin', ...overrides }),
  createMockManagerUser: (overrides: Partial<User> = {}) => createMockUser({ role: 'manager', ...overrides }),
  createMockResidentUser: (overrides: Partial<User> = {}) => createMockUser({ role: 'resident', ...overrides }),
};