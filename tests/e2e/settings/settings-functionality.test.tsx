/**
 * Comprehensive E2E tests for Settings Page Functionality
 * Tests all user settings features including profile updates, password changes,
 * data export, and account deletion (Law 25 compliance).
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { AuthProvider } from '@/hooks/use-auth';
import { LanguageProvider } from '@/hooks/use-language';
import Settings from '@/pages/settings/settings';

// Demo organization user data (real user from database)
const demoUser = {
  id: 'c73f4c13-31c6-4ced-a832-6f115b107360',
  firstName: 'Sophie',
  lastName: 'Laval',
  email: 'tenant@koveo-gestion.com',
  username: 'tenant',
  phone: '+1-514-555-0400',
  language: 'fr',
  role: 'tenant',
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

// Mock API handlers
const server = setupServer(
  // Auth endpoints
  rest.get('/api/auth/user', (req, res, ctx) => {
    return res(ctx.json(demoUser));
  }),

  // Profile update endpoint
  rest.put('/api/users/me', async (req, res, ctx) => {
    const body = await req.json();
    return res(
      ctx.json({
        ...demoUser,
        ...body,
        updatedAt: new Date().toISOString(),
      })
    );
  }),

  // Password change endpoint
  rest.post('/api/users/me/change-password', async (req, res, ctx) => {
    const body = await req.json();

    // Simulate current password validation
    if (body.currentPassword !== 'currentPassword123') {
      return res(ctx.status(400), ctx.json({ message: 'Current password is incorrect' }));
    }

    return res(ctx.json({ message: 'Password changed successfully' }));
  }),

  // Data export endpoint
  rest.get('/api/users/me/data-export', (req, res, ctx) => {
    const exportData = {
      personalInformation: demoUser,
      organizations: [],
      residences: [],
      bills: [],
      documents: [],
      notifications: [],
      maintenanceRequests: [],
      exportDate: new Date().toISOString(),
      note: 'This export contains all personal data we have on file for you in compliance with Quebec Law 25.',
    };

    // Return as blob for download
    return res(
      ctx.set('Content-Type', 'application/json'),
      ctx.set(
        'Content-Disposition',
        `attachment; filename="user-data-export-${demoUser.id}-${new Date().toISOString().split('T')[0]}.json"`
      ),
      ctx.json(exportData)
    );
  }),

  // Account deletion endpoint
  rest.post('/api/users/me/delete-account', async (req, res, ctx) => {
    const body = await req.json();

    // Validate email confirmation
    if (body.confirmEmail !== demoUser.email) {
      return res(ctx.status(400), ctx.json({ message: 'Email confirmation does not match' }));
    }

    return res(
      ctx.json({
        message:
          'Account successfully deleted. All personal data has been permanently removed from our systems.',
        deletionDate: new Date().toISOString(),
      })
    );
  })
);

// Test setup
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Custom render with providers
const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Router>
        <LanguageProvider>
          <AuthProvider>{component}</AuthProvider>
        </LanguageProvider>
      </Router>
    </QueryClientProvider>
  );
};

describe('Settings Page - Complete Functionality', () => {
  beforeEach(() => {
    // Mock window.URL.createObjectURL for data export tests
    global.URL.createObjectURL = jest.fn(() => 'mock-url');
    global.URL.revokeObjectURL = jest.fn();

    // Mock document methods for download simulation
    const mockClick = jest.fn();
    const mockAppendChild = jest.fn();
    const mockRemoveChild = jest.fn();

    jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') {
        return {
          click: mockClick,
          href: '',
          download: '',
        } as any;
      }
      return document.createElement(tag);
    });

    Object.defineProperty(document.body, 'appendChild', {
      value: mockAppendChild,
      writable: true,
    });

    Object.defineProperty(document.body, 'removeChild', {
      value: mockRemoveChild,
      writable: true,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('General Settings - Profile Updates', () => {
    it('renders the settings page with all sections', async () => {
      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByTestId('settings-page')).toBeInTheDocument();
        expect(screen.getByText('General Settings')).toBeInTheDocument();
        expect(screen.getByText('Security Settings')).toBeInTheDocument();
        expect(screen.getByText('Privacy & Data (Law 25 Compliance)')).toBeInTheDocument();
      });
    });

    it('loads user data into profile form', async () => {
      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByTestId('input-first-name')).toHaveValue('Sophie');
        expect(screen.getByTestId('input-last-name')).toHaveValue('Laval');
        expect(screen.getByTestId('input-email')).toHaveValue('tenant@koveo-gestion.com');
        expect(screen.getByTestId('input-username')).toHaveValue('tenant');
        expect(screen.getByTestId('input-phone')).toHaveValue('+1-514-555-0400');
      });
    });

    it('validates required fields in profile form', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByTestId('input-first-name')).toBeInTheDocument();
      });

      // Clear required fields
      await user.clear(screen.getByTestId('input-first-name'));
      await user.clear(screen.getByTestId('input-last-name'));

      // Try to submit
      await user.click(screen.getByTestId('button-save-profile'));

      await waitFor(() => {
        expect(screen.getByText('First name is required')).toBeInTheDocument();
        expect(screen.getByText('Last name is required')).toBeInTheDocument();
      });
    });

    it('successfully updates profile information', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByTestId('input-first-name')).toBeInTheDocument();
      });

      // Update profile data
      await user.clear(screen.getByTestId('input-first-name'));
      await user.type(screen.getByTestId('input-first-name'), 'Sophie');

      await user.clear(screen.getByTestId('input-last-name'));
      await user.type(screen.getByTestId('input-last-name'), 'Laval');

      await user.clear(screen.getByTestId('input-phone'));
      await user.type(screen.getByTestId('input-phone'), '+1-514-555-0401');

      // Submit form
      await user.click(screen.getByTestId('button-save-profile'));

      await waitFor(() => {
        expect(screen.getByText('Profile updated')).toBeInTheDocument();
      });
    });

    it('handles profile update errors', async () => {
      // Mock API error
      server.use(
        rest.put('/api/users/me', (req, res, ctx) => {
          return res(ctx.status(400), ctx.json({ message: 'Invalid email address' }));
        })
      );

      const user = userEvent.setup();
      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByTestId('button-save-profile')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('button-save-profile'));

      await waitFor(() => {
        expect(screen.getByText('Invalid email address')).toBeInTheDocument();
      });
    });
  });

  describe('Security Settings - Password Changes', () => {
    it('validates password form fields', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByTestId('input-current-password')).toBeInTheDocument();
      });

      // Try to submit empty form
      await user.click(screen.getByTestId('button-change-password'));

      await waitFor(() => {
        expect(screen.getByText('Current password is required')).toBeInTheDocument();
        expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
      });
    });

    it('validates password confirmation match', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByTestId('input-current-password')).toBeInTheDocument();
      });

      // Fill form with mismatched passwords
      await user.type(screen.getByTestId('input-current-password'), 'currentPassword123');
      await user.type(screen.getByTestId('input-new-password'), 'newPassword123');
      await user.type(screen.getByTestId('input-confirm-password'), 'differentPassword123');

      await user.click(screen.getByTestId('button-change-password'));

      await waitFor(() => {
        expect(screen.getByText("Passwords don't match")).toBeInTheDocument();
      });
    });

    it('toggles password visibility', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByTestId('input-current-password')).toBeInTheDocument();
      });

      const currentPasswordInput = screen.getByTestId('input-current-password');
      const toggleButton = screen.getByTestId('toggle-current-password');

      // Initially password type
      expect(currentPasswordInput).toHaveAttribute('type', 'password');

      // Toggle to text
      await user.click(toggleButton);
      expect(currentPasswordInput).toHaveAttribute('type', 'text');

      // Toggle back to password
      await user.click(toggleButton);
      expect(currentPasswordInput).toHaveAttribute('type', 'password');
    });

    it('successfully changes password', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByTestId('input-current-password')).toBeInTheDocument();
      });

      // Fill password form correctly
      await user.type(screen.getByTestId('input-current-password'), 'currentPassword123');
      await user.type(screen.getByTestId('input-new-password'), 'newPassword123');
      await user.type(screen.getByTestId('input-confirm-password'), 'newPassword123');

      await user.click(screen.getByTestId('button-change-password'));

      await waitFor(() => {
        expect(screen.getByText('Password changed')).toBeInTheDocument();
      });
    });

    it('handles incorrect current password', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByTestId('input-current-password')).toBeInTheDocument();
      });

      // Fill form with incorrect current password
      await user.type(screen.getByTestId('input-current-password'), 'wrongPassword');
      await user.type(screen.getByTestId('input-new-password'), 'newPassword123');
      await user.type(screen.getByTestId('input-confirm-password'), 'newPassword123');

      await user.click(screen.getByTestId('button-change-password'));

      await waitFor(() => {
        expect(screen.getByText('Current password is incorrect')).toBeInTheDocument();
      });
    });
  });

  describe('Law 25 Compliance - Data Export', () => {
    it('successfully exports user data', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByTestId('button-export-data')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('button-export-data'));

      await waitFor(() => {
        expect(screen.getByText('Data exported')).toBeInTheDocument();
        expect(global.URL.createObjectURL).toHaveBeenCalled();
      });
    });

    it('handles data export errors', async () => {
      // Mock API error
      server.use(
        rest.get('/api/users/me/data-export', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ message: 'Export failed' }));
        })
      );

      const user = userEvent.setup();
      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByTestId('button-export-data')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('button-export-data'));

      await waitFor(() => {
        expect(screen.getByText('Export failed')).toBeInTheDocument();
      });
    });
  });

  describe('Law 25 Compliance - Account Deletion', () => {
    it('opens account deletion dialog', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByTestId('button-delete-account')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('button-delete-account'));

      await waitFor(() => {
        expect(screen.getByTestId('dialog-delete-account')).toBeInTheDocument();
        expect(screen.getByText('Delete Account Permanently')).toBeInTheDocument();
      });
    });

    it('validates email confirmation for account deletion', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByTestId('button-delete-account')).toBeInTheDocument();
      });

      // Open dialog
      await user.click(screen.getByTestId('button-delete-account'));

      await waitFor(() => {
        expect(screen.getByTestId('input-confirm-email')).toBeInTheDocument();
      });

      // Try to submit with wrong email
      await user.type(screen.getByTestId('input-confirm-email'), 'wrong@example.com');
      await user.click(screen.getByTestId('button-confirm-delete'));

      await waitFor(() => {
        expect(screen.getByText('Email confirmation does not match')).toBeInTheDocument();
      });
    });

    it('successfully deletes account with correct email confirmation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByTestId('button-delete-account')).toBeInTheDocument();
      });

      // Open dialog
      await user.click(screen.getByTestId('button-delete-account'));

      await waitFor(() => {
        expect(screen.getByTestId('input-confirm-email')).toBeInTheDocument();
      });

      // Fill correct email and optional reason
      await user.type(screen.getByTestId('input-confirm-email'), demoUser.email);
      await user.type(screen.getByTestId('textarea-delete-reason'), 'No longer needed');

      await user.click(screen.getByTestId('button-confirm-delete'));

      await waitFor(() => {
        expect(screen.getByText('Account deleted')).toBeInTheDocument();
      });
    });

    it('can cancel account deletion', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByTestId('button-delete-account')).toBeInTheDocument();
      });

      // Open dialog
      await user.click(screen.getByTestId('button-delete-account'));

      await waitFor(() => {
        expect(screen.getByTestId('button-cancel-delete')).toBeInTheDocument();
      });

      // Cancel deletion
      await user.click(screen.getByTestId('button-cancel-delete'));

      await waitFor(() => {
        expect(screen.queryByTestId('dialog-delete-account')).not.toBeInTheDocument();
      });
    });
  });

  describe('Future Features', () => {
    it('shows future feature buttons as disabled', async () => {
      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByTestId('button-notifications')).toBeDisabled();
        expect(screen.getByTestId('button-theme')).toBeDisabled();
        expect(screen.getByTestId('button-advanced')).toBeDisabled();
      });
    });

    it('displays future badges on disabled features', async () => {
      renderWithProviders(<Settings />);

      await waitFor(() => {
        // Check for "Future" badges
        const futureBadges = screen.getAllByText('Future');
        expect(futureBadges.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Loading States and UX', () => {
    it('shows loading state during profile update', async () => {
      // Mock slow API response
      server.use(
        rest.put('/api/users/me', (req, res, ctx) => {
          return res(ctx.delay(1000), ctx.json(demoUser));
        })
      );

      const user = userEvent.setup();
      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByTestId('button-save-profile')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('button-save-profile'));

      // Check for loading state
      expect(screen.getByText('Saving...')).toBeInTheDocument();
      expect(screen.getByTestId('button-save-profile')).toBeDisabled();
    });

    it('shows loading state during password change', async () => {
      // Mock slow API response
      server.use(
        rest.post('/api/users/me/change-password', (req, res, ctx) => {
          return res(ctx.delay(1000), ctx.json({ message: 'Success' }));
        })
      );

      const user = userEvent.setup();
      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByTestId('input-current-password')).toBeInTheDocument();
      });

      // Fill valid form
      await user.type(screen.getByTestId('input-current-password'), 'currentPassword123');
      await user.type(screen.getByTestId('input-new-password'), 'newPassword123');
      await user.type(screen.getByTestId('input-confirm-password'), 'newPassword123');

      await user.click(screen.getByTestId('button-change-password'));

      // Check for loading state
      expect(screen.getByText('Changing...')).toBeInTheDocument();
      expect(screen.getByTestId('button-change-password')).toBeDisabled();
    });

    it('shows loading state during data export', async () => {
      // Mock slow API response
      server.use(
        rest.get('/api/users/me/data-export', (req, res, ctx) => {
          return res(ctx.delay(1000), ctx.json({}));
        })
      );

      const user = userEvent.setup();
      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByTestId('button-export-data')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('button-export-data'));

      // Check for loading state
      expect(screen.getByText('Exporting...')).toBeInTheDocument();
      expect(screen.getByTestId('button-export-data')).toBeDisabled();
    });
  });

  describe('Accessibility and UI', () => {
    it('has proper headings and structure', async () => {
      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('General Settings')).toBeInTheDocument();
        expect(screen.getByText('Security Settings')).toBeInTheDocument();
        expect(screen.getByText('Privacy & Data (Law 25 Compliance)')).toBeInTheDocument();
      });
    });

    it('has proper form labels', async () => {
      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByLabelText('First Name')).toBeInTheDocument();
        expect(screen.getByLabelText('Last Name')).toBeInTheDocument();
        expect(screen.getByLabelText('Email')).toBeInTheDocument();
        expect(screen.getByLabelText('Username')).toBeInTheDocument();
        expect(screen.getByLabelText('Phone')).toBeInTheDocument();
        expect(screen.getByLabelText('Language')).toBeInTheDocument();
      });
    });

    it('displays Law 25 compliance information', async () => {
      renderWithProviders(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('Your Data Rights')).toBeInTheDocument();
        expect(screen.getByText(/Under Quebec's Law 25/)).toBeInTheDocument();
        expect(screen.getByText(/This action cannot be undone/)).toBeInTheDocument();
      });
    });
  });
});
