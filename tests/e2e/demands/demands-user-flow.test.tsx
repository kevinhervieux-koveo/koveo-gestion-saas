/**
 * @file Demands End-to-End User Flow Tests.
 * @description E2E tests simulating real user interactions with the demands system.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory';
import ResidentDemandsPage from '../../../client/src/pages/residents/demands';
import ManagerDemandsPage from '../../../client/src/pages/manager/demands';
import { LanguageProvider } from '@/hooks/use-language';
import { Toaster } from '../../../client/src/components/ui/toaster';

// Mock the API calls
const mockApiCalls = {
  getDemands: jest.fn(),
  createDemand: jest.fn(),
  updateDemandStatus: jest.fn(),
  deleteDemand: jest.fn(),
  getComments: jest.fn(),
  createComment: jest.fn(),
  getBuildings: jest.fn(),
  getResidences: jest.fn()
};

// Mock fetch globally
global.fetch = jest.fn();

// Mock auth context
const mockAuthContext = {
  user: {
    id: 'user-123',
    role: 'resident',
    firstName: 'John',
    lastName: 'Resident',
    email: 'john@example.com'
  },
  isAuthenticated: true,
  isLoading: false
};

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => mockAuthContext
}));

// Test data
const mockDemands = [
  {
    id: 'demand-1',
    submitterId: 'user-123',
    type: 'maintenance',
    description: 'Kitchen faucet is leaking',
    residenceId: 'residence-1',
    buildingId: 'building-1',
    status: 'submitted',
    createdAt: '2025-01-15T10:00:00Z',
    updatedAt: '2025-01-15T10:00:00Z',
    submitter: {
      id: 'user-123',
      firstName: 'John',
      lastName: 'Resident',
      email: 'john@example.com'
    },
    residence: {
      id: 'residence-1',
      unitNumber: '101',
      buildingId: 'building-1'
    },
    building: {
      id: 'building-1',
      name: 'Test Building',
      address: '123 Test St'
    }
  },
  {
    id: 'demand-2',
    submitterId: 'user-456',
    type: 'complaint',
    description: 'Noise from upstairs neighbor',
    residenceId: 'residence-2',
    buildingId: 'building-1',
    status: 'under_review',
    createdAt: '2025-01-14T14:30:00Z',
    updatedAt: '2025-01-15T09:15:00Z',
    submitter: {
      id: 'user-456',
      firstName: 'Jane',
      lastName: 'Neighbor',
      email: 'jane@example.com'
    },
    residence: {
      id: 'residence-2',
      unitNumber: '102',
      buildingId: 'building-1'
    },
    building: {
      id: 'building-1',
      name: 'Test Building',
      address: '123 Test St'
    }
  }
];

const mockBuildings = [
  {
    id: 'building-1',
    name: 'Test Building',
    address: '123 Test St',
    organizationId: 'org-1'
  }
];

const mockResidences = [
  {
    id: 'residence-1',
    unitNumber: '101',
    buildingId: 'building-1',
    floor: 1
  },
  {
    id: 'residence-2',
    unitNumber: '102',
    buildingId: 'building-1',
    floor: 1
  }
];

describe('Demands E2E User Flow Tests', () => {
  let queryClient: QueryClient;
  let hookReturn: any;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });

    hookReturn = memoryLocation({ path: '/residents/demands' });

    // Reset mocks
    jest.clearAllMocks();
    
    // Setup default fetch responses
    (global.fetch as jest.Mock).mockImplementation((url: string, options?: unknown) => {
      if (url.includes('/api/demands') && !options?.method) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockDemands)
        });
      }
      
      if (url.includes('/api/buildings')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockBuildings)
        });
      }
      
      if (url.includes('/api/residences')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResidences)
        });
      }
      
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });
  });

  const renderWithProviders = (component: React.ReactElement, initialPath = '/residents/demands') => {
    hookReturn.history = [initialPath];
    hookReturn.reset();
    
    return render(
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <Router hook={hookReturn}>
            {component}
          </Router>
          <Toaster />
        </LanguageProvider>
      </QueryClientProvider>
    );
  };

  describe('Resident User Flow', () => {
    it('should allow resident to view their demands list', async () => {
      renderWithProviders(<ResidentDemandsPage />);

      // Wait for demands to load
      await waitFor(() => {
        expect(screen.getByText('Kitchen faucet is leaking')).toBeInTheDocument();
      });

      // Verify demand details are displayed
      expect(screen.getByText('Maintenance')).toBeInTheDocument();
      expect(screen.getByText('Submitted')).toBeInTheDocument();
      expect(screen.getByText('Unit 101')).toBeInTheDocument();
    });

    it('should allow resident to create a new demand', async () => {
      const user = userEvent.setup();
      
      // Mock successful creation
      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'new-demand-id',
            type: 'maintenance',
            description: 'New maintenance request',
            status: 'submitted'
          })
        })
      );

      renderWithProviders(<ResidentDemandsPage />);

      // Wait for page to load
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create new demand/i })).toBeInTheDocument();
      });

      // Click create demand button
      const createButton = screen.getByRole('button', { name: /create new demand/i });
      await user.click(createButton);

      // Fill out the form
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Select demand type
      const typeSelect = screen.getByLabelText(/type/i);
      await user.click(typeSelect);
      
      await waitFor(() => {
        expect(screen.getByText('Maintenance')).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Maintenance'));

      // Fill description
      const descriptionField = screen.getByLabelText(/description/i);
      await user.type(descriptionField, 'Bathroom light fixture needs replacement');

      // Select building and residence
      const buildingSelect = screen.getByLabelText(/building/i);
      await user.click(buildingSelect);
      
      await waitFor(() => {
        expect(screen.getByText('Test Building')).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Test Building'));

      const residenceSelect = screen.getByLabelText(/residence/i);
      await user.click(residenceSelect);
      
      await waitFor(() => {
        expect(screen.getByText('Unit 101')).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Unit 101'));

      // Submit the form
      const submitButton = screen.getByRole('button', { name: /submit demand/i });
      await user.click(submitButton);

      // Verify API call was made
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/demands',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: expect.stringContaining('Bathroom light fixture')
          })
        );
      });
    });

    it('should show validation errors for invalid form data', async () => {
      const user = userEvent.setup();

      renderWithProviders(<ResidentDemandsPage />);

      // Wait for page to load
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create new demand/i })).toBeInTheDocument();
      });

      // Click create demand button
      const createButton = screen.getByRole('button', { name: /create new demand/i });
      await user.click(createButton);

      // Try to submit without filling required fields
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /submit demand/i });
      await user.click(submitButton);

      // Verify validation errors appear
      await waitFor(() => {
        expect(screen.getByText(/type is required/i)).toBeInTheDocument();
        expect(screen.getByText(/description is required/i)).toBeInTheDocument();
      });
    });

    it('should allow resident to filter demands by type and status', async () => {
      const user = userEvent.setup();

      renderWithProviders(<ResidentDemandsPage />);

      // Wait for demands to load
      await waitFor(() => {
        expect(screen.getByText('Kitchen faucet is leaking')).toBeInTheDocument();
      });

      // Apply type filter
      const typeFilter = screen.getByLabelText(/filter by type/i);
      await user.click(typeFilter);
      
      await waitFor(() => {
        expect(screen.getByText('Maintenance')).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Maintenance'));

      // Verify filtered results
      await waitFor(() => {
        expect(screen.getByText('Kitchen faucet is leaking')).toBeInTheDocument();
        expect(screen.queryByText('Noise from upstairs neighbor')).not.toBeInTheDocument();
      });
    });

    it('should allow resident to search demands by description', async () => {
      const user = userEvent.setup();

      renderWithProviders(<ResidentDemandsPage />);

      // Wait for demands to load
      await waitFor(() => {
        expect(screen.getByText('Kitchen faucet is leaking')).toBeInTheDocument();
      });

      // Enter search term
      const searchField = screen.getByPlaceholderText(/search demands/i);
      await user.type(searchField, 'faucet');

      // Verify search results
      await waitFor(() => {
        expect(screen.getByText('Kitchen faucet is leaking')).toBeInTheDocument();
        expect(screen.queryByText('Noise from upstairs neighbor')).not.toBeInTheDocument();
      });
    });

    it('should allow resident to delete their own demand', async () => {
      const user = userEvent.setup();
      
      // Mock successful deletion
      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ message: 'Demand deleted successfully' })
        })
      );

      renderWithProviders(<ResidentDemandsPage />);

      // Wait for demands to load
      await waitFor(() => {
        expect(screen.getByText('Kitchen faucet is leaking')).toBeInTheDocument();
      });

      // Find and click delete button for user's own demand
      const demandCard = screen.getByText('Kitchen faucet is leaking').closest('[data-testid="demand-card"]');
      expect(demandCard).toBeInTheDocument();

      const deleteButton = within(demandCard!).getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      // Confirm deletion in dialog
      await waitFor(() => {
        expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /delete/i });
      await user.click(confirmButton);

      // Verify API call was made
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/demands/demand-1',
          expect.objectContaining({
            method: 'DELETE'
          })
        );
      });
    });

    it('should show demand comments when expanded', async () => {
      const user = userEvent.setup();
      
      // Mock comments API
      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 'comment-1',
              content: 'We will schedule a plumber for tomorrow.',
              authorId: 'manager-1',
              isInternal: false,
              createdAt: '2025-01-15T11:00:00Z',
              author: {
                firstName: 'Manager',
                lastName: 'User'
              }
            }
          ])
        })
      );

      renderWithProviders(<ResidentDemandsPage />);

      // Wait for demands to load
      await waitFor(() => {
        expect(screen.getByText('Kitchen faucet is leaking')).toBeInTheDocument();
      });

      // Expand demand to show comments
      const expandButton = screen.getByRole('button', { name: /view comments/i });
      await user.click(expandButton);

      // Verify comments are loaded and displayed
      await waitFor(() => {
        expect(screen.getByText('We will schedule a plumber for tomorrow.')).toBeInTheDocument();
        expect(screen.getByText('Manager User')).toBeInTheDocument();
      });
    });
  });

  describe('Manager User Flow', () => {
    beforeEach(() => {
      mockAuthContext.user.role = 'manager';
    });

    it('should allow manager to view all demands in their organization', async () => {
      renderWithProviders(<ManagerDemandsPage />);

      // Wait for demands to load
      await waitFor(() => {
        expect(screen.getByText('Kitchen faucet is leaking')).toBeInTheDocument();
        expect(screen.getByText('Noise from upstairs neighbor')).toBeInTheDocument();
      });

      // Verify manager can see demands from different residents
      expect(screen.getByText('John Resident')).toBeInTheDocument();
      expect(screen.getByText('Jane Neighbor')).toBeInTheDocument();
    });

    it('should allow manager to update demand status', async () => {
      const user = userEvent.setup();
      
      // Mock successful status update
      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            ...mockDemands[0],
            status: 'approved',
            reviewNotes: 'Approved for repair'
          })
        })
      );

      renderWithProviders(<ManagerDemandsPage />);

      // Wait for demands to load
      await waitFor(() => {
        expect(screen.getByText('Kitchen faucet is leaking')).toBeInTheDocument();
      });

      // Find status update button
      const demandCard = screen.getByText('Kitchen faucet is leaking').closest('[data-testid="demand-card"]');
      const statusButton = within(demandCard!).getByRole('button', { name: /update status/i });
      await user.click(statusButton);

      // Select new status
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const statusSelect = screen.getByLabelText(/status/i);
      await user.click(statusSelect);
      
      await waitFor(() => {
        expect(screen.getByText('Approved')).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Approved'));

      // Add review notes
      const notesField = screen.getByLabelText(/review notes/i);
      await user.type(notesField, 'Approved for immediate repair');

      // Submit status update
      const updateButton = screen.getByRole('button', { name: /update/i });
      await user.click(updateButton);

      // Verify API call was made
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/demands/demand-1/status',
          expect.objectContaining({
            method: 'PATCH',
            body: expect.stringContaining('approved')
          })
        );
      });
    });

    it('should allow manager to add comments to demands', async () => {
      const user = userEvent.setup();
      
      // Mock comments load and create
      (global.fetch as jest.Mock)
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        }))
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'new-comment-id',
            content: 'We have contacted the plumber',
            authorId: mockAuthContext.user.id,
            isInternal: false
          })
        }));

      renderWithProviders(<ManagerDemandsPage />);

      // Wait for demands to load
      await waitFor(() => {
        expect(screen.getByText('Kitchen faucet is leaking')).toBeInTheDocument();
      });

      // Expand demand comments
      const expandButton = screen.getByRole('button', { name: /view comments/i });
      await user.click(expandButton);

      // Wait for comments section to load
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/add a comment/i)).toBeInTheDocument();
      });

      // Add comment
      const commentField = screen.getByPlaceholderText(/add a comment/i);
      await user.type(commentField, 'We have contacted the plumber and they will arrive tomorrow morning');

      const submitCommentButton = screen.getByRole('button', { name: /post comment/i });
      await user.click(submitCommentButton);

      // Verify API call was made
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/demands/demand-1/comments',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('contacted the plumber')
          })
        );
      });
    });

    it('should show demand statistics dashboard', async () => {
      renderWithProviders(<ManagerDemandsPage />);

      // Wait for page to load
      await waitFor(() => {
        expect(screen.getByText(/total demands/i)).toBeInTheDocument();
      });

      // Verify statistics are displayed
      expect(screen.getByText('2')).toBeInTheDocument(); // Total demands
      expect(screen.getByText(/pending review/i)).toBeInTheDocument();
      expect(screen.getByText(/in progress/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      // Mock API failure
      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ message: 'Internal server error' })
        })
      );

      renderWithProviders(<ResidentDemandsPage />);

      // Verify error message is displayed
      await waitFor(() => {
        expect(screen.getByText(/error loading demands/i)).toBeInTheDocument();
      });
    });

    it('should handle network failures', async () => {
      // Mock network failure
      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.reject(new Error('Network error'))
      );

      renderWithProviders(<ResidentDemandsPage />);

      // Verify network error is handled
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });

    it('should show loading states during API calls', async () => {
      // Mock slow API response
      (global.fetch as jest.Mock).mockImplementationOnce(
        () => new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            json: () => Promise.resolve(mockDemands)
          }), 1000)
        )
      );

      renderWithProviders(<ResidentDemandsPage />);

      // Verify loading indicator is shown
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to mobile viewport', async () => {
      // Simulate mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      global.dispatchEvent(new Event('resize'));

      renderWithProviders(<ResidentDemandsPage />);

      await waitFor(() => {
        expect(screen.getByText('Kitchen faucet is leaking')).toBeInTheDocument();
      });

      // Verify mobile layout adaptations
      const demandCards = screen.getAllByTestId('demand-card');
      expect(demandCards[0]).toHaveClass('flex-col'); // Should stack vertically on mobile
    });
  });
});