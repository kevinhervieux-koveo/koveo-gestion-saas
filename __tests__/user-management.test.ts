/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserManagement } from '../client/src/pages/manager/user-management';
import { LanguageProvider } from '../client/src/context/LanguageContext';
import { BrowserRouter } from 'wouter';

// Mock the API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock user data
const mockUsers = [
  {
    id: '1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    role: 'demo_resident',
    isActive: true,
    organizations: [{ id: 'org1', name: 'Demo 123', type: 'condo' }],
    buildings: [{ id: 'b1', name: 'Building A' }],
    residences: [{ id: 'r1', unitNumber: 'A101', buildingId: 'b1', buildingName: 'Building A' }]
  },
  {
    id: '2', 
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane@example.com',
    role: 'manager',
    isActive: true,
    organizations: [],
    buildings: [],
    residences: []
  }
];

const mockCurrentUser = {
  id: 'admin1',
  email: 'admin@example.com',
  role: 'admin',
  firstName: 'Admin',
  lastName: 'User'
};

// Test component wrapper
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </LanguageProvider>
    </QueryClientProvider>
  );
};

describe('User Management Page', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    
    // Mock successful API responses
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockCurrentUser
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          users: mockUsers,
          total: 2,
          page: 1,
          totalPages: 1,
          filterOptions: {
            roles: [
              { value: '', label: 'All Roles' },
              { value: 'admin', label: 'Admin' },
              { value: 'manager', label: 'Manager' },
              { value: 'demo_resident', label: 'Demo Resident' }
            ],
            statuses: [
              { value: '', label: 'All Statuses' },
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Inactive' }
            ],
            organizations: [
              { value: '', label: 'All Organizations' },
              { value: 'org1', label: 'Demo 123' }
            ],
            orphanOptions: [
              { value: '', label: 'All Users' },
              { value: 'true', label: 'Orphan Users' },
              { value: 'false', label: 'Assigned Users' }
            ]
          }
        })
      });
  });

  test('renders user management page', async () => {
    render(
      <TestWrapper>
        <UserManagement />
      </TestWrapper>
    );

    // Check if main elements are rendered
    expect(screen.getByText('User Management')).toBeInTheDocument();
    expect(screen.getByText('Manage All Users')).toBeInTheDocument();
    
    // Wait for users to load
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    });
  });

  test('displays filter options correctly', async () => {
    render(
      <TestWrapper>
        <UserManagement />
      </TestWrapper>
    );

    await waitFor(() => {
      // Check search input
      expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
      
      // Check filter dropdowns
      expect(screen.getByDisplayValue('All Roles')).toBeInTheDocument();
      expect(screen.getByDisplayValue('All Statuses')).toBeInTheDocument();
      expect(screen.getByDisplayValue('All Organizations')).toBeInTheDocument();
    });
  });

  test('search functionality works', async () => {
    render(
      <TestWrapper>
        <UserManagement />
      </TestWrapper>
    );

    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText(/search/i);
      fireEvent.change(searchInput, { target: { value: 'john' } });
      expect(searchInput).toHaveValue('john');
    });
  });

  test('role filter works', async () => {
    render(
      <TestWrapper>
        <UserManagement />
      </TestWrapper>
    );

    await waitFor(() => {
      const roleSelect = screen.getByDisplayValue('All Roles');
      fireEvent.change(roleSelect, { target: { value: 'admin' } });
      expect(roleSelect).toHaveValue('admin');
    });
  });

  test('organization filter hides orphan filter', async () => {
    render(
      <TestWrapper>
        <UserManagement />
      </TestWrapper>
    );

    await waitFor(() => {
      // Select an organization
      const orgSelect = screen.getByDisplayValue('All Organizations');
      fireEvent.change(orgSelect, { target: { value: 'org1' } });
      
      // Orphan filter should be hidden or disabled
      expect(screen.queryByText('Orphan filter unavailable')).toBeInTheDocument();
    });
  });

  test('admin sees delete orphan users button', async () => {
    render(
      <TestWrapper>
        <UserManagement />
      </TestWrapper>
    );

    await waitFor(() => {
      const deleteButton = screen.getByTestId('button-delete-orphans');
      expect(deleteButton).toBeInTheDocument();
      expect(deleteButton).toHaveTextContent('Delete Orphan Users');
    });
  });

  test('delete orphan users dialog opens', async () => {
    render(
      <TestWrapper>
        <UserManagement />
      </TestWrapper>
    );

    await waitFor(() => {
      const deleteButton = screen.getByTestId('button-delete-orphans');
      fireEvent.click(deleteButton);
      
      // Check if dialog opens
      expect(screen.getByText('Delete All Orphan Users')).toBeInTheDocument();
      expect(screen.getByText('This will permanently mark all orphan users')).toBeInTheDocument();
    });
  });

  test('clear filters works', async () => {
    render(
      <TestWrapper>
        <UserManagement />
      </TestWrapper>
    );

    await waitFor(() => {
      // Set some filters
      const searchInput = screen.getByPlaceholderText(/search/i);
      fireEvent.change(searchInput, { target: { value: 'test' } });
      
      const roleSelect = screen.getByDisplayValue('All Roles');
      fireEvent.change(roleSelect, { target: { value: 'admin' } });
      
      // Find and click clear filters
      const clearButton = screen.getByText('Clear Filters');
      fireEvent.click(clearButton);
      
      // Check if filters are cleared
      expect(searchInput).toHaveValue('');
      expect(roleSelect).toHaveValue('');
    });
  });

  test('user count displays correctly', async () => {
    render(
      <TestWrapper>
        <UserManagement />
      </TestWrapper>
    );

    await waitFor(() => {
      // Check user count display
      expect(screen.getByText(/Users \(2 of 2 users\)/)).toBeInTheDocument();
    });
  });

  test('pagination shows when needed', async () => {
    // Mock data with multiple pages
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        users: mockUsers,
        total: 25,
        page: 1,
        totalPages: 3,
        filterOptions: {}
      })
    });

    render(
      <TestWrapper>
        <UserManagement />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    });
  });

  test('user table displays user information correctly', async () => {
    render(
      <TestWrapper>
        <UserManagement />
      </TestWrapper>
    );

    await waitFor(() => {
      // Check user data in table
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
      expect(screen.getByText('Demo 123')).toBeInTheDocument();
      expect(screen.getByText('Building A')).toBeInTheDocument();
      expect(screen.getByText('A101')).toBeInTheDocument();
    });
  });

  test('orphan user shows no assignments', async () => {
    render(
      <TestWrapper>
        <UserManagement />
      </TestWrapper>
    );

    await waitFor(() => {
      // Jane Smith has no assignments (orphan user)
      const janeRow = screen.getByText('jane@example.com').closest('tr');
      expect(janeRow).toHaveTextContent('No organizations');
      expect(janeRow).toHaveTextContent('No buildings');
      expect(janeRow).toHaveTextContent('No residences');
    });
  });

  test('handles API errors gracefully', async () => {
    // Mock API error
    mockFetch.mockRejectedValueOnce(new Error('API Error'));

    render(
      <TestWrapper>
        <UserManagement />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Loading users...')).toBeInTheDocument();
    });
  });

  test('invite user button works', async () => {
    render(
      <TestWrapper>
        <UserManagement />
      </TestWrapper>
    );

    await waitFor(() => {
      const inviteButton = screen.getByText('Invite User');
      expect(inviteButton).toBeInTheDocument();
      fireEvent.click(inviteButton);
    });
  });
});