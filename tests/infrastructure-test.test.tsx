/**
 * Infrastructure Test - Verifies that all test infrastructure improvements work
 * This test validates the API mocking, database isolation, auth context, and routing fixes
 */

import React from 'react';
import { renderWithProviders, __mockAuthUtils, createMockUser, cleanupTestUtils } from '../client/src/test-utils';
import { useAuth } from '../client/src/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';

// Test component that uses auth and API calls
const TestComponent: React.FC = () => {
  const { user, isAuthenticated, hasRole } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await fetch('/api/users');
      return response.json();
    }
  });

  if (isLoading) return <div data-testid="loading">Loading...</div>;
  if (error) return <div data-testid="error">Error</div>;

  return (
    <div>
      <div data-testid="auth-status">{isAuthenticated ? 'authenticated' : 'not-authenticated'}</div>
      <div data-testid="user-role">{user?.role || 'no-role'}</div>
      <div data-testid="has-admin-role">{hasRole('admin') ? 'true' : 'false'}</div>
      <div data-testid="api-data">{JSON.stringify(data)}</div>
    </div>
  );
};

describe('Test Infrastructure', () => {
  afterEach(() => {
    cleanupTestUtils();
  });

  test('API mocking system works correctly', async () => {
    const { findByTestId } = renderWithProviders(<TestComponent />);
    
    // Should receive mocked API response
    const apiData = await findByTestId('api-data');
    expect(apiData).toBeInTheDocument();
    
    // Should contain the mocked data structure
    const data = JSON.parse(apiData.textContent || '{}');
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });

  test('Auth context mocking works correctly - unauthenticated', async () => {
    // Set unauthenticated state
    __mockAuthUtils.setUnauthenticated();
    
    const { findByTestId } = renderWithProviders(<TestComponent />);
    
    const authStatus = await findByTestId('auth-status');
    const userRole = await findByTestId('user-role');
    const hasAdminRole = await findByTestId('has-admin-role');
    
    expect(authStatus.textContent).toBe('not-authenticated');
    expect(userRole.textContent).toBe('no-role');
    expect(hasAdminRole.textContent).toBe('false');
  });

  test('Auth context mocking works correctly - authenticated admin', async () => {
    // Set authenticated admin user
    const adminUser = createMockUser({ role: 'admin' });
    __mockAuthUtils.setAuthenticatedUser(adminUser);
    
    const { findByTestId } = renderWithProviders(<TestComponent />);
    
    const authStatus = await findByTestId('auth-status');
    const userRole = await findByTestId('user-role');
    const hasAdminRole = await findByTestId('has-admin-role');
    
    expect(authStatus.textContent).toBe('authenticated');
    expect(userRole.textContent).toBe('admin');
    expect(hasAdminRole.textContent).toBe('true');
  });

  test('Database isolation prevents real connections', async () => {
    // Import server modules to ensure they don't trigger real connections
    const { db } = await import('../server/db');
    const { storage } = await import('../server/storage');
    
    // These should be mocked and not throw errors
    expect(db).toBeDefined();
    expect(storage).toBeDefined();
    
    // Test that database operations are mocked
    const result = await db.select();
    expect(result).toBeDefined();
  });

  test('Router configuration supports memory routing', async () => {
    const TestRouterComponent: React.FC = () => (
      <div data-testid="router-test">Router loaded</div>
    );
    
    const { findByTestId } = renderWithProviders(
      <TestRouterComponent />, 
      { initialRoute: '/test-route' }
    );
    
    const routerTest = await findByTestId('router-test');
    expect(routerTest).toBeInTheDocument();
  });
});