import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Control, FieldPath, FieldValues } from 'react-hook-form';

/**
 *
 */
interface FormInputProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  'data-testid'?: string;
  description?: string;
  className?: string;
  step?: string;
  min?: string;
  max?: string;
}

/**
 * Reusable form input component with proper React Hook Form integration
 * Standardizes input patterns across forms.
 * @param root0
 * @param root0.control
 * @param root0.name
 * @param root0.label
 * @param root0.type
 * @param root0.placeholder
 * @param root0.required
 * @param root0.disabled
 * @param root0.'data-testid'
 * @param root0.description
 * @param root0.className
 * @param root0.step
 * @param root0.min
 * @param root0.max
 */
export function FormInput<T extends FieldValues>({
  control,
  name,
  label,
  type = 'text',
  placeholder,
  required = false,
  disabled = false,
  'data-testid': testId,
  description,
  className = '',
  step,
  min,
  max,
}: FormInputProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>
            {label}
            {required && <span className='text-red-500 ml-1'>*</span>}
          </FormLabel>
          <FormControl>
            <Input
              type={type}
              placeholder={placeholder}
              disabled={disabled}
              step={step}
              min={min}
              max={max}
              data-testid={testId}
              {...field}
            />
          </FormControl>
          {description && <div className='text-sm text-muted-foreground'>{description}</div>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export default FormInput;
