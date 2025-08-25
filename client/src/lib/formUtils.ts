import { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';

// Common form states and behaviors
/**
 *
 */
export interface FormState {
  isSubmitting: boolean;
  hasErrors: boolean;
  isDirty: boolean;
  isValid: boolean;
}

// Common form field configurations
/**
 *
 */
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

// Form utilities
export const formUtils = {
  // Convert enum to select options
  enumToOptions: <T extends string>(
    enumObject: Record<string, T>,
    labelMap?: Record<T, string>
  ): SelectOption[] => {
    return Object.values(enumObject).map((value) => ({
      value,
      label: labelMap?.[value] || value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' '),
    }));
  },

  // Convert array to select options with custom labeling
  arrayToOptions: <T extends string>(
    array: readonly T[],
    labelMap?: Record<T, string>
  ): SelectOption[] => {
    return array.map((value) => ({
      value,
      label: labelMap?.[value] || value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' '),
    }));
  },

  // Create options with "All" option for filters
  createFilterOptions: (options: SelectOption[], allLabel = 'All'): SelectOption[] => [
    { value: 'all', label: allLabel },
    ...options,
  ],

  // Get form state summary
  getFormState: <T extends Record<string, any>>(form: UseFormReturn<T>): FormState => ({
    isSubmitting: form.formState.isSubmitting,
    hasErrors: Object.keys(form.formState.errors).length > 0,
    isDirty: form.formState.isDirty,
    isValid: form.formState.isValid,
  }),

  // Reset form with new default values
  resetFormWithDefaults: <T extends Record<string, any>>(
    form: UseFormReturn<T>,
    defaultValues: T
  ) => {
    form.reset(defaultValues);
  },

  // Clear specific form errors
  clearFormErrors: <T extends Record<string, any>>(
    form: UseFormReturn<T>,
    fieldNames?: (keyof T)[]
  ) => {
    if (fieldNames) {
      fieldNames.forEach(fieldName => {
        form.clearErrors(fieldName as any);
      });
    } else {
      form.clearErrors();
    }
  },

  // Set form values programmatically
  setFormValues: <T extends Record<string, any>>(
    form: UseFormReturn<T>,
    values: Partial<T>
  ) => {
    Object.entries(values).forEach(([key, value]) => {
      form.setValue(key as keyof T, value);
    });
  },

  // Validate form fields manually
  validateFields: async <T extends Record<string, any>>(
    form: UseFormReturn<T>,
    fieldNames?: (keyof T)[]
  ): Promise<boolean> => {
    if (fieldNames) {
      const results = await Promise.all(
        fieldNames.map(fieldName => form.trigger(fieldName as any))
      );
      return results.every(Boolean);
    }
    return await form.trigger();
  },
};

// Common form field default values
export const defaultValues = {
  emptyString: '',
  emptyArray: [] as string[],
  false: false,
  true: true,
  currentDate: () => new Date().toISOString().split('T')[0],
  currentDateTime: () => new Date().toISOString(),
};

// Form validation helpers
export const validationUtils = {
  // Create conditional validation
  conditionalValidation: <T>(
    condition: (data: any) => boolean,
    schema: z.ZodSchema<T>
  ) => {
    return z.any().refine((data) => {
      if (condition(data)) {
        return schema.safeParse(data).success;
      }
      return true;
    });
  },

  // Create cross-field validation
  crossFieldValidation: <T extends Record<string, any>>(
    validator: (data: T) => boolean,
    message: string
  ) => {
    return z.any().refine(validator, { message });
  },

  // Date range validation
  dateRangeValidation: (startDateField: string, endDateField: string) => {
    return z.any().refine((data) => {
      const startDate = data[startDateField];
      const endDate = data[endDateField];
      
      if (!startDate || !endDate) {return true;}
      
      return new Date(startDate) <= new Date(endDate);
    }, {
      message: 'End date must be after start date',
      path: [endDateField],
    });
  },
};

// Common form patterns
export const formPatterns = {
  // Search form pattern
  createSearchForm: (initialValue = '') => ({
    searchTerm: initialValue,
  }),

  // Filter form pattern
  createFilterForm: (filters: string[] = []) => 
    Object.fromEntries(filters.map(filter => [filter, 'all'])),

  // Pagination form pattern
  createPaginationState: (itemsPerPage = 10) => ({
    currentPage: 1,
    itemsPerPage,
    totalItems: 0,
    totalPages: 0,
  }),

  // Modal form pattern
  createModalState: () => ({
    isOpen: false,
    mode: 'create' as 'create' | 'edit' | 'view',
    selectedItem: null as any,
  }),
};

// Form submission helpers
export const submissionHelpers = {
  // Handle form submission with loading state
  handleSubmission: async <T>(
    submitFn: (data: T) => Promise<any>,
    data: T,
    onSuccess?: () => void,
    onError?: (error: any) => void
  ) => {
    try {
      await submitFn(data);
      onSuccess?.();
    } catch (error) {
      onError?.(error);
      throw error;
    }
  },

  // Create submit handler with validation
  createSubmitHandler: <T extends Record<string, any>>(
    form: UseFormReturn<T>,
    submitFn: (data: T) => Promise<any>,
    onSuccess?: () => void,
    onError?: (error: any) => void
  ) => {
    return form.handleSubmit(async (data: T) => {
      await submissionHelpers.handleSubmission(submitFn, data, onSuccess, onError);
    });
  },
};

// Form field focus management
export const focusHelpers = {
  // Focus first error field
  focusFirstError: <T extends Record<string, any>>(form: UseFormReturn<T>) => {
    const firstErrorField = Object.keys(form.formState.errors)[0];
    if (firstErrorField) {
      const element = document.querySelector(`[name="${firstErrorField}"]`) as HTMLElement;
      element?.focus();
    }
  },

  // Focus specific field
  focusField: (fieldName: string) => {
    const element = document.querySelector(`[name="${fieldName}"]`) as HTMLElement;
    element?.focus();
  },
};

// Export all utilities
export {
  formUtils as default,
  defaultValues,
  validationUtils,
  formPatterns,
  submissionHelpers,
  focusHelpers,
};