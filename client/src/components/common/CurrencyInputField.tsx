/**
 * Specialized currency input field component.
 * Extracted from repeated currency input patterns across forms.
 */
import { forwardRef } from 'react';
import { Control, FieldPath, FieldValues } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface CurrencyInputFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  placeholder?: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  min?: number;
  max?: number;
  step?: number;
  currency?: string;
  'data-testid'?: string;
}

/**
 * Standardized currency input field with proper validation and formatting.
 * Provides consistent currency input behavior across the application.
 */
export function CurrencyInputField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder = '0.00',
  description,
  required = false,
  disabled = false,
  className = '',
  min = 0.01,
  max = 999999.99,
  step = 0.01,
  currency = 'CAD',
  'data-testid': testId,
}: CurrencyInputFieldProps<T>) {
  const displayLabel = required ? `${label} *` : label;
  const defaultTestId = testId || `input-${String(name).replace(/\./g, '-')}`;

  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem className={cn('space-y-2', className)}>
          <FormLabel className={cn(
            'text-sm font-medium leading-none',
            fieldState.error && 'text-red-600 dark:text-red-400'
          )}>
            {displayLabel}
          </FormLabel>
          
          <FormControl>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">
                $
              </span>
              <Input
                {...field}
                type="number"
                min={min}
                max={max}
                step={step}
                placeholder={placeholder}
                disabled={disabled}
                data-testid={defaultTestId}
                className={cn(
                  'pl-7 transition-colors focus:ring-2 focus:ring-blue-500',
                  fieldState.error && 'border-red-500 focus:border-red-500',
                  'text-right' // Align currency values to the right
                )}
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">
                {currency}
              </span>
            </div>
          </FormControl>
          
          {description && (
            <FormDescription className="text-sm text-muted-foreground">
              {description}
            </FormDescription>
          )}
          
          <FormMessage className="text-sm text-red-600 dark:text-red-400" />
        </FormItem>
      )}
    />
  );
}