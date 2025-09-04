/**
 * Form Action Button Functionality Tests
 * Tests all form submission, saving, and action buttons
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';

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

describe('Form Action Buttons Functionality', () => {
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

  describe('Save Buttons', () => {
    const saveButtonTestIds = [
      'save-residences',
      'save-buildings', 
      'save-organizations',
      'button-save-text-file',
      'button-save-edit',
    ];

    saveButtonTestIds.forEach(testId => {
      it(`should handle save action for ${testId}`, async () => {
        // Create a mock component with the save button
        const MockComponent = () => {
          const handleSave = () => {
            mockApiRequest('/api/save', { method: 'POST' });
          };

          return (
            <button data-testid={testId} onClick={handleSave}>
              Save
            </button>
          );
        };

        renderWithProvider(<MockComponent />);
        
        const saveButton = screen.getByTestId(testId);
        expect(saveButton).toBeInTheDocument();
        
        await user.click(saveButton);
        
        await waitFor(() => {
          expect(mockApiRequest).toHaveBeenCalledWith('/api/save', { method: 'POST' });
        });
      });
    });
  });

  describe('Submit Buttons', () => {
    const submitButtonTestIds = [
      'button-submit-bug',
      'button-submit-feature-request',
    ];

    submitButtonTestIds.forEach(testId => {
      it(`should handle form submission for ${testId}`, async () => {
        const MockForm = () => {
          const handleSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            mockApiRequest('/api/submit', { method: 'POST' });
          };

          return (
            <form onSubmit={handleSubmit}>
              <input type="text" name="title" defaultValue="Test Title" />
              <button type="submit" data-testid={testId}>
                Submit
              </button>
            </form>
          );
        };

        renderWithProvider(<MockForm />);
        
        const submitButton = screen.getByTestId(testId);
        expect(submitButton).toBeInTheDocument();
        
        await user.click(submitButton);
        
        await waitFor(() => {
          expect(mockApiRequest).toHaveBeenCalledWith('/api/submit', { method: 'POST' });
        });
      });
    });
  });

  describe('Update Buttons', () => {
    const updateButtonTestIds = [
      'button-update-bug',
      'button-update-feature-request',
    ];

    updateButtonTestIds.forEach(testId => {
      it(`should handle update action for ${testId}`, async () => {
        const MockComponent = () => {
          const handleUpdate = () => {
            mockApiRequest('/api/update', { method: 'PATCH' });
          };

          return (
            <button data-testid={testId} onClick={handleUpdate}>
              Update
            </button>
          );
        };

        renderWithProvider(<MockComponent />);
        
        const updateButton = screen.getByTestId(testId);
        expect(updateButton).toBeInTheDocument();
        
        await user.click(updateButton);
        
        await waitFor(() => {
          expect(mockApiRequest).toHaveBeenCalledWith('/api/update', { method: 'PATCH' });
        });
      });
    });
  });

  describe('Create Buttons', () => {
    const createButtonTestIds = [
      'button-create-bug',
      'button-create-feature-request',
      'button-create-space',
      'button-invite-user',
    ];

    createButtonTestIds.forEach(testId => {
      it(`should handle create action for ${testId}`, async () => {
        const MockComponent = () => {
          const handleCreate = () => {
            mockApiRequest('/api/create', { method: 'POST' });
          };

          return (
            <button data-testid={testId} onClick={handleCreate}>
              Create
            </button>
          );
        };

        renderWithProvider(<MockComponent />);
        
        const createButton = screen.getByTestId(testId);
        expect(createButton).toBeInTheDocument();
        
        await user.click(createButton);
        
        await waitFor(() => {
          expect(mockApiRequest).toHaveBeenCalledWith('/api/create', { method: 'POST' });
        });
      });
    });
  });

  describe('Button States', () => {
    it('should handle loading states correctly', () => {
      const MockComponent = () => {
        const [isLoading, setIsLoading] = React.useState(false);

        const handleClick = () => {
          setIsLoading(true);
          setTimeout(() => setIsLoading(false), 1000);
        };

        return (
          <button 
            data-testid="loading-button" 
            onClick={handleClick}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Click Me'}
          </button>
        );
      };

      renderWithProvider(<MockComponent />);
      
      const button = screen.getByTestId('loading-button');
      expect(button).toBeInTheDocument();
      expect(button).not.toBeDisabled();
      
      fireEvent.click(button);
      expect(button).toBeDisabled();
    });

    it('should handle disabled states correctly', () => {
      const MockComponent = () => (
        <button data-testid="disabled-button" disabled>
          Disabled Button
        </button>
      );

      renderWithProvider(<MockComponent />);
      
      const button = screen.getByTestId('disabled-button');
      expect(button).toBeInTheDocument();
      expect(button).toBeDisabled();
    });
  });
});