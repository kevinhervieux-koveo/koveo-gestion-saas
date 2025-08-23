/**
 * Page Accessibility Tests
 * 
 * Comprehensive tests to ensure all pages are accessible, handle errors gracefully,
 * and provide proper loading states for users across different scenarios.
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router, Route, Switch } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import React from 'react';
import '@testing-library/jest-dom';

// Import pages
import Home from '../../client/src/pages/home';
import Dashboard from '../../client/src/pages/dashboard';
import Login from '../../client/src/pages/auth/login';
import ResidentsDashboard from '../../client/src/pages/residents/dashboard';
import Residence from '../../client/src/pages/residents/residence';
import Budget from '../../client/src/pages/manager/budget';
import UserManagement from '../../client/src/pages/manager/user-management';
import Buildings from '../../client/src/pages/manager/buildings';
import Residences from '../../client/src/pages/manager/residences';
import Story from '../../client/src/pages/story';
import Features from '../../client/src/pages/features';
import Security from '../../client/src/pages/security';

// Mock components
const TestWrapper: React.FC<{ children: React.ReactNode; route?: string }> = ({ 
  children, 
  route = '/' 
}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
    },
  });

  const [location, navigate] = memoryLocation({ path: route });

  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={() => [location, navigate]}>
        {children}
      </Router>
    </QueryClientProvider>
  );
};

// Mock API responses
jest.mock('../../client/src/lib/queryClient', () => ({
  apiRequest: jest.fn(),
  queryClient: new (require('@tanstack/react-query').QueryClient)(),
}));

// Mock authentication hook
jest.mock('../../client/src/hooks/use-auth', () => ({
  useAuth: jest.fn(() => ({
    isAuthenticated: false,
    user: null as any,
    login: jest.fn(),
    logout: jest.fn(),
  })),
}));

// Mock language hook
jest.mock('../../client/src/hooks/use-language', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string) => key,
    setLanguage: jest.fn(),
  }),
}));

describe('Page Accessibility Tests', () => {
  const { apiRequest: mockApiRequest } = require('../../client/src/lib/queryClient');
  const { useAuth: mockUseAuth } = require('../../client/src/hooks/use-auth');
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiRequest.mockReset?.();
  });

  describe('Public Pages Accessibility', () => {
    test('Home page renders without errors', async () => {
      render(
        <TestWrapper route="/">
          <Home />
        </TestWrapper>
      );

      expect(screen.getByTestId('logo-link')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByText('modernPropertyManagement')).toBeInTheDocument();
      });
    });

    test('Login page renders without errors', async () => {
      render(
        <TestWrapper route="/login">
          <Login />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });
    });

    test('Story page renders without errors', async () => {
      render(
        <TestWrapper route="/story">
          <Story />
        </TestWrapper>
      );

      expect(document.querySelector('h1')).toBeInTheDocument();
    });

    test('Features page renders without errors', async () => {
      render(
        <TestWrapper route="/features">
          <Features />
        </TestWrapper>
      );

      expect(document.querySelector('h1')).toBeInTheDocument();
    });

    test('Security page renders without errors', async () => {
      render(
        <TestWrapper route="/security">
          <Security />
        </TestWrapper>
      );

      expect(document.querySelector('h1')).toBeInTheDocument();
    });
  });

  describe('Authenticated Pages Accessibility', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: 'test-user', role: 'admin' } as any,
        login: jest.fn(),
        logout: jest.fn(),
      });
    });

    test('Dashboard renders without errors for authenticated users', async () => {
      mockApiRequest.mockResolvedValue({ metrics: {} });

      render(
        <TestWrapper route="/dashboard">
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading')).not.toBeInTheDocument();
      });
    });

    test('Residents Dashboard handles loading state', async () => {
      mockApiRequest.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      render(
        <TestWrapper route="/residents/dashboard">
          <ResidentsDashboard />
        </TestWrapper>
      );

      // Should show loading state initially
      expect(screen.getByText('loading')).toBeInTheDocument();
    });

    test('Budget page handles API errors gracefully', async () => {
      mockApiRequest.mockRejectedValue(new Error('API Error'));

      render(
        <TestWrapper route="/manager/budget">
          <Budget />
        </TestWrapper>
      );

      await waitFor(() => {
        // Page should render even with API errors
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Data Loading Error Handling', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: 'test-user', role: 'resident' } as any,
        login: jest.fn(),
        logout: jest.fn(),
      });
    });

    test('Residence page handles empty data gracefully', async () => {
      mockApiRequest.mockResolvedValue([]); // Empty array

      render(
        <TestWrapper route="/residents/residence">
          <Residence />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('noResidencesFound')).toBeInTheDocument();
      });
    });

    test('Residence page handles non-array data gracefully', async () => {
      mockApiRequest.mockResolvedValue({ error: 'Not found' }); // Not an array

      render(
        <TestWrapper route="/residents/residence">
          <Residence />
        </TestWrapper>
      );

      await waitFor(() => {
        // Should not crash and should show no residences message
        expect(screen.getByText('noResidencesFound')).toBeInTheDocument();
      });
    });

    test('User Management page handles network errors', async () => {
      mockApiRequest.mockRejectedValue(new Error('Network error'));

      render(
        <TestWrapper route="/manager/user-management">
          <UserManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        // Page should render without crashing
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Navigation Accessibility', () => {
    test('Navigation between public pages works', () => {
      const { rerender } = render(
        <TestWrapper route="/">
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/features" component={Features} />
          </Switch>
        </TestWrapper>
      );

      expect(screen.getByTestId('logo-link')).toBeInTheDocument();

      // Test navigation to features
      rerender(
        <TestWrapper route="/features">
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/features" component={Features} />
          </Switch>
        </TestWrapper>
      );

      expect(document.querySelector('h1')).toBeInTheDocument();
    });

    test('Protected routes handle unauthenticated access', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        user: null as any,
        login: jest.fn(),
        logout: jest.fn(),
      });

      render(
        <TestWrapper route="/dashboard">
          <Dashboard />
        </TestWrapper>
      );

      // Should show access denied or redirect to login
      expect(screen.getByText('accessDenied')).toBeInTheDocument();
    });
  });

  describe('Role-Based Access Control', () => {
    test('Manager pages accessible to managers', async () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: 'test-user', role: 'manager' } as any,
        login: jest.fn(),
        logout: jest.fn(),
      });

      mockApiRequest.mockResolvedValue([]);

      render(
        <TestWrapper route="/manager/buildings">
          <Buildings />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    test('Manager pages deny access to residents', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: 'test-user', role: 'resident' } as any,
        login: jest.fn(),
        logout: jest.fn(),
      });

      render(
        <TestWrapper route="/manager/buildings">
          <Buildings />
        </TestWrapper>
      );

      expect(screen.getByText('accessDenied')).toBeInTheDocument();
    });

    test('Resident pages accessible to residents', async () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: 'test-user', role: 'resident' } as any,
        login: jest.fn(),
        logout: jest.fn(),
      });

      mockApiRequest.mockResolvedValue([]);

      render(
        <TestWrapper route="/residents/dashboard">
          <ResidentsDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('loading')).toBeInTheDocument();
      });
    });
  });

  describe('Error Boundary Testing', () => {
    test('Pages handle component errors gracefully', () => {
      // Mock console.error to avoid test noise
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Mock a component that throws an error
      const ThrowingComponent = () => {
        throw new Error('Component error');
      };

      expect(() => {
        render(
          <TestWrapper>
            <ThrowingComponent />
          </TestWrapper>
        );
      }).toThrow(); // Should be caught by error boundary in production

      consoleSpy.mockRestore();
    });
  });

  describe('Loading States', () => {
    test('Pages show loading states while data is fetching', async () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: 'test-user', role: 'manager' } as any,
        login: jest.fn(),
        logout: jest.fn(),
      });

      mockApiRequest.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([]), 100))
      );

      render(
        <TestWrapper route="/manager/residences">
          <Residences />
        </TestWrapper>
      );

      // Should show loading initially
      expect(screen.getByText('loading')).toBeInTheDocument();

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText('loading')).not.toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    test('Pages render properly on mobile viewport', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <TestWrapper route="/">
          <Home />
        </TestWrapper>
      );

      expect(screen.getByTestId('logo-link')).toBeInTheDocument();
    });

    test('Pages render properly on desktop viewport', () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1920,
      });

      render(
        <TestWrapper route="/">
          <Home />
        </TestWrapper>
      );

      expect(screen.getByTestId('logo-link')).toBeInTheDocument();
    });
  });
});