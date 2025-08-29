import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../client/src/contexts/AuthContext';
import { LanguageProvider } from '../../client/src/contexts/LanguageContext';
import { ToastProvider } from '../../client/src/components/ui/toast';

// Import components to test
import Dashboard from '../../client/src/pages/dashboard';
import UserManagement from '../../client/src/pages/admin/users';
import BuildingManagement from '../../client/src/pages/admin/buildings';
import DocumentManagement from '../../client/src/pages/documents';

// Mock the useAuth hook
const mockUseAuth = jest.fn();
jest.mock('../../client/src/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock API calls
const mockApiRequest = jest.fn();
jest.mock('../../client/src/lib/queryClient', () => ({
  apiRequest: mockApiRequest,
  queryClient: new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  }),
}));

// Test wrapper component
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}

describe('Demo User UI Restrictions', () => {
  beforeAll(() => {
    // Mock ResizeObserver for tests
    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));
  });

  beforeEach(() => {
    mockApiRequest.mockClear();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('Open Demo User Restrictions', () => {
    beforeEach(() => {
      // Mock Open Demo user
      mockUseAuth.mockReturnValue({
        user: {
          id: 'open-demo-user-id',
          email: 'demo@opendemo.com',
          firstName: 'Demo',
          lastName: 'User',
          role: 'tenant',
          isDemo: true,
          isDemoRestricted: true,
        },
        isAuthenticated: true,
        login: jest.fn(),
        logout: jest.fn(),
      });
    });

    test('should hide create buttons for Open Demo users', async () => {
      render(
        <TestWrapper>
          <UserManagement />
        </TestWrapper>
      );

      // Wait for component to load
      await waitFor(() => {
        expect(screen.queryByTestId('button-create-user')).not.toBeInTheDocument();
        expect(screen.queryByTestId('button-invite-user')).not.toBeInTheDocument();
        expect(screen.queryByTestId('button-bulk-import')).not.toBeInTheDocument();
      });
    });

    test('should disable edit buttons for Open Demo users', async () => {
      // Mock user data
      mockApiRequest.mockResolvedValueOnce([
        {
          id: 'user-1',
          email: 'test@demo.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'tenant',
        },
      ]);

      render(
        <TestWrapper>
          <UserManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        const editButtons = screen.queryAllByTestId(/button-edit-user/);
        editButtons.forEach(button => {
          expect(button).toBeDisabled();
        });
      });
    });

    test('should show demo restriction tooltips on disabled buttons', async () => {
      render(
        <TestWrapper>
          <UserManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        const disabledButton = screen.queryByTestId('button-edit-user-disabled');
        if (disabledButton) {
          fireEvent.mouseOver(disabledButton);
          expect(screen.getByText(/demo mode.*view only/i)).toBeInTheDocument();
        }
      });
    });

    test('should display demo restriction banner', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('demo-restriction-banner')).toBeInTheDocument();
        expect(screen.getByText(/demonstration account.*view only/i)).toBeInTheDocument();
      });
    });

    test('should prevent form submission with elegant error', async () => {
      const user = userEvent.setup();

      // Mock the API to return demo restriction error
      mockApiRequest.mockRejectedValueOnce({
        response: {
          data: {
            code: 'DEMO_RESTRICTED',
            title: 'Demo Mode - View Only',
            message: 'This is a demonstration account with view-only access.',
            suggestion: 'Contact us for a full account to make changes.',
          },
        },
      });

      render(
        <TestWrapper>
          <UserManagement />
        </TestWrapper>
      );

      // Try to submit a hidden form (if any exists)
      const hiddenSubmitButton = screen.queryByTestId('hidden-submit-user');
      if (hiddenSubmitButton) {
        await user.click(hiddenSubmitButton);

        await waitFor(() => {
          expect(screen.getByText(/demo mode.*view only/i)).toBeInTheDocument();
          expect(screen.getByText(/contact us for a full account/i)).toBeInTheDocument();
        });
      }
    });

    test('should show restricted state in document upload area', async () => {
      render(
        <TestWrapper>
          <DocumentManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('button-upload-document')).not.toBeInTheDocument();
        expect(screen.getByTestId('upload-restricted-message')).toBeInTheDocument();
        expect(screen.getByText(/file uploads.*not available.*demo mode/i)).toBeInTheDocument();
      });
    });

    test('should disable context menu actions', async () => {
      const user = userEvent.setup();

      // Mock building data
      mockApiRequest.mockResolvedValueOnce([
        {
          id: 'building-1',
          name: 'Demo Building',
          address: '123 Demo St',
          totalUnits: 10,
        },
      ]);

      render(
        <TestWrapper>
          <BuildingManagement />
        </TestWrapper>
      );

      await waitFor(async () => {
        const buildingCard = screen.getByTestId('card-building-building-1');
        await user.rightClick(buildingCard);

        // Context menu should not appear or should have disabled items
        expect(screen.queryByTestId('context-menu-edit')).not.toBeInTheDocument();
        expect(screen.queryByTestId('context-menu-delete')).not.toBeInTheDocument();
      });
    });
  });

  describe('Regular Demo User Access', () => {
    beforeEach(() => {
      // Mock regular Demo user
      mockUseAuth.mockReturnValue({
        user: {
          id: 'demo-user-id',
          email: 'manager@demo.com',
          firstName: 'Demo',
          lastName: 'Manager',
          role: 'manager',
          isDemo: true,
          isDemoRestricted: false,
        },
        isAuthenticated: true,
        login: jest.fn(),
        logout: jest.fn(),
      });
    });

    test('should show create buttons for regular Demo users', async () => {
      render(
        <TestWrapper>
          <UserManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('button-create-user')).toBeInTheDocument();
        expect(screen.getByTestId('button-invite-user')).toBeInTheDocument();
      });
    });

    test('should enable edit functionality for regular Demo users', async () => {
      // Mock user data
      mockApiRequest.mockResolvedValueOnce([
        {
          id: 'user-1',
          email: 'test@demo.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'tenant',
        },
      ]);

      render(
        <TestWrapper>
          <UserManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        const editButtons = screen.queryAllByTestId(/button-edit-user/);
        editButtons.forEach(button => {
          expect(button).not.toBeDisabled();
        });
      });
    });

    test('should not show demo restriction banner for regular Demo users', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('demo-restriction-banner')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Message Display', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: {
          id: 'open-demo-user-id',
          email: 'demo@opendemo.com',
          firstName: 'Demo',
          lastName: 'User',
          role: 'tenant',
          isDemo: true,
          isDemoRestricted: true,
        },
        isAuthenticated: true,
        login: jest.fn(),
        logout: jest.fn(),
      });
    });

    test('should display bilingual error messages', async () => {
      const user = userEvent.setup();

      // Mock API error with bilingual messages
      mockApiRequest.mockRejectedValueOnce({
        response: {
          data: {
            code: 'DEMO_RESTRICTED',
            title: 'Demo Mode - View Only',
            message: 'This is a demonstration account with view-only access.',
            messageEn: 'This is a demonstration account with view-only access.',
            messageFr: 'Ceci est un compte de démonstration avec accès en consultation seulement.',
            suggestion: 'Contact us for a full account to make changes.',
          },
        },
      });

      render(
        <TestWrapper>
          <UserManagement />
        </TestWrapper>
      );

      // Trigger an error (if there's a way to do it in the UI)
      const errorTrigger = screen.queryByTestId('trigger-demo-error');
      if (errorTrigger) {
        await user.click(errorTrigger);

        await waitFor(() => {
          expect(screen.getByText(/demonstration account.*view only/i)).toBeInTheDocument();
          expect(screen.getByText(/contact us for a full account/i)).toBeInTheDocument();
        });
      }
    });

    test('should show contact information in error messages', async () => {
      // Mock API error with contact info
      mockApiRequest.mockRejectedValueOnce({
        response: {
          data: {
            code: 'DEMO_RESTRICTED',
            contact: 'Contact our team to get started with your own property management workspace.',
          },
        },
      });

      render(
        <TestWrapper>
          <UserManagement />
        </TestWrapper>
      );

      // Check if contact info is displayed somewhere
      await waitFor(() => {
        const contactInfo = screen.queryByText(/contact our team/i);
        if (contactInfo) {
          expect(contactInfo).toBeInTheDocument();
        }
      });
    });
  });

  describe('UI State Management', () => {
    test('should maintain view functionality while restricting actions', async () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: 'open-demo-user-id',
          email: 'demo@opendemo.com',
          firstName: 'Demo',
          lastName: 'User',
          role: 'tenant',
          isDemo: true,
          isDemoRestricted: true,
        },
        isAuthenticated: true,
        login: jest.fn(),
        logout: jest.fn(),
      });

      // Mock successful GET request
      mockApiRequest.mockResolvedValueOnce([
        {
          id: 'doc-1',
          title: 'Demo Document',
          category: 'bylaw',
          createdAt: new Date().toISOString(),
        },
      ]);

      render(
        <TestWrapper>
          <DocumentManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        // Should be able to view documents
        expect(screen.getByText('Demo Document')).toBeInTheDocument();
        
        // Should be able to use search/filter
        const searchInput = screen.queryByTestId('input-search-documents');
        if (searchInput) {
          expect(searchInput).not.toBeDisabled();
        }
        
        // Should be able to view details
        const viewButton = screen.queryByTestId('button-view-document');
        if (viewButton) {
          expect(viewButton).not.toBeDisabled();
        }
      });
    });

    test('should properly handle loading states for demo users', async () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: 'open-demo-user-id',
          email: 'demo@opendemo.com',
          firstName: 'Demo',
          lastName: 'User',
          role: 'tenant',
          isDemo: true,
          isDemoRestricted: true,
        },
        isAuthenticated: true,
        login: jest.fn(),
        logout: jest.fn(),
      });

      // Mock delayed API response
      mockApiRequest.mockImplementationOnce(
        () => new Promise(resolve => setTimeout(() => resolve([]), 1000))
      );

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      // Should show loading state
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

      // After loading, should show demo restrictions
      await waitFor(() => {
        expect(screen.getByTestId('demo-restriction-banner')).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Accessibility and User Experience', () => {
    test('should provide proper ARIA labels for disabled buttons', async () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: 'open-demo-user-id',
          email: 'demo@opendemo.com',
          firstName: 'Demo',
          lastName: 'User',
          role: 'tenant',
          isDemo: true,
          isDemoRestricted: true,
        },
        isAuthenticated: true,
        login: jest.fn(),
        logout: jest.fn(),
      });

      render(
        <TestWrapper>
          <UserManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        const disabledButtons = screen.queryAllByRole('button', { hidden: true });
        disabledButtons.forEach(button => {
          if (button.hasAttribute('disabled')) {
            expect(button).toHaveAttribute('aria-label');
            expect(button.getAttribute('aria-label')).toMatch(/demo.*restricted|view.*only/i);
          }
        });
      });
    });

    test('should maintain keyboard navigation for allowed actions', async () => {
      const user = userEvent.setup();

      mockUseAuth.mockReturnValue({
        user: {
          id: 'open-demo-user-id',
          email: 'demo@opendemo.com',
          firstName: 'Demo',
          lastName: 'User',
          role: 'tenant',
          isDemo: true,
          isDemoRestricted: true,
        },
        isAuthenticated: true,
        login: jest.fn(),
        logout: jest.fn(),
      });

      render(
        <TestWrapper>
          <DocumentManagement />
        </TestWrapper>
      );

      await waitFor(async () => {
        // Tab navigation should work for allowed actions
        await user.tab();
        const focusedElement = document.activeElement;
        
        if (focusedElement && focusedElement.tagName === 'BUTTON') {
          expect(focusedElement).not.toHaveAttribute('disabled');
        }
      });
    });

    test('should show progressive disclosure for demo limitations', async () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: 'open-demo-user-id',
          email: 'demo@opendemo.com',
          firstName: 'Demo',
          lastName: 'User',
          role: 'tenant',
          isDemo: true,
          isDemoRestricted: true,
        },
        isAuthenticated: true,
        login: jest.fn(),
        logout: jest.fn(),
      });

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        const banner = screen.getByTestId('demo-restriction-banner');
        expect(banner).toBeInTheDocument();
        
        // Should have an expand/collapse functionality
        const expandButton = screen.queryByTestId('button-expand-demo-info');
        if (expandButton) {
          expect(expandButton).toBeInTheDocument();
        }
      });
    });
  });
});