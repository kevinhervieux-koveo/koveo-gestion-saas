/**
 * Final Infrastructure Test - Tests all fixes without database imports
 * Verifies that our infrastructure improvements work correctly
 */

import React from 'react';
import { renderWithProviders, createMockUser, cleanupTestUtils } from '@/test-utils';
import { screen, waitFor } from '@testing-library/react';

// Simple test component that only tests API and rendering
const SimpleTestComponent: React.FC = () => {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // Test API call with our mocked fetch
    fetch('/api/users')
      .then(res => res.json())
      .then(result => {
        setData(result);
        setLoading(false);
      })
      .catch(err => {
        console.error('API call failed:', err);
        setData({ error: err.message });
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

describe('Final Infrastructure Tests', () => {
  afterEach(() => {
    cleanupTestUtils();
  });

  test('API mocking works correctly with realistic responses', async () => {
    renderWithProviders(<SimpleTestComponent />);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    }, { timeout: 5000 });

    // Check that API call succeeded  
    expect(screen.getByTestId('api-success')).toBeInTheDocument();
    expect(screen.getByTestId('data-available')).toHaveTextContent('true');
    
    // Verify mock data structure matches our API handlers
    const mockDataElement = screen.getByTestId('mock-data');
    const data = JSON.parse(mockDataElement.textContent || '{}');
    expect(data.success).toBe(true);
    expect(data.data).toEqual([
      { id: 'user1', email: 'user1@example.com', role: 'resident' },
      { id: 'user2', email: 'user2@example.com', role: 'manager' }
    ]);
  });

  test('Multiple API endpoints work correctly', async () => {
    const TestMultiApiComponent: React.FC = () => {
      const [usersData, setUsersData] = React.useState(null);
      const [buildingsData, setBuildingsData] = React.useState(null);
      const [ready, setReady] = React.useState(false);

      React.useEffect(() => {
        Promise.all([
          fetch('/api/users').then(r => r.json()),
          fetch('/api/buildings').then(r => r.json())
        ]).then(([users, buildings]) => {
          setUsersData(users);
          setBuildingsData(buildings);
          setReady(true);
        });
      }, []);

      if (!ready) return <div data-testid="loading">Loading...</div>;

      return (
        <div>
          <div data-testid="users-success">{usersData ? 'users-ok' : 'users-fail'}</div>
          <div data-testid="buildings-success">{buildingsData ? 'buildings-ok' : 'buildings-fail'}</div>
        </div>
      );
    };

    renderWithProviders(<TestMultiApiComponent />);
    
    await waitFor(() => {
      expect(screen.getByTestId('users-success')).toHaveTextContent('users-ok');
      expect(screen.getByTestId('buildings-success')).toHaveTextContent('buildings-ok');
    }, { timeout: 5000 });
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

  test('Render with providers works correctly', () => {
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
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const duration = Date.now() - start;
    expect(duration).toBeGreaterThan(1900);
    
    // Should complete without timing out
    expect(true).toBe(true);
  }, 15000);

  test('Auth endpoints return proper responses', async () => {
    // Test auth login endpoint
    const loginResponse = await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', password: 'password' })
    });
    const loginData = await loginResponse.json();
    
    expect(loginData.success).toBe(true);
    expect(loginData.user).toBeDefined();
    expect(loginData.user.email).toBe('testuser@example.com');
    
    // Test auth user endpoint
    const userResponse = await fetch('/api/auth/user');
    const userData = await userResponse.json();
    
    expect(userData.id).toBe('test-user-id');
    expect(userData.email).toBe('testuser@example.com');
  });
});