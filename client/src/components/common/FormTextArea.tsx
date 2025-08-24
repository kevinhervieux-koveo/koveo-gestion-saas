import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Control, FieldPath, FieldValues } from 'react-hook-form';

interface FormTextAreaProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  rows?: number;
  'data-testid'?: string;
  description?: string;
  className?: string;
  maxLength?: number;
}

/**
 * Reusable form textarea component with proper React Hook Form integration
 * Standardizes textarea patterns across forms
 */
export function FormTextArea<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  required = false,
  disabled = false,
  rows = 3,
  'data-testid': testId,
  description,
  className = '',
  maxLength,
}: FormTextAreaProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </FormLabel>
          <FormControl>
            <Textarea
              placeholder={placeholder}
              rows={rows}
              maxLength={maxLength}
              disabled={disabled}
              data-testid={testId}
              {...field}
            />
          </FormControl>
          {description && (
            <div className="text-sm text-muted-foreground">
              {description}
            </div>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export default FormTextArea;