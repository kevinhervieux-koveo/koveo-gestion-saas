/**
 * @file Form validation tests
 * @description Test suite for Zod schema validation and form handling
 */

import { z } from 'zod';
import { 
  insertUserSchema, 
  insertFeatureSchema, 
  insertActionableItemSchema 
} from '@shared/schema';

describe('Schema Validation Tests', () => {
  describe('User Schema Validation', () => {
    it('should validate correct user data', () => {
      const validUser = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        profileImageUrl: 'https://example.com/avatar.jpg',
      };

      const result = insertUserSchema.safeParse(validUser);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.email).toBe(validUser.email);
        expect(result.data.firstName).toBe(validUser.firstName);
      }
    });

    it('should reject invalid email format', () => {
      const invalidUser = {
        email: 'invalid-email',
        firstName: 'John',
        lastName: 'Doe',
      };

      const result = insertUserSchema.safeParse(invalidUser);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('email');
      }
    });

    it('should handle optional fields correctly', () => {
      const minimalUser = {
        email: 'test@example.com',
      };

      const result = insertUserSchema.safeParse(minimalUser);
      expect(result.success).toBe(true);
    });
  });

  describe('Feature Schema Validation', () => {
    it('should validate complete feature data', () => {
      const validFeature = {
        name: 'SSL Management',
        description: 'Automatic SSL certificate renewal and management',
        category: 'Website',
        status: 'planned',
        priority: 'high',
        businessObjective: 'Ensure secure connections',
        targetUsers: 'Property managers',
        successMetrics: 'Auto renewal, 100% uptime',
        technicalComplexity: 'Medium complexity',
        dependencies: 'Certificate authorities',
        userFlow: 'Automatic background process',
        isPublicRoadmap: true,
        isStrategicPath: false,
      };

      const result = insertFeatureSchema.safeParse(validFeature);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.name).toBe(validFeature.name);
        expect(result.data.isStrategicPath).toBe(false);
      }
    });

    it('should require mandatory fields', () => {
      const incompleteFeature = {
        name: 'Test Feature',
        // Missing description and category
      };

      const result = insertFeatureSchema.safeParse(incompleteFeature);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        const errorPaths = result.error.errors.map(e => e.path[0]);
        expect(errorPaths).toContain('description');
        expect(errorPaths).toContain('category');
      }
    });

    it('should validate enum values', () => {
      const featureWithInvalidStatus = {
        name: 'Test Feature',
        description: 'Test description',
        category: 'Website',
        status: 'invalid-status',
        priority: 'high',
      };

      const result = insertFeatureSchema.safeParse(featureWithInvalidStatus);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('status');
      }
    });

    it('should handle strategic path boolean correctly', () => {
      const strategicFeature = {
        name: 'Strategic Feature',
        description: 'High priority feature',
        category: 'Website',
        isStrategicPath: true,
      };

      const result = insertFeatureSchema.safeParse(strategicFeature);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.isStrategicPath).toBe(true);
      }
    });
  });

  describe('Actionable Item Schema Validation', () => {
    it('should validate complete actionable item', () => {
      const validItem = {
        featureId: 'feature-123',
        title: '1. Create SSL Certificate Database Table',
        description: 'Create database table for SSL certificates',
        technicalDetails: 'Use Drizzle ORM with PostgreSQL',
        implementationPrompt: 'Add ssl_certificates table to schema',
        testingRequirements: 'Write migration tests',
        estimatedEffort: '1 day',
        status: 'pending',
        orderIndex: 0,
      };

      const result = insertActionableItemSchema.safeParse(validItem);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.title).toBe(validItem.title);
        expect(result.data.orderIndex).toBe(0);
      }
    });

    it('should handle dependencies array', () => {
      const itemWithDependencies = {
        featureId: 'feature-123',
        title: '2. Implement SSL Service',
        description: 'Create SSL acquisition service',
        technicalDetails: 'Use ACME protocol',
        implementationPrompt: 'Create SSL service class',
        testingRequirements: 'Integration tests',
        estimatedEffort: '2 days',
        dependencies: ['1. Create SSL Certificate Database Table'],
        status: 'pending',
        orderIndex: 1,
      };

      const result = insertActionableItemSchema.safeParse(itemWithDependencies);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.dependencies).toHaveLength(1);
        expect(result.data.dependencies?.[0]).toBe('1. Create SSL Certificate Database Table');
      }
    });

    it('should require essential fields', () => {
      const incompleteItem = {
        featureId: 'feature-123',
        title: 'Incomplete Item',
        // Missing required fields
      };

      const result = insertActionableItemSchema.safeParse(incompleteItem);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        const errorPaths = result.error.errors.map(e => e.path[0]);
        expect(errorPaths).toContain('description');
        expect(errorPaths).toContain('implementationPrompt');
      }
    });
  });

  describe('Quebec-Specific Validation', () => {
    it('should validate Quebec postal codes', () => {
      const quebecPostalCodes = ['H1A 1A1', 'G1A 1A1', 'J1A 1A1'];
      const postalCodeSchema = z.string().regex(/^[GHBJ]\d[A-Z] \d[A-Z]\d$/);

      quebecPostalCodes.forEach(code => {
        const result = postalCodeSchema.safeParse(code);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid Quebec postal codes', () => {
      const invalidCodes = ['12345', 'A1A 1A1', 'H1A1A1'];
      const postalCodeSchema = z.string().regex(/^[GHBJ]\d[A-Z] \d[A-Z]\d$/);

      invalidCodes.forEach(code => {
        const result = postalCodeSchema.safeParse(code);
        expect(result.success).toBe(false);
      });
    });

    it('should validate French and English text fields', () => {
      const bilingualTextSchema = z.object({
        en: z.string().min(1),
        fr: z.string().min(1),
      });

      const validText = {
        en: 'Property Management',
        fr: 'Gestion Immobilière',
      };

      const result = bilingualTextSchema.safeParse(validText);
      expect(result.success).toBe(true);
    });
  });
});