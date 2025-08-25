/**
 * @file Form validation tests.
 * @description Test suite for Zod schema validation and form handling.
 */

import { z } from 'zod';

describe('Schema Validation Tests', () => {
  describe('User Schema Validation', () => {
    // Simple user schema for testing
    const userSchema = z.object({
      email: z.string().email(),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      password: z.string().min(6),
    });

    it('should validate correct user data', () => {
      const validUser = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        password: 'securePassword123',
      };

      const result = userSchema.safeParse(validUser);
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
        password: 'password123',
      };

      const result = userSchema.safeParse(invalidUser);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues[0].path).toContain('email');
      }
    });

    it('should handle all required fields correctly', () => {
      const minimalUser = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        password: 'password123',
      };

      const result = userSchema.safeParse(minimalUser);
      expect(result.success).toBe(true);
    });
  });

  describe('Feature Schema Validation', () => {
    // Simple feature schema for testing
    const featureSchema = z.object({
      name: z.string().min(1),
      description: z.string().min(1),
      category: z.enum(['Website', 'Dashboard & Home', 'Property Management']),
      status: z.enum(['submitted', 'approved', 'in-progress', 'completed']).default('submitted'),
      priority: z.enum(['low', 'medium', 'high']).default('medium'),
    });

    it('should validate complete feature data', () => {
      const validFeature = {
        name: 'Quebec Property Dashboard',
        description: 'Multi-language property dashboard for Quebec compliance',
        category: 'Dashboard & Home' as const,
        status: 'submitted' as const,
        priority: 'high' as const,
      };

      const result = featureSchema.safeParse(validFeature);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.name).toBe(validFeature.name);
      }
    });

    it('should require mandatory fields', () => {
      const incompleteFeature = {
        name: 'Test Feature',
        // Missing description and category
      };

      const result = featureSchema.safeParse(incompleteFeature);
      expect(result.success).toBe(false);

      if (!result.success) {
        const errorPaths = result.error.issues.map((e) => e.path[0]);
        expect(errorPaths).toContain('description');
        expect(errorPaths).toContain('category');
      }
    });

    it('should validate enum values', () => {
      const featureWithInvalidStatus = {
        name: 'Test Feature',
        description: 'Test description',
        category: 'Website' as const,
        status: 'invalid-status' as unknown,
        priority: 'high' as const,
      };

      const result = featureSchema.safeParse(featureWithInvalidStatus);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues[0].path).toContain('status');
      }
    });

    it('should handle defaults correctly', () => {
      const minimalFeature = {
        name: 'Basic Feature',
        description: 'Test description',
        category: 'Website' as const,
      };

      const result = featureSchema.safeParse(minimalFeature);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.status).toBe('submitted');
        expect(result.data.priority).toBe('medium');
      }
    });
  });

  describe('Actionable Item Schema Validation', () => {
    // Simple actionable item schema for testing
    const actionableItemSchema = z.object({
      title: z.string().min(1),
      description: z.string().min(1),
      featureId: z.string().min(1),
      status: z.enum(['pending', 'in-progress', 'completed', 'blocked']).default('pending'),
      priority: z.enum(['low', 'medium', 'high']).default('medium'),
      order: z.number().int().min(0).default(0),
    });

    it('should validate complete actionable item', () => {
      const validItem = {
        title: '1. Create SSL Certificate Database Table',
        description: 'Create database table for SSL certificates',
        featureId: 'feature-123',
        status: 'pending' as const,
        priority: 'high' as const,
        order: 0,
      };

      const result = actionableItemSchema.safeParse(validItem);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.title).toBe(validItem.title);
        expect(result.data.order).toBe(0);
      }
    });

    it('should handle defaults correctly', () => {
      const itemWithDefaults = {
        title: '2. Implement SSL Service',
        description: 'Create SSL acquisition service',
        featureId: 'feature-123',
      };

      const result = actionableItemSchema.safeParse(itemWithDefaults);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.status).toBe('pending');
        expect(result.data.priority).toBe('medium');
        expect(result.data.order).toBe(0);
      }
    });

    it('should require essential fields', () => {
      const incompleteItem = {
        title: 'Incomplete Item',
        // Missing required fields
      };

      const result = actionableItemSchema.safeParse(incompleteItem);
      expect(result.success).toBe(false);

      if (!result.success) {
        const errorPaths = result.error.issues.map((e) => e.path[0]);
        expect(errorPaths).toContain('description');
        expect(errorPaths).toContain('featureId');
      }
    });
  });

  describe('Quebec-Specific Validation', () => {
    it('should validate Quebec postal codes', () => {
      const quebecPostalCodes = ['H1A 1A1', 'G1A 1A1', 'J1A 1A1'];
      const postalCodeSchema = z.string().regex(/^[GHBJ]\d[A-Z] \d[A-Z]\d$/);

      quebecPostalCodes.forEach((code) => {
        const result = postalCodeSchema.safeParse(code);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid Quebec postal codes', () => {
      const invalidCodes = ['12345', 'A1A 1A1', 'H1A1A1'];
      const postalCodeSchema = z.string().regex(/^[GHBJ]\d[A-Z] \d[A-Z]\d$/);

      invalidCodes.forEach((code) => {
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
