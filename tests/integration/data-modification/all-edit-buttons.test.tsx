/**
 * Comprehensive test suite for all buttons and forms that can apply changes or edit existing data
 * This ensures all data modification functionality works correctly across the application.
 */

import React from 'react';
import { describe, it, expect, beforeEach, jest, beforeAll } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProviders } from '../../test-utils/providers';
import { mockApiRequest } from '../../test-utils/api-mocks';

// Component imports for testing
import { OrganizationFormDialog } from '../../../client/src/components/admin/organization-form-dialog';
import { SendInvitationDialog } from '../../../client/src/components/admin/send-invitation-dialog';
import { BillCreateForm } from '../../../client/src/components/BillCreateForm';
import { BillEditForm } from '../../../client/src/components/BillEditForm';
import Login from '../../../client/src/pages/auth/login';
import ForgotPassword from '../../../client/src/pages/auth/forgot-password';
import ResetPassword from '../../../client/src/pages/auth/reset-password';
import InvitationAcceptance from '../../../client/src/pages/auth/invitation-acceptance';

// Test data
const mockOrganization = {
  id: 'test-org-id',
  name: 'Test Organization',
  type: 'management_company',
  address: '123 Test Street',
  city: 'Montreal',
  province: 'QC',
  postalCode: 'H1H 1H1',
  phone: '514-555-0123',
  email: 'test@test.com',
  website: 'https://test.com',
  registrationNumber: 'REG123',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
};

const mockBill = {
  id: 'test-bill-id',
  billNumber: 'BILL-001',
  amount: 1500.00,
  dueDate: new Date('2025-12-31'),
  type: 'monthly_fee',
  status: 'sent' as const,
  residenceId: 'test-residence-id',
  createdAt: new Date(),
  updatedAt: new Date(),
  buildingId: 'test-building-id',
  title: 'Test Bill',
  description: 'Test bill description',
  category: 'utilities',
  isRecurring: false,
  frequency: null,
  nextBillDate: null,
  lateFeesEnabled: false,
  lateFeeAmount: null,
  discountEnabled: false,
  discountAmount: null,
  discountDeadline: null,
  emailNotificationsEnabled: true,
  reminderDays: 7,
  notes: null,
  isActive: true,
  createdBy: 'test-user-id'
};

const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  role: 'admin',
  firstName: 'Test',
  lastName: 'User'
};

describe('Data Modification - All Edit Buttons and Forms', () => {
  const user = userEvent.setup();

  beforeAll(() => {
    // Mock API requests globally
    jest.mock('../../../client/src/lib/queryClient', () => ({
      apiRequest: mockApiRequest,
      queryClient: {
        invalidateQueries: jest.fn(),
        setQueryData: jest.fn(),
        getQueryData: jest.fn()
      }
    }));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset API mock responses
    mockApiRequest.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
      status: 200
    });
  });

  describe('Organization Management', () => {
    it('should handle organization creation successfully', async () => {
      const onOpenChange = jest.fn();
      const onSuccess = jest.fn();

      render(
        <TestProviders>
          <OrganizationFormDialog
            open={true}
            onOpenChange={onOpenChange}
            organization={null}
            onSuccess={onSuccess}
          />
        </TestProviders>
      );

      // Fill out the form
      await user.type(screen.getByLabelText(/organization name/i), 'New Organization');
      await user.selectOptions(screen.getByLabelText(/organization type/i), 'syndicate');
      await user.type(screen.getByLabelText(/address/i), '456 New Street');
      await user.type(screen.getByLabelText(/city/i), 'Quebec City');
      await user.type(screen.getByLabelText(/postal code/i), 'G1G 1G1');

      // Submit the form
      const submitButton = screen.getByRole('button', { name: /create organization/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('POST', '/api/organizations', expect.objectContaining({
          name: 'New Organization',
          type: 'syndicate',
          address: '456 New Street',
          city: 'Quebec City',
          postalCode: 'G1G 1G1'
        }));
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('should handle organization editing successfully', async () => {
      const onOpenChange = jest.fn();
      const onSuccess = jest.fn();

      render(
        <TestProviders>
          <OrganizationFormDialog
            open={true}
            onOpenChange={onOpenChange}
            organization={mockOrganization}
            onSuccess={onSuccess}
          />
        </TestProviders>
      );

      // Verify form is pre-populated
      expect(screen.getByDisplayValue('Test Organization')).toBeInTheDocument();

      // Modify the name
      const nameInput = screen.getByDisplayValue('Test Organization');
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Organization');

      // Submit the form
      const submitButton = screen.getByRole('button', { name: /update organization/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('PUT', `/api/organizations/${mockOrganization.id}`, expect.objectContaining({
          name: 'Updated Organization'
        }));
      });
    });

    it('should handle organization form validation errors', async () => {
      render(
        <TestProviders>
          <OrganizationFormDialog
            open={true}
            onOpenChange={jest.fn()}
            organization={null}
            onSuccess={jest.fn()}
          />
        </TestProviders>
      );

      // Try to submit empty form
      const submitButton = screen.getByRole('button', { name: /create organization/i });
      await user.click(submitButton);

      // Check for validation errors
      await waitFor(() => {
        expect(screen.getByText(/organization name is required/i)).toBeInTheDocument();
      });

      expect(mockApiRequest).not.toHaveBeenCalled();
    });
  });

  describe('User Management & Authentication', () => {
    it('should handle user invitation sending', async () => {
      const onOpenChange = jest.fn();

      render(
        <TestProviders>
          <SendInvitationDialog
            open={true}
            onOpenChange={onOpenChange}
            onSuccess={jest.fn()}
          />
        </TestProviders>
      );

      // Fill out invitation form
      await user.type(screen.getByLabelText(/email/i), 'newuser@example.com');
      await user.type(screen.getByLabelText(/first name/i), 'New');
      await user.type(screen.getByLabelText(/last name/i), 'User');
      await user.selectOptions(screen.getByLabelText(/role/i), 'resident');

      // Submit invitation
      const submitButton = screen.getByRole('button', { name: /send invitation/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('POST', '/api/invitations', expect.objectContaining({
          email: 'newuser@example.com',
          firstName: 'New',
          lastName: 'User',
          role: 'resident'
        }));
      });
    });

    it('should handle login form submission', async () => {
      render(
        <TestProviders>
          <Login />
        </TestProviders>
      );

      // Fill out login form
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');

      // Submit login
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('POST', '/api/auth/login', {
          email: 'test@example.com',
          password: 'password123'
        });
      });
    });

    it('should handle forgot password form', async () => {
      render(
        <TestProviders>
          <ForgotPassword />
        </TestProviders>
      );

      // Fill out forgot password form
      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'test@example.com');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('POST', '/api/auth/forgot-password', {
          email: 'test@example.com'
        });
      });
    });

    it('should handle password reset form', async () => {
      // Mock URL parameters
      Object.defineProperty(window, 'location', {
        value: { search: '?token=reset-token' },
        writable: true
      });

      render(
        <TestProviders>
          <ResetPassword />
        </TestProviders>
      );

      // Fill out password reset form
      const passwordInput = screen.getByLabelText(/new password/i);
      const confirmInput = screen.getByLabelText(/confirm password/i);

      await user.type(passwordInput, 'newPassword123');
      await user.type(confirmInput, 'newPassword123');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /reset password/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('POST', '/api/auth/reset-password', {
          token: 'reset-token',
          password: 'newPassword123'
        });
      });
    });
  });

  describe('Bill Management', () => {
    it('should handle bill creation', async () => {
      const onSuccess = jest.fn();

      render(
        <TestProviders>
          <BillCreateForm
            buildingId="test-building-id"
            onSuccess={onSuccess}
          />
        </TestProviders>
      );

      // Fill out bill creation form
      await user.type(screen.getByLabelText(/bill number/i), 'BILL-002');
      await user.type(screen.getByLabelText(/amount/i), '2000.00');
      await user.selectOptions(screen.getByLabelText(/type/i), 'special_assessment');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /create bill/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('POST', '/api/bills', expect.objectContaining({
          billNumber: 'BILL-002',
          amount: 2000.00,
          type: 'special_assessment',
          residenceId: 'test-residence-id'
        }));
      });
    });

    it('should handle bill editing', async () => {
      const onSuccess = jest.fn();

      render(
        <TestProviders>
          <BillEditForm
            bill={mockBill}
            onSuccess={onSuccess}
            onCancel={jest.fn()}
          />
        </TestProviders>
      );

      // Verify form is pre-populated
      expect(screen.getByDisplayValue('BILL-001')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1500')).toBeInTheDocument();

      // Modify the amount
      const amountInput = screen.getByDisplayValue('1500');
      await user.clear(amountInput);
      await user.type(amountInput, '1750.00');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /update bill/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('PUT', `/api/bills/${mockBill.id}`, expect.objectContaining({
          amount: 1750.00
        }));
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      // Mock API failure
      mockApiRequest.mockRejectedValueOnce(new Error('Network error'));

      render(
        <TestProviders>
          <OrganizationFormDialog
            open={true}
            onOpenChange={jest.fn()}
            organization={null}
            onSuccess={jest.fn()}
          />
        </TestProviders>
      );

      // Fill out valid form
      await user.type(screen.getByLabelText(/organization name/i), 'Test Organization');
      await user.type(screen.getByLabelText(/address/i), '123 Test St');
      await user.type(screen.getByLabelText(/city/i), 'Montreal');
      await user.type(screen.getByLabelText(/postal code/i), 'H1H 1H1');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /create organization/i });
      await user.click(submitButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });
    });

    it('should handle form validation properly', async () => {
      render(
        <TestProviders>
          <BillCreateForm
            buildingId="test-building-id"
            onSuccess={jest.fn()}
          />
        </TestProviders>
      );

      // Submit form with invalid data
      await user.type(screen.getByLabelText(/amount/i), '-100'); // Invalid negative amount

      const submitButton = screen.getByRole('button', { name: /create bill/i });
      await user.click(submitButton);

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/amount must be positive/i)).toBeInTheDocument();
      });

      expect(mockApiRequest).not.toHaveBeenCalled();
    });
  });

  describe('Button States and Loading', () => {
    it('should disable submit buttons during API calls', async () => {
      // Mock slow API response
      let resolvePromise: (value: any) => void;
      const slowPromise = new Promise(resolve => {
        resolvePromise = resolve;
      });
      mockApiRequest.mockReturnValueOnce(slowPromise);

      render(
        <TestProviders>
          <OrganizationFormDialog
            open={true}
            onOpenChange={jest.fn()}
            organization={null}
            onSuccess={jest.fn()}
          />
        </TestProviders>
      );

      // Fill out form
      await user.type(screen.getByLabelText(/organization name/i), 'Test Organization');
      await user.type(screen.getByLabelText(/address/i), '123 Test St');
      await user.type(screen.getByLabelText(/city/i), 'Montreal');
      await user.type(screen.getByLabelText(/postal code/i), 'H1H 1H1');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /create organization/i });
      await user.click(submitButton);

      // Button should show loading state and be disabled
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
      });

      // Resolve the promise
      resolvePromise!({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
    });

    it('should show proper button text based on mode', async () => {
      // Test create mode
      const { rerender } = render(
        <TestProviders>
          <OrganizationFormDialog
            open={true}
            onOpenChange={jest.fn()}
            organization={null}
            onSuccess={jest.fn()}
          />
        </TestProviders>
      );

      expect(screen.getByRole('button', { name: /create organization/i })).toBeInTheDocument();

      // Test edit mode
      rerender(
        <TestProviders>
          <OrganizationFormDialog
            open={true}
            onOpenChange={jest.fn()}
            organization={mockOrganization}
            onSuccess={jest.fn()}
          />
        </TestProviders>
      );

      expect(screen.getByRole('button', { name: /update organization/i })).toBeInTheDocument();
    });
  });

  describe('Data Integrity', () => {
    it('should preserve form data during validation failures', async () => {
      render(
        <TestProviders>
          <OrganizationFormDialog
            open={true}
            onOpenChange={jest.fn()}
            organization={null}
            onSuccess={jest.fn()}
          />
        </TestProviders>
      );

      // Fill out partial form
      const nameInput = screen.getByLabelText(/organization name/i);
      await user.type(nameInput, 'Test Organization');

      // Submit incomplete form
      const submitButton = screen.getByRole('button', { name: /create organization/i });
      await user.click(submitButton);

      // Form should show validation errors but preserve entered data
      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Organization')).toBeInTheDocument();
        expect(screen.getByText(/address is required/i)).toBeInTheDocument();
      });
    });

    it('should reset form after successful submission', async () => {
      const onOpenChange = jest.fn();
      const onSuccess = jest.fn();

      render(
        <TestProviders>
          <OrganizationFormDialog
            open={true}
            onOpenChange={onOpenChange}
            organization={null}
            onSuccess={onSuccess}
          />
        </TestProviders>
      );

      // Fill out complete form
      await user.type(screen.getByLabelText(/organization name/i), 'Test Organization');
      await user.type(screen.getByLabelText(/address/i), '123 Test St');
      await user.type(screen.getByLabelText(/city/i), 'Montreal');
      await user.type(screen.getByLabelText(/postal code/i), 'H1H 1H1');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /create organization/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(onSuccess).toHaveBeenCalled();
      });
    });
  });
});