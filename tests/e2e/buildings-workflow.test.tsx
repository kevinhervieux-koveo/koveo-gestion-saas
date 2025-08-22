/**
 * @file End-to-end tests for Buildings Management workflow
 * Tests complete user journeys including authentication, navigation,
 * CRUD operations, and role-based access control.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// Mock auth context
const AuthProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;
import Buildings from '@/pages/manager/buildings';

// Mock wouter for navigation testing
const mockPush = jest.fn();
const mockLocation = ['/manager/buildings', mockPush];

jest.mock('wouter', () => ({
  useLocation: () => mockLocation,
  Link: ({ children, href, ...props }: {children: React.ReactNode, href?: string, [key: string]: any}) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock API with realistic response simulation
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

// Mock toast notifications
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock auth context
const mockUseAuth = jest.fn();
jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('Buildings Management E2E Workflow Tests', () => {
  let queryClient: QueryClient;
  let user: ReturnType<typeof userEvent.setup>;

  const mockBuildings = [
    {
      id: 'building-1',
      name: 'Maple Heights Condominiums',
      address: '123 Rue Sainte-Catherine Est',
      city: 'Montréal',
      province: 'QC',
      postalCode: 'H2X 1L4',
      buildingType: 'condo',
      yearBuilt: 2020,
      totalUnits: 50,
      totalFloors: 10,
      parkingSpaces: 30,
      storageSpaces: 25,
      organizationId: 'org-koveo',
      organizationName: 'Koveo Management',
      accessType: 'organization',
      isActive: true,
    },
    {
      id: 'building-2',
      name: 'Résidence Les Érables',
      address: '456 Boulevard René-Lévesque',
      city: 'Québec',
      province: 'QC',
      postalCode: 'G1R 2B5',
      buildingType: 'rental',
      yearBuilt: 2018,
      totalUnits: 75,
      totalFloors: 15,
      parkingSpaces: 0,
      storageSpaces: 0,
      organizationId: 'org-properties',
      organizationName: 'Properties Plus',
      accessType: 'residence',
      isActive: true,
    },
  ];

  const mockOrganizations = [
    {
      id: 'org-koveo',
      name: 'Koveo Management',
      type: 'management_company',
    },
    {
      id: 'org-properties',
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
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    user = userEvent.setup();
    jest.clearAllMocks();
    mockToast.mockClear();
    mockApiRequest.mockClear();

    // Mock successful API responses by default
    mockApiRequest
      .mockResolvedValueOnce({ buildings: mockBuildings })
      .mockResolvedValueOnce({ organizations: mockOrganizations });
  });

  describe('Admin User Complete Workflow', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: {
          id: 'admin-1',
          role: 'admin',
          email: 'admin@koveo.com',
          firstName: 'Marie',
          lastName: 'Tremblay',
          organizationName: 'Koveo',
        },
        isAuthenticated: true,
        isLoading: false,
      });
    });

    it('should complete full building creation workflow', async () => {
      // Setup mock responses for the complete workflow
      mockApiRequest
        .mockResolvedValueOnce({ buildings: mockBuildings })
        .mockResolvedValueOnce({ organizations: mockOrganizations })
        .mockResolvedValueOnce({ 
          message: 'Building created successfully',
          building: {
            id: 'new-building-id',
            name: 'Tour Moderne',
            organizationId: 'org-koveo',
            address: '789 Rue University',
            city: 'Montréal',
            province: 'QC',
            postalCode: 'H3A 2B4',
            buildingType: 'condo',
            yearBuilt: 2024,
            totalUnits: 100,
            totalFloors: 20,
            parkingSpaces: 80,
            storageSpaces: 50,
          }
        })
        .mockResolvedValueOnce({ 
          buildings: [...mockBuildings, {
            id: 'new-building-id',
            name: 'Tour Moderne',
            organizationId: 'org-koveo',
            organizationName: 'Koveo Management',
            address: '789 Rue University',
            city: 'Montréal',
            province: 'QC',
            postalCode: 'H3A 2B4',
            buildingType: 'condo',
            yearBuilt: 2024,
            totalUnits: 100,
            totalFloors: 20,
            parkingSpaces: 80,
            storageSpaces: 50,
            accessType: 'organization',
            isActive: true,
          }]
        });

      render(<Buildings />, { wrapper: createWrapper() });

      // Step 1: Verify page loads and shows existing buildings
      await waitFor(() => {
        expect(screen.getByText('Buildings Management')).toBeInTheDocument();
      });

      expect(screen.getByText('Maple Heights Condominiums')).toBeInTheDocument();
      expect(screen.getByText('Résidence Les Érables')).toBeInTheDocument();

      // Step 2: Open Add Building dialog
      const addButton = screen.getByText('Add New Building');
      expect(addButton).toBeInTheDocument();
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Create New Building')).toBeInTheDocument();
      });

      // Step 3: Fill out the form with comprehensive data
      const nameInput = screen.getByLabelText(/building name/i);
      await user.type(nameInput, 'Tour Moderne');

      // Select organization
      const orgSelect = screen.getByRole('combobox');
      await user.click(orgSelect);
      
      await waitFor(async () => {
        const orgOption = screen.getByText('Koveo Management (management_company)');
        await user.click(orgOption);
      });

      // Fill address information
      const addressInput = screen.getByLabelText(/^address$/i);
      await user.type(addressInput, '789 Rue University');

      const cityInput = screen.getByLabelText(/city/i);
      await user.type(cityInput, 'Montréal');

      const postalCodeInput = screen.getByLabelText(/postal code/i);
      await user.type(postalCodeInput, 'H3A 2B4');

      // Fill building details
      const yearInput = screen.getByLabelText(/year built/i);
      await user.type(yearInput, '2024');

      const unitsInput = screen.getByLabelText(/total units/i);
      await user.type(unitsInput, '100');

      const floorsInput = screen.getByLabelText(/total floors/i);
      await user.type(floorsInput, '20');

      const parkingInput = screen.getByLabelText(/parking spaces/i);
      await user.type(parkingInput, '80');

      const storageInput = screen.getByLabelText(/storage spaces/i);
      await user.type(storageInput, '50');

      // Step 4: Submit the form
      const submitButton = screen.getByText('Create Building');
      await user.click(submitButton);

      // Step 5: Verify API call was made with correct data
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          'POST',
          '/api/admin/buildings',
          expect.objectContaining({
            name: 'Tour Moderne',
            organizationId: 'org-koveo',
            address: '789 Rue University',
            city: 'Montréal',
            province: 'QC',
            postalCode: 'H3A 2B4',
            buildingType: 'condo',
            yearBuilt: 2024,
            totalUnits: 100,
            totalFloors: 20,
            parkingSpaces: 80,
            storageSpaces: 50,
          })
        );
      });

      // Step 6: Verify success notification
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Building created',
            description: 'The building has been successfully created.',
          })
        );
      });

      // Step 7: Verify dialog closes and new building appears in list
      await waitFor(() => {
        expect(screen.queryByText('Create New Building')).not.toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('Tour Moderne')).toBeInTheDocument();
      });
    });

    it('should complete building edit workflow with zero values', async () => {
      // Setup for edit workflow
      mockApiRequest
        .mockResolvedValueOnce({ buildings: mockBuildings })
        .mockResolvedValueOnce({ organizations: mockOrganizations })
        .mockResolvedValueOnce({ 
          message: 'Building updated successfully',
          building: {
            ...mockBuildings[1],
            name: 'Résidence Les Érables - Rénové',
            parkingSpaces: 0,
            storageSpaces: 0,
          }
        })
        .mockResolvedValueOnce({ buildings: mockBuildings });

      render(<Buildings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Résidence Les Érables')).toBeInTheDocument();
      });

      // Click edit button on second building (Les Érables)
      const editButtons = screen.getAllByTitle(/edit building/i);
      await user.click(editButtons[1]);

      await waitFor(() => {
        expect(screen.getByText('Edit Building')).toBeInTheDocument();
      });

      // Verify form is pre-filled with existing data
      const nameInput = screen.getByDisplayValue('Résidence Les Érables');
      expect(nameInput).toBeInTheDocument();

      // Verify zero values are displayed correctly
      const parkingInput = screen.getByLabelText(/parking spaces/i);
      expect(parkingInput).toHaveValue('0');

      // Update the name
      await user.clear(nameInput);
      await user.type(nameInput, 'Résidence Les Érables - Rénové');

      // Test that zero values can be maintained
      await user.clear(parkingInput);
      await user.type(parkingInput, '0');

      // Submit the update
      const updateButton = screen.getByText('Update Building');
      await user.click(updateButton);

      // Verify update API call
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          'PUT',
          '/api/admin/buildings/building-2',
          expect.objectContaining({
            name: 'Résidence Les Érables - Rénové',
            parkingSpaces: 0,
          })
        );
      });

      // Verify success notification
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Building updated',
          })
        );
      });
    });

    it('should complete building deletion workflow', async () => {
      // Mock window.confirm
      window.confirm = jest.fn().mockReturnValue(true);

      // Setup for delete workflow
      mockApiRequest
        .mockResolvedValueOnce({ buildings: mockBuildings })
        .mockResolvedValueOnce({ organizations: mockOrganizations })
        .mockResolvedValueOnce({ message: 'Building deleted successfully' })
        .mockResolvedValueOnce({ buildings: [mockBuildings[1]] }); // Only second building remains

      render(<Buildings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Maple Heights Condominiums')).toBeInTheDocument();
      });

      // Click delete button on first building
      const deleteButtons = screen.getAllByTitle(/delete building/i);
      await user.click(deleteButtons[0]);

      // Verify confirmation dialog
      expect(window.confirm).toHaveBeenCalledWith(
        expect.stringContaining('Are you sure you want to delete "Maple Heights Condominiums"?')
      );

      // Verify delete API call
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          'DELETE',
          '/api/admin/buildings/building-1'
        );
      });

      // Verify success notification
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Building deleted',
          })
        );
      });

      // Verify building is removed from list
      await waitFor(() => {
        expect(screen.queryByText('Maple Heights Condominiums')).not.toBeInTheDocument();
      });

      expect(screen.getByText('Résidence Les Érables')).toBeInTheDocument();

      // Cleanup
      jest.restoreAllMocks();
    });
  });

  describe('Manager User Workflow', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: {
          id: 'manager-1',
          role: 'manager',
          email: 'manager@properties.com',
          firstName: 'Jean',
          lastName: 'Dupuis',
          organizationName: 'Properties Plus',
        },
        isAuthenticated: true,
        isLoading: false,
      });
    });

    it('should allow building editing but not creation or deletion', async () => {
      mockApiRequest
        .mockResolvedValueOnce({ buildings: mockBuildings })
        .mockResolvedValueOnce({ organizations: mockOrganizations });

      render(<Buildings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Buildings Management')).toBeInTheDocument();
      });

      // Should not see Add Building button
      expect(screen.queryByText('Add New Building')).not.toBeInTheDocument();
      expect(screen.getByText('Admin Only')).toBeInTheDocument();

      // Should see edit buttons but not delete buttons
      const editButtons = screen.getAllByTitle(/edit building/i);
      expect(editButtons).toHaveLength(2);

      const deleteButtons = screen.queryAllByTitle(/delete building/i);
      expect(deleteButtons).toHaveLength(0);

      // Should be able to open edit dialog
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Edit Building')).toBeInTheDocument();
      });
    });
  });

  describe('Search and Filter Workflow', () => {
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
    });

    it('should filter buildings by search term in real-time', async () => {
      render(<Buildings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Maple Heights Condominiums')).toBeInTheDocument();
        expect(screen.getByText('Résidence Les Érables')).toBeInTheDocument();
      });

      // Search for specific building
      const searchInput = screen.getByPlaceholderText(/search buildings/i);
      await user.type(searchInput, 'Maple');

      // Should filter to only show Maple Heights
      await waitFor(() => {
        expect(screen.getByText('Maple Heights Condominiums')).toBeInTheDocument();
        expect(screen.queryByText('Résidence Les Érables')).not.toBeInTheDocument();
      });

      // Clear search
      await user.clear(searchInput);

      // Should show all buildings again
      await waitFor(() => {
        expect(screen.getByText('Maple Heights Condominiums')).toBeInTheDocument();
        expect(screen.getByText('Résidence Les Érables')).toBeInTheDocument();
      });

      // Search by address
      await user.type(searchInput, 'René-Lévesque');

      await waitFor(() => {
        expect(screen.queryByText('Maple Heights Condominiums')).not.toBeInTheDocument();
        expect(screen.getByText('Résidence Les Érables')).toBeInTheDocument();
      });

      // Search with no results
      await user.clear(searchInput);
      await user.type(searchInput, 'Nonexistent Building');

      await waitFor(() => {
        expect(screen.getByText(/no buildings found matching your search/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling Workflow', () => {
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

    it('should handle form validation errors gracefully', async () => {
      mockApiRequest
        .mockResolvedValueOnce({ buildings: mockBuildings })
        .mockResolvedValueOnce({ organizations: mockOrganizations });

      render(<Buildings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Add New Building')).toBeInTheDocument();
      });

      // Open add dialog
      const addButton = screen.getByText('Add New Building');
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Create New Building')).toBeInTheDocument();
      });

      // Try to submit without required fields
      const submitButton = screen.getByText('Create Building');
      await user.click(submitButton);

      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText(/building name.*required/i)).toBeInTheDocument();
        expect(screen.getByText(/organization.*required/i)).toBeInTheDocument();
      });

      // Fill only name
      const nameInput = screen.getByLabelText(/building name/i);
      await user.type(nameInput, 'Test Building');

      await user.click(submitButton);

      // Should still show organization error
      await waitFor(() => {
        expect(screen.queryByText(/building name.*required/i)).not.toBeInTheDocument();
        expect(screen.getByText(/organization.*required/i)).toBeInTheDocument();
      });
    });

    it('should handle API errors with user-friendly messages', async () => {
      mockApiRequest
        .mockResolvedValueOnce({ buildings: mockBuildings })
        .mockResolvedValueOnce({ organizations: mockOrganizations })
        .mockRejectedValueOnce(new Error('Server temporarily unavailable'));

      render(<Buildings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Add New Building')).toBeInTheDocument();
      });

      // Complete form and submit
      const addButton = screen.getByText('Add New Building');
      await user.click(addButton);

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/building name/i);
        await user.type(nameInput, 'Test Building');

        const orgSelect = screen.getByRole('combobox');
        await user.click(orgSelect);
        
        const orgOption = screen.getByText('Koveo Management (management_company)');
        await user.click(orgOption);

        const submitButton = screen.getByText('Create Building');
        await user.click(submitButton);
      });

      // Should show error toast
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

  describe('Loading States Workflow', () => {
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

    it('should show loading states during operations', async () => {
      // Mock slow API response
      const slowPromise = new Promise((resolve) => {
        setTimeout(() => resolve({ buildings: mockBuildings }), 100);
      });
      
      mockApiRequest
        .mockReturnValueOnce(slowPromise)
        .mockResolvedValueOnce({ organizations: mockOrganizations });

      render(<Buildings />, { wrapper: createWrapper() });

      // Should show loading state initially
      expect(screen.getByText('Loading...')).toBeInTheDocument();

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('Buildings Management')).toBeInTheDocument();
      });

      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    it('should show form submission loading states', async () => {
      mockApiRequest
        .mockResolvedValueOnce({ buildings: mockBuildings })
        .mockResolvedValueOnce({ organizations: mockOrganizations })
        .mockImplementation(() => new Promise(() => {})); // Pending promise

      render(<Buildings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Add New Building')).toBeInTheDocument();
      });

      // Open add dialog and fill form
      const addButton = screen.getByText('Add New Building');
      await user.click(addButton);

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/building name/i);
        await user.type(nameInput, 'Test Building');

        const orgSelect = screen.getByRole('combobox');
        await user.click(orgSelect);
        
        const orgOption = screen.getByText('Koveo Management (management_company)');
        await user.click(orgOption);

        const submitButton = screen.getByText('Create Building');
        await user.click(submitButton);
      });

      // Should show loading state on submit button
      await waitFor(() => {
        expect(screen.getByText('Creating...')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility Workflow', () => {
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

    it('should support keyboard navigation', async () => {
      render(<Buildings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Buildings Management')).toBeInTheDocument();
      });

      // Tab to search input
      const searchInput = screen.getByPlaceholderText(/search buildings/i);
      searchInput.focus();
      expect(searchInput).toHaveFocus();

      // Tab to Add Building button
      await user.tab();
      const addButton = screen.getByText('Add New Building');
      expect(addButton).toHaveFocus();

      // Enter to open dialog
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Create New Building')).toBeInTheDocument();
      });
    });

    it('should have proper ARIA labels and roles', async () => {
      render(<Buildings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Buildings Management')).toBeInTheDocument();
      });

      // Check for proper labels
      const searchInput = screen.getByLabelText(/search buildings/i);
      expect(searchInput).toBeInTheDocument();

      const editButtons = screen.getAllByLabelText(/edit building/i);
      expect(editButtons.length).toBeGreaterThan(0);

      const deleteButtons = screen.getAllByLabelText(/delete building/i);
      expect(deleteButtons.length).toBeGreaterThan(0);
    });
  });
});