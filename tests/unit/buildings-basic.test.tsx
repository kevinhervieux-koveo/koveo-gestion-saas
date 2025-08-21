/**
 * @file Basic unit tests for Buildings Management functionality
 * Tests core building operations, validation, and role-based access.
 */

import { describe, it, expect } from '@jest/globals';

// Mock data for testing
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
    isActive: true,
  },
];

describe('Buildings Management Unit Tests', () => {
  describe('Building Data Validation', () => {
    it('should validate required building fields', () => {
      const validBuilding = mockBuildings[0];
      
      expect(validBuilding.name).toBeDefined();
      expect(validBuilding.name.length).toBeGreaterThan(0);
      expect(validBuilding.organizationId).toBeDefined();
      expect(validBuilding.buildingType).toMatch(/^(condo|rental)$/);
    });

    it('should handle optional numeric fields correctly', () => {
      const buildingWithZeros = mockBuildings[1];
      
      expect(buildingWithZeros.parkingSpaces).toBe(0);
      expect(buildingWithZeros.storageSpaces).toBe(0);
      expect(typeof buildingWithZeros.parkingSpaces).toBe('number');
      expect(typeof buildingWithZeros.storageSpaces).toBe('number');
    });

    it('should validate Quebec postal codes', () => {
      const quebecPostalCodePattern = /^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/;
      
      mockBuildings.forEach(building => {
        if (building.postalCode) {
          expect(building.postalCode).toMatch(quebecPostalCodePattern);
        }
      });
    });

    it('should validate building types', () => {
      const validTypes = ['condo', 'rental'];
      
      mockBuildings.forEach(building => {
        expect(validTypes).toContain(building.buildingType);
      });
    });

    it('should validate numeric field ranges', () => {
      mockBuildings.forEach(building => {
        if (building.yearBuilt) {
          expect(building.yearBuilt).toBeGreaterThanOrEqual(1800);
          expect(building.yearBuilt).toBeLessThanOrEqual(new Date().getFullYear() + 5);
        }
        
        if (building.totalUnits) {
          expect(building.totalUnits).toBeGreaterThanOrEqual(0);
          expect(building.totalUnits).toBeLessThanOrEqual(10000);
        }
        
        if (building.totalFloors) {
          expect(building.totalFloors).toBeGreaterThanOrEqual(1);
          expect(building.totalFloors).toBeLessThanOrEqual(200);
        }
        
        if (building.parkingSpaces !== undefined) {
          expect(building.parkingSpaces).toBeGreaterThanOrEqual(0);
          expect(building.parkingSpaces).toBeLessThanOrEqual(50000);
        }
        
        if (building.storageSpaces !== undefined) {
          expect(building.storageSpaces).toBeGreaterThanOrEqual(0);
          expect(building.storageSpaces).toBeLessThanOrEqual(50000);
        }
      });
    });
  });

  describe('Building Search Functionality', () => {
    const searchBuildings = (buildings: typeof mockBuildings, searchTerm: string) => {
      const term = searchTerm.toLowerCase();
      return buildings.filter(building => 
        building.name.toLowerCase().includes(term) ||
        building.address.toLowerCase().includes(term) ||
        building.city.toLowerCase().includes(term) ||
        building.organizationName.toLowerCase().includes(term)
      );
    };

    it('should filter buildings by name', () => {
      const results = searchBuildings(mockBuildings, 'Maple');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Maple Heights');
    });

    it('should filter buildings by address', () => {
      const results = searchBuildings(mockBuildings, 'Sainte-Catherine');
      expect(results).toHaveLength(1);
      expect(results[0].address).toContain('Sainte-Catherine');
    });

    it('should filter buildings by city', () => {
      const results = searchBuildings(mockBuildings, 'Montreal');
      expect(results).toHaveLength(1);
      expect(results[0].city).toBe('Montreal');
    });

    it('should filter buildings by organization', () => {
      const results = searchBuildings(mockBuildings, 'Koveo');
      expect(results).toHaveLength(1);
      expect(results[0].organizationName).toContain('Koveo');
    });

    it('should be case insensitive', () => {
      const upperResults = searchBuildings(mockBuildings, 'MAPLE');
      const lowerResults = searchBuildings(mockBuildings, 'maple');
      expect(upperResults).toEqual(lowerResults);
    });

    it('should return empty array for no matches', () => {
      const results = searchBuildings(mockBuildings, 'nonexistent');
      expect(results).toHaveLength(0);
    });

    it('should handle special characters', () => {
      const results = searchBuildings(mockBuildings, 'René-Lévesque');
      expect(results).toHaveLength(1);
      expect(results[0].address).toContain('René-Lévesque');
    });
  });

  describe('Role-based Access Control Logic', () => {
    const checkAccessPermissions = (userRole: string) => {
      const permissions = {
        canView: ['admin', 'manager'].includes(userRole),
        canCreate: ['admin'].includes(userRole),
        canEdit: ['admin', 'manager'].includes(userRole),
        canDelete: ['admin'].includes(userRole),
      };
      return permissions;
    };

    it('should grant full access to admin users', () => {
      const permissions = checkAccessPermissions('admin');
      expect(permissions.canView).toBe(true);
      expect(permissions.canCreate).toBe(true);
      expect(permissions.canEdit).toBe(true);
      expect(permissions.canDelete).toBe(true);
    });

    it('should grant limited access to manager users', () => {
      const permissions = checkAccessPermissions('manager');
      expect(permissions.canView).toBe(true);
      expect(permissions.canCreate).toBe(false);
      expect(permissions.canEdit).toBe(true);
      expect(permissions.canDelete).toBe(false);
    });

    it('should deny access to tenant users', () => {
      const permissions = checkAccessPermissions('tenant');
      expect(permissions.canView).toBe(false);
      expect(permissions.canCreate).toBe(false);
      expect(permissions.canEdit).toBe(false);
      expect(permissions.canDelete).toBe(false);
    });

    it('should deny access to resident users', () => {
      const permissions = checkAccessPermissions('resident');
      expect(permissions.canView).toBe(false);
      expect(permissions.canCreate).toBe(false);
      expect(permissions.canEdit).toBe(false);
      expect(permissions.canDelete).toBe(false);
    });
  });

  describe('Building Form Validation', () => {
    const validateBuildingForm = (formData: unknown) => {
      const errors: string[] = [];
      
      if (!formData.name || formData.name.trim().length === 0) {
        errors.push('Building name is required');
      }
      
      if (!formData.organizationId || formData.organizationId.trim().length === 0) {
        errors.push('Organization is required');
      }
      
      if (formData.postalCode && !/^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/.test(formData.postalCode)) {
        errors.push('Invalid postal code format');
      }
      
      if (formData.yearBuilt && (formData.yearBuilt < 1800 || formData.yearBuilt > new Date().getFullYear() + 5)) {
        errors.push('Invalid year built');
      }
      
      if (formData.totalUnits && (formData.totalUnits < 0 || formData.totalUnits > 10000)) {
        errors.push('Invalid total units');
      }
      
      if (formData.totalFloors && (formData.totalFloors < 1 || formData.totalFloors > 200)) {
        errors.push('Invalid total floors');
      }
      
      if (formData.parkingSpaces !== undefined && (formData.parkingSpaces < 0 || formData.parkingSpaces > 50000)) {
        errors.push('Invalid parking spaces');
      }
      
      if (formData.storageSpaces !== undefined && (formData.storageSpaces < 0 || formData.storageSpaces > 50000)) {
        errors.push('Invalid storage spaces');
      }
      
      return { isValid: errors.length === 0, errors };
    };

    it('should validate complete valid form data', () => {
      const validForm = {
        name: 'Test Building',
        organizationId: 'org-123',
        address: '123 Test Street',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H3A 1A1',
        buildingType: 'condo',
        yearBuilt: 2023,
        totalUnits: 50,
        totalFloors: 10,
        parkingSpaces: 30,
        storageSpaces: 25,
      };
      
      const result = validateBuildingForm(validForm);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject form with missing required fields', () => {
      const invalidForm = {
        address: '123 Test Street',
        city: 'Montreal',
      };
      
      const result = validateBuildingForm(invalidForm);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Building name is required');
      expect(result.errors).toContain('Organization is required');
    });

    it('should accept zero values for optional numeric fields', () => {
      const formWithZeros = {
        name: 'Test Building',
        organizationId: 'org-123',
        parkingSpaces: 0,
        storageSpaces: 0,
      };
      
      const result = validateBuildingForm(formWithZeros);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid postal codes', () => {
      const invalidPostalCodes = ['12345', 'ABC123', 'H3A1A', 'H3A 1A12'];
      
      invalidPostalCodes.forEach(postalCode => {
        const form = {
          name: 'Test Building',
          organizationId: 'org-123',
          postalCode,
        };
        
        const result = validateBuildingForm(form);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid postal code format');
      });
    });

    it('should reject invalid numeric ranges', () => {
      const invalidData = [
        { field: 'yearBuilt', value: 1799, error: 'Invalid year built' },
        { field: 'yearBuilt', value: new Date().getFullYear() + 10, error: 'Invalid year built' },
        { field: 'totalUnits', value: -1, error: 'Invalid total units' },
        { field: 'totalUnits', value: 10001, error: 'Invalid total units' },
        { field: 'totalFloors', value: 0, error: 'Invalid total floors' },
        { field: 'totalFloors', value: 201, error: 'Invalid total floors' },
        { field: 'parkingSpaces', value: -1, error: 'Invalid parking spaces' },
        { field: 'parkingSpaces', value: 50001, error: 'Invalid parking spaces' },
        { field: 'storageSpaces', value: -1, error: 'Invalid storage spaces' },
        { field: 'storageSpaces', value: 50001, error: 'Invalid storage spaces' },
      ];
      
      invalidData.forEach(({ field, value, error }) => {
        const form = {
          name: 'Test Building',
          organizationId: 'org-123',
          [field]: value,
        };
        
        const result = validateBuildingForm(form);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(error);
      });
    });
  });

  describe('Quebec-specific Business Logic', () => {
    it('should handle French building names and addresses', () => {
      const frenchBuilding = {
        name: 'Résidence Les Érables',
        address: 'Rue de la Cathédrale',
        city: 'Québec',
        province: 'QC',
        organizationName: 'Gestion Immobilière Québécoise',
      };
      
      expect(frenchBuilding.name).toContain('Résidence');
      expect(frenchBuilding.address).toContain('Cathédrale');
      expect(frenchBuilding.city).toBe('Québec');
      expect(frenchBuilding.organizationName).toContain('Québécoise');
    });

    it('should validate Quebec postal code pattern', () => {
      const quebecPostalCodes = ['H3A 1A1', 'G1R 2B5', 'J5A 1B2', 'K1A 0A6'];
      const quebecPattern = /^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/;
      
      quebecPostalCodes.forEach(postalCode => {
        expect(postalCode).toMatch(quebecPattern);
      });
    });

    it('should handle special characters in Quebec addresses', () => {
      const quebecAddresses = [
        'Côte-des-Neiges',
        'Rue Saint-Denis',
        'Boulevard René-Lévesque',
        'Chemin de la Côte-Sainte-Catherine',
      ];
      
      quebecAddresses.forEach(address => {
        expect(address).toBeDefined();
        expect(address.length).toBeGreaterThan(0);
        // Should contain French characters or hyphens
        expect(/[àâäéèêëïîôöùûüÿç-]/.test(address)).toBe(true);
      });
    });
  });

  describe('Data Transformation and Display', () => {
    const formatBuildingDisplay = (building: typeof mockBuildings[0]) => {
      return {
        title: building.name,
        subtitle: `${building.address}, ${building.city}`,
        details: [
          building.buildingType === 'condo' ? 'Condominium' : 'Rental',
          building.totalUnits ? `${building.totalUnits} units` : 'Units: N/A',
          building.yearBuilt ? `Built in ${building.yearBuilt}` : 'Year: N/A',
        ].filter(Boolean),
        organization: building.organizationName,
        hasParking: (building.parkingSpaces || 0) > 0,
        hasStorage: (building.storageSpaces || 0) > 0,
      };
    };

    it('should format building display correctly', () => {
      const formatted = formatBuildingDisplay(mockBuildings[0]);
      
      expect(formatted.title).toBe('Maple Heights');
      expect(formatted.subtitle).toBe('123 Rue Sainte-Catherine, Montreal');
      expect(formatted.details).toContain('Condominium');
      expect(formatted.details).toContain('50 units');
      expect(formatted.details).toContain('Built in 2020');
      expect(formatted.organization).toBe('Koveo Management');
      expect(formatted.hasParking).toBe(true);
      expect(formatted.hasStorage).toBe(true);
    });

    it('should handle buildings with zero parking and storage', () => {
      const formatted = formatBuildingDisplay(mockBuildings[1]);
      
      expect(formatted.hasParking).toBe(false);
      expect(formatted.hasStorage).toBe(false);
    });

    it('should handle missing optional fields gracefully', () => {
      const minimalBuilding = {
        ...mockBuildings[0],
        totalUnits: undefined,
        yearBuilt: undefined,
        parkingSpaces: undefined,
        storageSpaces: undefined,
      };
      
      const formatted = formatBuildingDisplay(minimalBuilding as any);
      
      expect(formatted.details).toContain('Units: N/A');
      expect(formatted.details).toContain('Year: N/A');
      expect(formatted.hasParking).toBe(false);
      expect(formatted.hasStorage).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed building data', () => {
      const malformedData = {
        name: null,
        organizationId: undefined,
        yearBuilt: 'invalid',
        totalUnits: 'not a number',
      };
      
      // Mock validation function for testing
      const validateBuildingForm = (data: unknown) => {
        const errors: string[] = [];
        const typedData = data as Record<string, unknown>;
        
        if (!typedData.name) {
          errors.push('Building name is required');
        }
        if (!typedData.organizationId) {
          errors.push('Organization is required');
        }
        if (typedData.yearBuilt && typeof typedData.yearBuilt !== 'number') {
          errors.push('Invalid year');
        }
        if (typedData.totalUnits && typeof typedData.totalUnits !== 'number') {
          errors.push('Invalid units');
        }
        
        return { isValid: errors.length === 0, errors };
      };
      
      const validation = validateBuildingForm(malformedData);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should handle empty string values', () => {
      const emptyData = {
        name: '',
        organizationId: '   ',
        address: '',
        city: '',
      };
      
      // Mock validation function for testing
      const validateBuildingForm = (data: unknown) => {
        const errors: string[] = [];
        const typedData = data as Record<string, unknown>;
        
        if (!typedData.name || (typeof typedData.name === 'string' && typedData.name.trim() === '')) {
          errors.push('Building name is required');
        }
        if (!typedData.organizationId || (typeof typedData.organizationId === 'string' && typedData.organizationId.trim() === '')) {
          errors.push('Organization is required');
        }
        
        return { isValid: errors.length === 0, errors };
      };
      
      const validation = validateBuildingForm(emptyData);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Building name is required');
      expect(validation.errors).toContain('Organization is required');
    });

    it('should handle extreme numeric values', () => {
      const extremeData = {
        name: 'Test Building',
        organizationId: 'org-123',
        yearBuilt: Number.MAX_SAFE_INTEGER,
        totalUnits: Number.MAX_SAFE_INTEGER,
        totalFloors: Number.MAX_SAFE_INTEGER,
      };
      
      // Mock validation function for testing
      const validateBuildingForm = (data: unknown) => {
        const errors: string[] = [];
        const typedData = data as Record<string, unknown>;
        const currentYear = new Date().getFullYear();
        
        if (typedData.yearBuilt && typeof typedData.yearBuilt === 'number' && typedData.yearBuilt > currentYear + 5) {
          errors.push('Year built is too far in the future');
        }
        if (typedData.totalUnits && typeof typedData.totalUnits === 'number' && typedData.totalUnits > 10000) {
          errors.push('Total units exceeds maximum');
        }
        
        return { isValid: errors.length === 0, errors };
      };
      
      const validation = validateBuildingForm(extremeData);
      expect(validation.isValid).toBe(false);
    });
  });
});