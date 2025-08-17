/**
 * @file Comprehensive routing tests for Koveo Gestion application
 * Tests route registration, authentication, role-based access, and navigation.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router as WouterRouter } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import App from '@/App';
import { AuthProvider } from '@/hooks/use-auth';
import { LanguageProvider } from '@/hooks/use-language';

// Mock the API requests
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Route Validation Tests', () => {
  let queryClient: QueryClient;
  let hook: ReturnType<typeof memoryLocation>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
    hook = memoryLocation({ path: '/' });
    mockFetch.mockClear();
  });

  const renderWithProviders = (initialPath = '/') => {
    hook = memoryLocation({ path: initialPath });
    
    return render(
      <WouterRouter hook={hook}>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </WouterRouter>
    );
  };

  describe('Public Routes', () => {
    beforeEach(() => {
      // Mock unauthenticated state
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Authentication required' })
      });
    });

    test('should render home page at /', async () => {
      renderWithProviders('/');
      
      await waitFor(() => {
        expect(screen.getByText(/Modern Property Management/i)).toBeInTheDocument();
      });
    });

    test('should render login page at /login', async () => {
      renderWithProviders('/login');
      
      await waitFor(() => {
        expect(screen.getByText(/Sign in to your account/i)).toBeInTheDocument();
      });
    });

    test('should render invitation acceptance page at /accept-invitation', async () => {
      renderWithProviders('/accept-invitation');
      
      await waitFor(() => {
        expect(screen.getByText(/Accept Invitation/i)).toBeInTheDocument();
      });
    });

    test('should redirect unauthorized users to home from protected routes', async () => {
      renderWithProviders('/admin/organizations');
      
      await waitFor(() => {
        expect(hook.value).toBe('/');
      });
    });
  });

  describe('Authenticated Routes', () => {
    const mockUser = {
      id: 'test-user-id',
      email: 'admin@test.com',
      role: 'admin',
      firstName: 'Test',
      lastName: 'Admin',
      organizationId: 'test-org-id',
      isActive: true
    };

    beforeEach(() => {
      // Mock authenticated state
      mockFetch.mockImplementation((url) => {
        if (url === '/api/auth/user') {
          return Promise.resolve({
            ok: true,
            json: async () => mockUser
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({})
        });
      });
    });

    describe('Admin Routes', () => {
      test('should render admin organizations page', async () => {
        renderWithProviders('/admin/organizations');
        
        await waitFor(() => {
          expect(screen.getByText(/Organization Management/i)).toBeInTheDocument();
        });
      });

      test('should render admin documentation page', async () => {
        renderWithProviders('/admin/documentation');
        
        await waitFor(() => {
          expect(screen.getByText(/Documentation/i)).toBeInTheDocument();
        });
      });

      test('should NOT render removed /admin/dashboard route', async () => {
        renderWithProviders('/admin/dashboard');
        
        await waitFor(() => {
          // Should show 404 page
          expect(screen.getByText(/404/i)).toBeInTheDocument();
        });
      });
    });

    describe('Owner Routes', () => {
      test('should render owner dashboard', async () => {
        mockUser.role = 'owner';
        renderWithProviders('/owner/dashboard');
        
        await waitFor(() => {
          expect(screen.getByText(/Owner Dashboard/i)).toBeInTheDocument();
        });
      });
    });

    describe('Manager Routes', () => {
      test('should render manager buildings page', async () => {
        mockUser.role = 'manager';
        renderWithProviders('/manager/buildings');
        
        await waitFor(() => {
          expect(screen.getByText(/Building Management/i)).toBeInTheDocument();
        });
      });

      test('should render user management for managers', async () => {
        mockUser.role = 'manager';
        renderWithProviders('/manager/user-management');
        
        await waitFor(() => {
          expect(screen.getByText(/User Management/i)).toBeInTheDocument();
        });
      });
    });

    describe('Resident Routes', () => {
      test('should render dashboard for residents', async () => {
        mockUser.role = 'resident';
        renderWithProviders('/dashboard');
        
        await waitFor(() => {
          expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
        });
      });
    });
  });

  describe('Route Navigation', () => {
    test('should navigate between routes correctly', async () => {
      // Start at home
      renderWithProviders('/');
      expect(hook.value).toBe('/');
      
      // Navigate to login
      hook[1]('/login');
      await waitFor(() => {
        expect(hook.value).toBe('/login');
      });
      
      // Navigate back to home
      hook[1]('/');
      await waitFor(() => {
        expect(hook.value).toBe('/');
      });
    });
  });

  describe('Build Cache Validation', () => {
    test('should not have references to removed routes in build', () => {
      // This test would run in CI/CD to check build output
      // For now, we'll check that the route is not in our route definitions
      const appSource = require('../../client/src/App.tsx');
      const sourceCode = appSource.toString();
      
      // Check that removed routes are not present
      expect(sourceCode).not.toContain('/admin/dashboard');
      
      // Check that current routes are present
      expect(sourceCode).toContain('/owner/dashboard');
      expect(sourceCode).toContain('/admin/organizations');
    });
  });
});