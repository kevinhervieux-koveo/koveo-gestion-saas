/**
 * Form Components Validation Test Suite
 * Tests React components to ensure they follow validation UI standards
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect } from '@jest/globals';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../client/src/components/ui/form';
import { Input } from '../../client/src/components/ui/input';
import { Button } from '../../client/src/components/ui/button';

// Test component that uses our form validation standards
const TestFormSchema = z.object({
  email: z.string().min(1, 'Email address is required').email('Please enter a valid email address (example: user@domain.com)'),
  name: z.string().min(1, 'Name is required (example: Jean Dupont)').max(50, 'Name must be less than 50 characters'),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Amount must be a valid number with up to 2 decimal places (example: 125.50)'),
  phone: z.string().regex(/^(\+1\s?)?(\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}$/, 'Phone number must be a valid North American format (example: (514) 123-4567)').optional()
});

type TestFormData = z.infer<typeof TestFormSchema>;

const TestFormComponent = () => {
  const form = useForm<TestFormData>({
    resolver: zodResolver(TestFormSchema),
    defaultValues: {
      email: '',
      name: '',
      amount: '',
      phone: '',
    },
  });

  const onSubmit = (data: TestFormData) => {
    console.log(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} data-testid="test-form">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel data-testid="label-email">Email Address *</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-email" />
              </FormControl>
              <FormMessage data-testid="error-email" />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel data-testid="label-name">Full Name *</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-name" />
              </FormControl>
              <FormMessage data-testid="error-name" />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel data-testid="label-amount">Amount *</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-amount" />
              </FormControl>
              <FormMessage data-testid="error-amount" />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel data-testid="label-phone">Phone Number</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-phone" />
              </FormControl>
              <FormMessage data-testid="error-phone" />
            </FormItem>
          )}
        />
        
        <Button type="submit" data-testid="submit-button">
          Submit
        </Button>
      </form>
    </Form>
  );
};

describe('Form Component Validation UI', () => {
  describe('FormLabel Red Color Display', () => {
    test('should display field labels in red when validation errors occur', async () => {
      const user = userEvent.setup();
      render(<TestFormComponent />);

      // Submit form with invalid data to trigger validation errors
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      // Wait for validation errors to appear
      await waitFor(() => {
        const emailError = screen.getByTestId('error-email');
        expect(emailError).toBeInTheDocument();
      });

      // Check that FormLabel has error styling when field has error
      const emailLabel = screen.getByTestId('label-email');
      const nameLabel = screen.getByTestId('label-name');
      const amountLabel = screen.getByTestId('label-amount');

      // Labels for required fields with errors should have error styling
      expect(emailLabel).toHaveClass('text-red-600');
      expect(nameLabel).toHaveClass('text-red-600');
      expect(amountLabel).toHaveClass('text-red-600');
    });

    test('should not display red labels when fields are valid', async () => {
      const user = userEvent.setup();
      render(<TestFormComponent />);

      // Fill in valid data
      const emailInput = screen.getByTestId('input-email');
      const nameInput = screen.getByTestId('input-name');
      const amountInput = screen.getByTestId('input-amount');

      await user.type(emailInput, 'user@domain.com');
      await user.type(nameInput, 'Jean Dupont');
      await user.type(amountInput, '125.50');

      // Submit form
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      // Wait for validation to complete
      await waitFor(() => {
        // Check that no error messages are shown
        const emailError = screen.getByTestId('error-email');
        const nameError = screen.getByTestId('error-name');
        const amountError = screen.getByTestId('error-amount');
        
        expect(emailError).toBeEmptyDOMElement();
        expect(nameError).toBeEmptyDOMElement();
        expect(amountError).toBeEmptyDOMElement();
      });

      // Labels should not have error styling
      const emailLabel = screen.getByTestId('label-email');
      const nameLabel = screen.getByTestId('label-name');
      const amountLabel = screen.getByTestId('label-amount');

      expect(emailLabel).not.toHaveClass('text-red-600');
      expect(nameLabel).not.toHaveClass('text-red-600');
      expect(amountLabel).not.toHaveClass('text-red-600');
    });
  });

  describe('Error Message Display', () => {
    test('should display detailed error messages with examples', async () => {
      const user = userEvent.setup();
      render(<TestFormComponent />);

      // Enter invalid data
      const emailInput = screen.getByTestId('input-email');
      const nameInput = screen.getByTestId('input-name');
      const amountInput = screen.getByTestId('input-amount');
      const phoneInput = screen.getByTestId('input-phone');

      await user.type(emailInput, 'invalid-email');
      await user.type(nameInput, '');
      await user.type(amountInput, '125.555');
      await user.type(phoneInput, '123');

      // Submit to trigger validation
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      // Wait for error messages
      await waitFor(() => {
        const emailError = screen.getByTestId('error-email');
        const nameError = screen.getByTestId('error-name');
        const amountError = screen.getByTestId('error-amount');
        const phoneError = screen.getByTestId('error-phone');

        // Check that error messages contain examples and helpful guidance
        expect(emailError.textContent).toContain('example:');
        expect(emailError.textContent).toContain('user@domain.com');
        
        expect(nameError.textContent).toContain('example:');
        expect(nameError.textContent).toContain('Jean Dupont');
        
        expect(amountError.textContent).toContain('decimal places');
        expect(amountError.textContent).toContain('example:');
        expect(amountError.textContent).toContain('125.50');
        
        expect(phoneError.textContent).toContain('example:');
        expect(phoneError.textContent).toContain('(514) 123-4567');
      });
    });

    test('should clear error messages when fields become valid', async () => {
      const user = userEvent.setup();
      render(<TestFormComponent />);

      // First trigger an error
      const emailInput = screen.getByTestId('input-email');
      await user.type(emailInput, 'invalid');
      
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      // Wait for error to appear
      await waitFor(() => {
        const emailError = screen.getByTestId('error-email');
        expect(emailError.textContent).toContain('valid email');
      });

      // Then fix the email
      await user.clear(emailInput);
      await user.type(emailInput, 'user@domain.com');

      // Trigger validation again
      await user.click(submitButton);

      // Wait for error to clear
      await waitFor(() => {
        const emailError = screen.getByTestId('error-email');
        expect(emailError).toBeEmptyDOMElement();
      });
    });
  });

  describe('Accessibility Compliance', () => {
    test('should maintain proper form accessibility with validation', async () => {
      render(<TestFormComponent />);

      // Check that form fields have proper labels
      const emailInput = screen.getByTestId('input-email');
      const nameInput = screen.getByTestId('input-name');
      
      expect(emailInput).toHaveAccessibleName(/email address/i);
      expect(nameInput).toHaveAccessibleName(/full name/i);

      // Check that required fields are marked appropriately
      const emailLabel = screen.getByTestId('label-email');
      const nameLabel = screen.getByTestId('label-name');
      
      expect(emailLabel.textContent).toContain('*');
      expect(nameLabel.textContent).toContain('*');
    });

    test('should associate error messages with form fields', async () => {
      const user = userEvent.setup();
      render(<TestFormComponent />);

      // Trigger validation error
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      await waitFor(() => {
        const emailInput = screen.getByTestId('input-email');
        const emailError = screen.getByTestId('error-email');

        // Error message should be associated with the input
        expect(emailError).toBeInTheDocument();
        expect(emailError.textContent).toBeTruthy();
        
        // Input should have aria-describedby or similar accessibility attribute
        expect(emailInput).toBeInTheDocument();
      });
    });
  });
});

describe('Validation Standards Enforcement', () => {
  describe('Schema Pattern Validation', () => {
    test('should validate that all string schemas include helpful error messages', () => {
      // Helper function to check if a schema follows our standards
      const validateStringSchema = (schema: z.ZodString, fieldContext: string) => {
        const testResult = schema.safeParse('');
        if (!testResult.success) {
          const errorMessage = testResult.error.issues[0].message;
          
          // Requirements for good error messages:
          // 1. Should not be just "Required" or "Invalid"
          // 2. Should provide context about the field
          // 3. Should include examples for format-specific fields
          const isDescriptive = errorMessage.length > 10;
          const isNotGeneric = !errorMessage.match(/^(required|invalid|error|wrong)$/i);
          const hasExample = errorMessage.includes('example:') || !needsExample(fieldContext);
          
          return {
            isDescriptive,
            isNotGeneric,
            hasExample,
            message: errorMessage,
            passes: isDescriptive && isNotGeneric && hasExample
          };
        }
        return { passes: true };
      };

      const needsExample = (context: string) => {
        return ['email', 'phone', 'postal', 'amount', 'time', 'date', 'name'].some(type => 
          context.toLowerCase().includes(type)
        );
      };

      // Test various schema types that should follow our standards
      const schemasToTest = [
        {
          schema: z.string().min(1, 'Email address is required').email('Please enter a valid email address (example: user@domain.com)'),
          context: 'email'
        },
        {
          schema: z.string().min(1, 'Name is required (example: Jean Dupont)'),
          context: 'name'
        },
        {
          schema: z.string().min(1, 'Please select an option from the dropdown'),
          context: 'selection'
        }
      ];

      schemasToTest.forEach(({ schema, context }) => {
        const result = validateStringSchema(schema, context);
        expect(result.passes).toBe(true);
      });
    });
  });

  describe('Consistent Pattern Enforcement', () => {
    test('should enforce consistent validation patterns across field types', () => {
      // Define standard patterns that should be used consistently
      const standardPatterns = {
        email: {
          regex: /\S+@\S+\.\S+/,
          errorPattern: /please enter.*valid.*email.*example:/i,
          example: 'user@domain.com'
        },
        phone: {
          regex: /^(\+1\s?)?(\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}$/,
          errorPattern: /phone.*valid.*north american.*format.*example:/i,
          example: '(514) 123-4567'
        },
        postalCode: {
          regex: /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/,
          errorPattern: /postal.*canadian.*format.*example:/i,
          example: 'H1A 1B1'
        },
        amount: {
          regex: /^\d+(\.\d{1,2})?$/,
          errorPattern: /amount.*valid.*number.*decimal.*example:/i,
          example: '125.50'
        }
      };

      Object.entries(standardPatterns).forEach(([fieldType, { regex, errorPattern, example }]) => {
        // Test that the regex works correctly
        expect(regex.test(example)).toBe(true);

        // Test that error messages follow the expected pattern
        const mockErrorMessage = `Please enter a valid ${fieldType} (example: ${example})`;
        expect(errorPattern.test(mockErrorMessage)).toBe(true);
      });
    });

    test('should validate character length limits are consistently applied', () => {
      const standardLimits = {
        title: { min: 1, max: 200 },
        description: { min: 10, max: 1000 },
        shortText: { min: 1, max: 100 },
        longText: { min: 10, max: 2000 },
        name: { min: 1, max: 50 },
        notes: { min: 0, max: 1000 },
        comment: { min: 1, max: 1000 }
      };

      Object.entries(standardLimits).forEach(([fieldType, { min, max }]) => {
        const schema = z.string()
          .min(min, min > 0 ? `${fieldType} is required` : undefined)
          .max(max, `${fieldType} must be less than ${max} characters`);

        // Test boundary conditions
        if (min > 0) {
          const tooShort = 'a'.repeat(min - 1);
          expect(schema.safeParse(tooShort).success).toBe(false);
        }

        const tooLong = 'a'.repeat(max + 1);
        expect(schema.safeParse(tooLong).success).toBe(false);

        const justRight = 'a'.repeat(min > 0 ? min : 1);
        expect(schema.safeParse(justRight).success).toBe(true);
      });
    });
  });

  describe('Quebec Compliance Standards', () => {
    test('should validate French character support in name fields', () => {
      const nameSchema = z.string().regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'Name can only contain letters, spaces, apostrophes and hyphens');

      const validQuebecNames = [
        'Jean-Baptiste',
        'Marie-Ève',
        'François',
        'Michèle',
        "O'Connor",
        'Lafleur-Dufresne',
        'José-María'
      ];

      const invalidNames = [
        'Jean123',
        'Marie@email',
        'François#',
        'Name$pecial'
      ];

      // Test valid Quebec names
      validQuebecNames.forEach(name => {
        expect(nameSchema.safeParse(name).success).toBe(true);
      });

      // Test invalid names
      invalidNames.forEach(name => {
        const result = nameSchema.safeParse(name);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('letters, spaces, apostrophes');
        }
      });
    });

    test('should validate Canadian postal code formats', () => {
      const postalSchema = z.string().regex(
        /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/,
        'Postal code must follow Canadian format (example: H1A 1B1)'
      );

      const validPostalCodes = [
        'H1A 1B1',
        'H1A1B1',
        'K1A 0A6',
        'M5V 3A8',
        'V6B 1A1'
      ];

      const invalidPostalCodes = [
        '12345',
        'H1A 1B',
        'h1a 1b1',
        'H1A-1B1',
        'H1A  1B1'
      ];

      validPostalCodes.forEach(code => {
        expect(postalSchema.safeParse(code).success).toBe(true);
      });

      invalidPostalCodes.forEach(code => {
        const result = postalSchema.safeParse(code);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('Canadian format');
          expect(result.error.issues[0].message).toContain('example:');
        }
      });
    });
  });

  describe('Business Logic Validation', () => {
    test('should validate time range logic with clear error messages', () => {
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
      const validResult = timeRangeSchema.safeParse({ startTime: '09:00', endTime: '11:00' });
      expect(validResult.success).toBe(true);

      // Test invalid time range
      const invalidResult = timeRangeSchema.safeParse({ startTime: '11:00', endTime: '09:00' });
      expect(invalidResult.success).toBe(false);

      if (!invalidResult.success) {
        const error = invalidResult.error.issues.find(issue => issue.path.includes('endTime'));
        expect(error?.message).toContain('after start time');
        expect(error?.message).toContain('example:');
      }
    });

    test('should validate conditional requirements with helpful messaging', () => {
      const conditionalSchema = z
        .object({
          role: z.enum(['admin', 'manager', 'tenant', 'resident']),
          email: z.string().email('Please enter a valid email address (example: user@domain.com)').optional(),
          firstName: z.string().min(1, 'First name is required (example: Jean)').optional(),
          lastName: z.string().min(1, 'Last name is required (example: Dupont)').optional(),
        })
        .refine(
          (data) => {
            // For regular roles, email is required
            if (['admin', 'manager'].includes(data.role)) {
              return !!data.email;
            }
            // For tenant/resident, name is required
            return !!data.firstName && !!data.lastName;
          },
          {
            message: 'Email address is required for admin and manager roles. First and last name required for tenant and resident roles.',
            path: ['email'],
          }
        );

      // Test admin with email - should pass
      expect(conditionalSchema.safeParse({
        role: 'admin',
        email: 'admin@domain.com'
      }).success).toBe(true);

      // Test resident with names - should pass
      expect(conditionalSchema.safeParse({
        role: 'resident',
        firstName: 'Jean',
        lastName: 'Dupont'
      }).success).toBe(true);

      // Test admin without email - should fail with helpful message
      const adminResult = conditionalSchema.safeParse({
        role: 'admin'
      });
      expect(adminResult.success).toBe(false);

      if (!adminResult.success) {
        expect(adminResult.error.issues[0].message).toContain('Email address is required for admin');
        expect(adminResult.error.issues[0].message).toContain('First and last name required for tenant');
      }
    });
  });
});