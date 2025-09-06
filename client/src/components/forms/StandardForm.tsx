import React from 'react';
import { UseFormReturn, FieldValues } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StandardSubmitButton, FormSection } from './StandardFormField';

/**
 * Props for the standardized form wrapper
 */
interface StandardFormProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  onSubmit: (data: T) => void | Promise<void>;
  title?: string;
  description?: string;
  children: React.ReactNode;
  isLoading?: boolean;
  submitText?: string;
  loadingText?: string;
  className?: string;
  formName?: string;
  showCard?: boolean;
  errorMessage?: string;
  successMessage?: string;
  resetOnSuccess?: boolean;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

/**
 * Standardized form wrapper that provides consistent styling, layout,
 * error handling, and accessibility features for all forms in the application.
 * 
 * Features:
 * - Consistent form layout and styling
 * - Quebec compliance standards
 * - Built-in error and success messaging
 * - Responsive design
 * - Automatic test ID generation
 * - Loading states with proper UX
 * - Optional card wrapper for better visual hierarchy
 * 
 * @param props - Configuration for the form wrapper
 */
export function StandardForm<T extends FieldValues>({
  form,
  onSubmit,
  title,
  description,
  children,
  isLoading = false,
  submitText = 'Submit',
  loadingText = 'Submitting...',
  className = '',
  formName = 'standard-form',
  showCard = true,
  errorMessage,
  successMessage,
  resetOnSuccess = false,
  maxWidth = 'md',
}: StandardFormProps<T>) {
  // Handle form submission with error boundary
  const handleSubmit = async (data: T) => {
    try {
      await onSubmit(data);
      if (resetOnSuccess) {
        form.reset();
      }
    } catch (error) {
      console.error('Form submission error:', error);
      // Error is handled by parent component through errorMessage prop
    }
  };

  // Get max-width classes based on prop
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    full: 'max-w-full',
  };

  const FormContent = () => (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className={cn('space-y-6', className)}
        data-testid={`${formName}-form`}
        noValidate // We handle validation with Zod
      >
        {/* Error Alert */}
        {errorMessage && (
          <Alert variant="destructive" data-testid={`${formName}-error-alert`}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {/* Success Alert */}
        {successMessage && (
          <Alert variant="default" className="border-green-500 text-green-700" data-testid={`${formName}-success-alert`}>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}

        {/* Form Fields */}
        <div className="space-y-4">
          {children}
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-4">
          <StandardSubmitButton
            isLoading={isLoading}
            loadingText={loadingText}
            formName={formName}
            disabled={isLoading}
          >
            {submitText}
          </StandardSubmitButton>
        </div>
      </form>
    </Form>
  );

  if (!showCard) {
    return (
      <div className={cn('w-full mx-auto', maxWidthClasses[maxWidth])}>
        <FormContent />
      </div>
    );
  }

  return (
    <div className={cn('w-full mx-auto', maxWidthClasses[maxWidth])}>
      <Card data-testid={`${formName}-card`}>
        {(title || description) && (
          <CardHeader>
            {title && (
              <CardTitle className="text-xl font-semibold text-gray-900">
                {title}
              </CardTitle>
            )}
            {description && (
              <CardDescription className="text-gray-600">
                {description}
              </CardDescription>
            )}
          </CardHeader>
        )}
        <CardContent>
          <FormContent />
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Hook for managing form state with standardized error handling
 */
interface UseStandardFormOptions {
  resetOnSuccess?: boolean;
  showSuccessMessage?: boolean;
  successMessageDuration?: number;
}

export function useStandardForm(options: UseStandardFormOptions = {}) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string>('');
  const [successMessage, setSuccessMessage] = React.useState<string>('');

  const {
    resetOnSuccess = false,
    showSuccessMessage = true,
    successMessageDuration = 3000,
  } = options;

  // Clear success message after duration
  React.useEffect(() => {
    if (successMessage && successMessageDuration > 0) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
      }, successMessageDuration);
      return () => clearTimeout(timer);
    }
  }, [successMessage, successMessageDuration]);

  const handleSubmit = React.useCallback(
    async <T extends FieldValues>(
      submitFn: (data: T) => Promise<void>,
      form: UseFormReturn<T>,
      successMsg: string = 'Operation completed successfully'
    ) => {
      return async (data: T) => {
        setIsLoading(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
          await submitFn(data);
          
          if (showSuccessMessage) {
            setSuccessMessage(successMsg);
          }
          
          if (resetOnSuccess) {
            form.reset();
          }
        } catch (error: any) {
          console.error('Form submission error:', error);
          setErrorMessage(
            error.response?.data?.message || 
            error.message || 
            'An unexpected error occurred. Please try again.'
          );
        } finally {
          setIsLoading(false);
        }
      };
    },
    [resetOnSuccess, showSuccessMessage]
  );

  const clearMessages = React.useCallback(() => {
    setErrorMessage('');
    setSuccessMessage('');
  }, []);

  return {
    isLoading,
    errorMessage,
    successMessage,
    handleSubmit,
    clearMessages,
    setIsLoading,
    setErrorMessage,
    setSuccessMessage,
  };
}

/**
 * Standardized form validation error display component
 */
interface FormValidationSummaryProps {
  errors: Record<string, any>;
  formName?: string;
  className?: string;
}

export function FormValidationSummary({
  errors,
  formName = 'form',
  className = '',
}: FormValidationSummaryProps) {
  const errorEntries = Object.entries(errors).filter(([, error]) => error?.message);

  if (errorEntries.length === 0) {
    return null;
  }

  return (
    <Alert variant="destructive" className={className} data-testid={`${formName}-validation-summary`}>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        <div className="space-y-1">
          <p className="font-medium">Please correct the following errors:</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {errorEntries.map(([field, error]) => (
              <li key={field}>
                <strong>{field.charAt(0).toUpperCase() + field.slice(1)}:</strong> {error.message}
              </li>
            ))}
          </ul>
        </div>
      </AlertDescription>
    </Alert>
  );
}