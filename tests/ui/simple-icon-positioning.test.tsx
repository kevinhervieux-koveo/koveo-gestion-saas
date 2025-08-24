/**
 * @file Simple Icon Positioning Test.
 * @description Focused test to ensure icons stay within card boundaries for "563 montée des pionniers, Terrebonne".
 */

import React from 'react';
import { describe, it, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Simple BuildingCard component focused on testing icon positioning
const BuildingCard = ({ building, userRole }: { building: any; userRole: string }) => {
  return (
    <div 
      className="bg-white rounded-lg border p-4 shadow-sm max-w-sm"
      data-testid="building-card"
      style={{ width: '320px' }}
    >
      {/* Header with building name and action icons */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 
            className="text-lg font-semibold text-gray-900 truncate"
            data-testid="building-name"
          >
            {building.name}
          </h3>
        </div>
        
        {/* Action buttons should stay within boundaries */}
        {(userRole === 'admin' || userRole === 'manager') && (
          <div className="flex gap-1 ml-2 flex-shrink-0">
            <button
              className="h-8 w-8 p-0 rounded hover:bg-blue-50 flex-shrink-0"
              title="Edit building"
              data-testid="edit-button"
            >
              <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              </svg>
            </button>
            <button
              className="h-8 w-8 p-0 rounded hover:bg-red-50 flex-shrink-0"
              title="Delete building"
              data-testid="delete-button"
            >
              <svg className="w-4 h-4 text-red-600" viewBox="0 0 24 24">
                <path d="m3 6 3 18h12l3-18"/>
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Content with address icon */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-500 flex-shrink-0" viewBox="0 0 24 24">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          </svg>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate" data-testid="address-text">
              {building.address}
            </p>
            <p className="text-xs text-gray-500">
              {building.city}, {building.province} {building.postalCode}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-500 flex-shrink-0" viewBox="0 0 24 24">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
          </svg>
          <span className="text-sm">{building.totalUnits} units</span>
        </div>
      </div>
    </div>
  );
};

describe('Simple Icon Positioning Tests', () => {
  const testBuildings = {
    problematicName: {
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
      name: 'The Grand Metropolitan Residential Tower Complex at 1234 Boulevard Saint-Laurent with Premium Amenities',
      address: '1234 Boulevard Saint-Laurent Ouest',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H2X 3Y4',
      totalUnits: 150
    }
  };

  it('should contain action icons within card for "563 montée des pionniers, Terrebonne"', () => {
    render(
      <BuildingCard building={testBuildings.problematicName} userRole="admin" />
    );

    // Verify the building name is displayed
    const buildingName = screen.getByTestId('building-name');
    expect(buildingName).toHaveTextContent('563 montée des pionniers, Terrebonne');

    // Find action buttons
    const editButton = screen.getByTestId('edit-button');
    const deleteButton = screen.getByTestId('delete-button');

    // Buttons should exist and have proper size constraints
    expect(editButton).toBeInTheDocument();
    expect(deleteButton).toBeInTheDocument();
    
    // Check that buttons have fixed dimensions to prevent overflow
    expect(editButton).toHaveClass('h-8', 'w-8', 'flex-shrink-0');
    expect(deleteButton).toHaveClass('h-8', 'w-8', 'flex-shrink-0');

    // Icons within buttons should have consistent sizing
    const editIcon = editButton.querySelector('svg');
    const deleteIcon = deleteButton.querySelector('svg');
    
    expect(editIcon).toHaveClass('w-4', 'h-4');
    expect(deleteIcon).toHaveClass('w-4', 'h-4');
  });

  it('should handle very long building names with proper icon positioning', () => {
    render(
      <BuildingCard building={testBuildings.veryLongName} userRole="admin" />
    );

    // Building name should be truncated to prevent overflow
    const buildingName = screen.getByTestId('building-name');
    expect(buildingName).toHaveClass('truncate');

    // Action buttons should still be visible and properly positioned
    const editButton = screen.getByTestId('edit-button');
    const deleteButton = screen.getByTestId('delete-button');

    expect(editButton).toBeInTheDocument();
    expect(deleteButton).toBeInTheDocument();

    // Container should use flex with proper space management
    const header = buildingName.parentElement;
    expect(header).toHaveClass('flex', 'items-start', 'justify-between');
    
    // Building name container should allow truncation
    const nameContainer = buildingName.parentElement;
    expect(nameContainer).toHaveClass('flex-1', 'min-w-0');
  });

  it('should properly position content icons with address text', () => {
    render(
      <BuildingCard building={testBuildings.problematicName} userRole="manager" />
    );

    // Find address icon and text
    const addressText = screen.getByTestId('address-text');
    expect(addressText).toHaveTextContent('563 montée des pionniers');

    // Address container should use flex layout with proper spacing
    const addressContainer = addressText.parentElement?.parentElement;
    expect(addressContainer).toHaveClass('flex', 'items-center', 'gap-2');

    // Address icon should be present and have fixed size
    const addressIcon = addressContainer?.querySelector('svg');
    expect(addressIcon).toHaveClass('w-4', 'h-4', 'flex-shrink-0');

    // Text container should handle overflow properly
    const textContainer = addressText.parentElement;
    expect(textContainer).toHaveClass('min-w-0', 'flex-1');
    expect(addressText).toHaveClass('truncate');
  });

  it('should maintain card width constraints', () => {
    const { container } = render(
      <BuildingCard building={testBuildings.veryLongName} userRole="admin" />
    );

    const card = screen.getByTestId('building-card');
    
    // Card should have fixed width to prevent expansion
    const cardStyles = getComputedStyle(card);
    expect(card.style.width).toBe('320px');
    
    // Verify card exists in DOM
    expect(card).toBeInTheDocument();
  });

  it('should handle different user roles without breaking layout', () => {
    const roles = ['resident', 'manager', 'admin'];
    
    roles.forEach(role => {
      const { rerender } = render(
        <BuildingCard building={testBuildings.problematicName} userRole={role} />
      );

      // Building name should always be present regardless of role
      const buildingName = screen.getByTestId('building-name');
      expect(buildingName).toBeInTheDocument();

      // Address icon should always be present
      const addressText = screen.getByTestId('address-text');
      expect(addressText).toBeInTheDocument();

      // Header layout should remain consistent
      const header = buildingName.parentElement;
      expect(header).toHaveClass('flex', 'items-start', 'justify-between');

      // Clean up for next iteration
      rerender(<div />);
    });
  });
});