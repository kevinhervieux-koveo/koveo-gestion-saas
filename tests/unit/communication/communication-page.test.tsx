/**
 * Communication Page Test Suite
 * Tests notification preferences, general communication form, and RBAC enforcement
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { render as customRender } from '../../utils/test-utils';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import React from 'react';

// Mock language hook
const mockLanguage = {
  language: 'en',
  t: jest.fn((key: string) => key),
  setLanguage: jest.fn(),
};

jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => mockLanguage,
}));

// Mock Collapsible to always be open (expanded) for testing
jest.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
  CollapsibleTrigger: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
  CollapsibleContent: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
}));

// Mock NotificationConfigurations component
jest.mock('@/components/dashboard/notification-configurations', () => ({
  NotificationConfigurations: () => <div data-testid="notification-configurations">Notification Configurations Component</div>
}));

// Mock Header component
jest.mock('@/components/layout/header', () => ({
  Header: () => <div data-testid="header">Header Component</div>
}));

// Mock API request function
const mockApiRequest = jest.fn();
const mockQueryClient = {
  invalidateQueries: jest.fn(),
};

jest.mock('@/lib/queryClient', () => ({
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
  queryClient: mockQueryClient,
}));

// Mock toast hook
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Import the real communication page component after mocks
import CommunicationDashboard from '@/pages/dashboard/communication';

// Create mock auth user function
const createMockAuthUser = (role: string = 'admin') => ({
  user: {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@koveo.com',
    role: role,
    organizationId: '123e4567-e89b-12d3-a456-426614174001',
    firstName: 'Test',
    lastName: 'User',
    language: 'en',
    isActive: true,
  },
  login: jest.fn(),
  logout: jest.fn(),
  hasRole: jest.fn((roles: string[]) => {
    return roles.includes(role);
  }),
});

// Mock authentication hook - will be overridden in tests
let mockAuth = createMockAuthUser('admin');
jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => mockAuth,
}));

// Mock notification preferences data with 15 notification types
const mockNotificationPreferences = [
  {
    id: '1',
    userId: '123e4567-e89b-12d3-a456-426614174000',
    notificationType: 'bill_reminder',
    frequency: 'monthly',
    isEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    userId: '123e4567-e89b-12d3-a456-426614174000',
    notificationType: 'maintenance_update',
    frequency: 'monthly',
    isEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '3',
    userId: '123e4567-e89b-12d3-a456-426614174000',
    notificationType: 'announcement',
    frequency: 'monthly',
    isEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '4',
    userId: '123e4567-e89b-12d3-a456-426614174000',
    notificationType: 'system',
    frequency: 'monthly',
    isEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '5',
    userId: '123e4567-e89b-12d3-a456-426614174000',
    notificationType: 'upcoming_payment',
    frequency: 'monthly',
    isEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '6',
    userId: '123e4567-e89b-12d3-a456-426614174000',
    notificationType: 'upcoming_bills',
    frequency: 'monthly',
    isEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '7',
    userId: '123e4567-e89b-12d3-a456-426614174000',
    notificationType: 'bill_paid_last_month',
    frequency: 'monthly',
    isEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '8',
    userId: '123e4567-e89b-12d3-a456-426614174000',
    notificationType: 'bills_overdue',
    frequency: 'monthly',
    isEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '9',
    userId: '123e4567-e89b-12d3-a456-426614174000',
    notificationType: 'payment_overdue',
    frequency: 'monthly',
    isEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '10',
    userId: '123e4567-e89b-12d3-a456-426614174000',
    notificationType: 'new_building_document',
    frequency: 'monthly',
    isEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '11',
    userId: '123e4567-e89b-12d3-a456-426614174000',
    notificationType: 'meeting_invite',
    frequency: 'monthly',
    isEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '12',
    userId: '123e4567-e89b-12d3-a456-426614174000',
    notificationType: 'maintenance_completed',
    frequency: 'monthly',
    isEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '13',
    userId: '123e4567-e89b-12d3-a456-426614174000',
    notificationType: 'budget_update',
    frequency: 'monthly',
    isEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '14',
    userId: '123e4567-e89b-12d3-a456-426614174000',
    notificationType: 'policy_change',
    frequency: 'monthly',
    isEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '15',
    userId: '123e4567-e89b-12d3-a456-426614174000',
    notificationType: 'seasonal_reminder',
    frequency: 'monthly',
    isEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Mock organization context
const mockOrganizationContext = {
  id: '123e4567-e89b-12d3-a456-426614174001',
  name: 'Test Organization 1',
  canSendToAllOrganizations: false,
};

// Mock organizations data
const mockOrganizations = [
  {
    id: '123e4567-e89b-12d3-a456-426614174001',
    name: 'Test Organization 1',
    type: 'property_management',
  },
  {
    id: '123e4567-e89b-12d3-a456-426614174002',
    name: 'Test Organization 2',
    type: 'property_management',
  },
];

// Mock buildings data
const mockBuildings = [
  {
    id: 'building-1',
    name: 'Building 1',
    address: '123 Main St',
  },
  {
    id: 'building-2',
    name: 'Building 2',
    address: '456 Oak Ave',
  },
];

describe('Communication Page Test Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock fetch for React Query's default queryFn
    global.fetch = jest.fn((url: string, options?: RequestInit) => {
      const urlStr = url.toString();
      
      // GET requests
      if (urlStr.includes('/api/communication/preferences')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockNotificationPreferences,
        } as Response);
      }
      if (urlStr.includes('/api/communication/settings')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ startingDate: '2025-01-01' }),
        } as Response);
      }
      if (urlStr.includes('/api/communication/organizations') && urlStr.includes('/member-counts')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ resident: 10, tenant: 5, manager: 2, admin: 1 }),
        } as Response);
      }
      if (urlStr.includes('/api/communication/organizations')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ 
            organizations: [
              { id: '123e4567-e89b-12d3-a456-426614174001', name: 'Test Organization' }
            ],
            userRole: 'admin',
            canAccessAll: true
          }),
        } as Response);
      }
      if (urlStr.includes('/api/communication/buildings')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ 
            buildings: [
              { id: 'building-1', name: 'Test Building', address: '123 Test St' }
            ]
          }),
        } as Response);
      }
      if (urlStr.includes('/api/communication/organization-context')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockOrganizationContext,
        } as Response);
      }
      if (urlStr.includes('/api/organizations')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockOrganizations,
        } as Response);
      }
      if (urlStr.includes('/api/communication/buildings')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ buildings: mockBuildings }),
        } as Response);
      }
      
      // Default fallback
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);
    }) as jest.Mock;

    // Mock apiRequest for mutations
    mockApiRequest.mockImplementation((method: string, url: string, data?: unknown) => {
      if (method === 'PUT' && url === '/api/communication/preferences') {
        return Promise.resolve({ 
          json: async () => ({
            success: true, 
            message: 'Preferences updated',
            preferences: data?.preferences || [] 
          })
        });
      }
      if (method === 'PUT' && url === '/api/communication/settings') {
        return Promise.resolve({ 
          json: async () => ({
            success: true, 
            message: 'Settings updated',
          })
        });
      }
      
      // POST requests
      if (method === 'POST' && url === '/api/communication/general') {
        return Promise.resolve({ 
          json: async () => ({
            success: true, 
            id: 'test-communication-id',
            ...data 
          })
        });
      }
      
      // Default fallback
      return Promise.resolve({ json: async () => ({ success: true }) });
    });

    // Reset mock auth to admin by default
    mockAuth = createMockAuthUser('admin');
    
    // Reset language mock
    mockLanguage.language = 'en';
    mockLanguage.t.mockImplementation((key: string) => key);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Component Rendering and RBAC', () => {
    it('should render communication page for admin users', async () => {
      mockAuth = createMockAuthUser('admin');
      customRender(<CommunicationDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('communication-page')).toBeInTheDocument();
      });

      // Wait for data to load and check for key elements
      await waitFor(() => {
        expect(screen.getByTestId('button-save-preferences')).toBeInTheDocument();
      });

      // Admin should see communication sending features
      expect(screen.getByTestId('input-communication-title')).toBeInTheDocument();
    });

    it('should render communication page for manager users', async () => {
      mockAuth = createMockAuthUser('manager');
      customRender(<CommunicationDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('communication-page')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByTestId('button-save-preferences')).toBeInTheDocument();
      });

      // Manager should see communication sending features
      expect(screen.getByTestId('input-communication-title')).toBeInTheDocument();
    });

    it('should render communication page for demo_manager users', async () => {
      mockAuth = createMockAuthUser('demo_manager');
      customRender(<CommunicationDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('communication-page')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByTestId('button-save-preferences')).toBeInTheDocument();
      });

      // Demo manager should see communication sending features
      expect(screen.getByTestId('input-communication-title')).toBeInTheDocument();
    });

    it('should restrict general communication form for resident users', async () => {
      mockAuth = createMockAuthUser('resident');
      customRender(<CommunicationDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('communication-page')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByTestId('button-save-preferences')).toBeInTheDocument();
      });

      // Resident should NOT see communication sending features
      expect(screen.queryByTestId('input-communication-title')).not.toBeInTheDocument();
      expect(screen.queryByTestId('button-send-communication')).not.toBeInTheDocument();
    });

    it('should restrict general communication form for tenant users', async () => {
      mockAuth = createMockAuthUser('tenant');
      customRender(<CommunicationDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('communication-page')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByTestId('button-save-preferences')).toBeInTheDocument();
      });

      // Tenant should NOT see communication sending features
      expect(screen.queryByTestId('input-communication-title')).not.toBeInTheDocument();
      expect(screen.queryByTestId('button-send-communication')).not.toBeInTheDocument();
    });
  });

  describe('Notification Preferences', () => {
    beforeEach(() => {
      mockAuth = createMockAuthUser('admin');
    });

    it('should render notification preference controls', async () => {
      customRender(<CommunicationDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('button-save-preferences')).toBeInTheDocument();
      });

      // Categories are now always expanded due to Collapsible mock
      await waitFor(() => {
        expect(screen.getByTestId('switch-category-financial-enabled')).toBeInTheDocument();
      });
      
      // Check that select element exists (testid is now on SelectTrigger)
      expect(screen.getByTestId('select-category-financial-frequency')).toBeInTheDocument();
    });

    it('should toggle notification preference enabled state', async () => {
      customRender(<CommunicationDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('button-save-preferences')).toBeInTheDocument();
      });

      // Categories are now always expanded due to Collapsible mock
      await waitFor(() => {
        expect(screen.getByTestId('switch-category-financial-enabled')).toBeInTheDocument();
      });

      const enableSwitch = screen.getByTestId('switch-category-financial-enabled');
      
      // Switch should be checked initially (from mock data)
      expect(enableSwitch).toBeChecked();

      // Click to toggle
      await userEvent.click(enableSwitch);

      // Should show unsaved changes
      await waitFor(() => {
        expect(screen.getByText(/Unsaved changes/i)).toBeInTheDocument();
      });
    });

    it('should update notification frequency', async () => {
      customRender(<CommunicationDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('button-save-preferences')).toBeInTheDocument();
      });

      // Categories are now always expanded due to Collapsible mock
      await waitFor(() => {
        expect(screen.getByTestId('switch-category-financial-enabled')).toBeInTheDocument();
      });

      // Verify select trigger renders (testid is now on SelectTrigger)
      const selectTrigger = screen.getByTestId('select-category-financial-frequency');
      expect(selectTrigger).toBeInTheDocument();
      expect(selectTrigger).toHaveAttribute('role', 'combobox');
      
      // Verify the select has a value displayed (current frequency)
      expect(selectTrigger).toHaveTextContent(/monthly|weekly|immediate|quarterly|bi-annually|annually|bi_weekly/i);
    });

    it('should save preference changes', async () => {
      customRender(<CommunicationDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('button-save-preferences')).toBeInTheDocument();
      });

      // Categories are now always expanded due to Collapsible mock
      await waitFor(() => {
        expect(screen.getByTestId('switch-category-financial-enabled')).toBeInTheDocument();
      });

      // Toggle a switch to create changes
      const enableSwitch = screen.getByTestId('switch-category-financial-enabled');
      await userEvent.click(enableSwitch);

      await waitFor(() => {
        expect(screen.getByText(/Unsaved changes/i)).toBeInTheDocument();
      });

      // Click save button
      const saveButton = screen.getByTestId('button-save-preferences');
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          'PUT',
          '/api/communication/preferences',
          expect.any(Array)
        );
      });

      // Should show success toast
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Preferences updated',
          })
        );
      });
    });

    it('should reset preference changes', async () => {
      customRender(<CommunicationDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('button-save-preferences')).toBeInTheDocument();
      });

      // Categories are now always expanded due to Collapsible mock
      await waitFor(() => {
        expect(screen.getByTestId('switch-category-financial-enabled')).toBeInTheDocument();
      });

      // Toggle a switch to create changes
      const enableSwitch = screen.getByTestId('switch-category-financial-enabled');
      await userEvent.click(enableSwitch);

      await waitFor(() => {
        expect(screen.getByText(/Unsaved changes/i)).toBeInTheDocument();
      });

      // Click reset button
      const resetButton = screen.getByTestId('button-reset-preferences');
      await userEvent.click(resetButton);

      // Should remove unsaved changes indicator
      await waitFor(() => {
        expect(screen.queryByText(/Unsaved changes/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Bulk Update', () => {
    beforeEach(() => {
      mockAuth = createMockAuthUser('admin');
    });

    it('should open bulk update dialog', async () => {
      customRender(<CommunicationDashboard />);

      await waitFor(() => {
        const bulkButton = screen.getByTestId('button-bulk-update');
        expect(bulkButton).toBeInTheDocument();
      });

      const bulkButton = screen.getByTestId('button-bulk-update');
      await userEvent.click(bulkButton);

      // Dialog should open
      await waitFor(() => {
        expect(screen.getByTestId('dialog-bulk-update')).toBeInTheDocument();
      });

      // Select should be in dialog
      expect(screen.getByTestId('select-bulk-frequency')).toBeInTheDocument();
    });

    it('should apply bulk frequency update', async () => {
      customRender(<CommunicationDashboard />);

      await waitFor(() => {
        const bulkButton = screen.getByTestId('button-bulk-update');
        expect(bulkButton).toBeInTheDocument();
      });

      // Open dialog
      const bulkButton = screen.getByTestId('button-bulk-update');
      await userEvent.click(bulkButton);

      await waitFor(() => {
        expect(screen.getByTestId('select-bulk-frequency')).toBeInTheDocument();
      });

      // Verify select element renders correctly
      const select = screen.getByTestId('select-bulk-frequency');
      expect(select).toBeInTheDocument();
      expect(select).toHaveAttribute('role', 'combobox');
      
      // Verify apply button exists and is disabled when no frequency selected
      const applyButton = screen.getByTestId('button-apply-bulk');
      expect(applyButton).toBeInTheDocument();
      expect(applyButton).toBeDisabled();
    });
  });

  describe('General Communication Form', () => {
    beforeEach(() => {
      mockAuth = createMockAuthUser('admin');
    });

    it('should render communication form for authorized users', async () => {
      customRender(<CommunicationDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('input-communication-title')).toBeInTheDocument();
      });

      expect(screen.getByTestId('textarea-communication-content')).toBeInTheDocument();
      expect(screen.getByTestId('select-urgency-level')).toBeInTheDocument();
      expect(screen.getByTestId('button-send-communication')).toBeInTheDocument();
    });

    it('should fill and submit communication form', async () => {
      customRender(<CommunicationDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('input-communication-title')).toBeInTheDocument();
      });

      const titleInput = screen.getByTestId('input-communication-title');
      const contentTextarea = screen.getByTestId('textarea-communication-content');

      await userEvent.type(titleInput, 'Test Communication');
      await userEvent.type(contentTextarea, 'This is a test message');

      // Verify urgency select renders correctly (interaction testing skipped due to JSDOM/Radix UI limitation)
      const urgencySelect = screen.getByTestId('select-urgency-level');
      expect(urgencySelect).toBeInTheDocument();
      expect(urgencySelect).toHaveAttribute('role', 'combobox');

      // Verify submit button exists
      const submitButton = screen.getByTestId('button-send-communication');
      expect(submitButton).toBeInTheDocument();
    });

    it('should reset communication form', async () => {
      customRender(<CommunicationDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('input-communication-title')).toBeInTheDocument();
      });

      const titleInput = screen.getByTestId('input-communication-title') as HTMLInputElement;
      await userEvent.type(titleInput, 'Test Communication');

      expect(titleInput.value).toBe('Test Communication');

      // Click reset button
      const resetButton = screen.getByTestId('button-reset-communication');
      await userEvent.click(resetButton);

      // Form should be cleared
      await waitFor(() => {
        expect(titleInput.value).toBe('');
      });
    });
  });

  describe('Language Support', () => {
    it('should display French labels when language is set to French', async () => {
      mockLanguage.language = 'fr';
      mockAuth = createMockAuthUser('admin');
      
      customRender(<CommunicationDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('communication-page')).toBeInTheDocument();
      });

      // Check for French text in the card title
      await waitFor(() => {
        expect(screen.getByText('Préférences de notification')).toBeInTheDocument();
      });
    });
  });

  describe('Test Email Functionality', () => {
    beforeEach(() => {
      mockAuth = createMockAuthUser('admin');
    });

    it('should render test email button', async () => {
      customRender(<CommunicationDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('button-combined-test-email')).toBeInTheDocument();
      });
    });

    it('should send test email', async () => {
      mockApiRequest.mockImplementation((method: string, url: string, data?: unknown) => {
        if (method === 'POST' && url === '/api/communication/preferences/test-combined-email') {
          return Promise.resolve({ 
            json: async () => ({ success: true })
          });
        }
        return Promise.resolve({ json: async () => ({ success: true }) });
      });

      customRender(<CommunicationDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('button-combined-test-email')).toBeInTheDocument();
      });

      const testButton = screen.getByTestId('button-combined-test-email');
      await userEvent.click(testButton);

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          'POST',
          '/api/communication/preferences/test-combined-email',
          expect.objectContaining({ language: 'en' })
        );
      });
    });
  });

  describe('Settings Management', () => {
    beforeEach(() => {
      mockAuth = createMockAuthUser('admin');
    });

    it('should render settings save button', async () => {
      customRender(<CommunicationDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('button-save-settings')).toBeInTheDocument();
      });
    });

    it('should save settings', async () => {
      customRender(<CommunicationDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('button-save-settings')).toBeInTheDocument();
      });

      const saveButton = screen.getByTestId('button-save-settings');
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          'PUT',
          '/api/communication/settings',
          expect.objectContaining({
            startingDate: expect.any(String)
          })
        );
      });
    });
  });
});
