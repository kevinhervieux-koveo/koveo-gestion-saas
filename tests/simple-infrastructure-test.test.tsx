/**
 * Simple Infrastructure Test - Verifies core test infrastructure fixes
 * Tests basic functionality without complex auth/routing integration
 */

import React from 'react';
import { renderWithProviders, createMockUser, cleanupTestUtils } from '@/test-utils';
import { screen, waitFor } from '@testing-library/react';

// Simple test component
const SimpleTestComponent: React.FC = () => {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // Test API call
    fetch('/api/users')
      .then(res => res.json())
      .then(result => {
        setData(result);
        setLoading(false);
      })
      .catch(err => {
        console.error('API call failed:', err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div data-testid="loading">Loading...</div>;

  return (
    <div>
      <div data-testid="api-success">API Call Success</div>
      <div data-testid="data-available">{data ? 'true' : 'false'}</div>
      <div data-testid="mock-data">{JSON.stringify(data)}</div>
    </div>
  );
};

describe('Infrastructure Core Tests', () => {
  afterEach(() => {
    cleanupTestUtils();
  });

  test('API mocking works correctly', async () => {
    renderWithProviders(<SimpleTestComponent />);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });

    // Check that API call succeeded  
    expect(screen.getByTestId('api-success')).toBeInTheDocument();
    expect(screen.getByTestId('data-available')).toHaveTextContent('true');
    
    // Verify mock data structure
    const mockData = screen.getByTestId('mock-data');
    const data = JSON.parse(mockData.textContent || '{}');
    expect(data.success).toBe(true);
  });

  test('Database mocking prevents real connections', async () => {
    // Import server modules - should not throw or connect to real DB
    const dbModule = await import('../server/db');
    const storageModule = await import('../server/storage');
    
    expect(dbModule.db).toBeDefined();
    expect(storageModule.storage).toBeDefined();
    
    // Verify these are mocked
    const result = await dbModule.db.select();
    expect(result).toBeDefined();
  });

  test('Mock user utilities work correctly', () => {
    const user = createMockUser();
    expect(user.id).toBe('test-user-id');
    expect(user.email).toBe('testuser@example.com');
    expect(user.role).toBe('admin');
    
    const customUser = createMockUser({ role: 'resident', firstName: 'Custom' });
    expect(customUser.role).toBe('resident');
    expect(customUser.firstName).toBe('Custom');
  });

  test('Render with providers works without errors', () => {
    const TestComponent = () => <div data-testid="test">Test Component</div>;
    
    renderWithProviders(<TestComponent />);
    expect(screen.getByTestId('test')).toBeInTheDocument();
  });

  test('Memory router configuration works', () => {
    const RouterTestComponent = () => <div data-testid="router">Router Works</div>;
    
    renderWithProviders(<RouterTestComponent />, { 
      initialRoute: '/test-route' 
    });
    
    expect(screen.getByTestId('router')).toBeInTheDocument();
  });

  test('Test timeout allows for longer operations', async () => {
    const start = Date.now();
    
    // Simulate longer operation (but under timeout)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const duration = Date.now() - start;
    expect(duration).toBeGreaterThan(1400);
    
    // Should complete without timing out
    expect(true).toBe(true);
  }, 10000);
});