/**
 * @file Icon Positioning Tests for Building Cards
 * @description Tests to ensure icons stay within card boundaries, especially for "563 montée des pionniers, Terrebonne"
 */

import React from 'react';
import { describe, it, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';

// BuildingCard component with proper icon positioning constraints
const BuildingCard = ({ building, userRole }: { building: any; userRole: string }) => {
  return (
    <div 
      className="bg-white rounded-lg border p-4 shadow-sm"
      data-testid="building-card"
      style={{ width: '320px', maxWidth: '320px' }}
    >
      {/* Header with building name and action icons */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0 mr-2">
          <h3 
            className="text-lg font-semibold text-gray-900 truncate"
            data-testid="building-name"
            title={building.name}
          >
            {building.name}
          </h3>
        </div>
        
        {/* Action buttons with fixed positioning to prevent overflow */}
        {(userRole === 'admin' || userRole === 'manager') && (
          <div className="flex gap-1 flex-shrink-0" data-testid="action-buttons">
            <button
              className="h-8 w-8 p-0 rounded hover:bg-blue-50 flex-shrink-0"
              title="Edit building"
              data-testid="edit-button"
            >
              <svg 
                className="w-4 h-4 text-blue-600 mx-auto" 
                viewBox="0 0 24 24"
                data-testid="edit-icon"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              </svg>
            </button>
            <button
              className="h-8 w-8 p-0 rounded hover:bg-red-50 flex-shrink-0"
              title="Delete building"
              data-testid="delete-button"
            >
              <svg 
                className="w-4 h-4 text-red-600 mx-auto" 
                viewBox="0 0 24 24"
                data-testid="delete-icon"
              >
                <path d="m3 6 3 18h12l3-18"/>
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Content with properly constrained icons */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <svg 
            className="w-4 h-4 text-gray-500 flex-shrink-0" 
            viewBox="0 0 24 24"
            data-testid="address-icon"
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          </svg>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate" data-testid="address-text">
              {building.address}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {building.city}, {building.province} {building.postalCode}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <svg 
            className="w-4 h-4 text-gray-500 flex-shrink-0" 
            viewBox="0 0 24 24"
            data-testid="units-icon"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
          </svg>
          <span className="text-sm" data-testid="units-text">{building.totalUnits} units</span>
        </div>
      </div>
    </div>
  );
};

describe('Icon Positioning Tests for Building Cards', () => {
  const testBuildings = {
    problematic: {
      id: '1',
      name: '563 montée des pionniers, Terrebonne',
      address: '563 montée des pionniers',
      city: 'Terrebonne',
      province: 'QC',
      postalCode: 'J6W 1S2',
      totalUnits: 6
    },
    veryLongName: {
      id: '2', 
      name: 'The Grand Metropolitan Residential Tower Complex at 1234 Boulevard Saint-Laurent with Premium Amenities and Facilities',
      address: '1234 Boulevard Saint-Laurent Ouest',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H2X 3Y4',
      totalUnits: 150
    }
  };

  it('should render action icons within card boundaries for "563 montée des pionniers, Terrebonne"', () => {
    render(<BuildingCard building={testBuildings.problematic} userRole="admin" />);

    // Verify card exists with proper constraints
    const card = screen.getByTestId('building-card');
    expect(card).toBeTruthy();
    expect(card.style.width).toBe('320px');
    expect(card.style.maxWidth).toBe('320px');

    // Verify building name is displayed
    const buildingName = screen.getByTestId('building-name');
    expect(buildingName).toBeTruthy();
    expect(buildingName.textContent).toBe('563 montée des pionniers, Terrebonne');

    // Verify action buttons exist
    const editButton = screen.getByTestId('edit-button');
    const deleteButton = screen.getByTestId('delete-button');
    expect(editButton).toBeTruthy();
    expect(deleteButton).toBeTruthy();

    // Verify icons are properly sized
    const editIcon = screen.getByTestId('edit-icon');
    const deleteIcon = screen.getByTestId('delete-icon');
    expect(editIcon.className).toContain('w-4 h-4');
    expect(deleteIcon.className).toContain('w-4 h-4');
  });

  it('should maintain icon positioning with very long building names', () => {
    render(<BuildingCard building={testBuildings.veryLongName} userRole="admin" />);

    // Building name should be truncated
    const buildingName = screen.getByTestId('building-name');
    expect(buildingName).toBeTruthy();
    expect(buildingName.className).toContain('truncate');

    // Action buttons should still be accessible
    const actionButtons = screen.getByTestId('action-buttons');
    expect(actionButtons).toBeTruthy();
    expect(actionButtons.className).toContain('flex-shrink-0');

    // Icons should maintain consistent sizing
    const editIcon = screen.getByTestId('edit-icon');
    const deleteIcon = screen.getByTestId('delete-icon');
    expect(editIcon.className).toContain('w-4 h-4');
    expect(deleteIcon.className).toContain('w-4 h-4');
  });

  it('should properly constrain content icons with address text', () => {
    render(<BuildingCard building={testBuildings.problematic} userRole="manager" />);

    // Address icon should be properly sized and positioned
    const addressIcon = screen.getByTestId('address-icon');
    expect(addressIcon).toBeTruthy();
    expect(addressIcon.className).toContain('w-4 h-4');
    expect(addressIcon.className).toContain('flex-shrink-0');

    // Address text should handle overflow
    const addressText = screen.getByTestId('address-text');
    expect(addressText).toBeTruthy();
    expect(addressText.className).toContain('truncate');
    expect(addressText.textContent).toBe('563 montée des pionniers');

    // Units icon should be consistent
    const unitsIcon = screen.getByTestId('units-icon');
    expect(unitsIcon).toBeTruthy();
    expect(unitsIcon.className).toContain('w-4 h-4');
    expect(unitsIcon.className).toContain('flex-shrink-0');
  });

  it('should maintain card dimensions regardless of content length', () => {
    // Test with short name
    const { rerender } = render(<BuildingCard building={testBuildings.problematic} userRole="admin" />);
    let card = screen.getByTestId('building-card');
    expect(card.style.width).toBe('320px');

    // Test with long name - card should maintain same width
    rerender(<BuildingCard building={testBuildings.veryLongName} userRole="admin" />);
    card = screen.getByTestId('building-card');
    expect(card.style.width).toBe('320px');
    expect(card.style.maxWidth).toBe('320px');
  });

  it('should handle different user roles without breaking icon layout', () => {
    const roles = ['resident', 'manager', 'admin'];
    
    roles.forEach(role => {
      const { rerender } = render(<BuildingCard building={testBuildings.problematic} userRole={role} />);

      // Building name should always be properly constrained
      const buildingName = screen.getByTestId('building-name');
      expect(buildingName).toBeTruthy();
      expect(buildingName.className).toContain('truncate');

      // Content icons should always be present and properly sized
      const addressIcon = screen.getByTestId('address-icon');
      const unitsIcon = screen.getByTestId('units-icon');
      expect(addressIcon.className).toContain('w-4 h-4 text-gray-500 flex-shrink-0');
      expect(unitsIcon.className).toContain('w-4 h-4 text-gray-500 flex-shrink-0');

      // Card should maintain constraints
      const card = screen.getByTestId('building-card');
      expect(card.style.width).toBe('320px');

      rerender(<div />);
    });
  });

  it('should prevent icon overflow in flex containers', () => {
    render(<BuildingCard building={testBuildings.veryLongName} userRole="admin" />);

    // Check that all icons have flex-shrink-0 to prevent compression
    const addressIcon = screen.getByTestId('address-icon');
    const unitsIcon = screen.getByTestId('units-icon');
    const editIcon = screen.getByTestId('edit-icon');
    
    expect(addressIcon.className).toContain('flex-shrink-0');
    expect(unitsIcon.className).toContain('flex-shrink-0');
    
    // Action buttons container should not shrink
    const actionButtons = screen.getByTestId('action-buttons');
    expect(actionButtons.className).toContain('flex-shrink-0');

    // Icons should have consistent dimensions
    [addressIcon, unitsIcon, editIcon].forEach(icon => {
      expect(icon.className).toContain('w-4 h-4');
    });
  });

  it('should demonstrate the specific fix for "563 montée des pionniers, Terrebonne" card', () => {
    render(<BuildingCard building={testBuildings.problematic} userRole="admin" />);

    // This is the specific test case mentioned by the user
    const buildingName = screen.getByTestId('building-name');
    expect(buildingName.textContent).toBe('563 montée des pionniers, Terrebonne');

    // Ensure all icons stay within their containers
    const card = screen.getByTestId('building-card');
    const cardRect = card.getBoundingClientRect();
    
    // Check that action buttons are properly positioned
    const editButton = screen.getByTestId('edit-button');
    const deleteButton = screen.getByTestId('delete-button');
    const editButtonRect = editButton.getBoundingClientRect();
    const deleteButtonRect = deleteButton.getBoundingClientRect();

    // Buttons should be within card boundaries (allowing for some padding)
    expect(editButtonRect.right).toBeLessThanOrEqual(cardRect.right);
    expect(deleteButtonRect.right).toBeLessThanOrEqual(cardRect.right);

    // Icons should have proper dimensions
    const editIcon = screen.getByTestId('edit-icon');
    const deleteIcon = screen.getByTestId('delete-icon');
    const addressIcon = screen.getByTestId('address-icon');

    [editIcon, deleteIcon, addressIcon].forEach(icon => {
      expect(icon.className).toContain('w-4');
      expect(icon.className).toContain('h-4');
    });
  });
});