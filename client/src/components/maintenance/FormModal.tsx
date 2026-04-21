import { ReactNode, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useForm, UseFormReturn, FieldValues, Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

interface FormModalProps<T extends FieldValues> {
  // Modal props
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: ReactNode;
  
  // Modal content
  title: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  
  // Form props
  form: UseFormReturn<T>;
  schema?: z.ZodSchema<T>;
  onSubmit: (data: T) => void | Promise<void>;
  defaultValues?: Partial<T>;
  
  // Form state
  isSubmitting?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  mode?: 'create' | 'edit' | 'view';
  
  // Error handling
  error?: string | null;
  success?: string | null;
  
  // Form content
  children: ReactNode;
  
  // Additional actions
  additionalActions?: ReactNode;
  
  // Validation
  validationErrors?: Record<string, string>;
  
  // Styling
  className?: string;
  footerClassName?: string;
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-6xl',
};

/**
 * Generic FormModal component for maintenance journal system
 * Provides standardized modal forms with validation, error handling, and loading states
 */
export function FormModal<T extends FieldValues>({
  isOpen,
  onOpenChange,
  trigger,
  title,
  description,
  size = 'md',
  form,
  schema,
  onSubmit,
  defaultValues,
  isSubmitting = false,
  submitLabel,
  cancelLabel = 'Cancel',
  mode = 'create',
  error,
  success,
  children,
  additionalActions,
  validationErrors,
  className,
  footerClassName,
}: FormModalProps<T>) {
  
  // Auto-determine submit label based on mode
  const finalSubmitLabel = submitLabel || (mode === 'create' ? 'Create' : 'Save Changes');
  
  // Reset form when modal opens/closes or default values change
  useEffect(() => {
    if (isOpen && defaultValues) {
      form.reset(defaultValues as any);
    }
  }, [isOpen, defaultValues, form]);

  // Handle form submission with error handling
  const handleSubmit = async (data: T) => {
    try {
      await onSubmit(data);
    } catch (submitError) {
      // Error is handled by parent component
      // Error logging removed for production
    }
  };

  // Close modal and reset form
  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      form.reset();
    }, 150); // Small delay to allow modal close animation
  };

  // Use React Hook Form's built-in validation state
  const { isValid, errors, isDirty } = form.formState;
  const hasValidationErrors = validationErrors && Object.keys(validationErrors).length > 0;
  
  // Form validation state tracking (production optimized)
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      // Validation errors are displayed in UI, no need for console logging
    }
  }, [errors]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      
      <DialogContent 
        className={`${sizeClasses[size]} max-h-[90vh] overflow-y-auto ${className || ''}`}
        data-testid="form-modal"
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <DialogTitle data-testid="modal-title">
                {title}
                {mode === 'edit' && (
                  <Badge variant="secondary" className="ml-2">
                    Edit Mode
                  </Badge>
                )}
                {mode === 'view' && (
                  <Badge variant="outline" className="ml-2">
                    View Mode
                  </Badge>
                )}
              </DialogTitle>
              {description && (
                <DialogDescription className="mt-2" data-testid="modal-description">
                  {description}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Success/Error Messages */}
        {success && (
          <Alert className="border-green-200 bg-green-50 dark:bg-green-950" data-testid="success-alert">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              {success}
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" data-testid="error-alert">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Validation Errors */}
        {hasValidationErrors && (
          <Alert variant="destructive" data-testid="validation-errors-alert">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <p className="font-medium">Please fix the following errors:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {Object.entries(validationErrors!).map(([field, message]) => (
                    <li key={field}>{message}</li>
                  ))}
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Form */}
        <Form {...form}>
          <form 
            onSubmit={form.handleSubmit(handleSubmit)} 
            className="space-y-6"
            data-testid="modal-form"
          >
            <div className="space-y-4">
              {children}
            </div>

            <DialogFooter className={`flex flex-col sm:flex-row gap-2 ${footerClassName || ''}`}>
              <div className="flex flex-1 justify-between">
                <div className="flex gap-2">
                  {additionalActions}
                </div>
                
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    disabled={isSubmitting}
                    data-testid="cancel-button"
                  >
                    {cancelLabel}
                  </Button>
                  
                  {mode !== 'view' && (
                    <Button
                      type="submit"
                      disabled={isSubmitting || !isValid}
                      data-testid="submit-button"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {mode === 'create' ? 'Creating...' : 'Saving...'}
                        </>
                      ) : (
                        finalSubmitLabel
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Form field helper component for consistent styling
interface FormFieldWrapperProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  name: Path<T>;
  label: string;
  description?: string;
  required?: boolean;
  children: (field: any, hasError: boolean) => ReactNode;
  className?: string;
}

export function FormFieldWrapper<T extends FieldValues>({
  form,
  name,
  label,
  description,
  required = false,
  children,
  className,
}: FormFieldWrapperProps<T>) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field, fieldState }) => {
        const hasError = !!fieldState.error;
        
        return (
          <FormItem className={className}>
            <FormLabel className="flex items-center gap-1">
              {label}
              {required && <span className="text-red-500">*</span>}
            </FormLabel>
            <FormControl>
              {children(field, hasError)}
            </FormControl>
            {description && (
              <FormDescription>{description}</FormDescription>
            )}
            <FormMessage data-testid={`field-error-${name}`} />
          </FormItem>
        );
      }}
    />
  );
}

export type { FormModalProps };