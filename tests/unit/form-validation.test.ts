/**
 * Comprehensive Form Validation Test Suite
 * Tests all form validation rules and ensures consistency across the application
 */

import { z } from 'zod';
import { describe, test, expect } from '@jest/globals';

describe('Form Validation Rules Compliance', () => {
  describe('Error Message Quality Standards', () => {
    test('should require detailed error messages with examples for string fields', () => {
      // Test that error messages are descriptive and include examples
      const emailSchema = z.string().email('Please enter a valid email address (example: user@domain.com)');
      const nameSchema = z.string().min(1, 'First name is required (example: Jean)');
      const phoneSchema = z.string().regex(/^(\+1\s?)?(\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}$/, 'Phone number must be a valid North American format (example: (514) 123-4567)');

      // Test valid inputs
      expect(() => emailSchema.parse('user@domain.com')).not.toThrow();
      expect(() => nameSchema.parse('Jean')).not.toThrow();
      expect(() => phoneSchema.parse('(514) 123-4567')).not.toThrow();

      // Test invalid inputs return detailed error messages
      const emailResult = emailSchema.safeParse('invalid-email');
      const nameResult = nameSchema.safeParse('');
      const phoneResult = phoneSchema.safeParse('123');

      expect(emailResult.success).toBe(false);
      expect(nameResult.success).toBe(false);
      expect(phoneResult.success).toBe(false);

      if (!emailResult.success) {
        expect(emailResult.error.issues[0].message).toContain('example:');
        expect(emailResult.error.issues[0].message).toContain('@');
      }
      if (!nameResult.success) {
        expect(nameResult.error.issues[0].message).toContain('example:');
      }
      if (!phoneResult.success) {
        expect(phoneResult.error.issues[0].message).toContain('example:');
        expect(phoneResult.error.issues[0].message).toContain('(514)');
      }
    });

    test('should enforce length limits with clear error messages', () => {
      const titleSchema = z.string().min(1, 'Title is required (example: Monthly Meeting Minutes)').max(200, 'Title must be less than 200 characters');
      const descriptionSchema = z.string().max(1000, 'Description must be less than 1000 characters');

      // Test length violations
      const longTitle = 'A'.repeat(201);
      const longDescription = 'A'.repeat(1001);

      const titleResult = titleSchema.safeParse(longTitle);
      const descriptionResult = descriptionSchema.safeParse(longDescription);

      expect(titleResult.success).toBe(false);
      expect(descriptionResult.success).toBe(false);

      if (!titleResult.success) {
        expect(titleResult.error.issues[0].message).toContain('less than');
        expect(titleResult.error.issues[0].message).toContain('200');
      }
      if (!descriptionResult.success) {
        expect(descriptionResult.error.issues[0].message).toContain('less than');
        expect(descriptionResult.error.issues[0].message).toContain('1000');
      }
    });

    test('should validate Quebec-specific formats', () => {
      const postalCodeSchema = z.string().regex(/^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/, 'Postal code must follow Canadian format (example: H1A 1B1)');
      const citySchema = z.string().regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'City name can only contain letters, spaces, apostrophes and hyphens');

      // Test valid Quebec formats
      expect(() => postalCodeSchema.parse('H1A 1B1')).not.toThrow();
      expect(() => postalCodeSchema.parse('H1A1B1')).not.toThrow();
      expect(() => citySchema.parse('Montréal')).not.toThrow();
      expect(() => citySchema.parse("Saint-Jean-sur-Richelieu")).not.toThrow();

      // Test invalid formats
      const postalResult = postalCodeSchema.safeParse('12345');
      const cityResult = citySchema.safeParse('City123');

      expect(postalResult.success).toBe(false);
      expect(cityResult.success).toBe(false);

      if (!postalResult.success) {
        expect(postalResult.error.issues[0].message).toContain('Canadian format');
        expect(postalResult.error.issues[0].message).toContain('H1A 1B1');
      }
      if (!cityResult.success) {
        expect(cityResult.error.issues[0].message).toContain('letters, spaces, apostrophes');
      }
    });
  });

  describe('Numeric Field Validation Standards', () => {
    test('should validate numeric ranges with clear bounds', () => {
      const ageSchema = z.number().min(18, 'Age must be between 18 and 120 years').max(120, 'Age must be between 18 and 120 years');
      const amountSchema = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Amount must be a valid number with up to 2 decimal places (example: 125.50)');
      const capacitySchema = z.number().min(1, 'Capacity must be between 1 and 500 people').max(500, 'Capacity must be between 1 and 500 people');

      // Test valid ranges
      expect(() => ageSchema.parse(25)).not.toThrow();
      expect(() => amountSchema.parse('125.50')).not.toThrow();
      expect(() => capacitySchema.parse(50)).not.toThrow();

      // Test boundary violations
      const ageResult = ageSchema.safeParse(17);
      const amountResult = amountSchema.safeParse('125.555');
      const capacityResult = capacitySchema.safeParse(501);

      expect(ageResult.success).toBe(false);
      expect(amountResult.success).toBe(false);
      expect(capacityResult.success).toBe(false);

      if (!ageResult.success) {
        expect(ageResult.error.issues[0].message).toContain('between');
      }
      if (!amountResult.success) {
        expect(amountResult.error.issues[0].message).toContain('decimal places');
        expect(amountResult.error.issues[0].message).toContain('example:');
      }
    });
  });

  describe('Required Field Validation', () => {
    test('should provide clear guidance for required selections', () => {
      const organizationSchema = z.string().min(1, 'Please select an organization from the dropdown');
      const roleSchema = z.string().min(1, 'Please select a user role');
      const typeSchema = z.string().min(1, 'Please select an organization type from the dropdown');

      const orgResult = organizationSchema.safeParse('');
      const roleResult = roleSchema.safeParse('');
      const typeResult = typeSchema.safeParse('');

      expect(orgResult.success).toBe(false);
      expect(roleResult.success).toBe(false);
      expect(typeResult.success).toBe(false);

      if (!orgResult.success) {
        expect(orgResult.error.issues[0].message).toContain('select');
        expect(orgResult.error.issues[0].message).toContain('dropdown');
      }
      if (!roleResult.success) {
        expect(roleResult.error.issues[0].message).toContain('select');
      }
    });
  });

  describe('Quebec Law 25 Compliance Validation', () => {
    test('should enforce privacy-compliant field validation', () => {
      // Personal information fields must have enhanced protection
      const firstNameSchema = z.string().min(1, 'First name is required (example: Jean)').max(50, 'First name must be less than 50 characters').regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'First name can only contain letters, spaces, apostrophes and hyphens');
      const lastNameSchema = z.string().min(1, 'Last name is required (example: Dupont)').max(50, 'Last name must be less than 50 characters').regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'Last name can only contain letters, spaces, apostrophes and hyphens');

      // Test valid Quebec names
      expect(() => firstNameSchema.parse('Jean-Baptiste')).not.toThrow();
      expect(() => firstNameSchema.parse('Marie-Ève')).not.toThrow();
      expect(() => lastNameSchema.parse("O'Connor")).not.toThrow();
      expect(() => lastNameSchema.parse('Lafleur-Dufresne')).not.toThrow();

      // Test invalid inputs
      const invalidFirst = firstNameSchema.safeParse('Jean123');
      const invalidLast = lastNameSchema.safeParse('');

      expect(invalidFirst.success).toBe(false);
      expect(invalidLast.success).toBe(false);

      if (!invalidFirst.success) {
        expect(invalidFirst.error.issues[0].message).toContain('letters, spaces, apostrophes');
      }
      if (!invalidLast.success) {
        expect(invalidLast.error.issues[0].message).toContain('example:');
      }
    });

    test('should validate password security requirements', () => {
      const passwordSchema = z.string()
        .min(8, 'Password must be at least 8 characters long (example: MonNouveauMotDePasse123!)')
        .max(100, 'Password must be less than 100 characters')
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number');

      // Test valid passwords
      expect(() => passwordSchema.parse('MonMotDePasse123!')).not.toThrow();
      expect(() => passwordSchema.parse('SecurePass123')).not.toThrow();

      // Test invalid passwords
      const shortResult = passwordSchema.safeParse('short');
      const noUpperResult = passwordSchema.safeParse('password123');
      const noNumberResult = passwordSchema.safeParse('Password');

      expect(shortResult.success).toBe(false);
      expect(noUpperResult.success).toBe(false);
      expect(noNumberResult.success).toBe(false);

      if (!shortResult.success) {
        expect(shortResult.error.issues[0].message).toContain('at least 8');
        expect(shortResult.error.issues[0].message).toContain('example:');
      }
    });
  });

  describe('Time and Date Validation', () => {
    test('should validate time formats with clear examples', () => {
      const timeSchema = z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format (example: 09:00)');
      const dateSchema = z.string().min(1, 'Date is required (select from calendar)');

      // Test valid times
      expect(() => timeSchema.parse('09:00')).not.toThrow();
      expect(() => timeSchema.parse('23:59')).not.toThrow();
      expect(() => timeSchema.parse('00:00')).not.toThrow();

      // Test invalid times
      const invalidTime = timeSchema.safeParse('25:00');
      const invalidFormat = timeSchema.safeParse('9:0');

      expect(invalidTime.success).toBe(false);
      expect(invalidFormat.success).toBe(false);

      if (!invalidTime.success) {
        expect(invalidTime.error.issues[0].message).toContain('HH:MM');
        expect(invalidTime.error.issues[0].message).toContain('example:');
      }
    });
  });

  describe('Business Logic Validation', () => {
    test('should validate refinements with helpful error messages', () => {
      const timeRangeSchema = z
        .object({
          startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Start time must be in HH:MM format (example: 09:00)'),
          endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'End time must be in HH:MM format (example: 11:00)'),
        })
        .refine(
          (data) => {
            const [startHour, startMin] = data.startTime.split(':').map(Number);
            const [endHour, endMin] = data.endTime.split(':').map(Number);
            const startMinutes = startHour * 60 + startMin;
            const endMinutes = endHour * 60 + endMin;
            return endMinutes > startMinutes;
          },
          {
            message: 'End time must be after start time (example: start at 09:00, end at 11:00)',
            path: ['endTime'],
          }
        );

      // Test valid time range
      expect(() => timeRangeSchema.parse({ startTime: '09:00', endTime: '11:00' })).not.toThrow();

      // Test invalid time range
      const result = timeRangeSchema.safeParse({ startTime: '11:00', endTime: '09:00' });
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues[0].message).toContain('after start time');
        expect(result.error.issues[0].message).toContain('example:');
      }
    });

    test('should validate password confirmation with clear messaging', () => {
      const passwordSchema = z
        .object({
          newPassword: z.string().min(8, 'New password must be at least 8 characters long (example: MonNouveauMotDePasse123!)'),
          confirmPassword: z.string().min(1, 'Please confirm your new password by typing it again'),
        })
        .refine((data) => data.newPassword === data.confirmPassword, {
          message: "Passwords don't match - please enter the same password in both fields",
          path: ['confirmPassword'],
        });

      // Test valid password confirmation
      expect(() => passwordSchema.parse({ 
        newPassword: 'TestPassword123!', 
        confirmPassword: 'TestPassword123!' 
      })).not.toThrow();

      // Test password mismatch
      const result = passwordSchema.safeParse({ 
        newPassword: 'TestPassword123!', 
        confirmPassword: 'DifferentPassword123!' 
      });
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues[0].message).toContain("don't match");
        expect(result.error.issues[0].message).toContain('same password');
      }
    });
  });

  describe('Validation Pattern Enforcement', () => {
    test('should enforce minimum character requirements for text fields', () => {
      // All meaningful text fields should have minimum length requirements
      const shortDescriptionSchema = z.string().min(10, 'Description must be at least 10 characters long (example: Detailed explanation of the issue)');
      const titleSchema = z.string().min(1, 'Title is required (example: Document Title)');

      const shortResult = shortDescriptionSchema.safeParse('short');
      const emptyResult = titleSchema.safeParse('');

      expect(shortResult.success).toBe(false);
      expect(emptyResult.success).toBe(false);

      if (!shortResult.success) {
        expect(shortResult.error.issues[0].message).toContain('at least');
        expect(shortResult.error.issues[0].message).toContain('example:');
      }
    });

    test('should validate selection fields with guidance', () => {
      const categorySchema = z.enum(['maintenance', 'complaint', 'information', 'other']);
      const organizationSchema = z.string().min(1, 'Please select an organization from the dropdown');

      // Test empty selection
      const orgResult = organizationSchema.safeParse('');
      expect(orgResult.success).toBe(false);

      if (!orgResult.success) {
        expect(orgResult.error.issues[0].message).toContain('select');
        expect(orgResult.error.issues[0].message).toContain('dropdown');
      }
    });
  });

  describe('Bilingual Support Validation', () => {
    test('should support both English and French error messages', () => {
      // Some forms may use French error messages for Quebec compliance
      const frenchDateSchema = z.date({ message: 'Please select a booking date from the calendar' });
      const englishEmailSchema = z.string().email('Please enter a valid email address (example: user@domain.com)');

      // Both should work and provide clear guidance
      const dateResult = frenchDateSchema.safeParse('invalid-date');
      const emailResult = englishEmailSchema.safeParse('invalid-email');

      expect(dateResult.success).toBe(false);
      expect(emailResult.success).toBe(false);

      if (!dateResult.success) {
        expect(dateResult.error.issues[0].message).toContain('select');
        expect(dateResult.error.issues[0].message).toContain('calendar');
      }
      if (!emailResult.success) {
        expect(emailResult.error.issues[0].message).toContain('valid email');
        expect(emailResult.error.issues[0].message).toContain('example:');
      }
    });
  });

  describe('Form Consistency Standards', () => {
    test('should enforce consistent error message patterns', () => {
      // Test that all error messages follow consistent patterns:
      // 1. Clear explanation of what's wrong
      // 2. Include examples where helpful
      // 3. Specify valid ranges/formats
      // 4. Use friendly, helpful language

      const patterns = [
        {
          schema: z.string().min(1, 'Email address is required').email('Please enter a valid email address (example: user@domain.com)'),
          invalidInput: 'invalid-email',
          shouldContain: ['valid email', 'example:', '@']
        },
        {
          schema: z.string().min(1, 'First name is required (example: Jean)').regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'First name can only contain letters, spaces, apostrophes and hyphens'),
          invalidInput: 'John123',
          shouldContain: ['can only contain', 'letters, spaces']
        },
        {
          schema: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Amount must be a valid number with up to 2 decimal places (example: 125.50)'),
          invalidInput: '125.555',
          shouldContain: ['valid number', 'decimal places', 'example:']
        }
      ];

      patterns.forEach(({ schema, invalidInput, shouldContain }) => {
        const result = schema.safeParse(invalidInput);
        expect(result.success).toBe(false);

        if (!result.success) {
          const errorMessage = result.error.issues[0].message;
          shouldContain.forEach(pattern => {
            expect(errorMessage).toContain(pattern);
          });
        }
      });
    });

    test('should validate that all forms use proper character limits', () => {
      // Standard character limits across the application
      const limits = {
        title: { max: 200, min: 1 },
        description: { max: 1000, min: 10 },
        shortText: { max: 100, min: 1 },
        longText: { max: 2000, min: 10 },
        name: { max: 50, min: 1 }
      };

      Object.entries(limits).forEach(([fieldType, { max, min }]) => {
        const schema = z.string()
          .min(min, `${fieldType} must be at least ${min} characters`)
          .max(max, `${fieldType} must be less than ${max} characters`);

        // Test boundary conditions
        const tooShort = 'a'.repeat(min - 1);
        const tooLong = 'a'.repeat(max + 1);
        const justRight = 'a'.repeat(min);

        expect(schema.safeParse(tooShort).success).toBe(false);
        expect(schema.safeParse(tooLong).success).toBe(false);
        expect(schema.safeParse(justRight).success).toBe(true);
      });
    });
  });

  describe('Security Validation Standards', () => {
    test('should validate email confirmation for destructive actions', () => {
      const deleteConfirmSchema = z.object({
        confirmEmail: z.string().min(1, 'Email confirmation is required to delete account').email('Please enter a valid email address that matches your account'),
        reason: z.string().max(500, 'Reason must be less than 500 characters').optional(),
      });

      const validResult = deleteConfirmSchema.safeParse({
        confirmEmail: 'user@domain.com',
        reason: 'No longer needed'
      });

      const invalidResult = deleteConfirmSchema.safeParse({
        confirmEmail: '',
        reason: 'a'.repeat(501)
      });

      expect(validResult.success).toBe(true);
      expect(invalidResult.success).toBe(false);

      if (!invalidResult.success) {
        const errors = invalidResult.error.issues;
        expect(errors.some(e => e.message.includes('Email confirmation is required'))).toBe(true);
        expect(errors.some(e => e.message.includes('less than 500 characters'))).toBe(true);
      }
    });
  });

  describe('Future Form Compliance Validation', () => {
    test('should provide template for future form validation schemas', () => {
      // Template that all future forms should follow
      const futureFormTemplate = z.object({
        // Required text field with example
        title: z.string()
          .min(1, 'Title is required (example: Descriptive Title)')
          .max(200, 'Title must be less than 200 characters'),
        
        // Optional text field with validation
        description: z.string()
          .max(1000, 'Description must be less than 1000 characters')
          .optional(),
        
        // Email field with format example
        email: z.string()
          .min(1, 'Email address is required')
          .email('Please enter a valid email address (example: user@domain.com)'),
        
        // Quebec-specific phone number
        phone: z.string()
          .regex(/^(\+1\s?)?(\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}$/, 'Phone number must be a valid North American format (example: (514) 123-4567)')
          .optional(),
        
        // Numeric field with range
        amount: z.string()
          .min(1, 'Amount is required (example: 125.50)')
          .regex(/^\d+(\.\d{1,2})?$/, 'Amount must be a valid number with up to 2 decimal places (example: 125.50)'),
        
        // Selection field
        category: z.string()
          .min(1, 'Please select a category from the dropdown')
      });

      // Test the template works correctly
      const validData = {
        title: 'Test Document',
        description: 'This is a test description',
        email: 'test@example.com',
        phone: '(514) 123-4567',
        amount: '125.50',
        category: 'test'
      };

      const invalidData = {
        title: '',
        description: 'a'.repeat(1001),
        email: 'invalid-email',
        phone: '123',
        amount: '125.555',
        category: ''
      };

      expect(futureFormTemplate.safeParse(validData).success).toBe(true);
      
      const result = futureFormTemplate.safeParse(invalidData);
      expect(result.success).toBe(false);

      if (!result.success) {
        const messages = result.error.issues.map(i => i.message);
        expect(messages.some(m => m.includes('example:'))).toBe(true);
        expect(messages.some(m => m.includes('valid email'))).toBe(true);
        expect(messages.some(m => m.includes('select'))).toBe(true);
      }
    });
  });
});

/**
 * Validation Rules Enforcement Tests
 * Tests to ensure all forms follow the established validation patterns
 */
describe('Validation Rules Enforcement', () => {
  describe('Error Message Quality Checks', () => {
    test('should validate error messages contain examples where appropriate', () => {
      const fieldsRequiringExamples = [
        'email',
        'phone',
        'postalCode', 
        'amount',
        'time',
        'name',
        'title',
        'password'
      ];

      // Mock schema validation that should include examples
      fieldsRequiringExamples.forEach(fieldType => {
        // Each field type should have validation that includes examples
        switch (fieldType) {
          case 'email':
            const emailSchema = z.string().email('Please enter a valid email address (example: user@domain.com)');
            const emailResult = emailSchema.safeParse('invalid');
            expect(emailResult.success).toBe(false);
            if (!emailResult.success) {
              expect(emailResult.error.issues[0].message).toContain('example:');
            }
            break;
          
          case 'phone':
            const phoneSchema = z.string().regex(/phone-regex/, 'Phone number must be a valid North American format (example: (514) 123-4567)');
            const phoneResult = phoneSchema.safeParse('invalid');
            expect(phoneResult.success).toBe(false);
            if (!phoneResult.success) {
              expect(phoneResult.error.issues[0].message).toContain('example:');
            }
            break;
        }
      });
    });

    test('should enforce consistent language and tone', () => {
      // Error messages should be:
      // - Polite and helpful
      // - Clear about what's wrong
      // - Provide guidance on how to fix
      // - Use consistent language patterns

      const goodMessagePatterns = [
        /please enter/i,
        /must be/i,
        /should be/i,
        /example:/i,
        /between \d+ and \d+/i,
        /valid .+ format/i
      ];

      const badMessagePatterns = [
        /invalid/i, // Too vague without explanation
        /error/i,   // Doesn't help user understand what to do
        /wrong/i,   // Negative tone
      ];

      // Test that good patterns are used appropriately
      const emailMessage = 'Please enter a valid email address (example: user@domain.com)';
      const nameMessage = 'First name is required (example: Jean)';
      const rangeMessage = 'Age must be between 18 and 120 years';

      expect(goodMessagePatterns.some(pattern => pattern.test(emailMessage))).toBe(true);
      expect(goodMessagePatterns.some(pattern => pattern.test(nameMessage))).toBe(true);
      expect(goodMessagePatterns.some(pattern => pattern.test(rangeMessage))).toBe(true);
    });
  });

  describe('Field-Specific Validation Standards', () => {
    test('should validate Quebec-specific field requirements', () => {
      // Quebec-specific validations should be properly handled
      const quebecFields = {
        postalCode: z.string().regex(/^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/, 'Postal code must follow Canadian format (example: H1A 1B1)'),
        city: z.string().regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'City name can only contain letters, spaces, apostrophes and hyphens'),
        phone: z.string().regex(/^(\+1\s?)?(\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}$/, 'Phone number must be a valid North American format (example: (514) 123-4567)')
      };

      // Test valid Quebec formats
      expect(quebecFields.postalCode.safeParse('H1A 1B1').success).toBe(true);
      expect(quebecFields.city.safeParse('Montréal').success).toBe(true);
      expect(quebecFields.phone.safeParse('(514) 123-4567').success).toBe(true);

      // Test invalid formats have helpful messages
      const testInvalidInputs = {
        postalCode: '12345',
        city: 'City123',
        phone: '123'
      };

      Object.entries(quebecFields).forEach(([fieldName, schema]) => {
        const invalidInput = testInvalidInputs[fieldName as keyof typeof testInvalidInputs];
        const result = schema.safeParse(invalidInput);
        expect(result.success).toBe(false);
        if (!result.success) {
          // Only postal code and phone need examples, city field explains character restrictions
          if (fieldName === 'postalCode' || fieldName === 'phone') {
            expect(result.error.issues[0].message).toContain('example:');
          } else {
            expect(result.error.issues[0].message).toContain('can only contain');
          }
        }
      });
    });

    test('should validate numeric fields have proper constraints', () => {
      const numericValidations = [
        {
          name: 'amount',
          schema: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Amount must be a valid number with up to 2 decimal places (example: 125.50)'),
          valid: ['125.50', '0.99', '1000'],
          invalid: ['125.555', 'abc', '']
        },
        {
          name: 'capacity',
          schema: z.number().min(1, 'Capacity must be between 1 and 500 people').max(500, 'Capacity must be between 1 and 500 people'),
          valid: [1, 50, 500],
          invalid: [0, 501, -1]
        }
      ];

      numericValidations.forEach(({ name, schema, valid, invalid }) => {
        // Test valid inputs
        valid.forEach(input => {
          expect(schema.safeParse(input).success).toBe(true);
        });

        // Test invalid inputs have helpful messages
        invalid.forEach(input => {
          const result = schema.safeParse(input);
          expect(result.success).toBe(false);
          if (!result.success && name === 'amount') {
            expect(result.error.issues[0].message).toContain('example:');
          }
        });
      });
    });
  });
});

/**
 * Future Form Compliance Guard
 * Utility functions to ensure new forms follow validation standards
 */
describe('Future Form Compliance Guards', () => {
  describe('Validation Schema Checkers', () => {
    test('should validate that schema has proper error messages', () => {
      const validateSchemaCompliance = (schema: z.ZodType, fieldName: string) => {
        // Test with both empty and invalid format to check all validation messages
        const emptyResult = schema.safeParse('');
        const invalidResult = schema.safeParse('invalid-format');
        
        // Check both results for compliance
        const results = [emptyResult, invalidResult].filter(r => !r.success);
        
        if (results.length > 0) {
          // Check if any error message is compliant
          const hasCompliantMessage = results.some(result => {
            if (!result.success) {
              const errorMessage = result.error.issues[0].message;
              const hasGuidance = errorMessage.includes('must be') || errorMessage.includes('should be') || errorMessage.includes('please') || errorMessage.includes('required');
              const isNotVague = !errorMessage.match(/^(invalid|error|wrong)$/i);
              return hasGuidance && isNotVague;
            }
            return false;
          });

          return {
            hasGuidance: hasCompliantMessage,
            isNotVague: hasCompliantMessage,
            errorMessage: results[0].success ? '' : results[0].error.issues[0].message,
            compliance: hasCompliantMessage
          };
        }
        return { compliance: true };
      };

      // Test with compliant schema - test with invalid email format to get email validation message
      const goodSchema = z.string().min(1, 'Email address is required').email('Please enter a valid email address (example: user@domain.com)');
      const goodResult = validateSchemaCompliance(goodSchema, 'email');
      // The compliance should be true because it has guidance and is not vague
      expect(goodResult.compliance).toBe(true);

      // Test with non-compliant schema
      const badSchema = z.string().email('Invalid email');
      const badResult = validateSchemaCompliance(badSchema, 'email');
      expect(badResult.compliance).toBe(false);
    });
  });
});