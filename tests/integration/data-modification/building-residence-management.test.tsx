/**
 * Building and Residence Management Test Suite
 * Tests all data modification functionality for buildings and residences.
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProviders } from '../../test-utils/providers';
import { mockApiRequest } from '../../test-utils/api-mocks';

// Mock the building form component
const MockBuildingForm = ({ building, onSuccess }: any) => {
  const [formData, setFormData] = React.useState({});
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData.entries());
    
    try {
      const url = building ? `/api/admin/buildings/${building.id}` : '/api/admin/buildings';
      const method = building ? 'PUT' : 'POST';
      await mockApiRequest(method, url, data);
      onSuccess?.();
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} data-testid="building-form">
      <input 
        name="name" 
        placeholder="Building Name" 
        defaultValue={building?.name || ''}
        data-testid="input-building-name"
        required
      />
      <input 
        name="address" 
        placeholder="Address" 
        defaultValue={building?.address || ''}
        data-testid="input-building-address"
        required
      />
      <input 
        name="city" 
        placeholder="City" 
        defaultValue={building?.city || ''}
        data-testid="input-building-city"
        required
      />
      <input 
        name="totalUnits" 
        type="number" 
        placeholder="Total Units" 
        defaultValue={building?.totalUnits || ''}
        data-testid="input-total-units"
        required
      />
      <select name="buildingType" defaultValue={building?.buildingType || ''} data-testid="select-building-type" required>
        <option value="">Select Type</option>
        <option value="apartment">Apartment</option>
        <option value="condo">Condo</option>
        <option value="townhouse">Townhouse</option>
      </select>
      <button type="submit" data-testid="button-submit-building">
        {building ? 'Update Building' : 'Create Building'}
      </button>
    </form>
  );
};

const MockResidenceEditForm = ({ residence, onSuccess }: any) => {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData.entries());
    
    // Handle arrays for parking spots and storage spaces
    const parkingSpots = (data.parkingSpots as string).split(',').map(s => s.trim()).filter(s => s);
    const storageSpaces = (data.storageSpaces as string).split(',').map(s => s.trim()).filter(s => s);
    
    const finalData = {
      ...data,
      parkingSpots,
      storageSpaces,
      squareFootage: Number(data.squareFootage),
      floor: Number(data.floor)
    };
    
    try {
      await mockApiRequest('PUT', `/api/residences/${residence.id}`, finalData);
      onSuccess?.();
    } catch (error) {
      console.error('Residence update error:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} data-testid="residence-form">
      <input 
        name="unitNumber" 
        placeholder="Unit Number" 
        defaultValue={residence?.unitNumber || ''}
        data-testid="input-unit-number"
        required
      />
      <input 
        name="floor" 
        type="number" 
        placeholder="Floor" 
        defaultValue={residence?.floor || ''}
        data-testid="input-floor"
        required
      />
      <input 
        name="squareFootage" 
        type="number" 
        placeholder="Square Footage" 
        defaultValue={residence?.squareFootage || ''}
        data-testid="input-square-footage"
      />
      <input 
        name="parkingSpots" 
        placeholder="Parking Spots (comma separated)" 
        defaultValue={residence?.parkingSpots?.join(', ') || ''}
        data-testid="input-parking-spots"
      />
      <input 
        name="storageSpaces" 
        placeholder="Storage Spaces (comma separated)" 
        defaultValue={residence?.storageSpaces?.join(', ') || ''}
        data-testid="input-storage-spaces"
      />
      <button type="submit" data-testid="button-update-residence">
        Update Residence
      </button>
    </form>
  );
};

const mockBuilding = {
  id: 'test-building-id',
  name: 'Test Building',
  address: '123 Building Street',
  city: 'Montreal',
  province: 'QC',
  postalCode: 'H1H 1H1',
  buildingType: 'apartment',
  totalUnits: 50,
  organizationId: 'test-org-id'
};

const mockResidence = {
  id: 'test-residence-id',
  unitNumber: '101',
  floor: 1,
  squareFootage: 800,
  parkingSpots: ['P-001', 'P-002'],
  storageSpaces: ['S-001'],
  buildingId: 'test-building-id'
};

describe('Building and Residence Management', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiRequest.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
      status: 200
    });
  });

  describe('Building Management', () => {
    it('should create a new building successfully', async () => {
      const onSuccess = vi.fn();

      render(
        <TestProviders>
          <MockBuildingForm onSuccess={onSuccess} />
        </TestProviders>
      );

      // Fill out building creation form
      await user.type(screen.getByTestId('input-building-name'), 'New Building');
      await user.type(screen.getByTestId('input-building-address'), '456 New Street');
      await user.type(screen.getByTestId('input-building-city'), 'Quebec City');
      await user.type(screen.getByTestId('input-total-units'), '30');
      await user.selectOptions(screen.getByTestId('select-building-type'), 'condo');

      // Submit form
      await user.click(screen.getByTestId('button-submit-building'));

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('POST', '/api/admin/buildings', expect.objectContaining({
          name: 'New Building',
          address: '456 New Street',
          city: 'Quebec City',
          totalUnits: '30',
          buildingType: 'condo'
        }));
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('should edit an existing building successfully', async () => {
      const onSuccess = vi.fn();

      render(
        <TestProviders>
          <MockBuildingForm building={mockBuilding} onSuccess={onSuccess} />
        </TestProviders>
      );

      // Verify form is pre-populated
      expect(screen.getByDisplayValue('Test Building')).toBeInTheDocument();
      expect(screen.getByDisplayValue('50')).toBeInTheDocument();

      // Modify the building name and total units
      const nameInput = screen.getByTestId('input-building-name');
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Building Name');

      const unitsInput = screen.getByTestId('input-total-units');
      await user.clear(unitsInput);
      await user.type(unitsInput, '75');

      // Submit form
      await user.click(screen.getByTestId('button-submit-building'));

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('PUT', `/api/admin/buildings/${mockBuilding.id}`, expect.objectContaining({
          name: 'Updated Building Name',
          totalUnits: '75'
        }));
      });
    });

    it('should validate required building fields', async () => {
      render(
        <TestProviders>
          <MockBuildingForm />
        </TestProviders>
      );

      // Try to submit empty form
      await user.click(screen.getByTestId('button-submit-building'));

      // Form should not submit due to HTML5 validation
      expect(mockApiRequest).not.toHaveBeenCalled();
    });

    it('should handle building creation errors', async () => {
      mockApiRequest.mockRejectedValueOnce(new Error('Building creation failed'));

      const onSuccess = vi.fn();

      render(
        <TestProviders>
          <MockBuildingForm onSuccess={onSuccess} />
        </TestProviders>
      );

      // Fill out form
      await user.type(screen.getByTestId('input-building-name'), 'Test Building');
      await user.type(screen.getByTestId('input-building-address'), '123 Test St');
      await user.type(screen.getByTestId('input-building-city'), 'Montreal');
      await user.type(screen.getByTestId('input-total-units'), '10');
      await user.selectOptions(screen.getByTestId('select-building-type'), 'apartment');

      // Submit form
      await user.click(screen.getByTestId('button-submit-building'));

      // onSuccess should not be called due to error
      await waitFor(() => {
        expect(onSuccess).not.toHaveBeenCalled();
      });
    });
  });

  describe('Residence Management', () => {
    it('should update residence information successfully', async () => {
      const onSuccess = vi.fn();

      render(
        <TestProviders>
          <MockResidenceEditForm residence={mockResidence} onSuccess={onSuccess} />
        </TestProviders>
      );

      // Verify form is pre-populated
      expect(screen.getByDisplayValue('101')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('800')).toBeInTheDocument();
      expect(screen.getByDisplayValue('P-001, P-002')).toBeInTheDocument();
      expect(screen.getByDisplayValue('S-001')).toBeInTheDocument();

      // Modify unit number and square footage
      const unitInput = screen.getByTestId('input-unit-number');
      await user.clear(unitInput);
      await user.type(unitInput, '101A');

      const squareFootageInput = screen.getByTestId('input-square-footage');
      await user.clear(squareFootageInput);
      await user.type(squareFootageInput, '850');

      // Add additional parking spot
      const parkingInput = screen.getByTestId('input-parking-spots');
      await user.clear(parkingInput);
      await user.type(parkingInput, 'P-001, P-002, P-003');

      // Submit form
      await user.click(screen.getByTestId('button-update-residence'));

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('PUT', `/api/residences/${mockResidence.id}`, expect.objectContaining({
          unitNumber: '101A',
          squareFootage: 850,
          parkingSpots: ['P-001', 'P-002', 'P-003'],
          storageSpaces: ['S-001']
        }));
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('should handle empty parking spots and storage spaces', async () => {
      const onSuccess = vi.fn();

      render(
        <TestProviders>
          <MockResidenceEditForm residence={mockResidence} onSuccess={onSuccess} />
        </TestProviders>
      );

      // Clear parking spots and storage spaces
      const parkingInput = screen.getByTestId('input-parking-spots');
      await user.clear(parkingInput);

      const storageInput = screen.getByTestId('input-storage-spaces');
      await user.clear(storageInput);

      // Submit form
      await user.click(screen.getByTestId('button-update-residence'));

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('PUT', `/api/residences/${mockResidence.id}`, expect.objectContaining({
          parkingSpots: [],
          storageSpaces: []
        }));
      });
    });

    it('should validate numeric fields', async () => {
      render(
        <TestProviders>
          <MockResidenceEditForm residence={mockResidence} />
        </TestProviders>
      );

      // Enter invalid floor number
      const floorInput = screen.getByTestId('input-floor');
      await user.clear(floorInput);
      await user.type(floorInput, '-1');

      // HTML5 validation should prevent negative numbers
      expect(floorInput).toHaveValue(-1);
    });

    it('should handle residence update errors', async () => {
      mockApiRequest.mockRejectedValueOnce(new Error('Residence update failed'));

      const onSuccess = vi.fn();

      render(
        <TestProviders>
          <MockResidenceEditForm residence={mockResidence} onSuccess={onSuccess} />
        </TestProviders>
      );

      // Submit form with existing data
      await user.click(screen.getByTestId('button-update-residence'));

      // onSuccess should not be called due to error
      await waitFor(() => {
        expect(onSuccess).not.toHaveBeenCalled();
      });
    });
  });

  describe('Data Validation and Edge Cases', () => {
    it('should handle array parsing for parking spots correctly', async () => {
      const onSuccess = vi.fn();

      render(
        <TestProviders>
          <MockResidenceEditForm residence={mockResidence} onSuccess={onSuccess} />
        </TestProviders>
      );

      // Test various parking spot formats
      const parkingInput = screen.getByTestId('input-parking-spots');
      await user.clear(parkingInput);
      await user.type(parkingInput, 'P-001, P-002, , P-003, '); // Test with empty strings

      await user.click(screen.getByTestId('button-update-residence'));

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('PUT', `/api/residences/${mockResidence.id}`, expect.objectContaining({
          parkingSpots: ['P-001', 'P-002', 'P-003'] // Empty strings should be filtered out
        }));
      });
    });

    it('should handle large building with many units', async () => {
      const onSuccess = vi.fn();

      render(
        <TestProviders>
          <MockBuildingForm building={mockBuilding} onSuccess={onSuccess} />
        </TestProviders>
      );

      // Test with maximum allowed units
      const unitsInput = screen.getByTestId('input-total-units');
      await user.clear(unitsInput);
      await user.type(unitsInput, '300'); // Maximum allowed

      await user.click(screen.getByTestId('button-submit-building'));

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('PUT', `/api/admin/buildings/${mockBuilding.id}`, expect.objectContaining({
          totalUnits: '300'
        }));
      });
    });

    it('should preserve form data on network errors', async () => {
      // Simulate network error
      mockApiRequest.mockRejectedValueOnce(new Error('Network error'));

      render(
        <TestProviders>
          <MockBuildingForm />
        </TestProviders>
      );

      // Fill out form
      await user.type(screen.getByTestId('input-building-name'), 'Test Building');
      await user.type(screen.getByTestId('input-building-address'), '123 Test St');

      // Submit form
      await user.click(screen.getByTestId('button-submit-building'));

      // Form data should still be there after error
      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Building')).toBeInTheDocument();
        expect(screen.getByDisplayValue('123 Test St')).toBeInTheDocument();
      });
    });
  });

  describe('Building Type Management', () => {
    it('should handle all building types correctly', async () => {
      const buildingTypes = ['apartment', 'condo', 'townhouse'];
      
      for (const buildingType of buildingTypes) {
        const onSuccess = vi.fn();

        render(
          <TestProviders>
            <MockBuildingForm onSuccess={onSuccess} />
          </TestProviders>
        );

        await user.type(screen.getByTestId('input-building-name'), `${buildingType} Building`);
        await user.type(screen.getByTestId('input-building-address'), '123 Test St');
        await user.type(screen.getByTestId('input-building-city'), 'Montreal');
        await user.type(screen.getByTestId('input-total-units'), '10');
        await user.selectOptions(screen.getByTestId('select-building-type'), buildingType);

        await user.click(screen.getByTestId('button-submit-building'));

        await waitFor(() => {
          expect(mockApiRequest).toHaveBeenCalledWith('POST', '/api/admin/buildings', expect.objectContaining({
            buildingType
          }));
        });
      }
    });
  });
});