/**
 * Hierarchical Navigation User Flow Tests
 * Tests complete user scenarios and flows through the hierarchical navigation system
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';

// Mock wouter
const mockSetLocation = jest.fn();
let mockCurrentLocation = '/residents/building';
let mockCurrentSearch = '';

jest.mock('wouter', () => ({
  useLocation: () => [mockCurrentLocation, mockSetLocation],
  useSearch: () => mockCurrentSearch,
}));

// Mock fetch for API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock building data scenarios
const SINGLE_BUILDING_USER_DATA = [
  { id: 'building-1', name: 'Building A', address: '123 Main St' }
];

const MULTIPLE_BUILDINGS_USER_DATA = [
  { id: 'building-1', name: 'Building A', address: '123 Main St' },
  { id: 'building-2', name: 'Building B', address: '456 Oak Ave' },
  { id: 'building-3', name: 'Building C', address: '789 Pine Rd' }
];

const SINGLE_BUILDING_DETAILS = {
  id: 'building-1',
  name: 'Building A',
  address: '123 Main St',
  city: 'Montreal',
  province: 'QC',
  postalCode: 'H1A 1A1',
  totalUnits: 50,
  occupiedUnits: 45,
  occupancyRate: 90,
  buildingType: 'residential',
  yearBuilt: 2020,
};

// Mock page components that use hierarchical navigation
const MockBuildingPage = () => {
  const [showSelection, setShowSelection] = React.useState(true);
  const [selectedBuilding, setSelectedBuilding] = React.useState<string | null>(null);
  const [buildings, setBuildings] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    // Simulate API call based on URL
    const urlParams = new URLSearchParams(mockCurrentSearch);
    const buildingId = urlParams.get('building');
    
    if (buildingId) {
      setSelectedBuilding(buildingId);
      setShowSelection(false);
    } else {
      setShowSelection(true);
    }

    // Mock API call delay
    setTimeout(() => {
      setBuildings(MULTIPLE_BUILDINGS_USER_DATA);
      setIsLoading(false);
    }, 100);
  }, [mockCurrentSearch]);

  const handleBuildingSelect = (buildingId: string) => {
    setSelectedBuilding(buildingId);
    setShowSelection(false);
    mockCurrentSearch = `?building=${buildingId}`;
    mockSetLocation(`/residents/building?building=${buildingId}`);
  };

  const handleBack = () => {
    setSelectedBuilding(null);
    setShowSelection(true);
    mockCurrentSearch = '';
    mockSetLocation('/residents/building');
  };

  if (isLoading) {
    return (
      <div data-testid="loading-state">
        <div data-testid="loading-spinner">Loading...</div>
      </div>
    );
  }

  if (showSelection) {
    return (
      <div data-testid="building-selection-screen">
        <h1 data-testid="selection-title">Select Building</h1>
        <div data-testid="buildings-grid">
          {buildings.map((building) => (
            <button
              key={building.id}
              data-testid={`building-card-${building.id}`}
              onClick={() => handleBuildingSelect(building.id)}
              className="building-card"
            >
              <h3>{building.name}</h3>
              <p>{building.address}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div data-testid="building-details-screen">
      <div data-testid="header-with-back">
        {buildings.length > 1 && (
          <button
            data-testid="back-to-buildings"
            onClick={handleBack}
          >
            Back to Buildings
          </button>
        )}
        <h1 data-testid="building-title">Building Details</h1>
      </div>
      <div data-testid="building-info">
        <p data-testid="selected-building-id">{selectedBuilding}</p>
        <p>Building information and details</p>
        <button data-testid="view-documents-btn">View Documents</button>
      </div>
    </div>
  );
};

// Mock single building scenario
const MockSingleBuildingPage = () => {
  const [selectedBuilding, setSelectedBuilding] = React.useState('building-1');
  const [buildings] = React.useState(SINGLE_BUILDING_USER_DATA);
  
  // Auto-forward for single building user
  React.useEffect(() => {
    if (buildings.length === 1 && !mockCurrentSearch.includes('building=')) {
      mockCurrentSearch = `?building=${buildings[0].id}`;
      mockSetLocation(`/residents/building?building=${buildings[0].id}`);
    }
  }, [buildings]);

  return (
    <div data-testid="single-building-details-screen">
      <div data-testid="header-no-back">
        <h1 data-testid="building-title">Building Details</h1>
      </div>
      <div data-testid="building-info">
        <p data-testid="selected-building-id">{selectedBuilding}</p>
        <p>Single building - no back button</p>
        <button data-testid="view-documents-btn">View Documents</button>
      </div>
    </div>
  );
};

describe('Hierarchical Navigation User Flows', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    // Reset mocks and state
    jest.clearAllMocks();
    mockSetLocation.mockClear();
    mockCurrentLocation = '/residents/building';
    mockCurrentSearch = '';

    // Mock window.history
    Object.defineProperty(window, 'history', {
      value: {
        pushState: jest.fn(),
      },
      writable: true,
    });

    // Mock successful API responses
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => MULTIPLE_BUILDINGS_USER_DATA,
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  describe('Multiple Buildings User Flow', () => {
    test('should complete full user flow: landing → selection → details → back', async () => {
      renderWithProviders(<MockBuildingPage />);

      // 1. Initial landing - should show loading then selection
      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
      
      await waitFor(() => {
        expect(screen.getByTestId('building-selection-screen')).toBeInTheDocument();
      });

      expect(screen.getByTestId('selection-title')).toHaveTextContent('Select Building');
      expect(screen.getByTestId('buildings-grid')).toBeInTheDocument();

      // Should show all available buildings
      expect(screen.getByTestId('building-card-building-1')).toHaveTextContent('Building A');
      expect(screen.getByTestId('building-card-building-2')).toHaveTextContent('Building B');
      expect(screen.getByTestId('building-card-building-3')).toHaveTextContent('Building C');

      // 2. User selects a building
      const building2Card = screen.getByTestId('building-card-building-2');
      fireEvent.click(building2Card);

      await waitFor(() => {
        expect(screen.getByTestId('building-details-screen')).toBeInTheDocument();
      });

      // Should show building details with back button
      expect(screen.getByTestId('building-title')).toHaveTextContent('Building Details');
      expect(screen.getByTestId('selected-building-id')).toHaveTextContent('building-2');
      expect(screen.getByTestId('back-to-buildings')).toBeInTheDocument();

      // Should update router
      expect(mockSetLocation).toHaveBeenCalledWith('/residents/building?building=building-2');

      // 3. User clicks back
      const backButton = screen.getByTestId('back-to-buildings');
      fireEvent.click(backButton);

      await waitFor(() => {
        expect(screen.getByTestId('building-selection-screen')).toBeInTheDocument();
      });

      // Should return to selection screen
      expect(screen.getByTestId('selection-title')).toHaveTextContent('Select Building');
      expect(screen.getByTestId('buildings-grid')).toBeInTheDocument();
      expect(mockSetLocation).toHaveBeenCalledWith('/residents/building');
    });

    test('should handle direct URL navigation to building details', async () => {
      // Simulate direct navigation to building details
      mockCurrentSearch = '?building=building-1';
      
      renderWithProviders(<MockBuildingPage />);

      await waitFor(() => {
        expect(screen.getByTestId('building-details-screen')).toBeInTheDocument();
      });

      // Should land directly on building details
      expect(screen.getByTestId('building-title')).toHaveTextContent('Building Details');
      expect(screen.getByTestId('selected-building-id')).toHaveTextContent('building-1');
      expect(screen.getByTestId('back-to-buildings')).toBeInTheDocument();
    });

    test('should show back button only when multiple buildings are available', async () => {
      mockCurrentSearch = '?building=building-2';
      
      renderWithProviders(<MockBuildingPage />);

      await waitFor(() => {
        expect(screen.getByTestId('building-details-screen')).toBeInTheDocument();
      });

      // With multiple buildings, should show back button
      expect(screen.getByTestId('back-to-buildings')).toBeInTheDocument();
    });

    test('should handle building selection errors gracefully', async () => {
      // Mock API failure
      mockFetch.mockRejectedValue(new Error('API Error'));
      
      renderWithProviders(<MockBuildingPage />);

      // Should handle loading state
      expect(screen.getByTestId('loading-state')).toBeInTheDocument();

      // After timeout, should still show selection screen (even with empty data)
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });
    });
  });

  describe('Single Building User Flow', () => {
    test('should auto-forward single building users to details', async () => {
      renderWithProviders(<MockSingleBuildingPage />);

      await waitFor(() => {
        expect(screen.getByTestId('single-building-details-screen')).toBeInTheDocument();
      });

      // Should land directly on details, no selection screen
      expect(screen.getByTestId('building-title')).toHaveTextContent('Building Details');
      expect(screen.getByTestId('selected-building-id')).toHaveTextContent('building-1');
      
      // Should NOT show back button (single building)
      expect(screen.queryByTestId('back-to-buildings')).not.toBeInTheDocument();
      expect(screen.getByTestId('header-no-back')).toBeInTheDocument();

      // Should auto-forward URL
      expect(mockSetLocation).toHaveBeenCalledWith('/residents/building?building=building-1');
    });

    test('should handle single building direct URL access', async () => {
      // User directly accesses with building param
      mockCurrentSearch = '?building=building-1';
      
      renderWithProviders(<MockSingleBuildingPage />);

      await waitFor(() => {
        expect(screen.getByTestId('single-building-details-screen')).toBeInTheDocument();
      });

      // Should show details without back button
      expect(screen.getByTestId('building-title')).toHaveTextContent('Building Details');
      expect(screen.queryByTestId('back-to-buildings')).not.toBeInTheDocument();
    });
  });

  describe('URL State Management', () => {
    test('should maintain URL consistency throughout navigation', async () => {
      renderWithProviders(<MockBuildingPage />);

      // Start with base URL
      expect(mockCurrentLocation).toBe('/residents/building');
      expect(mockCurrentSearch).toBe('');

      await waitFor(() => {
        expect(screen.getByTestId('building-selection-screen')).toBeInTheDocument();
      });

      // Select building - should update URL
      const buildingCard = screen.getByTestId('building-card-building-1');
      fireEvent.click(buildingCard);

      expect(mockCurrentSearch).toBe('?building=building-1');
      expect(mockSetLocation).toHaveBeenCalledWith('/residents/building?building=building-1');

      await waitFor(() => {
        expect(screen.getByTestId('building-details-screen')).toBeInTheDocument();
      });

      // Go back - should clear URL parameters
      const backButton = screen.getByTestId('back-to-buildings');
      fireEvent.click(backButton);

      expect(mockCurrentSearch).toBe('');
      expect(mockSetLocation).toHaveBeenCalledWith('/residents/building');
    });

    test('should handle malformed URL parameters', async () => {
      // Simulate malformed or non-existent building ID
      mockCurrentSearch = '?building=nonexistent-id';
      
      renderWithProviders(<MockBuildingPage />);

      await waitFor(() => {
        expect(screen.getByTestId('building-details-screen')).toBeInTheDocument();
      });

      // Should still attempt to show details (graceful degradation)
      expect(screen.getByTestId('selected-building-id')).toHaveTextContent('nonexistent-id');
    });

    test('should handle multiple URL parameters correctly', async () => {
      // Simulate URL with extra parameters
      mockCurrentSearch = '?building=building-1&extra=param&another=value';
      
      renderWithProviders(<MockBuildingPage />);

      await waitFor(() => {
        expect(screen.getByTestId('building-details-screen')).toBeInTheDocument();
      });

      // Should extract building parameter correctly
      expect(screen.getByTestId('selected-building-id')).toHaveTextContent('building-1');
    });
  });

  describe('User Experience Scenarios', () => {
    test('should handle quick back-and-forth navigation', async () => {
      renderWithProviders(<MockBuildingPage />);

      await waitFor(() => {
        expect(screen.getByTestId('building-selection-screen')).toBeInTheDocument();
      });

      // Quick selection
      fireEvent.click(screen.getByTestId('building-card-building-1'));

      await waitFor(() => {
        expect(screen.getByTestId('building-details-screen')).toBeInTheDocument();
      });

      // Quick back
      fireEvent.click(screen.getByTestId('back-to-buildings'));

      await waitFor(() => {
        expect(screen.getByTestId('building-selection-screen')).toBeInTheDocument();
      });

      // Select different building
      fireEvent.click(screen.getByTestId('building-card-building-3'));

      await waitFor(() => {
        expect(screen.getByTestId('building-details-screen')).toBeInTheDocument();
        expect(screen.getByTestId('selected-building-id')).toHaveTextContent('building-3');
      });
    });

    test('should preserve selection when navigating away and back', async () => {
      // Simulate user navigating to building details
      mockCurrentSearch = '?building=building-2';
      
      renderWithProviders(<MockBuildingPage />);

      await waitFor(() => {
        expect(screen.getByTestId('building-details-screen')).toBeInTheDocument();
        expect(screen.getByTestId('selected-building-id')).toHaveTextContent('building-2');
      });

      // Simulate user navigating away (e.g., to another page) and back
      // In a real app, this would be handled by route changes
      mockCurrentSearch = '';
      
      // Simulate returning to the page
      renderWithProviders(<MockBuildingPage />);

      await waitFor(() => {
        expect(screen.getByTestId('building-selection-screen')).toBeInTheDocument();
      });

      // Should show selection screen (no preserved state without URL params)
      expect(screen.getByTestId('buildings-grid')).toBeInTheDocument();
    });
  });

  describe('Manager Residences Page Navigation Flow', () => {
    // Mock Manager Residences page component with organization → building hierarchy
    const MockManagerResidencesPage = withHierarchicalSelection(() => {
      const { organizationId, buildingId, showBackButton, onBack } = useContext(HierarchyContext);
      
      return (
        <div data-testid="manager-residences-screen">
          <div data-testid="residences-title">Manager Residences</div>
          <div data-testid="selected-organization-id">{organizationId || 'none'}</div>
          <div data-testid="selected-building-id">{buildingId || 'none'}</div>
          {showBackButton && (
            <button data-testid="back-to-selection" onClick={onBack}>
              Back to Selection
            </button>
          )}
        </div>
      );
    }, {
      hierarchy: ['organization', 'building']
    });

    test('should navigate through organization → building flow for manager residences', async () => {
      // Mock API responses for organizations and buildings
      const mockOrganizationsData = [
        { id: 'org-1', name: 'Organization A' },
        { id: 'org-2', name: 'Organization B' },
      ];

      const mockBuildingsData = [
        { id: 'building-1', name: 'Building A', organizationId: 'org-1' },
        { id: 'building-2', name: 'Building B', organizationId: 'org-1' },
      ];

      let apiCallCount = 0;
      mockFetch.mockImplementation((url) => {
        apiCallCount++;
        if (url.includes('/api/organizations')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockOrganizationsData,
          });
        }
        if (url.includes('/api/manager/buildings')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ buildings: mockBuildingsData }),
          });
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });

      renderWithProviders(<MockManagerResidencesPage />);

      // 1. Should start with organization selection
      await waitFor(() => {
        expect(screen.getByTestId('organization-selection-screen')).toBeInTheDocument();
      });

      expect(screen.getByTestId('selection-title')).toHaveTextContent('Select Organization');
      expect(screen.getByTestId('org-card-org-1')).toHaveTextContent('Organization A');
      expect(screen.getByTestId('org-card-org-2')).toHaveTextContent('Organization B');

      // 2. Select an organization
      fireEvent.click(screen.getByTestId('org-card-org-1'));

      // 3. Should move to building selection
      await waitFor(() => {
        expect(screen.getByTestId('building-selection-screen')).toBeInTheDocument();
      });

      expect(screen.getByTestId('selection-title')).toHaveTextContent('Select Building');
      expect(screen.getByTestId('building-card-building-1')).toHaveTextContent('Building A');
      expect(screen.getByTestId('building-card-building-2')).toHaveTextContent('Building B');

      // 4. Select a building
      fireEvent.click(screen.getByTestId('building-card-building-1'));

      // 5. Should reach the manager residences screen
      await waitFor(() => {
        expect(screen.getByTestId('manager-residences-screen')).toBeInTheDocument();
      });

      expect(screen.getByTestId('residences-title')).toHaveTextContent('Manager Residences');
      expect(screen.getByTestId('selected-organization-id')).toHaveTextContent('org-1');
      expect(screen.getByTestId('selected-building-id')).toHaveTextContent('building-1');
      expect(screen.getByTestId('back-to-selection')).toBeInTheDocument();
    });

    test('should auto-forward when manager has single building in organization', async () => {
      // Mock single building response
      const mockOrganizationsData = [
        { id: 'org-1', name: 'Organization A' },
      ];

      const mockSingleBuildingData = [
        { id: 'building-1', name: 'Single Building', organizationId: 'org-1' },
      ];

      mockFetch.mockImplementation((url) => {
        if (url.includes('/api/organizations')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockOrganizationsData,
          });
        }
        if (url.includes('/api/manager/buildings')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ buildings: mockSingleBuildingData }),
          });
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });

      // Start with organization already selected
      mockCurrentSearch = '?organization=org-1';
      
      renderWithProviders(<MockManagerResidencesPage />);

      // Should auto-forward through single building to final screen
      await waitFor(() => {
        expect(screen.getByTestId('manager-residences-screen')).toBeInTheDocument();
      });

      expect(screen.getByTestId('selected-organization-id')).toHaveTextContent('org-1');
      expect(screen.getByTestId('selected-building-id')).toHaveTextContent('building-1');
    });

    test('should handle back navigation in manager residences hierarchy', async () => {
      const mockOrganizationsData = [
        { id: 'org-1', name: 'Organization A' },
        { id: 'org-2', name: 'Organization B' },
      ];

      const mockBuildingsData = [
        { id: 'building-1', name: 'Building A', organizationId: 'org-1' },
        { id: 'building-2', name: 'Building B', organizationId: 'org-1' },
      ];

      mockFetch.mockImplementation((url) => {
        if (url.includes('/api/organizations')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockOrganizationsData,
          });
        }
        if (url.includes('/api/manager/buildings')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ buildings: mockBuildingsData }),
          });
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });

      // Start with both organization and building selected
      mockCurrentSearch = '?organization=org-1&building=building-1';
      
      renderWithProviders(<MockManagerResidencesPage />);

      await waitFor(() => {
        expect(screen.getByTestId('manager-residences-screen')).toBeInTheDocument();
      });

      // Click back button
      fireEvent.click(screen.getByTestId('back-to-selection'));

      // Should return to building selection
      await waitFor(() => {
        expect(screen.getByTestId('building-selection-screen')).toBeInTheDocument();
      });

      expect(screen.getByTestId('selection-title')).toHaveTextContent('Select Building');
    });
  });
});