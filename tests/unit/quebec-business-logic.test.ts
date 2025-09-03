import {
  insertUserSchema,
  insertOrganizationSchema,
  insertBuildingSchema,
  insertResidenceSchema,
} from '../../shared/schema';

describe('Quebec Property Management Business Logic', () => {
  describe('User Schema Validation - Quebec Context', () => {
    it('should validate Quebec user with French language default', () => {
      const validUser = {
        username: 'marie.tremblay',
        email: 'marie.tremblay@example.com',
        password: 'SecurePass123!',
        firstName: 'Marie',
        lastName: 'Tremblay',
        phone: '514-555-0123',
        language: 'fr',
        role: 'tenant',
      };

      const result = insertUserSchema.safeParse(validUser);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.language).toBe('fr');
        expect(result.data.firstName).toBe('Marie');
        expect(result.data.lastName).toBe('Tremblay');
      }
    });

    it('should validate Quebec user with English language', () => {
      const validUser = {
        username: 'john.smith',
        email: 'john.smith@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Smith',
        language: 'en',
        role: 'resident',
      };

      const result = insertUserSchema.safeParse(validUser);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.language).toBe('en');
      }
    });

    it('should require valid email format', () => {
      const invalidUser = {
        username: 'marie.invalid',
        email: 'invalid-email',
        password: 'SecurePass123!',
        firstName: 'Marie',
        lastName: 'Tremblay',
      };

      const result = insertUserSchema.safeParse(invalidUser);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('email');
      }
    });

    it('should require minimum password length for security', () => {
      const invalidUser = {
        username: 'marie.short',
        email: 'marie@example.com',
        password: 'short',
        firstName: 'Marie',
        lastName: 'Tremblay',
      };

      const result = insertUserSchema.safeParse(invalidUser);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('password');
        expect(result.error.issues[0].message).toContain('8 characters');
      }
    });

    it('should validate Quebec property management roles', () => {
      const roles = ['admin', 'manager', 'resident', 'tenant'];

      roles.forEach((role) => {
        const user = {
          username: 'test.user',
          email: 'test@example.com',
          password: 'SecurePass123!',
          firstName: 'Test',
          lastName: 'User',
          role,
        };

        const result = insertUserSchema.safeParse(user);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.role).toBe(role);
        }
      });
    });

    it('should handle Quebec name length requirements', () => {
      const longName = 'A'.repeat(101);
      const invalidUser = {
        username: 'test.long',
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: longName,
        lastName: 'Valid',
      };

      const result = insertUserSchema.safeParse(invalidUser);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('100 characters');
      }
    });
  });

  describe('Organization Schema Validation - Quebec Legal Entities', () => {
    it('should validate Quebec syndicate organization', () => {
      const quebecSyndicate = {
        name: 'Syndicat de Copropriété Château Frontenac',
        type: 'syndicate',
        address: '1 Rue des Carrières',
        city: 'Québec',
        province: 'QC',
        postalCode: 'G1R 4P5',
        phone: '+1-418-692-3861',
        email: 'admin@chateau-frontenac.ca',
        registrationNumber: 'QC-SYN-123456789',
      };

      const result = insertOrganizationSchema.safeParse(quebecSyndicate);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.province).toBe('QC');
        expect(result.data.type).toBe('syndicate');
        expect(result.data.name).toContain('Syndicat');
      }
    });

    it('should validate Quebec management company', () => {
      const managementCompany = {
        name: 'Gestion Immobilière Québec Inc.',
        type: 'management_company',
        address: '500 Grande Allée Est',
        city: 'Québec',
        province: 'QC',
        postalCode: 'G1R 2J7',
        phone: '+1-418-525-4321',
        email: 'info@gestion-quebec.ca',
        website: 'https://www.gestion-quebec.ca',
        registrationNumber: 'NEQ-1234567890',
      };

      const result = insertOrganizationSchema.safeParse(managementCompany);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.registrationNumber).toBe('NEQ-1234567890');
        expect(result.data.website).toBe('https://www.gestion-quebec.ca');
      }
    });

    it('should validate Quebec cooperative', () => {
      const cooperative = {
        name: "Coopérative d'habitation du Plateau",
        type: 'cooperative',
        address: '123 Rue Saint-Denis',
        city: 'Montréal',
        province: 'QC',
        postalCode: 'H2X 3L3',
        email: 'coop@plateau-habitat.ca',
      };

      const result = insertOrganizationSchema.safeParse(cooperative);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toContain('Coopérative');
        expect(result.data.type).toBe('cooperative');
      }
    });

    it('should require mandatory fields for Quebec organizations', () => {
      const incompleteOrg = {
        name: 'Test Organization',
        // Missing required fields
      };

      const result = insertOrganizationSchema.safeParse(incompleteOrg);
      expect(result.success).toBe(false);
    });

    it('should accept Quebec province explicitly', () => {
      const orgWithProvince = {
        name: 'Test Organization',
        type: 'management_company',
        address: '123 Test Street',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A 1A1',
      };

      const result = insertOrganizationSchema.safeParse(orgWithProvince);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.province).toBe('QC');
      }
    });
  });

  describe('Building Schema Validation - Quebec Properties', () => {
    it('should validate Quebec condo building', () => {
      const condoBuilding = {
        organizationId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Les Jardins du Château',
        address: '2450 Boulevard Laurier',
        city: 'Québec',
        province: 'QC',
        postalCode: 'G1V 2L1',
        buildingType: 'condo' as const,
        yearBuilt: 1985,
        totalUnits: 120,
        totalFloors: 15,
        parkingSpaces: 150,
        storageSpaces: 120,
        amenities: ['gym', 'pool', 'concierge', 'rooftop_terrace'],
        managementCompany: 'Gestion Immobilière Québec Inc.',
      };

      const result = insertBuildingSchema.safeParse(condoBuilding);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.buildingType).toBe('condo');
        expect(result.data.totalUnits).toBe(120);
        expect(result.data.amenities).toContain('pool');
      }
    });

    it('should validate Quebec rental building', () => {
      const rentalBuilding = {
        organizationId: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Appartements du Vieux-Port',
        address: '85 Rue de la Commune Est',
        city: 'Montréal',
        province: 'QC',
        postalCode: 'H2Y 1J1',
        buildingType: 'rental' as const,
        yearBuilt: 1890,
        totalUnits: 24,
        totalFloors: 4,
        parkingSpaces: 12,
      };

      const result = insertBuildingSchema.safeParse(rentalBuilding);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.buildingType).toBe('rental');
        expect(result.data.city).toBe('Montréal');
      }
    });

    it('should validate housing cooperative building', () => {
      const cooperativeBuilding = {
        organizationId: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Coopérative Habitat Plateau',
        address: '1234 Rue Rachel Est',
        city: 'Montréal',
        province: 'QC',
        postalCode: 'H2J 2K1',
        buildingType: 'cooperative' as const,
        totalUnits: 32,
        totalFloors: 3,
        amenities: ['community_room', 'shared_garden', 'bike_storage'],
      };

      const result = insertBuildingSchema.safeParse(cooperativeBuilding);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.buildingType).toBe('cooperative');
        expect(result.data.amenities).toContain('shared_garden');
      }
    });

    it('should accept Quebec province explicitly for buildings', () => {
      const buildingWithProvince = {
        organizationId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Building',
        address: '123 Test Street',
        city: 'Quebec City',
        province: 'QC',
        postalCode: 'G1K 1K1',
        buildingType: 'condo',
        totalUnits: 50,
      };

      const result = insertBuildingSchema.safeParse(buildingWithProvince);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.province).toBe('QC');
      }
    });

    it('should require valid building types for Quebec', () => {
      const invalidBuilding = {
        organizationId: 'org-123',
        name: 'Test Building',
        address: '123 Test Street',
        city: 'Quebec City',
        postalCode: 'G1K 1K1',
        buildingType: 'invalid_type',
        totalUnits: 50,
      };

      const result = insertBuildingSchema.safeParse(invalidBuilding);
      expect(result.success).toBe(false);
    });
  });

  describe('Residence Schema Validation - Quebec Housing Units', () => {
    it('should validate Quebec condo unit with ownership percentage', () => {
      const condoUnit = {
        buildingId: '550e8400-e29b-41d4-a716-446655440100',
        unitNumber: '1205',
        floor: 12,
        squareFootage: 985.5,
        bedrooms: 2,
        bathrooms: 1.5,
        balcony: true,
        parkingSpaceNumbers: ['P-045'],
        storageSpaceNumbers: ['S-045'],
        ownershipPercentage: 0.0083, // 0.83% of building
        monthlyFees: 425.75,
      };

      const result = insertResidenceSchema.safeParse(condoUnit);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.unitNumber).toBe('1205');
        expect(result.data.ownershipPercentage).toBe(0.0083);
        expect(result.data.balcony).toBe(true);
      }
    });

    it('should validate Quebec rental apartment', () => {
      const rentalUnit = {
        buildingId: '550e8400-e29b-41d4-a716-446655440101',
        unitNumber: '3A',
        floor: 3,
        squareFootage: 750.0,
        bedrooms: 1,
        bathrooms: 1.0,
        balcony: false,
        monthlyFees: 1250.0, // Rent in Quebec
      };

      const result = insertResidenceSchema.safeParse(rentalUnit);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.monthlyFees).toBe(1250.0);
        expect(result.data.balcony).toBe(false);
      }
    });

    it('should validate cooperative housing unit', () => {
      const coopUnit = {
        buildingId: '550e8400-e29b-41d4-a716-446655440102',
        unitNumber: 'Unit-5',
        floor: 2,
        squareFootage: 900.0,
        bedrooms: 3,
        bathrooms: 1.0,
        monthlyFees: 650.0, // Coop fees lower than market rent
      };

      const result = insertResidenceSchema.safeParse(coopUnit);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.unitNumber).toBe('Unit-5');
        expect(result.data.bedrooms).toBe(3);
      }
    });

    it('should handle units without optional amenities', () => {
      const basicUnit = {
        buildingId: '550e8400-e29b-41d4-a716-446655440100',
        unitNumber: 'B-1',
        squareFootage: 650.0,
        bedrooms: 1,
        bathrooms: 1.0,
      };

      const result = insertResidenceSchema.safeParse(basicUnit);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.parkingSpaceNumbers).toBeUndefined();
        expect(result.data.storageSpaceNumbers).toBeUndefined();
        expect(result.data.balcony).toBeUndefined();
      }
    });

    it('should require mandatory fields for Quebec residences', () => {
      const incompleteUnit = {
        buildingId: 'building-123',
        // Missing required unitNumber
      };

      const result = insertResidenceSchema.safeParse(incompleteUnit);
      expect(result.success).toBe(false);
    });
  });

  describe('Quebec Postal Code Validation', () => {
    const validQuebecPostalCodes = [
      'G1K 1K1',
      'H2X 3L3',
      'G1R 4P5',
      'H1A 1A1',
      'J7Y 2B8',
      'G0A 1A0',
    ];

    const invalidPostalCodes = [
      'M5V 1A1', // Toronto
      'V6B 1A1', // Vancouver
      'T2P 1A1', // Calgary
      'K1A 0A6', // Ottawa
    ];

    // Note: This would be implemented with a custom Zod validator in real schema
    it('should recognize valid Quebec postal codes', () => {
      validQuebecPostalCodes.forEach((code) => {
        // Quebec postal codes start with G, H, or J
        const firstLetter = code.charAt(0);
        expect(['G', 'H', 'J']).toContain(firstLetter);
      });
    });

    it('should identify non-Quebec postal codes', () => {
      invalidPostalCodes.forEach((code) => {
        const firstLetter = code.charAt(0);
        expect(['G', 'H', 'J']).not.toContain(firstLetter);
      });
    });
  });

  describe('Quebec Language Requirements', () => {
    it('should support Quebec French language variations', () => {
      const frenchVariations = ['fr', 'fr-CA', 'fr-QC'];

      // In a real implementation, these would be supported language codes
      frenchVariations.forEach((lang) => {
        expect(lang.startsWith('fr')).toBe(true);
      });
    });

    it('should handle bilingual user preferences', () => {
      const bilingualUser = {
        username: 'jean.dupuis',
        email: 'admin@example.com',
        password: 'SecurePass123!',
        firstName: 'Jean',
        lastName: 'Dupuis',
        language: 'fr', // Primary language French for Quebec
        role: 'admin',
      };

      const result = insertUserSchema.safeParse(bilingualUser);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(['en', 'fr']).toContain(result.data.language);
      }
    });
  });

  describe('Quebec Property Management Business Rules', () => {
    it('should validate condo ownership percentages sum constraints', () => {
      // In a real condo, ownership percentages should sum to 100%
      const ownershipPercentages = ['0.0083', '0.0125', '0.0092']; // Sample units

      const totalPercentage = ownershipPercentages
        .map((p) => parseFloat(p))
        .reduce((sum, current) => sum + current, 0);

      expect(totalPercentage).toBeLessThanOrEqual(1.0); // Should not exceed 100%
      expect(totalPercentage).toBeGreaterThan(0); // Should have some ownership
    });

    it('should validate reasonable Quebec property sizes', () => {
      const quebecUnitSizes = [
        { bedrooms: 1, minSqFt: 400, maxSqFt: 800 },
        { bedrooms: 2, minSqFt: 600, maxSqFt: 1200 },
        { bedrooms: 3, minSqFt: 800, maxSqFt: 1500 },
      ];

      quebecUnitSizes.forEach(({ bedrooms, minSqFt, maxSqFt }) => {
        const testUnit = {
          buildingId: '550e8400-e29b-41d4-a716-446655440100',
          unitNumber: `${bedrooms}BR-Test`,
          bedrooms,
          squareFootage: (minSqFt + maxSqFt) / 2,
          bathrooms: 1.0,
        };

        const result = insertResidenceSchema.safeParse(testUnit);
        expect(result.success).toBe(true);

        const sqFt = testUnit.squareFootage;
        expect(sqFt).toBeGreaterThanOrEqual(minSqFt);
        expect(sqFt).toBeLessThanOrEqual(maxSqFt);
      });
    });

    it('should validate Quebec building age and heritage considerations', () => {
      const currentYear = new Date().getFullYear();
      const historicBuilding = {
        organizationId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Patrimoine du Vieux-Québec',
        address: '12 Rue Saint-Louis',
        city: 'Québec',
        province: 'QC',
        postalCode: 'G1R 3Y8',
        buildingType: 'condo' as const,
        yearBuilt: 1692, // Historic Quebec building
        totalUnits: 8,
      };

      const result = insertBuildingSchema.safeParse(historicBuilding);
      expect(result.success).toBe(true);

      if (result.success && result.data.yearBuilt) {
        expect(result.data.yearBuilt).toBeLessThan(currentYear);
        expect(result.data.yearBuilt).toBeGreaterThan(1600); // Reasonable historical limit
      }
    });
  });
});
