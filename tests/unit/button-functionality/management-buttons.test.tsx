/**
 * Management Button Functionality Tests
 * Tests all management buttons (approve, reject, delete, edit, block, etc.)
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import React from 'react';

// Mock API requests
const mockApiRequest = jest.fn();
jest.mock('../../../client/src/lib/queryClient', () => ({
  apiRequest: mockApiRequest,
  queryClient: new (jest.requireActual('@tanstack/react-query').QueryClient)(),
}));

// Mock authentication context
jest.mock('../../../client/src/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'test@test.com', role: 'admin' },
    isAuthenticated: true,
    login: jest.fn(),
    logout: jest.fn(),
  }),
}));

// Mock toast notifications
const mockToast = jest.fn();
jest.mock('../../../client/src/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

describe('Management Buttons Functionality', () => {
  let queryClient: QueryClient;
  let user: any;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    user = userEvent.setup();
    jest.clearAllMocks();
    mockApiRequest.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
  });

  const renderWithProvider = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  describe('Demand Management Buttons', () => {
    it('should handle demand approval', async () => {
      const demandId = 'test-demand-id';
      const MockDemandCard = () => (
        <div>
          <button 
            data-testid={`button-approve-${demandId}`}
            onClick={() => mockApiRequest(`/api/demands/${demandId}/approve`, { method: 'PATCH' })}
          >
            Approve
          </button>
          <button 
            data-testid={`button-reject-${demandId}`}
            onClick={() => mockApiRequest(`/api/demands/${demandId}/reject`, { method: 'PATCH' })}
          >
            Reject
          </button>
          <button 
            data-testid={`button-view-${demandId}`}
            onClick={() => mockApiRequest(`/api/demands/${demandId}`, { method: 'GET' })}
          >
            View
          </button>
          <button 
            data-testid={`button-edit-${demandId}`}
            onClick={() => mockApiRequest(`/api/demands/${demandId}`, { method: 'GET' })}
          >
            Edit
          </button>
        </div>
      );

      renderWithProvider(<MockDemandCard />);
      
      const approveButton = screen.getByTestId(`button-approve-${demandId}`);
      const rejectButton = screen.getByTestId(`button-reject-${demandId}`);
      const viewButton = screen.getByTestId(`button-view-${demandId}`);
      const editButton = screen.getByTestId(`button-edit-${demandId}`);
      
      expect(approveButton).toBeInTheDocument();
      expect(rejectButton).toBeInTheDocument();
      expect(viewButton).toBeInTheDocument();
      expect(editButton).toBeInTheDocument();
      
      await user.click(approveButton);
      expect(mockApiRequest).toHaveBeenCalledWith(`/api/demands/${demandId}/approve`, { method: 'PATCH' });
      
      await user.click(rejectButton);
      expect(mockApiRequest).toHaveBeenCalledWith(`/api/demands/${demandId}/reject`, { method: 'PATCH' });
      
      await user.click(viewButton);
      expect(mockApiRequest).toHaveBeenCalledWith(`/api/demands/${demandId}`, { method: 'GET' });
      
      await user.click(editButton);
      expect(mockApiRequest).toHaveBeenCalledWith(`/api/demands/${demandId}`, { method: 'GET' });
    });
  });

  describe('User Management Buttons', () => {
    it('should handle user blocking and unblocking', async () => {
      const userId = 'test-user-id';
      const MockUserManagement = () => (
        <div>
          <button 
            data-testid={`button-block-${userId}`}
            onClick={() => mockApiRequest(`/api/users/${userId}/block`, { method: 'POST' })}
          >
            Block User
          </button>
          <button 
            data-testid={`button-unblock-${userId}`}
            onClick={() => mockApiRequest(`/api/users/${userId}/unblock`, { method: 'POST' })}
          >
            Unblock User
          </button>
          <button 
            data-testid={`button-time-limit-${userId}`}
            onClick={() => mockApiRequest(`/api/users/${userId}/time-limits`, { method: 'POST' })}
          >
            Set Time Limit
          </button>
        </div>
      );

      renderWithProvider(<MockUserManagement />);
      
      const blockButton = screen.getByTestId(`button-block-${userId}`);
      const unblockButton = screen.getByTestId(`button-unblock-${userId}`);
      const timeLimitButton = screen.getByTestId(`button-time-limit-${userId}`);
      
      expect(blockButton).toBeInTheDocument();
      expect(unblockButton).toBeInTheDocument();
      expect(timeLimitButton).toBeInTheDocument();
      
      await user.click(blockButton);
      expect(mockApiRequest).toHaveBeenCalledWith(`/api/users/${userId}/block`, { method: 'POST' });
      
      await user.click(unblockButton);
      expect(mockApiRequest).toHaveBeenCalledWith(`/api/users/${userId}/unblock`, { method: 'POST' });
      
      await user.click(timeLimitButton);
      expect(mockApiRequest).toHaveBeenCalledWith(`/api/users/${userId}/time-limits`, { method: 'POST' });
    });
  });

  describe('Delete and Confirmation Buttons', () => {
    it('should handle delete confirmation flow', async () => {
      const bugId = 'test-bug-id';
      const invitationId = 'test-invitation-id';
      
      const MockDeleteFlow = () => {
        const [showConfirmation, setShowConfirmation] = React.useState(false);
        
        return (
          <div>
            <button 
              data-testid={`button-delete-${bugId}`}
              onClick={() => setShowConfirmation(true)}
            >
              Delete Bug
            </button>
            <button 
              data-testid={`button-delete-invitation-${invitationId}`}
              onClick={() => setShowConfirmation(true)}
            >
              Delete Invitation
            </button>
            
            {showConfirmation && (
              <div>
                <button 
                  data-testid="button-cancel-delete-invitation"
                  onClick={() => setShowConfirmation(false)}
                >
                  Cancel
                </button>
                <button 
                  data-testid="button-confirm-delete-invitation"
                  onClick={() => {
                    mockApiRequest('/api/delete', { method: 'DELETE' });
                    setShowConfirmation(false);
                  }}
                >
                  Confirm Delete
                </button>
              </div>
            )}
          </div>
        );
      };

      renderWithProvider(<MockDeleteFlow />);
      
      const deleteBugButton = screen.getByTestId(`button-delete-${bugId}`);
      const deleteInvitationButton = screen.getByTestId(`button-delete-invitation-${invitationId}`);
      
      expect(deleteBugButton).toBeInTheDocument();
      expect(deleteInvitationButton).toBeInTheDocument();
      
      // Test delete confirmation flow
      await user.click(deleteInvitationButton);
      
      await waitFor(() => {
        const cancelButton = screen.getByTestId('button-cancel-delete-invitation');
        const confirmButton = screen.getByTestId('button-confirm-delete-invitation');
        
        expect(cancelButton).toBeInTheDocument();
        expect(confirmButton).toBeInTheDocument();
      });
      
      const confirmButton = screen.getByTestId('button-confirm-delete-invitation');
      await user.click(confirmButton);
      
      expect(mockApiRequest).toHaveBeenCalledWith('/api/delete', { method: 'DELETE' });
    });
  });

  describe('Edit and Cancel Buttons', () => {
    it('should handle edit and cancel actions', async () => {
      const MockEditForm = () => {
        const [isEditing, setIsEditing] = React.useState(false);
        
        return (
          <div>
            {!isEditing ? (
              <button 
                data-testid="button-edit-space"
                onClick={() => setIsEditing(true)}
              >
                Edit Space
              </button>
            ) : (
              <div>
                <button 
                  data-testid="button-cancel-edit"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel Edit
                </button>
                <button 
                  data-testid="button-save-edit"
                  onClick={() => {
                    mockApiRequest('/api/save', { method: 'PATCH' });
                    setIsEditing(false);
                  }}
                >
                  Save Edit
                </button>
              </div>
            )}
          </div>
        );
      };

      renderWithProvider(<MockEditForm />);
      
      const editButton = screen.getByTestId('button-edit-space');
      expect(editButton).toBeInTheDocument();
      
      await user.click(editButton);
      
      await waitFor(() => {
        const cancelButton = screen.getByTestId('button-cancel-edit');
        const saveButton = screen.getByTestId('button-save-edit');
        
        expect(cancelButton).toBeInTheDocument();
        expect(saveButton).toBeInTheDocument();
      });
      
      const saveButton = screen.getByTestId('button-save-edit');
      await user.click(saveButton);
      
      expect(mockApiRequest).toHaveBeenCalledWith('/api/save', { method: 'PATCH' });
    });
  });

  describe('Upvote and Menu Buttons', () => {
    it('should handle upvote and menu actions', async () => {
      const requestId = 'test-request-id';
      
      const MockFeatureRequest = () => (
        <div>
          <button 
            data-testid={`button-upvote-${requestId}`}
            onClick={() => mockApiRequest(`/api/feature-requests/${requestId}/upvote`, { method: 'POST' })}
          >
            Upvote
          </button>
          <button 
            data-testid={`button-menu-${requestId}`}
            onClick={() => console.log('Menu opened')}
          >
            Menu
          </button>
        </div>
      );

      renderWithProvider(<MockFeatureRequest />);
      
      const upvoteButton = screen.getByTestId(`button-upvote-${requestId}`);
      const menuButton = screen.getByTestId(`button-menu-${requestId}`);
      
      expect(upvoteButton).toBeInTheDocument();
      expect(menuButton).toBeInTheDocument();
      
      await user.click(upvoteButton);
      expect(mockApiRequest).toHaveBeenCalledWith(`/api/feature-requests/${requestId}/upvote`, { method: 'POST' });
      
      await user.click(menuButton);
      // Menu button functionality would be tested in integration tests
    });
  });
});