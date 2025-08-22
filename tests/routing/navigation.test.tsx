/**
 * @file Navigation and sidebar integration tests
 * Tests that sidebar navigation correctly routes to pages and handles role-based visibility.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router as WouterRouter } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import Sidebar from '@/components/layout/sidebar';
import { AuthProvider } from '@/hooks/use-auth';
import { LanguageProvider } from '@/hooks/use-language';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Navigation Integration Tests', () => {
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

  const renderSidebar = (userRole = 'admin') => {
    const mockUser = {
      id: 'test-user-id',
      email: `${userRole}@test.com`,
      role: userRole,
      firstName: 'Test',
      lastName: userRole.charAt(0).toUpperCase() + userRole.slice(1),
      organizationId: 'test-org-id',
      isActive: true
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockUser
    });

    return render(
      <WouterRouter hook={hook}>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <AuthProvider>
              <Sidebar />
            </AuthProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </WouterRouter>
    );
  };

  describe('Admin Navigation', () => {
    test('should show all admin menu items', async () => {
      renderSidebar('admin');
      
      await waitFor(() => {
        expect(screen.getByText('Organizations')).toBeInTheDocument();
        expect(screen.getByText('Documentation')).toBeInTheDocument();
        expect(screen.getByText('Roadmap')).toBeInTheDocument();
        expect(screen.getByText('Quality Assurance')).toBeInTheDocument();
        expect(screen.getByText('RBAC Permissions')).toBeInTheDocument();
        expect(screen.getByText('Suggestions')).toBeInTheDocument();
        expect(screen.getByText('Pillars')).toBeInTheDocument();
      });
    });

    test('should NOT show User Management in Admin menu', async () => {
      renderSidebar('admin');
      
      await waitFor(() => {
        // User Management should NOT be in Admin section
        expect(screen.queryByText('User Management')).not.toBeInTheDocument();
      });
    });

    test('should NOT show removed Admin Dashboard item', async () => {
      renderSidebar('admin');
      
      await waitFor(() => {
        expect(screen.queryByText('Admin Dashboard')).not.toBeInTheDocument();
      });
    });

    test('should navigate to organizations when clicked', async () => {
      renderSidebar('admin');
      
      await waitFor(() => {
        const orgLink = screen.getByText('Organizations');
        fireEvent.click(orgLink);
      });
      
      expect(hook._value).toBe('/admin/organizations');
    });
  });

  describe('Owner Navigation', () => {
    test('should show owner dashboard in menu', async () => {
      renderSidebar('owner');
      
      await waitFor(() => {
        expect(screen.getByText('Owner Dashboard')).toBeInTheDocument();
      });
    });

    test('should navigate to owner dashboard when clicked', async () => {
      renderSidebar('owner');
      
      await waitFor(() => {
        const dashboardLink = screen.getByText('Owner Dashboard');
        fireEvent.click(dashboardLink);
      });
      
      expect(hook._value).toBe('/owner/dashboard');
    });
  });

  describe('Manager Navigation', () => {
    test('should show manager-specific menu items', async () => {
      renderSidebar('manager');
      
      await waitFor(() => {
        expect(screen.getByText('Buildings')).toBeInTheDocument();
        expect(screen.getByText('Residences')).toBeInTheDocument();
        expect(screen.getByText('Budget')).toBeInTheDocument();
        expect(screen.getByText('Bills')).toBeInTheDocument();
        expect(screen.getByText('User Management')).toBeInTheDocument();
      });
    });

    test('should navigate to buildings when clicked', async () => {
      renderSidebar('manager');
      
      await waitFor(() => {
        const buildingsLink = screen.getByText('Buildings');
        fireEvent.click(buildingsLink);
      });
      
      expect(hook._value).toBe('/manager/buildings');
    });
  });

  describe('Resident Navigation', () => {
    test('should show resident-specific menu items', async () => {
      renderSidebar('resident');
      
      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
        expect(screen.getByText('My Residence')).toBeInTheDocument();
        expect(screen.getByText('Building Info')).toBeInTheDocument();
        expect(screen.getByText('Maintenance Requests')).toBeInTheDocument();
      });
    });

    test('should NOT show admin or manager items for residents', async () => {
      renderSidebar('resident');
      
      await waitFor(() => {
        expect(screen.queryByText('Organizations')).not.toBeInTheDocument();
        expect(screen.queryByText('Buildings')).not.toBeInTheDocument();
        expect(screen.queryByText('User Management')).not.toBeInTheDocument();
      });
    });
  });

  describe('Route Path Validation', () => {
    test('should have correct paths for all navigation items', async () => {
      const expectedPaths = {
        admin: [
          { label: 'Organizations', path: '/admin/organizations' },
          { label: 'Documentation', path: '/admin/documentation' },
          { label: 'Roadmap', path: '/admin/roadmap' },
          { label: 'Quality Assurance', path: '/admin/quality' },
          { label: 'Permissions', path: '/admin/permissions' }
        ],
        owner: [
          { label: 'Owner Dashboard', path: '/owner/dashboard' },
          { label: 'Documentation', path: '/owner/documentation' },
          { label: 'Roadmap', path: '/owner/roadmap' }
        ],
        manager: [
          { label: 'Buildings', path: '/manager/buildings' },
          { label: 'Residences', path: '/manager/residences' },
          { label: 'Budget', path: '/manager/budget' },
          { label: 'Bills', path: '/manager/bills' },
          { label: 'User Management', path: '/manager/user-management' }
        ],
        resident: [
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'My Residence', path: '/residents/residence' },
          { label: 'Building Info', path: '/residents/building' },
          { label: 'Maintenance Requests', path: '/residents/demands' }
        ]
      };

      for (const [_role, items] of Object.entries(expectedPaths)) {
        renderSidebar(role);
        
        for (const item of items) {
          await waitFor(() => {
            const link = screen.getByText(item.label);
            fireEvent.click(link);
            expect(hook._value).toBe(item.path);
          });
        }
      }
    });
  });
});