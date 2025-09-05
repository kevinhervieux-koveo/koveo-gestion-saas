import React from 'react';
import { Control, FieldPath, FieldValues } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { FormQuality } from '@/utils/form-validation-helpers';

/**
 * Standardized form field types for consistent form building
 */
export type StandardFieldType = 
  | 'text' 
  | 'email' 
  | 'password' 
  | 'textarea' 
  | 'select' 
  | 'checkbox' 
  | 'number'
  | 'tel'
  | 'url'
  | 'date';

/**
 * Option interface for select fields
 */
export interface FieldOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * Props for the standardized form field component
 */
interface StandardFormFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  type?: StandardFieldType;
  placeholder?: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  options?: FieldOption[]; // For select fields
  rows?: number; // For textarea fields
  formName?: string; // For auto-generating test IDs
  autoComplete?: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
}

/**
 * Standardized form field component that follows all Quebec compliance 
 * and accessibility standards. Automatically generates test IDs and 
 * applies consistent styling patterns.
 * 
 * @param props - Configuration for the form field
 */
export function StandardFormField<T extends FieldValues>({
  control,
  name,
  label,
  type = 'text',
  placeholder,
  description,
  required = false,
  disabled = false,
  className = '',
  options = [],
  rows = 3,
  formName = 'form',
  autoComplete,
  min,
  max,
  step,
}: StandardFormFieldProps<T>) {
  // Auto-generate test ID following standards
  const testId = FormQuality.generateTestId(formName, name as string, 
    ['select'].includes(type) ? 'select' : 'input');

  // Render the appropriate input component based on type
  const renderInput = (field: any) => {
    const baseProps = {
      ...field,
      placeholder,
      disabled,
      autoComplete,
      'data-testid': testId,
      className: cn(
        // Standard styling for all inputs
        'transition-colors focus:ring-2 focus:ring-blue-500',
        // Error state styling  
        field.error && 'border-red-500 focus:border-red-500',
        className
      ),
    };

    switch (type) {
      case 'textarea':
        return (
          <Textarea
            {...baseProps}
            rows={rows}
            className={cn(
              'min-h-[80px] resize-y',
              baseProps.className
            )}
          />
        );

      case 'select':
        return (
          <Select
            onValueChange={field.onChange}
            defaultValue={field.value}
            disabled={disabled}
          >
            <SelectTrigger data-testid={testId} className={baseProps.className}>
              <SelectValue placeholder={placeholder || `Select ${label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  data-testid={`${testId}-option-${option.value}`}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={disabled}
              data-testid={testId}
              className={baseProps.className}
            />
            <span className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              {label}
            </span>
          </div>
        );

      case 'number':
        return (
          <Input
            {...baseProps}
            type="number"
            min={min}
            max={max}
            step={step}
          />
        );

      default:
        return (
          <Input
            {...baseProps}
            type={type}
            min={min}
            max={max}
            step={step}
          />
        );
    }
  };

  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem className={cn('space-y-2', className)}>
          {type !== 'checkbox' && (
            <FormLabel className={cn(
              'text-sm font-medium leading-none',
              required && 'after:content-["*"] after:ml-0.5 after:text-red-500',
              fieldState.error && 'text-red-600'
            )}>
              {label}
            </FormLabel>
          )}
          
          <FormControl>
            {renderInput({ ...field, error: fieldState.error })}
          </FormControl>
          
          {description && (
            <FormDescription className="text-sm text-muted-foreground">
              {description}
            </FormDescription>
          )}
          
          <FormMessage className="text-sm text-red-600" />
        </FormItem>
      )}
    />
  );
}

/**
 * Standard form submit button with consistent styling and test ID
 */
interface StandardSubmitButtonProps {
  isLoading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
  disabled?: boolean;
  formName?: string;
  className?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
}

export function StandardSubmitButton({
  isLoading = false,
  loadingText = 'Submitting...',
  children,
  disabled = false,
  formName = 'form',
  className = '',
  variant = 'default',
}: StandardSubmitButtonProps) {
  const testId = FormQuality.generateTestId(formName, 'submit', 'button');

  return (
    <button
      type="submit"
      disabled={disabled || isLoading}
      data-testid={testId}
      className={cn(
        'inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md',
        'transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
        variant === 'default' && 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
        variant === 'destructive' && 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
        variant === 'outline' && 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-blue-500',
        (disabled || isLoading) && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {isLoading ? (
        <>
          <svg className="w-4 h-4 mr-2 animate-spin" viewBox="0 0 24 24">
            <circle 
              className="opacity-25" 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4"
              fill="none"
            />
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          {loadingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/**
 * Form section wrapper for organizing complex forms
 */
interface FormSectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export function FormSection({
  title,
  description,
  children,
  className = '',
  collapsible = false,
  defaultOpen = true,
}: FormSectionProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  const toggleSection = () => {
    if (collapsible) {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {title && (
        <div className="border-b border-gray-200 pb-2">
          <div 
            className={cn(
              'flex items-center justify-between',
              collapsible && 'cursor-pointer hover:text-blue-600'
            )}
            onClick={toggleSection}
          >
            <h3 className="text-lg font-medium text-gray-900">{title}</h3>
            {collapsible && (
              <svg 
                className={cn('w-5 h-5 transition-transform', isOpen && 'rotate-180')}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </div>
          {description && (
            <p className="mt-1 text-sm text-gray-600">{description}</p>
          )}
        </div>
      )}
      
      {(!collapsible || isOpen) && (
        <div className="space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}