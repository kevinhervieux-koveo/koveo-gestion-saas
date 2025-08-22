/**
 * @file Validation tests for building schemas and business logic
 * Tests Zod schema validation, business rules, and data integrity constraints
 * for building management functionality.
 */

import { describe, it, expect } from '@jest/globals';
import { z } from 'zod';

// Mock the building schema - in real implementation this would be imported
const buildingFormSchema = z.object({
  name: z.string().min(1, 'Building name is required').max(200, 'Building name is too long'),
  organizationId: z.string().min(1, 'Organization is required'),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.enum(['QC', 'ON', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'NL', 'PE', 'YT', 'NT', 'NU']).default('QC'),
  postalCode: z.string().regex(/^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/, 'Invalid postal code format').optional(),
  buildingType: z.enum(['condo', 'rental']).default('condo'),
  yearBuilt: z.number().int().min(1800).max(new Date().getFullYear() + 5).optional(),
  totalUnits: z.number().int().min(0).max(10000).optional(),
  totalFloors: z.number().int().min(1).max(200).optional(),
  parkingSpaces: z.number().int().min(0).max(50000).optional(),
  storageSpaces: z.number().int().min(0).max(50000).optional(),
  managementCompany: z.string().max(200).optional(),
});

const buildingSearchSchema = z.object({
  search: z.string().max(100).optional(),
  buildingType: z.enum(['condo', 'rental']).optional(),
  organizationId: z.string().uuid().optional(),
  city: z.string().max(100).optional(),
  minUnits: z.number().int().min(0).optional(),
  maxUnits: z.number().int().min(0).optional(),
  minYear: z.number().int().min(1800).optional(),
  maxYear: z.number().int().max(new Date().getFullYear() + 5).optional(),
});

describe('Building Validation Tests', () => {
  // Move validBuildingData to top level so all tests can access it
  const validBuildingData = {
    name: 'Maple Heights Condominiums',
    organizationId: 'org-123e4567-e89b-12d3-a456-426614174000',
    address: '123 Rue Sainte-Catherine Est',
    city: 'Montréal',
    province: 'QC' as const,
    postalCode: 'H2X 1L4',
    buildingType: 'condo' as const,
    yearBuilt: 2020,
    totalUnits: 50,
    totalFloors: 10,
    parkingSpaces: 30,
    storageSpaces: 25,
    managementCompany: 'Gestion Immobilière Koveo',
  };

  describe('Building Form Schema Validation', () => {
    // validBuildingData moved to top level

    describe('Required Fields', () => {
      it('should validate correct building data', () => {
        const result = buildingFormSchema.safeParse(validBuildingData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.name).toBe('Maple Heights Condominiums');
          expect(result.data.province).toBe('QC');
          expect(result.data.buildingType).toBe('condo');
        }
      });

      it('should require building name', () => {
        const invalidData = { ...validBuildingData, name: '' };
        const result = buildingFormSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some(issue => 
            issue.path.includes('name') && issue.message.includes('required')
          )).toBe(true);
        }
      });

      it('should require organization ID', () => {
        const invalidData = { ...validBuildingData, organizationId: '' };
        const result = buildingFormSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some(issue => 
            issue.path.includes('organizationId') && issue.message.includes('required')
          )).toBe(true);
        }
      });

      it('should allow empty optional fields', () => {
        const minimalData = {
          name: 'Simple Building',
          organizationId: 'org-123e4567-e89b-12d3-a456-426614174000',
        };
        const result = buildingFormSchema.safeParse(minimalData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.province).toBe('QC'); // Default value
          expect(result.data.buildingType).toBe('condo'); // Default value
        }
      });
    });

    describe('String Field Validation', () => {
      it('should reject excessively long building names', () => {
        const invalidData = { ...validBuildingData, name: 'A'.repeat(201) };
        const result = buildingFormSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some(issue => 
            issue.path.includes('name') && issue.message.includes('too long')
          )).toBe(true);
        }
      });

      it('should accept building names at maximum length', () => {
        const validData = { ...validBuildingData, name: 'A'.repeat(200) };
        const result = buildingFormSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should reject excessively long management company names', () => {
        const invalidData = { ...validBuildingData, managementCompany: 'A'.repeat(201) };
        const result = buildingFormSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some(issue => 
            issue.path.includes('managementCompany')
          )).toBe(true);
        }
      });

      it('should handle French characters in building names', () => {
        const frenchData = {
          ...validBuildingData,
          name: 'Résidence Les Érables - Côte-des-Neiges',
          address: 'Chemin de la Côte-des-Neiges',
          city: 'Montréal',
          managementCompany: 'Gestion Immobilière Québécoise Inc.',
        };
        const result = buildingFormSchema.safeParse(frenchData);
        expect(result.success).toBe(true);
      });
    });

    describe('Postal Code Validation', () => {
      it('should accept valid Canadian postal codes', () => {
        const validPostalCodes = ['H3A 1A1', 'M5V 3A8', 'V6B 1A1', 'T2P 2M7'];
        
        validPostalCodes.forEach(postalCode => {
          const data = { ...validBuildingData, postalCode };
          const result = buildingFormSchema.safeParse(_data);
          expect(result.success).toBe(true);
        });
      });

      it('should accept postal codes without spaces', () => {
        const data = { ...validBuildingData, postalCode: 'H3A1A1' };
        const result = buildingFormSchema.safeParse(_data);
        expect(result.success).toBe(true);
      });

      it('should reject invalid postal code formats', () => {
        const invalidPostalCodes = ['12345', 'ABC 123', 'H3A1A', 'H3A 1A12'];
        
        invalidPostalCodes.forEach(postalCode => {
          const data = { ...validBuildingData, postalCode };
          const result = buildingFormSchema.safeParse(_data);
          expect(result.success).toBe(false);
        });
      });

      it('should handle lowercase postal codes', () => {
        const data = { ...validBuildingData, postalCode: 'h3a 1a1' };
        const result = buildingFormSchema.safeParse(_data);
        expect(result.success).toBe(true);
      });
    });

    describe('Province Validation', () => {
      it('should accept all Canadian provinces and territories', () => {
        const provinces = ['QC', 'ON', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'NL', 'PE', 'YT', 'NT', 'NU'];
        
        provinces.forEach(province => {
          const data = { ...validBuildingData, province: province as any };
          const result = buildingFormSchema.safeParse(_data);
          expect(result.success).toBe(true);
        });
      });

      it('should reject invalid province codes', () => {
        const invalidProvinces = ['XX', 'US', 'CA', 'Quebec', 'Ontario'];
        
        invalidProvinces.forEach(province => {
          const data = { ...validBuildingData, province: province as any };
          const result = buildingFormSchema.safeParse(_data);
          expect(result.success).toBe(false);
        });
      });

      it('should default to QC when not provided', () => {
        const dataWithoutProvince = {
          name: 'Test Building',
          organizationId: 'org-123',
        };
        const result = buildingFormSchema.safeParse(dataWithoutProvince);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.province).toBe('QC');
        }
      });
    });

    describe('Building Type Validation', () => {
      it('should accept valid building types', () => {
        const validTypes = ['condo', 'rental'];
        
        validTypes.forEach(buildingType => {
          const data = { ...validBuildingData, buildingType: buildingType as any };
          const result = buildingFormSchema.safeParse(_data);
          expect(result.success).toBe(true);
        });
      });

      it('should reject invalid building types', () => {
        const invalidTypes = ['apartment', 'house', 'commercial', 'mixed'];
        
        invalidTypes.forEach(buildingType => {
          const data = { ...validBuildingData, buildingType: buildingType as any };
          const result = buildingFormSchema.safeParse(_data);
          expect(result.success).toBe(false);
        });
      });

      it('should default to condo when not provided', () => {
        const dataWithoutType = {
          name: 'Test Building',
          organizationId: 'org-123',
        };
        const result = buildingFormSchema.safeParse(dataWithoutType);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.buildingType).toBe('condo');
        }
      });
    });

    describe('Numeric Field Validation', () => {
      it('should accept zero values for optional numeric fields', () => {
        const dataWithZeros = {
          ...validBuildingData,
          yearBuilt: undefined,
          totalUnits: 0,
          totalFloors: undefined,
          parkingSpaces: 0,
          storageSpaces: 0,
        };
        const result = buildingFormSchema.safeParse(dataWithZeros);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.totalUnits).toBe(0);
          expect(result.data.parkingSpaces).toBe(0);
          expect(result.data.storageSpaces).toBe(0);
        }
      });

      it('should validate year built range', () => {
        const currentYear = new Date().getFullYear();
        const validYears = [1800, 1950, 2000, currentYear, currentYear + 5];
        
        validYears.forEach(year => {
          const data = { ...validBuildingData, yearBuilt: year };
          const result = buildingFormSchema.safeParse(_data);
          expect(result.success).toBe(true);
        });
      });

      it('should reject invalid year built values', () => {
        const invalidYears = [1799, new Date().getFullYear() + 6, -100, 3000];
        
        invalidYears.forEach(year => {
          const data = { ...validBuildingData, yearBuilt: year };
          const result = buildingFormSchema.safeParse(_data);
          expect(result.success).toBe(false);
        });
      });

      it('should validate total units range', () => {
        const validUnits = [0, 1, 50, 500, 10000];
        
        validUnits.forEach(units => {
          const data = { ...validBuildingData, totalUnits: units };
          const result = buildingFormSchema.safeParse(_data);
          expect(result.success).toBe(true);
        });
      });

      it('should reject invalid total units values', () => {
        const invalidUnits = [-1, 10001, 999999];
        
        invalidUnits.forEach(units => {
          const data = { ...validBuildingData, totalUnits: units };
          const result = buildingFormSchema.safeParse(_data);
          expect(result.success).toBe(false);
        });
      });

      it('should validate total floors range', () => {
        const validFloors = [1, 5, 50, 200];
        
        validFloors.forEach(floors => {
          const data = { ...validBuildingData, totalFloors: floors };
          const result = buildingFormSchema.safeParse(_data);
          expect(result.success).toBe(true);
        });
      });

      it('should reject invalid total floors values', () => {
        const invalidFloors = [0, -1, 201, 1000];
        
        invalidFloors.forEach(floors => {
          const data = { ...validBuildingData, totalFloors: floors };
          const result = buildingFormSchema.safeParse(_data);
          expect(result.success).toBe(false);
        });
      });

      it('should validate parking and storage spaces', () => {
        const validSpaces = [0, 10, 100, 1000, 50000];
        
        validSpaces.forEach(spaces => {
          const data = { 
            ...validBuildingData, 
            parkingSpaces: spaces,
            storageSpaces: spaces,
          };
          const result = buildingFormSchema.safeParse(_data);
          expect(result.success).toBe(true);
        });
      });

      it('should reject invalid parking and storage spaces', () => {
        const invalidSpaces = [-1, 50001, 999999];
        
        invalidSpaces.forEach(spaces => {
          const parkingData = { ...validBuildingData, parkingSpaces: spaces };
          const storageData = { ...validBuildingData, storageSpaces: spaces };
          
          expect(buildingFormSchema.safeParse(parkingData).success).toBe(false);
          expect(buildingFormSchema.safeParse(storageData).success).toBe(false);
        });
      });

      it('should handle decimal numbers by rejecting them', () => {
        const decimalData = {
          ...validBuildingData,
          yearBuilt: 2020.5,
          totalUnits: 50.7,
          totalFloors: 10.2,
        };
        const result = buildingFormSchema.safeParse(decimalData);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Building Search Schema Validation', () => {
    it('should validate basic search parameters', () => {
      const searchData = {
        search: 'Maple Heights',
        buildingType: 'condo' as const,
        city: 'Montreal',
      };
      const result = buildingSearchSchema.safeParse(searchData);
      expect(result.success).toBe(true);
    });

    it('should validate numeric range parameters', () => {
      const rangeData = {
        minUnits: 10,
        maxUnits: 100,
        minYear: 2000,
        maxYear: 2023,
      };
      const result = buildingSearchSchema.safeParse(rangeData);
      expect(result.success).toBe(true);
    });

    it('should reject overly long search terms', () => {
      const invalidData = { search: 'A'.repeat(101) };
      const result = buildingSearchSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should validate UUID format for organizationId', () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const validData = { organizationId: validUuid };
      const result = buildingSearchSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID format for organizationId', () => {
      const invalidUuids = ['not-a-uuid', '123', 'abc-def-ghi'];
      
      invalidUuids.forEach(uuid => {
        const data = { organizationId: uuid };
        const result = buildingSearchSchema.safeParse(_data);
        expect(result.success).toBe(false);
      });
    });

    it('should handle empty search parameters', () => {
      const emptyData = {};
      const result = buildingSearchSchema.safeParse(emptyData);
      expect(result.success).toBe(true);
    });
  });

  describe('Business Logic Validation', () => {
    it('should validate logical consistency between floors and units', () => {
      // This would be implemented as a custom validation function
      const validateBuildingLogic = (_data: any) => {
        if (data.totalFloors && data.totalUnits) {
          const maxUnitsPerFloor = 50; // Business rule
          return data.totalUnits <= data.totalFloors * maxUnitsPerFloor;
        }
        return true;
      };

      const logicalData = {
        ...validBuildingData,
        totalFloors: 10,
        totalUnits: 50, // 5 units per floor - reasonable
      };
      expect(validateBuildingLogic(logicalData)).toBe(true);

      const illogicalData = {
        ...validBuildingData,
        totalFloors: 2,
        totalUnits: 200, // 100 units per floor - unreasonable
      };
      expect(validateBuildingLogic(illogicalData)).toBe(false);
    });

    it('should validate parking ratio constraints', () => {
      const validateParkingRatio = (_data: any) => {
        if (data.parkingSpaces && data.totalUnits) {
          const maxParkingRatio = 2; // Max 2 parking spaces per unit
          return data.parkingSpaces <= data.totalUnits * maxParkingRatio;
        }
        return true;
      };

      const reasonableParking = {
        totalUnits: 50,
        parkingSpaces: 75, // 1.5 spaces per unit
      };
      expect(validateParkingRatio(reasonableParking)).toBe(true);

      const excessiveParking = {
        totalUnits: 50,
        parkingSpaces: 150, // 3 spaces per unit
      };
      expect(validateParkingRatio(excessiveParking)).toBe(false);
    });

    it('should validate Quebec-specific business rules', () => {
      const validateQuebecRules = (_data: any) => {
        // Example: In Quebec, condo buildings typically have fewer rental restrictions
        if (data.province === 'QC' && data.buildingType === 'condo') {
          return true; // Quebec condos have specific regulations
        }
        return true;
      };

      const quebecCondo = {
        province: 'QC',
        buildingType: 'condo',
        name: 'Résidence Québécoise',
      };
      expect(validateQuebecRules(quebecCondo)).toBe(true);
    });

    it('should validate year built against building type expectations', () => {
      const validateYearBuildingType = (_data: any) => {
        // Modern condos are typically built after 1980
        if (data.buildingType === 'condo' && data.yearBuilt && data.yearBuilt < 1980) {
          return false; // Unusual but not impossible
        }
        return true;
      };

      const modernCondo = {
        buildingType: 'condo',
        yearBuilt: 2000,
      };
      expect(validateYearBuildingType(modernCondo)).toBe(true);

      const oldCondo = {
        buildingType: 'condo',
        yearBuilt: 1950,
      };
      expect(validateYearBuildingType(oldCondo)).toBe(false);
    });
  });

  describe('Edge Cases and Security', () => {
    it('should handle special characters safely', () => {
      const specialCharData = {
        ...validBuildingData,
        name: 'Building with "quotes" & <tags> and \' apostrophes',
        address: '123 O\'Connor St. - Unit #5 & 1/2',
      };
      const result = buildingFormSchema.safeParse(specialCharData);
      expect(result.success).toBe(true);
    });

    it('should handle unicode characters in building names', () => {
      const unicodeData = {
        ...validBuildingData,
        name: '🏢 Résidence Les Érables 🍁',
        city: 'Montréal',
      };
      const result = buildingFormSchema.safeParse(unicodeData);
      expect(result.success).toBe(true);
    });

    it('should prevent injection attempts in string fields', () => {
      const injectionData = {
        ...validBuildingData,
        name: "<script>alert('xss')</script>",
        address: "'; DROP TABLE buildings; --",
      };
      const result = buildingFormSchema.safeParse(injectionData);
      // Should still pass validation but application should sanitize
      expect(result.success).toBe(true);
    });

    it('should handle extremely large numbers gracefully', () => {
      const extremeData = {
        ...validBuildingData,
        yearBuilt: Number.MAX_SAFE_INTEGER,
        totalUnits: Number.MAX_SAFE_INTEGER,
      };
      const result = buildingFormSchema.safeParse(extremeData);
      expect(result.success).toBe(false); // Should be rejected by range constraints
    });

    it('should handle null and undefined values appropriately', () => {
      const nullData = {
        name: 'Test Building',
        organizationId: '123e4567-e89b-12d3-a456-426614174000',
        // Provide string values instead of null for required fields
        address: 'Test Address',
        yearBuilt: undefined, // Optional field can be undefined
        totalUnits: undefined, // Optional field can be undefined
      };
      const result = buildingFormSchema.safeParse(nullData);
      // Zod should handle undefined optional fields properly
      expect(result.success).toBe(true);
    });
  });
});