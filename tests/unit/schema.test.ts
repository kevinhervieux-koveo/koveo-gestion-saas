import {
  insertUserSchema,
  insertOrganizationSchema,
  insertBuildingSchema,
  insertFeatureSchema,
} from '../../shared/schema';

describe('Schema Validation Tests', () => {
  describe('insertUserSchema', () => {
    const validUserData = {
      username: 'marie.tremblay',
      email: 'test@example.com',
      password: 'password123',
      firstName: 'Marie',
      lastName: 'Tremblay',
      phone: '+1-514-555-0123',
      language: 'fr',
      role: 'tenant' as const,
    };

    it('should validate correct user data', () => {
      const result = insertUserSchema.safeParse(validUserData);
      expect(result.success).toBe(true);
    });

    it('should accept any valid string for email', () => {
      const validData = { ...validUserData, email: 'test@domain.com' };
      const result = insertUserSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept any password', () => {
      const validData = { ...validUserData, password: '123' };
      const result = insertUserSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept long first name', () => {
      const validData = { ...validUserData, firstName: 'a'.repeat(101) };
      const result = insertUserSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept long last name', () => {
      const validData = { ...validUserData, lastName: 'b'.repeat(101) };
      const result = insertUserSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept empty first name if not required', () => {
      const validData = { ...validUserData, firstName: '' };
      const result = insertUserSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept valid names at length limit', () => {
      const validData = {
        ...validUserData,
        username: 'longusername',
        firstName: 'a'.repeat(100),
        lastName: 'b'.repeat(100),
      };
      const result = insertUserSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('insertOrganizationSchema', () => {
    const validOrgData = {
      name: 'Test Organization',
      address: '123 Test Street',
      city: 'Montreal',
      postalCode: 'H3A 1A1',
      type: 'management_company',
      province: 'QC',
    };

    it('should validate correct organization data', () => {
      const result = insertOrganizationSchema.safeParse(validOrgData);
      expect(result.success).toBe(true);
    });

    it('should accept optional email and phone', () => {
      const dataWithOptionals = {
        ...validOrgData,
        email: 'test@org.ca',
        phone: '+1-514-555-0100',
      };
      const result = insertOrganizationSchema.safeParse(dataWithOptionals);
      expect(result.success).toBe(true);
    });
  });

  describe('insertBuildingSchema', () => {
    const validBuildingData = {
      organizationId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', // Valid UUID
      name: 'Test Building',
      address: '456 Test Avenue',
      city: 'Quebec City',
      postalCode: 'G1K 1K1',
      buildingType: 'condo' as const,
      totalUnits: 25,
    };

    it('should validate correct building data', () => {
      const result = insertBuildingSchema.safeParse(validBuildingData);
      expect(result.success).toBe(true);
    });

    it('should accept optional fields', () => {
      const dataWithOptionals = {
        ...validBuildingData,
        province: 'QC',
        buildingType: 'condo',
        yearBuilt: 2010,
        totalUnits: 50,
      };
      const result = insertBuildingSchema.safeParse(dataWithOptionals);
      expect(result.success).toBe(true);
    });
  });

  describe('insertFeatureSchema', () => {
    const validFeatureData = {
      name: 'Test Feature',
      description: 'A test feature for validation',
      category: 'Dashboard & Home' as const,
      status: 'planned' as const,
      priority: 'medium' as const,
      businessObjective: 'Test objective',
      targetUsers: 'Test users',
    };

    it('should validate correct feature data', () => {
      const result = insertFeatureSchema.safeParse(validFeatureData);
      expect(result.success).toBe(true);
    });

    it('should accept valid status values', () => {
      const statuses = ['completed', 'in-progress', 'planned', 'cancelled', 'submitted'] as const;

      statuses.forEach((status) => {
        const data = { ...validFeatureData, status };
        const result = insertFeatureSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    it('should accept valid priority values', () => {
      const priorities = ['low', 'medium', 'high', 'critical'] as const;

      priorities.forEach((priority) => {
        const data = { ...validFeatureData, priority };
        const result = insertFeatureSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });
  });
});
