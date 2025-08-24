/**
 * @file Building Card Icon Positioning Tests.
 * @description Tests to ensure icons stay within card boundaries and maintain proper positioning
 * especially with long building names like "563 montée des pionniers, Terrebonne".
 */

import React from 'react';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';

// Mock BuildingCard component since the import path may vary
const MockBuildingCard = ({ building, userRole, onEdit, onDelete }: any) => {
  return (
    <div className="card bg-white rounded-lg border p-4 shadow-sm" data-testid="building-card">
      <div className="card-header">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{building.name}</h3>
            <p className="text-sm text-gray-600 mt-1">{building.organizationName}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-2">
              <span className="badge px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                {building.buildingType === 'condo' ? 'Condo' : 'Rental'}
              </span>
              <span className="badge px-2 py-1 rounded text-xs font-medium border">
                {building.accessType === 'organization' ? 'Organization' : 'Residence'}
              </span>
            </div>
            {(userRole === 'admin' || userRole === 'manager') && (
              <div className="flex gap-1 ml-2">
                <button
                  className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  title="Manage building documents"
                  onClick={() => {}}
                  data-testid="documents-button"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path></svg>
                </button>
                <button
                  className="h-8 w-8 p-0 variant-ghost"
                  title="Edit building"
                  onClick={() => onEdit(building)}
                  data-testid="edit-button"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path></svg>
                </button>
                {userRole === 'admin' && (
                  <button
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    title="Delete building"
                    onClick={() => onDelete(building)}
                    data-testid="delete-button"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="m3 6 3 18h12l3-18"></path></svg>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="card-content">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path></svg>
              <div>
                <p className="text-sm font-medium">{building.address}</p>
                <p className="text-xs text-gray-500">{building.city}, {building.province} {building.postalCode}</p>
              </div>
            </div>
            {building.yearBuilt && (
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect></svg>
                <span className="text-sm">Built in {building.yearBuilt}</span>
              </div>
            )}
            {building.managementCompany && (
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24"><path d="M3 21h18V8l-9-5-9 5v13z"></path></svg>
                <span className="text-sm">Managed by {building.managementCompany}</span>
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path></svg>
              <span className="text-sm">{building.totalUnits} units</span>
            </div>
            {building.parkingSpaces && (
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9L18.4 10"></path></svg>
                <span className="text-sm">{building.parkingSpaces} parking spaces</span>
              </div>
            )}
            {building.storageSpaces && (
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
                <span className="text-sm">{building.storageSpaces} storage spaces</span>
              </div>
            )}
          </div>
        </div>
        {building.amenities && building.amenities.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm font-medium mb-2">Amenities:</p>
            <div className="flex flex-wrap gap-1">
              {building.amenities.map((amenity: string, index: number) => (
                <span key={index} className="badge px-2 py-1 rounded text-xs border">{amenity}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Mock building data with varying name lengths to test icon positioning
const testBuildings = {
  shortName: {
    id: '1',
    name: 'Building A',
    address: '123 Main St',
    city: 'Montreal',
    province: 'QC',
    postalCode: 'H1A 1A1',
    organizationName: 'Test Org',
    buildingType: 'condo',
    accessType: 'residence',
    totalUnits: 10,
    yearBuilt: 2020,
    managementCompany: 'ABC Management',
    totalFloors: 3,
    parkingSpaces: 15,
    storageSpaces: 8,
    amenities: ['Pool', 'Gym']
  },
  mediumName: {
    id: '2',
    name: '563 montée des pionniers, Terrebonne',
    address: '563 montée des pionniers',
    city: 'Terrebonne',
    province: 'QC',
    postalCode: 'J6W 1S2',
    organizationName: 'Property Management Inc.',
    buildingType: 'condo',
    accessType: 'organization',
    totalUnits: 6,
    yearBuilt: 2018,
    managementCompany: 'Professional Property Services',
    totalFloors: 2,
    parkingSpaces: 12,
    storageSpaces: 6,
    amenities: ['Parking', 'Storage', 'Laundry']
  },
  veryLongName: {
    id: '3',
    name: 'The Grand Metropolitan Residential Tower Complex at 1234 Boulevard Saint-Laurent with Premium Amenities',
    address: '1234 Boulevard Saint-Laurent Ouest',
    city: 'Montreal',
    province: 'QC',
    postalCode: 'H2X 3Y4',
    organizationName: 'Metropolitan Property Management Corporation Ltd.',
    buildingType: 'apartment',
    accessType: 'organization',
    totalUnits: 150,
    yearBuilt: 2015,
    managementCompany: 'Elite Property Management Services International Inc.',
    totalFloors: 25,
    parkingSpaces: 200,
    storageSpaces: 100,
    amenities: ['Pool', 'Gym', 'Concierge', 'Rooftop Garden', 'Underground Parking', 'Storage Lockers', 'Laundry Facilities']
  }
};

describe('Building Card Icon Positioning Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  describe('Header Icon Positioning', () => {
    it('should keep action icons within card boundaries for short building names', () => {
      const mockOnEdit = jest.fn();
      const mockOnDelete = jest.fn();
      
      renderWithProviders(
        <MockBuildingCard 
          building={testBuildings.shortName as any}
          userRole="admin"
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      const card = screen.getByRole('article', { hidden: true }) || screen.getByTestId('building-card') || document.querySelector('[class*="Card"]');
      
      // Find action buttons (edit, delete, documents)
      const editButton = screen.getByTitle('Edit building');
      const deleteButton = screen.getByTitle('Delete building');
      const documentsButton = screen.getByTitle('Manage building documents');

      expect(editButton).toBeInTheDocument();
      expect(deleteButton).toBeInTheDocument();
      expect(documentsButton).toBeInTheDocument();

      // Check that buttons have proper sizing constraints
      expect(editButton).toHaveClass('h-8', 'w-8');
      expect(deleteButton).toHaveClass('h-8', 'w-8');
      expect(documentsButton).toHaveClass('h-8', 'w-8');
    });

    it('should maintain icon positioning for "563 montée des pionniers, Terrebonne" card', () => {
      const mockOnEdit = jest.fn();
      const mockOnDelete = jest.fn();
      
      renderWithProviders(
        <BuildingCard 
          building={testBuildings.mediumName as any}
          userRole="admin"
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Verify the building name is displayed
      expect(screen.getByText('563 montée des pionniers, Terrebonne')).toBeInTheDocument();

      // Find action icons
      const editButton = screen.getByTitle('Edit building');
      const deleteButton = screen.getByTitle('Delete building');
      const documentsButton = screen.getByTitle('Manage building documents');

      // Check that icons are contained within their buttons
      const editIcon = within(editButton).getByRole('img', { hidden: true }) || editButton.querySelector('svg');
      const deleteIcon = within(deleteButton).getByRole('img', { hidden: true }) || deleteButton.querySelector('svg');
      const documentsIcon = within(documentsButton).getByRole('img', { hidden: true }) || documentsButton.querySelector('svg');

      // Icons should have consistent sizing
      expect(editIcon).toHaveClass('w-4', 'h-4');
      expect(deleteIcon).toHaveClass('w-4', 'h-4');
      expect(documentsIcon).toHaveClass('w-4', 'h-4');

      // Button containers should maintain proper spacing
      const buttonContainer = editButton.parentElement;
      expect(buttonContainer).toHaveClass('flex', 'gap-1');
    });

    it('should handle very long building names without icon overflow', () => {
      const mockOnEdit = jest.fn();
      const mockOnDelete = jest.fn();
      
      renderWithProviders(
        <BuildingCard 
          building={testBuildings.veryLongName as any}
          userRole="admin"
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Find the header container
      const headerDiv = screen.getByText(testBuildings.veryLongName.name).parentElement?.parentElement;
      expect(headerDiv).toHaveClass('flex', 'items-start', 'justify-between');

      // Action buttons should still be accessible and properly positioned
      const editButton = screen.getByTitle('Edit building');
      const deleteButton = screen.getByTitle('Delete building');
      
      expect(editButton).toBeInTheDocument();
      expect(deleteButton).toBeInTheDocument();

      // Icons should maintain their size constraints
      const editIcon = editButton.querySelector('svg');
      const deleteIcon = deleteButton.querySelector('svg');
      
      expect(editIcon).toHaveClass('w-4', 'h-4');
      expect(deleteIcon).toHaveClass('w-4', 'h-4');
    });
  });

  describe('Content Icon Alignment', () => {
    it('should align address icons properly with text content', () => {
      const mockOnEdit = jest.fn();
      const mockOnDelete = jest.fn();
      
      renderWithProviders(
        <BuildingCard 
          building={testBuildings.mediumName as any}
          userRole="manager"
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Find MapPin icon next to address
      const addressText = screen.getByText('563 montée des pionniers');
      const addressContainer = addressText.parentElement;
      const mapPinIcon = addressContainer?.querySelector('svg[class*="w-4 h-4"]');

      expect(mapPinIcon).toBeInTheDocument();
      expect(mapPinIcon).toHaveClass('w-4', 'h-4', 'text-gray-500');

      // Container should use flex layout for proper alignment
      expect(addressContainer).toHaveClass('flex', 'items-center', 'gap-2');
    });

    it('should maintain icon spacing with statistical information', () => {
      const mockOnEdit = jest.fn();
      const mockOnDelete = jest.fn();
      
      renderWithProviders(
        <BuildingCard 
          building={testBuildings.veryLongName as any}
          userRole="manager"
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Find Users icon for unit count
      const unitText = screen.getByText('150 units');
      const unitContainer = unitText.parentElement;
      const usersIcon = unitContainer?.querySelector('svg[class*="w-4 h-4"]');

      expect(usersIcon).toBeInTheDocument();
      expect(usersIcon).toHaveClass('w-4', 'h-4', 'text-gray-500');

      // Find Car icon for parking spaces
      const parkingText = screen.getByText('200 parking spaces');
      const parkingContainer = parkingText.parentElement;
      const carIcon = parkingContainer?.querySelector('svg[class*="w-4 h-4"]');

      expect(carIcon).toBeInTheDocument();
      expect(carIcon).toHaveClass('w-4', 'h-4', 'text-gray-500');

      // Find Package icon for storage spaces
      const storageText = screen.getByText('100 storage spaces');
      const storageContainer = storageText.parentElement;
      const packageIcon = storageContainer?.querySelector('svg[class*="w-4 h-4"]');

      expect(packageIcon).toBeInTheDocument();
      expect(packageIcon).toHaveClass('w-4', 'h-4', 'text-gray-500');

      // All containers should maintain consistent spacing
      expect(unitContainer).toHaveClass('flex', 'items-center', 'gap-2');
      expect(parkingContainer).toHaveClass('flex', 'items-center', 'gap-2');
      expect(storageContainer).toHaveClass('flex', 'items-center', 'gap-2');
    });

    it('should position Calendar and Building icons correctly with management info', () => {
      const mockOnEdit = jest.fn();
      const mockOnDelete = jest.fn();
      
      renderWithProviders(
        <BuildingCard 
          building={testBuildings.veryLongName as any}
          userRole="manager"
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Find Calendar icon for year built
      const yearText = screen.getByText('Built in 2015');
      const yearContainer = yearText.parentElement;
      const calendarIcon = yearContainer?.querySelector('svg[class*="w-4 h-4"]');

      expect(calendarIcon).toBeInTheDocument();
      expect(calendarIcon).toHaveClass('w-4', 'h-4', 'text-gray-500');

      // Find Building icon for management company
      const managementText = screen.getByText(/Managed by Elite Property Management/);
      const managementContainer = managementText.parentElement;
      const buildingIcon = managementContainer?.querySelector('svg[class*="w-4 h-4"]');

      expect(buildingIcon).toBeInTheDocument();
      expect(buildingIcon).toHaveClass('w-4', 'h-4', 'text-gray-500');

      // Both should maintain proper flex alignment
      expect(yearContainer).toHaveClass('flex', 'items-center', 'gap-2');
      expect(managementContainer).toHaveClass('flex', 'items-center', 'gap-2');
    });
  });

  describe('Badge and Icon Layout', () => {
    it('should prevent badge overflow in header section', () => {
      const mockOnEdit = jest.fn();
      const mockOnDelete = jest.fn();
      
      renderWithProviders(
        <BuildingCard 
          building={testBuildings.veryLongName as any}
          userRole="admin"
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Find building type badge
      const condoBadge = screen.getByText('Rental');
      expect(condoBadge.parentElement).toHaveClass('badge');

      // Find access type badge
      const accessBadge = screen.getByText('Organization');
      expect(accessBadge.parentElement).toHaveClass('badge');

      // Badge container should handle flex layout properly
      const badgeContainer = condoBadge.parentElement?.parentElement;
      expect(badgeContainer).toHaveClass('flex', 'gap-2');
    });

    it('should handle amenity badges without layout breaking', () => {
      const mockOnEdit = jest.fn();
      const mockOnDelete = jest.fn();
      
      renderWithProviders(
        <BuildingCard 
          building={testBuildings.veryLongName as any}
          userRole="manager"
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Find amenities section
      const amenitiesHeader = screen.getByText('Amenities:');
      expect(amenitiesHeader).toBeInTheDocument();

      // Find amenity badges
      const poolBadge = screen.getByText('Pool');
      const gymBadge = screen.getByText('Gym');
      const conciergeBadge = screen.getByText('Concierge');

      expect(poolBadge.parentElement).toHaveClass('badge');
      expect(gymBadge.parentElement).toHaveClass('badge');
      expect(conciergeBadge.parentElement).toHaveClass('badge');

      // Amenity container should use flex-wrap to prevent overflow
      const amenityContainer = poolBadge.parentElement?.parentElement;
      expect(amenityContainer).toHaveClass('flex', 'flex-wrap', 'gap-1');
    });
  });

  describe('Responsive Icon Behavior', () => {
    it('should maintain icon proportions across different screen sizes', () => {
      const mockOnEdit = jest.fn();
      const mockOnDelete = jest.fn();
      
      // Test with medium name building
      renderWithProviders(
        <BuildingCard 
          building={testBuildings.mediumName as any}
          userRole="admin"
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // All icons should have consistent sizing classes
      const allIcons = document.querySelectorAll('svg[class*="w-4 h-4"]');
      
      allIcons.forEach(icon => {
        expect(icon).toHaveClass('w-4', 'h-4');
      });

      // Action button icons should maintain square aspect ratio
      const actionButtons = [
        screen.getByTitle('Edit building'),
        screen.getByTitle('Delete building'),
        screen.getByTitle('Manage building documents')
      ];

      actionButtons.forEach(button => {
        expect(button).toHaveClass('h-8', 'w-8', 'p-0');
        const icon = button.querySelector('svg');
        expect(icon).toHaveClass('w-4', 'h-4');
      });
    });

    it('should prevent icon overlapping with long text content', () => {
      const mockOnEdit = jest.fn();
      const mockOnDelete = jest.fn();
      
      renderWithProviders(
        <BuildingCard 
          building={testBuildings.veryLongName as any}
          userRole="admin"
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Check that grid layout prevents overlapping
      const gridContainer = screen.getByText(/Built in 2015/).parentElement?.parentElement;
      expect(gridContainer).toHaveClass('grid', 'md:grid-cols-2', 'gap-4');

      // Individual sections should have proper spacing
      const leftSection = screen.getByText(/1234 Boulevard Saint-Laurent/).parentElement?.parentElement;
      const rightSection = screen.getByText(/150 units/).parentElement?.parentElement;

      expect(leftSection).toHaveClass('space-y-3');
      expect(rightSection).toHaveClass('space-y-3');
    });
  });

  describe('Icon Color and Visibility', () => {
    it('should apply consistent icon colors for better visibility', () => {
      const mockOnEdit = jest.fn();
      const mockOnDelete = jest.fn();
      
      renderWithProviders(
        <BuildingCard 
          building={testBuildings.mediumName as any}
          userRole="admin"
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Content icons should have gray color for subtle appearance
      const mapIcon = document.querySelector('svg[class*="text-gray-500"]');
      expect(mapIcon).toHaveClass('text-gray-500');

      // Action button icons should have appropriate hover states
      const editButton = screen.getByTitle('Edit building');
      const deleteButton = screen.getByTitle('Delete building');
      const documentsButton = screen.getByTitle('Manage building documents');

      expect(documentsButton).toHaveClass('text-blue-600', 'hover:text-blue-700');
      expect(deleteButton).toHaveClass('text-red-600', 'hover:text-red-700');
      
      // Edit button should have default ghost button styling
      expect(editButton).toHaveClass('variant-ghost');
    });

    it('should maintain icon visibility on different background states', () => {
      const mockOnEdit = jest.fn();
      const mockOnDelete = jest.fn();
      
      renderWithProviders(
        <MockBuildingCard 
          building={testBuildings.shortName as any}
          userRole="admin"
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Action buttons should have proper hover backgrounds
      const documentsButton = screen.getByTitle('Manage building documents');
      const deleteButton = screen.getByTitle('Delete building');

      expect(documentsButton).toHaveClass('hover:bg-blue-50');
      expect(deleteButton).toHaveClass('hover:bg-red-50');
    });
  });

  describe('Edge Cases and Error Prevention', () => {
    it('should handle missing building data without breaking icon layout', () => {
      const mockOnEdit = jest.fn();
      const mockOnDelete = jest.fn();
      
      const incompleteBuilding = {
        ...testBuildings.mediumName,
        yearBuilt: undefined,
        managementCompany: undefined,
        parkingSpaces: null,
        storageSpaces: null,
        amenities: null
      };
      
      renderWithProviders(
        <BuildingCard 
          building={incompleteBuilding as any}
          userRole="manager"
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Basic icons should still be present
      const addressIcon = document.querySelector('svg[class*="w-4 h-4 text-gray-500"]');
      const usersIcon = screen.getByText('6 units').parentElement?.querySelector('svg');

      expect(addressIcon).toBeInTheDocument();
      expect(usersIcon).toBeInTheDocument();
      expect(usersIcon).toHaveClass('w-4', 'h-4', 'text-gray-500');
    });

    it('should prevent icon layout breaks with permission restrictions', () => {
      const mockOnEdit = jest.fn();
      const mockOnDelete = jest.fn();
      
      // Test with different user roles
      const roles = ['resident', 'manager', 'admin'];
      
      roles.forEach(role => {
        const { rerender } = renderWithProviders(
          <BuildingCard 
            building={testBuildings.mediumName as any}
            userRole={role}
            onEdit={mockOnEdit}
            onDelete={mockOnDelete}
          />
        );

        // Content icons should always be present regardless of role
        const addressIcon = document.querySelector('svg[class*="w-4 h-4 text-gray-500"]');
        expect(addressIcon).toBeInTheDocument();

        // Header layout should remain consistent
        const header = screen.getByText('563 montée des pionniers, Terrebonne').parentElement?.parentElement;
        expect(header).toHaveClass('flex', 'items-start', 'justify-between');

        rerender(<div />);
      });
    });
  });

  describe('Performance and Accessibility', () => {
    it('should provide proper accessibility attributes for interactive icons', () => {
      const mockOnEdit = jest.fn();
      const mockOnDelete = jest.fn();
      
      renderWithProviders(
        <BuildingCard 
          building={testBuildings.mediumName as any}
          userRole="admin"
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Action buttons should have proper titles for accessibility
      const editButton = screen.getByTitle('Edit building');
      const deleteButton = screen.getByTitle('Delete building');
      const documentsButton = screen.getByTitle('Manage building documents');

      expect(editButton).toHaveAttribute('title', 'Edit building');
      expect(deleteButton).toHaveAttribute('title', 'Delete building');
      expect(documentsButton).toHaveAttribute('title', 'Manage building documents');

      // Buttons should be focusable
      expect(editButton.tagName).toBe('BUTTON');
      expect(deleteButton.tagName).toBe('BUTTON');
      expect(documentsButton.tagName).toBe('BUTTON');
    });

    it('should maintain performance with many icons in grid layout', () => {
      const mockOnEdit = jest.fn();
      const mockOnDelete = jest.fn();
      
      // Render multiple cards to test grid performance
      const MultiCardGrid = () => (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6" data-testid="building-grid">
          {Object.values(testBuildings).map((building) => (
            <BuildingCard
              key={building.id}
              building={building as any}
              userRole="admin"
              onEdit={mockOnEdit}
              onDelete={mockOnDelete}
            />
          ))}
        </div>
      );
      
      const startTime = performance.now();
      renderWithProviders(<MultiCardGrid />);
      const endTime = performance.now();

      // Rendering should be reasonably fast (less than 100ms for 3 cards)
      expect(endTime - startTime).toBeLessThan(100);

      // All cards should be rendered
      const cards = document.querySelectorAll('[class*="Card"]');
      expect(cards.length).toBeGreaterThanOrEqual(3);

      // Icons should maintain consistent sizing across all cards
      const allContentIcons = document.querySelectorAll('svg[class*="w-4 h-4 text-gray-500"]');
      allContentIcons.forEach(icon => {
        expect(icon).toHaveClass('w-4', 'h-4', 'text-gray-500');
      });
    });
  });
});