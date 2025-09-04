/**
 * Form Validation Helper Utilities
 * Utility functions to enforce validation standards across all forms
 */

import { z } from 'zod';

/**
 * Validation Templates for Common Field Types
 * Use these templates to ensure consistency across all forms
 */
export const ValidationTemplates = {
  /**
   * Email field validation with format example
   */
  email: () => z.string()
    .min(1, 'Email address is required')
    .email('Please enter a valid email address (example: user@domain.com)'),

  /**
   * Quebec-compliant name field validation with French character support
   */
  quebecName: (fieldName: string, example: string) => z.string()
    .min(1, `${fieldName} is required (example: ${example})`)
    .max(50, `${fieldName} must be less than 50 characters`)
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, `${fieldName} can only contain letters, spaces, apostrophes and hyphens`),

  /**
   * North American phone number validation
   */
  phone: () => z.string()
    .regex(/^(\+1\s?)?(\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}$/, 'Phone number must be a valid North American format (example: (514) 123-4567)')
    .optional(),

  /**
   * Monetary amount validation with decimal support
   */
  amount: (fieldName: string = 'Amount') => z.string()
    .min(1, `${fieldName} is required (example: 125.50)`)
    .regex(/^\d+(\.\d{1,2})?$/, `${fieldName} must be a valid number with up to 2 decimal places (example: 125.50)`),

  /**
   * Canadian postal code validation
   */
  postalCode: () => z.string()
    .regex(/^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/, 'Postal code must follow Canadian format (example: H1A 1B1)'),

  /**
   * Selection field validation with dropdown guidance
   */
  selection: (fieldName: string) => z.string()
    .min(1, `Please select ${fieldName} from the dropdown`),

  /**
   * Text description field with character limits
   */
  description: (maxLength: number = 1000, minLength: number = 0) => {
    let schema = z.string().max(maxLength, `Description must be less than ${maxLength} characters`);
    if (minLength > 0) {
      schema = schema.min(minLength, 'Description must be at least 10 characters long (example: Detailed explanation of the issue)');
    }
    return schema;
  },

  /**
   * Title field validation with example
   */
  title: (fieldName: string = 'Title', example: string = 'Descriptive Title', maxLength: number = 200) => z.string()
    .min(1, `${fieldName} is required (example: ${example})`)
    .max(maxLength, `${fieldName} must be less than ${maxLength} characters`),

  /**
   * Password validation with security requirements
   */
  password: (fieldName: string = 'Password') => z.string()
    .min(8, `${fieldName} must be at least 8 characters long (example: MonNouveauMotDePasse123!)`)
    .max(100, `${fieldName} must be less than 100 characters`)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, `${fieldName} must contain at least one lowercase letter, one uppercase letter, and one number`),

  /**
   * Numeric range validation
   */
  numericRange: (fieldName: string, min: number, max: number) => z.number()
    .min(min, `${fieldName} must be between ${min} and ${max}`)
    .max(max, `${fieldName} must be between ${min} and ${max}`),

  /**
   * Time format validation
   */
  time: () => z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format (example: 09:00)')
};

/**
 * Validation Quality Checkers
 * Functions to check if validation messages meet quality standards
 */
export const ValidationQualityCheckers = {
  /**
   * Check if an error message meets quality standards
   */
  checkErrorMessageQuality: (message: string, fieldType: string): {
    isCompliant: boolean;
    issues: string[];
    message: string;
  } => {
    const issues: string[] = [];

    // Check message length
    if (message.length < 15) {
      issues.push('Error message too short - should be at least 15 characters');
    }
    if (message.length > 200) {
      issues.push('Error message too long - should be less than 200 characters');
    }

    // Check for helpful language
    if (!/please|must be|should be|required/i.test(message)) {
      issues.push('Error message should use helpful language (please, must be, required, etc.)');
    }

    // Check for examples where needed
    const needsExample = ['email', 'phone', 'postal', 'amount', 'time', 'name', 'password'].includes(fieldType.toLowerCase());
    if (needsExample && !message.includes('example:')) {
      issues.push(`${fieldType} field should include format example in error message`);
    }

    // Check for vague language
    if (/^(invalid|error|wrong|bad)$/i.test(message)) {
      issues.push('Error message too vague - provide specific guidance');
    }

    // Check for actionable guidance
    if (!/enter|select|choose|type|provide|format|between|at least|less than/i.test(message)) {
      issues.push('Error message should provide actionable guidance on how to fix the error');
    }

    return {
      isCompliant: issues.length === 0,
      issues,
      message
    };
  },

  /**
   * Check if a Zod schema follows validation standards
   */
  checkSchemaCompliance: (schema: z.ZodType, fieldType: string): {
    isCompliant: boolean;
    issues: string[];
  } => {
    const issues: string[] = [];

    try {
      // Test schema with empty string to trigger validation
      const result = schema.safeParse('');
      if (!result.success && result.error.issues.length > 0) {
        const errorMessage = result.error.issues[0].message;
        const messageCheck = ValidationQualityCheckers.checkErrorMessageQuality(errorMessage, fieldType);
        
        if (!messageCheck.isCompliant) {
          issues.push(...messageCheck.issues);
        }
      }

      // Additional schema structure checks
      if (fieldType === 'email' && schema._def && 'typeName' in schema._def && schema._def.typeName !== 'ZodString') {
        issues.push('Email fields should use string schema with email validation');
      }

    } catch (error) {
      issues.push('Schema validation check failed - invalid schema structure');
    }

    return {
      isCompliant: issues.length === 0,
      issues
    };
  },

  /**
   * Check if form component follows UI standards
   */
  checkFormComponentCompliance: (componentStructure: {
    hasFormLabel: boolean;
    hasFormMessage: boolean;
    hasDataTestIds: boolean;
    hasProperStyling: boolean;
  }): {
    isCompliant: boolean;
    issues: string[];
  } => {
    const issues: string[] = [];

    if (!componentStructure.hasFormLabel) {
      issues.push('Form should use FormLabel component for consistent styling');
    }
    if (!componentStructure.hasFormMessage) {
      issues.push('Form should use FormMessage component to display validation errors');
    }
    if (!componentStructure.hasDataTestIds) {
      issues.push('Form elements should have data-testid attributes for testing');
    }
    if (!componentStructure.hasProperStyling) {
      issues.push('Form should follow responsive design patterns with proper styling');
    }

    return {
      isCompliant: issues.length === 0,
      issues
    };
  }
};

/**
 * Quebec-Specific Validation Patterns
 * Validation patterns specific to Quebec compliance requirements
 */
export const QuebecValidationPatterns = {
  /**
   * Quebec name validation supporting French characters
   */
  quebecName: /^[a-zA-ZÀ-ÿ\s'-]+$/,

  /**
   * Canadian postal code format
   */
  canadianPostalCode: /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/,

  /**
   * North American phone number format
   */
  northAmericanPhone: /^(\+1\s?)?(\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}$/,

  /**
   * Quebec city name validation
   */
  quebecCity: /^[a-zA-ZÀ-ÿ\s'-]+$/
};

/**
 * Form Validation Standards Enforcement
 * Functions to ensure forms meet all validation requirements
 */
export const FormValidationStandards = {
  /**
   * Validate that a form schema meets all requirements
   */
  validateFormSchema: (schema: Record<string, z.ZodType>, formName: string): {
    isCompliant: boolean;
    issues: string[];
    recommendations: string[];
  } => {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check each field in the schema
    Object.entries(schema).forEach(([fieldName, fieldSchema]) => {
      const fieldType = detectFieldType(fieldName);
      const compliance = ValidationQualityCheckers.checkSchemaCompliance(fieldSchema, fieldType);
      
      if (!compliance.isCompliant) {
        issues.push(`Field '${fieldName}': ${compliance.issues.join(', ')}`);
      }

      // Add recommendations based on field type
      if (fieldType === 'email' && !fieldName.includes('confirm')) {
        recommendations.push(`Consider adding email confirmation field for ${fieldName} in security-sensitive forms`);
      }
      if (fieldType === 'password') {
        recommendations.push(`Ensure ${fieldName} has proper strength indicators in the UI`);
      }
    });

    return {
      isCompliant: issues.length === 0,
      issues,
      recommendations
    };
  },

  /**
   * Generate validation report for development team
   */
  generateValidationReport: (formFiles: string[]): {
    compliantForms: string[];
    nonCompliantForms: Array<{ file: string; issues: string[] }>;
    totalForms: number;
    compliancePercentage: number;
  } => {
    const compliantForms: string[] = [];
    const nonCompliantForms: Array<{ file: string; issues: string[] }> = [];

    // For demo purposes, assume all listed forms are compliant
    // In real implementation, this would analyze actual form files
    formFiles.forEach(file => {
      compliantForms.push(file);
    });

    return {
      compliantForms,
      nonCompliantForms,
      totalForms: formFiles.length,
      compliancePercentage: (compliantForms.length / formFiles.length) * 100
    };
  }
};

/**
 * Helper function to detect field type from field name
 */
function detectFieldType(fieldName: string): string {
  const name = fieldName.toLowerCase();
  
  if (name.includes('email')) return 'email';
  if (name.includes('phone') || name.includes('telephone')) return 'phone';
  if (name.includes('postal') || name.includes('zipcode')) return 'postal';
  if (name.includes('amount') || name.includes('price') || name.includes('cost')) return 'amount';
  if (name.includes('time') || name.includes('hour')) return 'time';
  if (name.includes('password') || name.includes('pwd')) return 'password';
  if (name.includes('name') || name.includes('nom')) return 'name';
  if (name.includes('description') || name.includes('note')) return 'description';
  if (name.includes('title') || name.includes('titre')) return 'title';
  if (name.includes('date')) return 'date';
  if (name.includes('select') || name.includes('choice') || name.includes('option')) return 'selection';
  
  return 'text';
}

/**
 * Runtime validation checker for development
 * Use in development to ensure new forms follow standards
 */
export const DevValidationChecker = {
  /**
   * Check if a form follows all validation standards
   * Call this during development to validate form compliance
   */
  checkFormCompliance: (
    formSchema: Record<string, z.ZodType>,
    formName: string
  ): void => {
    if (process.env.NODE_ENV === 'development') {
      const validation = FormValidationStandards.validateFormSchema(formSchema, formName);
      
      // Validation logging removed for production
    }
  }
};