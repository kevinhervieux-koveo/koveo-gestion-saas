/**
 * @file Unit tests for Buildings Management page
 * Tests component rendering, user interactions, role-based permissions,
 * form validation, and data handling for building management functionality.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from '@/hooks/use-language';
import { MobileMenuProvider } from '@/hooks/use-mobile-menu';
import Buildings from '@/pages/manager/buildings';

// Mock wouter router
const mockPush = jest.fn();
const mockLocation = ['/manager/buildings', mockPush];

jest.mock('wouter', () => ({
  useLocation: () => mockLocation,
  Link: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [_key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock API requests
const mockApiRequest = jest.fn();
jest.mock('@/lib/queryClient', () => ({
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
  queryClient: new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  }),
}));

// Mock the buildings hook
const mockUseBuildings = jest.fn();
const mockCreateMutation = jest.fn();
const mockUpdateMutation = jest.fn();
const mockDeleteMutation = jest.fn();

jest.mock('@/hooks/use-buildings', () => ({
  useBuildings: () => mockUseBuildings(),
}));

// Mock mutation hooks from TanStack Query directly
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useMutation: () => ({
    mutate: jest.fn(),
    isPending: false,
    _error: null,
  }),
  useQuery: () => ({
    _data: { buildings: [] },
    isLoading: false,
    _error: null,
  }),
}));

// Mock toast hook
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock auth context
const mockUseAuth = jest.fn();
jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('Buildings Management Page', () => {
  let queryClient: QueryClient;
  let user: ReturnType<typeof userEvent.setup>;

  const mockBuildings = [
    {
      id: 'building-1',
      name: 'Maple Heights',
      address: '123 Rue Sainte-Catherine',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H3A 1A1',
      buildingType: 'condo',
      yearBuilt: 2020,
      totalUnits: 50,
      totalFloors: 10,
      parkingSpaces: 30,
      storageSpaces: 25,
      organizationId: 'org-1',
      organizationName: 'Koveo Management',
      accessType: 'organization',
      isActive: true,
    },
    {
      id: 'building-2',
      name: 'Oak Gardens',
      address: '456 Boulevard René-Lévesque',
      city: 'Quebec City',
      province: 'QC',
      postalCode: 'G1R 2B5',
      buildingType: 'rental',
      yearBuilt: 2018,
      totalUnits: 75,
      totalFloors: 15,
      parkingSpaces: 0,
      storageSpaces: 0,
      organizationId: 'org-2',
      organizationName: 'Properties Plus',
      accessType: 'residence',
      isActive: true,
    },
  ];

  const mockOrganizations = [
    {
      id: 'org-1',
      name: 'Koveo Management',
      type: 'management_company',
    },
    {
      id: 'org-2',
      name: 'Properties Plus',
      type: 'syndicate',
    },
  ];

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <MobileMenuProvider>{children}</MobileMenuProvider>
        </LanguageProvider>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    user = userEvent.setup();
    jest.clearAllMocks();
    mockToast.mockClear();
    mockApiRequest.mockClear();
    mockUseBuildings.mockClear();
    mockCreateMutation.mockClear();
    mockUpdateMutation.mockClear();
    mockDeleteMutation.mockClear();

    // Default successful mock for buildings hook - match the actual hook interface
    mockUseBuildings.mockReturnValue({
      buildings: mockBuildings,
      organizations: mockOrganizations,
      isLoading: false,
      _error: null,
      form: {
        reset: jest.fn(),
        handleSubmit: jest.fn(() => jest.fn()),
        control: {},
        formState: { errors: {} },
        setValue: jest.fn(),
        getValues: jest.fn(),
        watch: jest.fn(),
      },
      editForm: {
        reset: jest.fn(),
        handleSubmit: jest.fn(() => jest.fn()),
        control: {},
        formState: { errors: {} },
        setValue: jest.fn(),
        getValues: jest.fn(),
        watch: jest.fn(),
      },
      isAddDialogOpen: false,
      setIsAddDialogOpen: jest.fn(),
      isEditDialogOpen: false,
      setIsEditDialogOpen: jest.fn(),
      editingBuilding: null,
      deletingBuilding: null,
      setDeletingBuilding: jest.fn(),
      createBuildingMutation: { isPending: false, mutate: jest.fn() },
      updateBuildingMutation: { isPending: false, mutate: jest.fn() },
      deleteBuildingMutation: { isPending: false, mutate: jest.fn() },
      handleCreateBuilding: jest.fn(),
      handleEditBuilding: jest.fn(),
      handleUpdateBuilding: jest.fn(),
      handleDeleteBuilding: jest.fn(),
      confirmDeleteBuilding: jest.fn(),
    });

    // Mock mutation hooks
    mockCreateMutation.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
      _error: null,
    });

    mockUpdateMutation.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
      _error: null,
    });

    mockDeleteMutation.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
      _error: null,
    });
  });

  describe('Role-based Access Control', () => {
    it('should show access denied for resident users', () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: 'user-1',
          role: 'resident',
          email: 'resident@test.com',
        },
        isAuthenticated: true,
        isLoading: false,
      });

      render(<Buildings />, { wrapper: createWrapper() });

      expect(screen.getByText('Access Restricted')).toBeInTheDocument();
      expect(
        screen.getByText(/This page is only available to managers and administrators/)
      ).toBeInTheDocument();
    });

    it('should show access denied for tenant users', () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: 'user-1',
          role: 'tenant',
          email: 'tenant@test.com',
        },
        isAuthenticated: true,
        isLoading: false,
      });

      render(<Buildings />, { wrapper: createWrapper() });

      expect(screen.getByText('Access Restricted')).toBeInTheDocument();
    });

    it('should allow access for admin users', async () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: 'user-1',
          role: 'admin',
          email: 'admin@test.com',
        },
        isAuthenticated: true,
        isLoading: false,
      });

      // Mock API responses
      mockApiRequest
        .mockResolvedValueOnce({ buildings: mockBuildings })
        .mockResolvedValueOnce({ organizations: mockOrganizations });

      render(<Buildings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Buildings')).toBeInTheDocument();
        expect(screen.getByText(/Manage \d+ building/)).toBeInTheDocument();
      });
    });

    it('should allow access for manager users', async () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: 'user-1',
          role: 'manager',
          email: 'manager@test.com',
        },
        isAuthenticated: true,
        isLoading: false,
      });

      // Mock API responses
      mockApiRequest
        .mockResolvedValueOnce({ buildings: mockBuildings })
        .mockResolvedValueOnce({ organizations: mockOrganizations });

      render(<Buildings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Buildings')).toBeInTheDocument();
        expect(screen.getByText(/Manage \d+ building/)).toBeInTheDocument();
      });
    });
  });

  describe('Building Display and Search', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: {
          id: 'admin-1',
          role: 'admin',
          email: 'admin@koveo.com',
          organizationName: 'Koveo',
        },
        isAuthenticated: true,
        isLoading: false,
      });

      mockApiRequest
        .mockResolvedValueOnce({ buildings: mockBuildings })
        .mockResolvedValueOnce({ organizations: mockOrganizations });
    });

    it('should display all buildings correctly', async () => {
      render(<Buildings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Maple Heights')).toBeInTheDocument();
        expect(screen.getByText('Oak Gardens')).toBeInTheDocument();
      });

      expect(screen.getByText('123 Rue Sainte-Catherine')).toBeInTheDocument();
      expect(screen.getByText('456 Boulevard René-Lévesque')).toBeInTheDocument();
      expect(screen.getByText('Koveo Management')).toBeInTheDocument();
      expect(screen.getByText('Properties Plus')).toBeInTheDocument();
    });

    it('should filter buildings by search term', async () => {
      render(<Buildings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Maple Heights')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search buildings/i);
      await user.type(searchInput, 'Maple');

      await waitFor(() => {
        expect(screen.getByText('Maple Heights')).toBeInTheDocument();
        expect(screen.queryByText('Oak Gardens')).not.toBeInTheDocument();
      });
    });

    it('should filter buildings by address', async () => {
      render(<Buildings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Maple Heights')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search buildings/i);
      await user.type(searchInput, 'Sainte-Catherine');

      await waitFor(() => {
        expect(screen.getByText('Maple Heights')).toBeInTheDocument();
        expect(screen.queryByText('Oak Gardens')).not.toBeInTheDocument();
      });
    });

    it('should show no results message when search yields no matches', async () => {
      render(<Buildings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Maple Heights')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search buildings/i);
      await user.type(searchInput, 'nonexistent building');

      await waitFor(() => {
        expect(screen.getByText(/no buildings found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Add Building Functionality', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: {
          id: 'admin-1',
          role: 'admin',
          email: 'admin@koveo.com',
        },
        isAuthenticated: true,
        isLoading: false,
      });

      mockApiRequest
        .mockResolvedValueOnce({ buildings: mockBuildings })
        .mockResolvedValueOnce({ organizations: mockOrganizations });
    });

    it('should show Add Building button for admin users', async () => {
      render(<Buildings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Add New Building')).toBeInTheDocument();
      });
    });

    it('should not show Add Building button for manager users', async () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: 'manager-1',
          role: 'manager',
          email: 'manager@test.com',
        },
        isAuthenticated: true,
        isLoading: false,
      });

      mockApiRequest
        .mockResolvedValueOnce({ buildings: mockBuildings })
        .mockResolvedValueOnce({ organizations: mockOrganizations });

      render(<Buildings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Buildings')).toBeInTheDocument();
        expect(screen.getByText(/Manage \d+ building/)).toBeInTheDocument();
      });

      expect(screen.queryByText('Add New Building')).not.toBeInTheDocument();
      expect(screen.getByText('Admin Only')).toBeInTheDocument();
    });

    it('should open add building dialog when clicked', async () => {
      render(<Buildings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Add New Building')).toBeInTheDocument();
      });

      const addButton = screen.getByText('Add New Building');
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Create New Building')).toBeInTheDocument();
      });
    });

    it('should validate required fields in add building form', async () => {
      render(<Buildings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Add New Building')).toBeInTheDocument();
      });

      const addButton = screen.getByText('Add New Building');
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Create New Building')).toBeInTheDocument();
      });

      const submitButton = screen.getByText('Create Building');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/building name.*required/i)).toBeInTheDocument();
        expect(screen.getByText(/organization.*required/i)).toBeInTheDocument();
      });
    });

    it('should submit valid building data', async () => {
      mockApiRequest
        .mockResolvedValueOnce({ buildings: mockBuildings })
        .mockResolvedValueOnce({ organizations: mockOrganizations })
        .mockResolvedValueOnce({ message: 'Building created successfully' })
        .mockResolvedValueOnce({ buildings: [...mockBuildings] });

      render(<Buildings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Add New Building')).toBeInTheDocument();
      });

      const addButton = screen.getByText('Add New Building');
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Create New Building')).toBeInTheDocument();
      });

      // Fill required fields
      const nameInput = screen.getByLabelText(/building name/i);
      await user.type(nameInput, 'Test Building');

      const orgSelect = screen.getByRole('combobox');
      await user.click(orgSelect);

      await waitFor(async () => {
        const orgOption = screen.getByText('Koveo Management (management_company)');
        await user.click(orgOption);
      });

      const submitButton = screen.getByText('Create Building');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          'POST',
          '/api/admin/buildings',
          expect.objectContaining({
            name: 'Test Building',
            organizationId: 'org-1',
          })
        );
      });
    });
  });

  describe('Edit Building Functionality', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: {
          id: 'admin-1',
          role: 'admin',
          email: 'admin@koveo.com',
        },
        isAuthenticated: true,
        isLoading: false,
      });

      mockApiRequest
        .mockResolvedValueOnce({ buildings: mockBuildings })
        .mockResolvedValueOnce({ organizations: mockOrganizations });
    });

    it('should show edit buttons for admin and manager users', async () => {
      render(<Buildings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Maple Heights')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTitle(/edit building/i);
      expect(editButtons).toHaveLength(2); // One for each building
    });

    it('should not show edit buttons for non-admin/manager users', async () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: 'resident-1',
          role: 'resident',
          email: 'resident@test.com',
        },
        isAuthenticated: true,
        isLoading: false,
      });

      render(<Buildings />, { wrapper: createWrapper() });

      expect(screen.getByText('Access Denied')).toBeInTheDocument();
    });

    it('should open edit dialog with pre-filled data', async () => {
      render(<Buildings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Maple Heights')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTitle(/edit building/i);
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Edit Building')).toBeInTheDocument();
      });

      const nameInput = screen.getByDisplayValue('Maple Heights');
      expect(nameInput).toBeInTheDocument();
    });

    it('should handle zero values in numeric fields', async () => {
      render(<Buildings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Oak Gardens')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTitle(/edit building/i);
      await user.click(editButtons[1]); // Oak Gardens has 0 parking/storage

      await waitFor(() => {
        expect(screen.getByText('Edit Building')).toBeInTheDocument();
      });

      const parkingInput = screen.getByLabelText(/parking spaces/i);
      expect(parkingInput).toHaveValue('0');

      // Clear and re-enter 0
      await user.clear(parkingInput);
      await user.type(parkingInput, '0');

      expect(parkingInput).toHaveValue('0');
    });

    it('should submit updated building data', async () => {
      mockApiRequest
        .mockResolvedValueOnce({ buildings: mockBuildings })
        .mockResolvedValueOnce({ organizations: mockOrganizations })
        .mockResolvedValueOnce({ message: 'Building updated successfully' })
        .mockResolvedValueOnce({ buildings: mockBuildings });

      render(<Buildings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Maple Heights')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTitle(/edit building/i);
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Edit Building')).toBeInTheDocument();
      });

      const nameInput = screen.getByDisplayValue('Maple Heights');
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Maple Heights');

      const submitButton = screen.getByText('Update Building');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          'PUT',
          '/api/admin/buildings/building-1',
          expect.objectContaining({
            name: 'Updated Maple Heights',
          })
        );
      });
    });
  });

  describe('Delete Building Functionality', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: {
          id: 'admin-1',
          role: 'admin',
          email: 'admin@koveo.com',
        },
        isAuthenticated: true,
        isLoading: false,
      });

      mockApiRequest
        .mockResolvedValueOnce({ buildings: mockBuildings })
        .mockResolvedValueOnce({ organizations: mockOrganizations });

      // Mock window.confirm
      window.confirm = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should show delete buttons only for admin users', async () => {
      render(<Buildings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Maple Heights')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByTitle(/delete building/i);
      expect(deleteButtons).toHaveLength(2);
    });

    it('should not show delete buttons for manager users', async () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: 'manager-1',
          role: 'manager',
          email: 'manager@test.com',
        },
        isAuthenticated: true,
        isLoading: false,
      });

      mockApiRequest
        .mockResolvedValueOnce({ buildings: mockBuildings })
        .mockResolvedValueOnce({ organizations: mockOrganizations });

      render(<Buildings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Maple Heights')).toBeInTheDocument();
      });

      const deleteButtons = screen.queryAllByTitle(/delete building/i);
      expect(deleteButtons).toHaveLength(0);
    });

    it('should show confirmation dialog when delete is clicked', async () => {
      window.confirm = jest.fn().mockReturnValue(false);

      render(<Buildings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Maple Heights')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByTitle(/delete building/i);
      await user.click(deleteButtons[0]);

      expect(window.confirm).toHaveBeenCalledWith(
        expect.stringContaining('Are you sure you want to delete "Maple Heights"?')
      );
    });

    it('should delete building when confirmed', async () => {
      window.confirm = jest.fn().mockReturnValue(true);
      mockApiRequest
        .mockResolvedValueOnce({ buildings: mockBuildings })
        .mockResolvedValueOnce({ organizations: mockOrganizations })
        .mockResolvedValueOnce({ message: 'Building deleted successfully' })
        .mockResolvedValueOnce({ buildings: [mockBuildings[1]] });

      render(<Buildings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Maple Heights')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByTitle(/delete building/i);
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('DELETE', '/api/admin/buildings/building-1');
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: {
          id: 'admin-1',
          role: 'admin',
          email: 'admin@koveo.com',
        },
        isAuthenticated: true,
        isLoading: false,
      });
    });

    it('should handle API errors gracefully', async () => {
      mockApiRequest.mockRejectedValueOnce(new Error('Failed to fetch buildings'));

      render(<Buildings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText(/error loading buildings/i)).toBeInTheDocument();
      });
    });

    it('should show error toast on create failure', async () => {
      mockApiRequest
        .mockResolvedValueOnce({ buildings: mockBuildings })
        .mockResolvedValueOnce({ organizations: mockOrganizations })
        .mockRejectedValueOnce(new Error('Failed to create building'));

      render(<Buildings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Add New Building')).toBeInTheDocument();
      });

      const addButton = screen.getByText('Add New Building');
      await user.click(addButton);

      await waitFor(async () => {
        const nameInput = screen.getByLabelText(/building name/i);
        await user.type(nameInput, 'Test Building');

        const orgSelect = screen.getByRole('combobox');
        await user.click(orgSelect);

        const orgOption = screen.getByText('Koveo Management (management_company)');
        await user.click(orgOption);

        const submitButton = screen.getByText('Create Building');
        await user.click(submitButton);
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            variant: 'destructive',
          })
        );
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state while fetching data', () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: 'admin-1',
          role: 'admin',
          email: 'admin@koveo.com',
        },
        isAuthenticated: true,
        isLoading: false,
      });

      // Mock pending API request
      mockApiRequest.mockImplementation(
        () =>
          new Promise(() => {
            // Intentionally empty to simulate pending state
          })
      );

      render(<Buildings />, { wrapper: createWrapper() });

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should show loading state during form submission', async () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: 'admin-1',
          role: 'admin',
          email: 'admin@koveo.com',
        },
        isAuthenticated: true,
        isLoading: false,
      });

      mockApiRequest
        .mockResolvedValueOnce({ buildings: mockBuildings })
        .mockResolvedValueOnce({ organizations: mockOrganizations })
        .mockImplementation(
          () =>
            new Promise(() => {
              // Intentionally empty to simulate pending create request
            })
        );

      render(<Buildings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Add New Building')).toBeInTheDocument();
      });

      const addButton = screen.getByText('Add New Building');
      await user.click(addButton);

      await waitFor(async () => {
        const nameInput = screen.getByLabelText(/building name/i);
        await user.type(nameInput, 'Test Building');

        const submitButton = screen.getByText('Create Building');
        await user.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Creating...')).toBeInTheDocument();
      });
    });
  });
});
